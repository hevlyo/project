import { SETTINGS, STORAGE_KEY, SESSION_STORAGE_KEY, JOIN_MESSAGES, DISCONNECT_MESSAGES, HUD_TIPS, clamp, isTimedStateActive, lerpAngle, normalizeNickname, randomItem, round, scoreToScale } from './client/config.js?v=20260409';
import { SceneController, THREE } from './client/scene.js?v=20260409';
import { createUIController } from './client/ui.js?v=20260409';

const MUSIC_VOLUME_STORAGE_KEY = 'pega-bola-music-volume';

class GameApp {
  constructor(elements) {
    this.elements = elements;
    this.ui = createUIController(elements);
    this.scene = new SceneController({
      container: elements.gameRoot,
      worldSize: SETTINGS.worldSize,
    });

    this.mode = 'menu';
    this.connectionTone = 'idle';
    this.connectionText = 'Arena em repouso';
    this.worldSize = SETTINGS.worldSize;
    this.socket = null;
    this.nickname = '';
    this.sessionId = '';
    this.localPlayerId = null;
    this.players = new Map();
    this.balls = new Map();
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
    };
    this.simulationTimeMs = 0;
    this.accumulatorMs = 0;
    this.animationHandle = 0;
    this.lastFrameAt = 0;
    this.cameraHeading = 0;
    this.lastSentMovementAt = 0;
    this.lastSentPosition = new THREE.Vector3();
    this.localWasMoving = false;
    this.awaitingBallSnapshot = false;
    this.visibleBallCount = 0;
    this.nextHudUpdateAt = 0;
    this.ambienceStarted = false;
    this.ambientAudio = null;
    this.ambientPlaylist = [];
    this.ambientTrackIndex = 0;
    this.ambientTrackPlayCount = 0;
    this.onAmbientEnded = null;
    this.musicVolume = this.restoreMusicVolume();
    this.lastNonZeroMusicVolume = this.musicVolume > 0 ? this.musicVolume : 0.08;
    this.hasShownSessionInstructions = false;
    this.hasShownJoinToast = false;
    this.destroyed = false;
    this.disposers = [];
    this.remoteDelta = new THREE.Vector3();
    this.desiredVelocity = new THREE.Vector3();
  }

  init() {
    this.scene.init();
    this.ui.bindStart(() => this.handleStart());
    this.ui.setMenuStatus('Servidor quieto. Tu decide se isso continua assim.', 'idle');
    this.ui.setConnectionState(this.connectionText, this.connectionTone);
    this.ui.setHUDVisible(false);
    this.ui.setNickname(this.restoreNickname());
    this.ui.setMusicVolume(this.musicVolume);
    this.ui.setMusicMuted(this.musicVolume === 0);
    this.ui.bindMusicVolumeChange((volume) => this.setMusicVolume(volume));
    this.ui.bindMusicMuteToggle(() => this.toggleMusicMuted());
    this.sessionId = this.restoreSessionId();
    this.ui.focusNickname();

    this.bindMenuAmbienceWarmup();

    this.bindWindowEvents();
    this.exposeTestingHooks();
    this.startLoop();
  }

  restoreNickname() {
    try {
      return sessionStorage.getItem(STORAGE_KEY) || 'Kemell Pinto';
    } catch {
      return 'Kemell Pinto';
    }
  }

  persistNickname(value) {
    try {
      sessionStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Ignore storage failures in private contexts.
    }
  }

  restoreSessionId() {
    const fallback = window.crypto?.randomUUID?.()
      || `pb-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    try {
      const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (existing) {
        return existing;
      }
      sessionStorage.setItem(SESSION_STORAGE_KEY, fallback);
    } catch {
      return fallback;
    }

    return fallback;
  }

  restoreMusicVolume() {
    try {
      const stored = localStorage.getItem(MUSIC_VOLUME_STORAGE_KEY);
      if (!stored) return 0.08;

      const parsed = Number(stored);
      if (!Number.isFinite(parsed)) return 0.08;
      return clamp(parsed, 0, 1);
    } catch {
      return 0.08;
    }
  }

  persistMusicVolume(value) {
    try {
      localStorage.setItem(MUSIC_VOLUME_STORAGE_KEY, String(value));
    } catch {
      // Ignore storage failures in private contexts.
    }
  }

  setMusicVolume(value) {
    const safeVolume = clamp(Number(value) || 0, 0, 1);
    this.musicVolume = safeVolume;
    this.persistMusicVolume(safeVolume);
    if (safeVolume > 0) {
      this.lastNonZeroMusicVolume = safeVolume;
    }

    this.ui.setMusicVolume(safeVolume);
    this.ui.setMusicMuted(safeVolume === 0);

    if (this.ambientAudio) {
      this.ambientAudio.volume = safeVolume;
    }
  }

  toggleMusicMuted() {
    if (this.musicVolume === 0) {
      const restored = this.lastNonZeroMusicVolume > 0 ? this.lastNonZeroMusicVolume : 0.08;
      this.setMusicVolume(restored);
      return;
    }

    this.setMusicVolume(0);
  }

  bindMenuAmbienceWarmup() {
    const attemptStart = () => {
      this.startAmbience();
    };

    this.bindEvent(window, 'pointerdown', attemptStart, { passive: true });
    this.bindEvent(window, 'keydown', (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      attemptStart();
    });
  }

  bindWindowEvents() {
    this.bindEvent(window, 'resize', () => this.scene.resize());
    this.bindEvent(document, 'fullscreenchange', () => this.scene.resize());
    this.bindEvent(document, 'visibilitychange', () => {
      if (document.hidden) {
        this.resetInputState();
      }
    });
    this.bindEvent(window, 'blur', () => {
      this.resetInputState();
    });
    this.bindEvent(document, 'contextmenu', (event) => {
      event.preventDefault();
      this.resetInputState();
    });
    this.bindEvent(window, 'pointerdown', (event) => {
      if (event.button === 2) {
        event.preventDefault();
        this.resetInputState();
      }
    });
    this.bindEvent(window, 'keydown', (event) => {
      const target = event.target;
      const targetTag = target?.tagName;
      const typing = targetTag === 'INPUT'
        || targetTag === 'TEXTAREA'
        || target?.isContentEditable === true;
      const hasModifier = event.ctrlKey || event.metaKey || event.altKey;

      if (event.key.toLowerCase() === 'f' && !typing) {
        event.preventDefault();
        this.toggleFullscreen();
        return;
      }

      if (typing || hasModifier) {
        return;
      }

      switch (event.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          this.keys.forward = true;
          event.preventDefault();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          this.keys.backward = true;
          event.preventDefault();
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          this.keys.left = true;
          event.preventDefault();
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          this.keys.right = true;
          event.preventDefault();
          break;
        case 'Shift':
          this.keys.sprint = true;
          event.preventDefault();
          break;
        default:
          break;
      }
    });

    this.bindEvent(window, 'keyup', (event) => {
      switch (event.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          this.keys.forward = false;
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          this.keys.backward = false;
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          this.keys.left = false;
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          this.keys.right = false;
          break;
        case 'Shift':
          this.keys.sprint = false;
          break;
        default:
          break;
      }
    });
  }

  bindEvent(target, eventName, handler, options) {
    target.addEventListener(eventName, handler, options);
    this.disposers.push(() => {
      target.removeEventListener(eventName, handler, options);
    });
  }

  resetInputState() {
    Object.keys(this.keys).forEach((key) => {
      this.keys[key] = false;
    });
  }

  handleStart() {
    this.nickname = normalizeNickname(this.ui.getNickname());
    this.persistNickname(this.nickname);
    this.ui.setNickname(this.nickname);
    this.ui.setMenuBusy(true, 'Esquentando o caldeirão...');
    this.ui.setMenuStatus('Chamando o servidor para a baixaria.', 'warm');
    this.setConnectionState('Conectando', 'warm');
    this.mode = 'connecting';
    this.awaitingBallSnapshot = true;
    this.cameraHeading = 0;
    this.hasShownSessionInstructions = false;
    this.hasShownJoinToast = false;

    if (!this.socket) {
      this.createSocket();
    }

    if (!this.socket) {
      this.ui.setMenuBusy(false);
      this.ui.setMenuStatus('Socket.IO sumiu. Sem isso, só sobra o pasto.', 'danger');
      return;
    }

    this.startAmbience();

    if (this.socket.connected) {
      this.joinGame();
    } else {
      this.socket.connect();
    }
  }

  createSocket() {
    if (typeof window.io !== 'function') {
      this.ui.showToast('Socket.IO não carregou. Sem fio, sem glória.', 'danger', 3200);
      return;
    }

    this.socket = window.io({
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1500,
    });

    this.socket.on('connect', () => {
      this.setConnectionState('Conexão viva', 'live');
      this.joinGame();
    });

    this.socket.on('disconnect', (reason) => {
      this.mode = this.mode === 'menu' ? 'menu' : 'reconnecting';
      this.setConnectionState('Reconectando', 'warning');
      this.ui.setMenuStatus(randomItem(DISCONNECT_MESSAGES), 'warning');
      this.ui.showToast(`Conexão caiu: ${reason}`, 'warning', 2400);
    });

    this.socket.on('error', (payload) => {
      if (payload?.message) {
        this.ui.showToast(payload.message, 'danger', 2400);
      }
    });

    this.socket.on('worldInfo', (payload) => {
      this.worldSize = payload.worldSize || SETTINGS.worldSize;
      this.scene.setWorldSize(this.worldSize);
    });

    this.socket.on('playerInfo', (payload) => {
      this.localPlayerId = payload.id;
      this.upsertPlayerFromServer(payload, { hardSync: true });
      this.mode = 'playing';
      this.setConnectionState('Arena ao vivo', 'live');
      this.ui.hideMenu();
      this.ui.setMenuBusy(false, 'Entrar na pocilga');
      this.ui.setHUDVisible(true);
      if (!this.hasShownSessionInstructions) {
        this.ui.showSessionInstructions(randomItem(HUD_TIPS), 10000);
        this.hasShownSessionInstructions = true;
      }
      if (!this.hasShownJoinToast) {
        this.ui.showToast(randomItem(JOIN_MESSAGES), 'live', 2200);
        this.hasShownJoinToast = true;
      }
    });

    this.socket.on('currentPlayers', (snapshot) => {
      this.syncPlayers(snapshot);
    });

    this.socket.on('newPlayer', (payload) => {
      this.upsertPlayerFromServer(payload, { hardSync: true });
      this.ui.showToast(`${payload.nickname} apareceu para tumultuar.`, 'info', 1800);
    });

    this.socket.on('playerState', (payload) => {
      this.handlePlayerState(payload);
    });

    this.socket.on('playerDisconnected', (playerId) => {
      this.removePlayer(playerId);
    });

    this.socket.on('playerMoved', (payload) => {
      const player = this.players.get(payload.id);
      if (!player || payload.id === this.localPlayerId) return;

      player.targetPosition.set(payload.position.x, 0, payload.position.z);
    });

    this.socket.on('newBalls', (payload) => {
      this.syncBalls(payload, { replaceAll: this.awaitingBallSnapshot });
      this.awaitingBallSnapshot = false;
    });

    this.socket.on('ballCollected', (payload) => {
      this.handleBallCollected(payload);
    });

    this.socket.on('playerConsumed', (payload) => {
      this.handlePlayerConsumed(payload);
    });

    this.socket.on('updateScores', (scores) => {
      Object.entries(scores).forEach(([playerId, score]) => {
        const player = this.players.get(playerId);
        if (!player) return;
        player.score = score;
        player.sizeMultiplier = scoreToScale(score);
      });
    });

    this.socket.on('playerCount', () => {
      this.updateHud({ force: true });
    });

    if (this.socket.io) {
      this.socket.io.on('reconnect_attempt', (attempt) => {
        this.setConnectionState(`Reconectando ${attempt}`, 'warning');
      });

      this.socket.io.on('reconnect_failed', () => {
        this.mode = 'menu';
        this.ui.showMenu();
        this.ui.setMenuBusy(false, 'Tentar de novo');
        this.ui.setMenuStatus('O servidor fugiu da briga. Tenta chamar de novo.', 'danger');
        this.setConnectionState('Sem conexão', 'danger');
      });
    }
  }

  joinGame() {
    if (!this.socket?.connected) return;

    this.awaitingBallSnapshot = true;
    this.socket.emit('joinGame', {
      nickname: this.nickname,
      sessionId: this.sessionId,
    });
  }

  startAmbience() {
    if (!this.ambientAudio) {
      const playlist = this.buildShuffledAmbientPlaylist();
      if (!playlist.length) return;

      this.ambienceStarted = true;
      this.ambientPlaylist = playlist;
      this.ambientTrackIndex = 0;
      this.ambientTrackPlayCount = 1;

      this.ambientAudio = new Audio(this.ambientPlaylist[this.ambientTrackIndex]);
      this.ambientAudio.loop = false;

      this.onAmbientEnded = () => {
        this.handleAmbientTrackEnded();
      };
      this.ambientAudio.addEventListener('ended', this.onAmbientEnded);
    }

    this.ambientAudio.volume = this.musicVolume;
    this.ambientAudio.play().catch(() => {
      // Browsers can block autoplay until user gesture; later interactions retry.
    });
  }

  buildShuffledAmbientPlaylist() {
    const fileNames = [
      '01. Battle Suit Aces.mp3',
      '02. Peaceful Times.mp3',
      '03. Cosmic Rendezvous.mp3',
      '04. Pholians.mp3',
      '05. Under Attack.mp3',
      '06. To the Battle Line!.mp3',
      '07. Defeat.mp3',
      '08. Space Station.mp3',
      '09. USS Zephyr.mp3',
      '10. Mission Complete!.mp3',
      '11. SIM Chamber.mp3',
      '12. Wilderness.mp3',
      '13. Distant Settlement.mp3',
      '14. Suitsmiths.mp3',
      "15. A Captain's Speech.mp3",
      '16. Metropolis.mp3',
      "17. Hunter's Guild.mp3",
      '18. Spring in Our Step.mp3',
      '19. Unknown Truth.mp3',
      "20. You're Not Alone.mp3",
      '21. Crisis!.mp3',
      '22. Conspiracy.mp3',
      '23. Carrion Riders.mp3',
      '24. Quiet on the Ship.mp3',
      '25. Bounty Board.mp3',
      '26. Suit Gala.mp3',
      '27. Frenzied Swarm.mp3',
      '28. Steadfast.mp3',
      '29. Raring to Go!.mp3',
      '30. Starball Match.mp3',
      '31. Growing Pride.mp3',
      '32. Shady Dealings.mp3',
      '33. Typhoons.mp3',
      '34. Patchworks.mp3',
      '35. Suit Up!.mp3',
      '36. Our Precious Days Together.mp3',
      '37. Enigmas.mp3',
      '38. Blooming Love.mp3',
      '39. Skiads.mp3',
      '40. Grey Wraith.mp3',
      '41. The Summoning.mp3',
      '42. The Sun Eater.mp3',
      '43. Burning Memory.mp3',
    ];

    const trackUrls = fileNames.map((fileName) => `/assets/background_sound/${encodeURIComponent(fileName)}`);
    return this.shufflePlaylist(trackUrls);
  }

  shufflePlaylist(items) {
    const shuffled = items.slice();
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  playNextAmbientTrack() {
    if (!this.ambientAudio || this.ambientPlaylist.length === 0) return;

    this.ambientTrackIndex += 1;
    if (this.ambientTrackIndex >= this.ambientPlaylist.length) {
      this.ambientPlaylist = this.shufflePlaylist(this.ambientPlaylist);
      this.ambientTrackIndex = 0;
    }

    this.ambientAudio.src = this.ambientPlaylist[this.ambientTrackIndex];
    this.ambientAudio.currentTime = 0;
    this.ambientTrackPlayCount = 1;
    this.ambientAudio.play().catch(() => {
      // Audio is optional.
    });
  }

  handleAmbientTrackEnded() {
    if (!this.ambientAudio || this.ambientPlaylist.length === 0) return;

    if (this.ambientTrackPlayCount < 2) {
      this.ambientTrackPlayCount += 1;
      this.ambientAudio.currentTime = 0;
      this.ambientAudio.play().catch(() => {
        // Audio is optional.
      });
      return;
    }

    this.playNextAmbientTrack();
  }

  setConnectionState(text, tone) {
    this.connectionText = text;
    this.connectionTone = tone;
    this.ui.setConnectionState(text, tone);
  }

  makePlayerState(payload) {
    const position = new THREE.Vector3(payload.position.x, 0, payload.position.z);

    return {
      id: payload.id,
      nickname: payload.nickname,
      color: payload.color,
      score: payload.score || 0,
      sizeMultiplier: scoreToScale(payload.score || 0),
      invulnerableUntil: payload.invulnerableUntil || 0,
      speedBoostUntil: payload.speedBoostUntil || 0,
      position,
      targetPosition: position.clone(),
      velocity: new THREE.Vector3(),
      rotationY: 0,
      bobPhase: 0,
      bobOffset: 0,
      tilt: 0,
    };
  }

  upsertPlayerFromServer(payload, { hardSync = false } = {}) {
    let player = this.players.get(payload.id);
    if (!player) {
      player = this.makePlayerState(payload);
      this.players.set(payload.id, player);
    }

    player.nickname = payload.nickname;
    player.color = payload.color;
    player.score = payload.score || 0;
    player.sizeMultiplier = scoreToScale(player.score);
    player.invulnerableUntil = payload.invulnerableUntil || 0;
    player.speedBoostUntil = payload.speedBoostUntil || 0;

    if (hardSync) {
      player.position.set(payload.position.x, 0, payload.position.z);
      player.velocity.set(0, 0, 0);
      player.bobOffset = 0;
      player.tilt = 0;
    }

    player.targetPosition.set(payload.position.x, 0, payload.position.z);
  }

  syncPlayers(snapshot) {
    const serverIds = new Set(Object.keys(snapshot));

    [...this.players.keys()].forEach((playerId) => {
      if (!serverIds.has(playerId)) {
        this.removePlayer(playerId);
      }
    });

    Object.values(snapshot).forEach((payload) => {
      this.upsertPlayerFromServer(payload, { hardSync: true });
    });
  }

  makeBallState(payload) {
    return {
      id: payload.id,
      type: payload.type,
      value: payload.value,
      color: payload.color,
      position: new THREE.Vector3(payload.position.x, 0, payload.position.z),
      hidden: false,
      pendingUntilMs: 0,
    };
  }

  syncBalls(payloads, { replaceAll = false } = {}) {
    if (replaceAll) {
      const ids = new Set(payloads.map((ball) => ball.id));
      [...this.balls.keys()].forEach((ballId) => {
        if (!ids.has(ballId)) {
          this.balls.delete(ballId);
          this.scene.removeBall(ballId);
        }
      });
    }

    payloads.forEach((payload) => {
      const existing = this.balls.get(payload.id) || this.makeBallState(payload);
      existing.type = payload.type;
      existing.value = payload.value;
      existing.color = payload.color;
      existing.position.set(payload.position.x, 0, payload.position.z);
      existing.hidden = false;
      existing.pendingUntilMs = 0;
      this.balls.set(payload.id, existing);
    });

    this.refreshVisibleBallCount();
  }

  handleBallCollected(payload) {
    const ball = this.balls.get(payload.ballId);
    if (ball) {
      if (!ball.hidden) {
        this.visibleBallCount = Math.max(0, this.visibleBallCount - 1);
      }
      this.balls.delete(payload.ballId);
    }
    this.scene.removeBall(payload.ballId);

    if (payload.playerId === this.localPlayerId) {
      this.ui.hideToast();
      this.ui.showPickup(`+${payload.value}`);
      const localScale = this.players.get(this.localPlayerId)?.sizeMultiplier || 1;
      this.scene.triggerPickupCameraBoost(payload.value, localScale);
      this.scene.spawnPickupBurst(payload.position, payload.color, this.simulationTimeMs);
    }
  }

  handlePlayerState(payload) {
    const hardSync = payload?.syncMode === 'corrected';
    this.upsertPlayerFromServer(payload, { hardSync });

    if (payload?.id === this.localPlayerId) {
      this.updateHud({ force: true });
      this.syncScene();
      this.scene.render();
    }
  }

  handlePlayerConsumed(payload) {
    if (!payload?.winner || !payload?.loser) return;

    this.upsertPlayerFromServer(payload.winner, { hardSync: true });
    this.upsertPlayerFromServer(payload.loser, { hardSync: true });

    const loserPlayer = this.players.get(payload.loser.id);
    if (loserPlayer) {
      loserPlayer.velocity.set(0, 0, 0);
    }

    this.scene.spawnConsumeBurst(
      payload.consumedPosition || payload.winner.position,
      payload.winner.color,
      this.simulationTimeMs,
    );
    this.scene.spawnRespawnBurst(payload.loser.position, payload.loser.color, this.simulationTimeMs);

    this.ui.showKillfeed(
      `${payload.winner.nickname} engoliu ${payload.loser.nickname}`,
      payload.winner.id === this.localPlayerId ? 'live' : 'warning',
    );

    this.updateHud({ force: true });
    this.syncScene();
    this.scene.render();

    if (payload.winner.id === this.localPlayerId) {
      this.ui.hideToast();
      this.ui.showToast(`Tu engoliu ${payload.loser.nickname}.`, 'live', 1800);
    } else if (payload.loser.id === this.localPlayerId) {
      this.resetInputState();
      this.ui.hideToast();
      this.ui.showToast(`${payload.winner.nickname} te engoliu. Respawnando...`, 'danger', 2200);
    }
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    this.scene.removePlayer(playerId);

    if (playerId === this.localPlayerId && this.mode !== 'menu') {
      this.localPlayerId = null;
    }
  }

  startLoop() {
    if (this.animationHandle) return;

    const tick = (timestamp) => {
      if (this.destroyed) {
        this.animationHandle = 0;
        return;
      }
      if (!this.lastFrameAt) {
        this.lastFrameAt = timestamp;
      }

      const delta = Math.min(100, timestamp - this.lastFrameAt);
      this.lastFrameAt = timestamp;
      this.advanceSimulation(delta, { allowNetwork: true });
      this.animationHandle = window.requestAnimationFrame(tick);
    };

    this.animationHandle = window.requestAnimationFrame(tick);
  }

  advanceSimulation(ms, { allowNetwork } = { allowNetwork: true }) {
    this.accumulatorMs += ms;

    while (this.accumulatorMs >= SETTINGS.frameMs) {
      this.stepFixed({ allowNetwork });
      this.accumulatorMs -= SETTINGS.frameMs;
      this.simulationTimeMs += SETTINGS.frameMs;
    }

    this.syncScene();
    this.scene.step(this.simulationTimeMs);
    this.scene.render();
  }

  stepFixed({ allowNetwork }) {
    let becameVisible = 0;

    this.balls.forEach((ball) => {
      if (ball.hidden && ball.pendingUntilMs <= this.simulationTimeMs) {
        ball.hidden = false;
        ball.pendingUntilMs = 0;
        becameVisible += 1;
      }
    });

    if (becameVisible) {
      this.visibleBallCount += becameVisible;
    }

    this.updateRemotePlayers();

    const localPlayer = this.players.get(this.localPlayerId);
    if (localPlayer && this.mode === 'playing') {
      this.updateLocalPlayer(localPlayer, { allowNetwork });
      this.checkBallCollisions(localPlayer);
    }

    this.updateHud();
  }

  refreshVisibleBallCount() {
    let count = 0;
    this.balls.forEach((ball) => {
      if (!ball.hidden) {
        count += 1;
      }
    });
    this.visibleBallCount = count;
  }

  updateRemotePlayers() {
    this.players.forEach((player) => {
      if (player.id === this.localPlayerId) return;

      const delta = this.remoteDelta.subVectors(player.targetPosition, player.position);
      if (delta.lengthSq() > 0.000001) {
        player.position.lerp(player.targetPosition, SETTINGS.interpolationSpeed);
        player.rotationY = lerpAngle(
          player.rotationY,
          Math.atan2(delta.x, delta.z),
          SETTINGS.interpolationSpeed,
        );
        player.bobPhase += 0.12;
        player.bobOffset = Math.sin(player.bobPhase) * 0.04;
        player.tilt = Math.min(0.12, delta.length() * 0.15);
      } else {
        player.bobOffset *= 0.85;
        player.tilt *= 0.8;
      }
    });
  }

  updateLocalPlayer(player, { allowNetwork }) {
    const inputX = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    const inputZ = (this.keys.forward ? 1 : 0) - (this.keys.backward ? 1 : 0);
    const hasInput = Math.abs(inputX) > 0 || Math.abs(inputZ) > 0;
    const boosted = isTimedStateActive(player.speedBoostUntil);
    let speed = this.keys.sprint ? SETTINGS.moveSpeed * SETTINGS.sprintMultiplier : SETTINGS.moveSpeed;
    if (boosted) {
      speed *= SETTINGS.speedBoostMultiplier;
    }

    const desiredVelocity = this.desiredVelocity.set(0, 0, 0);
    if (hasInput) {
      const length = Math.hypot(inputX, inputZ) || 1;
      const localX = inputX / length;
      const localZ = inputZ / length;
      const forwardX = Math.sin(this.cameraHeading);
      const forwardZ = Math.cos(this.cameraHeading);
      const rightX = -forwardZ;
      const rightZ = forwardX;

      desiredVelocity.set(
        (localX * rightX) + (localZ * forwardX),
        0,
        (localX * rightZ) + (localZ * forwardZ),
      ).multiplyScalar(speed);
    }

    player.velocity.lerp(desiredVelocity, hasInput ? SETTINGS.acceleration : SETTINGS.deceleration);
    if (!hasInput && player.velocity.lengthSq() < SETTINGS.inputDeadZone) {
      player.velocity.set(0, 0, 0);
    }

    const previousX = player.position.x;
    const previousZ = player.position.z;
    player.position.add(player.velocity);
    this.clampPlayerToArena(player);

    const isMoving = player.velocity.lengthSq() > 0.0002;
    if (isMoving) {
      const movementAngle = Math.atan2(player.velocity.x, player.velocity.z);
      player.rotationY = lerpAngle(player.rotationY, movementAngle, 0.24);
      player.bobPhase += player.velocity.length() * 1.45;
      player.bobOffset = Math.sin(player.bobPhase) * 0.08;
      player.tilt = Math.min(0.2, player.velocity.length() * 0.35);
    } else {
      player.bobOffset *= 0.72;
      player.tilt *= 0.75;
    }

    if (!allowNetwork || !this.socket?.connected) {
      return;
    }

    const moved = Math.abs(previousX - player.position.x) > 0.0005 || Math.abs(previousZ - player.position.z) > 0.0005;
    const sinceLastSend = performance.now() - this.lastSentMovementAt;

    if (moved && (sinceLastSend > 45 || (!isMoving && this.localWasMoving))) {
      this.socket.emit('playerMovement', {
        position: {
          x: round(player.position.x, 3),
          y: 0,
          z: round(player.position.z, 3),
        },
      });
      this.lastSentMovementAt = performance.now();
      this.lastSentPosition.copy(player.position);
    }

    this.localWasMoving = isMoving;
  }

  checkBallCollisions(localPlayer) {
    if (!this.socket?.connected) return;

    const collectionRadius = SETTINGS.collectionDistance + ((localPlayer.sizeMultiplier - 1) * 0.3);

    this.balls.forEach((ball) => {
      if (ball.hidden) return;

      const distance = localPlayer.position.distanceTo(ball.position);
      if (distance > collectionRadius) return;

      ball.hidden = true;
      ball.pendingUntilMs = this.simulationTimeMs + 5000;
      this.visibleBallCount = Math.max(0, this.visibleBallCount - 1);

      this.socket.emit('collectBall', {
        ballId: ball.id,
      });
    });
  }

  syncScene() {
    this.players.forEach((player) => {
      this.scene.upsertPlayer(player, {
        isLocal: player.id === this.localPlayerId,
      });
    });

    this.balls.forEach((ball) => {
      this.scene.upsertBall(ball);
    });

    const localPlayer = this.players.get(this.localPlayerId);
    if (localPlayer && this.mode !== 'menu') {
      this.scene.updateCamera(localPlayer, this.cameraHeading);
    } else {
      this.scene.updateIdleCamera(this.simulationTimeMs);
    }
  }

  getLeaderboard() {
    return [...this.players.values()]
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return left.nickname.localeCompare(right.nickname);
      })
      .slice(0, 3)
      .map((player) => ({
        id: player.id,
        nickname: player.nickname,
        score: player.score,
      }));
  }

  updateHud({ force = false } = {}) {
    if (!force && this.simulationTimeMs < this.nextHudUpdateAt) {
      return;
    }
    this.nextHudUpdateAt = this.simulationTimeMs + SETTINGS.hudUpdateIntervalMs;

    const localPlayer = this.players.get(this.localPlayerId);
    const statusLine = this.mode === 'playing'
      ? `${this.visibleBallCount} bolas vivas na arena.`
      : this.mode === 'reconnecting'
        ? 'Segura a bronca. Estou tentando religar o circo.'
        : 'Arena em banho-maria.';
    const statusChip = this.getStatusChipState(localPlayer);

    this.ui.updateHUD({
      score: localPlayer?.score || 0,
      playerCount: this.players.size,
      leaderboard: this.getLeaderboard(),
      localPlayerId: this.localPlayerId,
      statusLine,
      statusChip,
    });
  }

  getStatusChipState(localPlayer) {
    if (!localPlayer) return null;

    const now = Date.now();
    if (isTimedStateActive(localPlayer.invulnerableUntil, now)) {
      return {
        label: `Protegido ${Math.max(1, Math.ceil((localPlayer.invulnerableUntil - now) / 1000))}s`,
        tone: 'live',
      };
    }

    if (isTimedStateActive(localPlayer.speedBoostUntil, now)) {
      return {
        label: `Turbo ${Math.max(1, Math.ceil((localPlayer.speedBoostUntil - now) / 1000))}s`,
        tone: 'warning',
      };
    }

    return null;
  }

  getArenaLimitForScale(scale = 1) {
    const radius = SETTINGS.playerRadius * scale;
    return Math.max(0, this.worldSize - radius - SETTINGS.arenaWallPadding);
  }

  clampPlayerToArena(player) {
    const limit = this.getArenaLimitForScale(player.sizeMultiplier || 1);
    player.position.x = clamp(player.position.x, -limit, limit);
    player.position.z = clamp(player.position.z, -limit, limit);
  }

  buildTextState() {
    const localPlayer = this.players.get(this.localPlayerId);
    const leaderboard = this.getLeaderboard();

    const visibleBalls = [...this.balls.values()]
      .filter((ball) => !ball.hidden)
      .sort((left, right) => {
        if (!localPlayer) return left.id.localeCompare(right.id);
        return localPlayer.position.distanceTo(left.position) - localPlayer.position.distanceTo(right.position);
      })
      .map((ball) => ({
        id: ball.id,
        type: ball.type,
        value: ball.value,
        x: round(ball.position.x),
        y: 0,
        z: round(ball.position.z),
      }));

    return {
      mode: this.mode,
      connection: {
        label: this.connectionText,
        tone: this.connectionTone,
      },
      coordinates: 'origin=center, +x=right/east, +z=down/south from default menu view, +y=up',
      localPlayer: localPlayer
        ? {
            id: localPlayer.id,
            nickname: localPlayer.nickname,
            x: round(localPlayer.position.x),
            y: 0,
            z: round(localPlayer.position.z),
            score: localPlayer.score,
            sizeMultiplier: round(localPlayer.sizeMultiplier),
            invulnerableUntil: isTimedStateActive(localPlayer.invulnerableUntil)
              ? localPlayer.invulnerableUntil
              : null,
            speedBoostUntil: isTimedStateActive(localPlayer.speedBoostUntil)
              ? localPlayer.speedBoostUntil
              : null,
            moving: localPlayer.velocity.lengthSq() > 0.0002,
          }
        : null,
      playerCount: this.players.size,
      leaderboard,
      visibleBalls,
    };
  }

  exposeTestingHooks() {
    window.render_game_to_text = () => JSON.stringify(this.buildTextState());
    window.advanceTime = async (ms) => {
      this.advanceSimulation(ms, { allowNetwork: true });
    };
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.resetInputState();

    if (this.animationHandle) {
      window.cancelAnimationFrame(this.animationHandle);
      this.animationHandle = 0;
    }

    this.disposers.forEach((dispose) => dispose());
    this.disposers = [];

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    if (this.ambientAudio) {
      if (this.onAmbientEnded) {
        this.ambientAudio.removeEventListener('ended', this.onAmbientEnded);
      }
      this.ambientAudio.pause();
      this.ambientAudio.src = '';
      this.ambientAudio.load();
      this.ambientAudio = null;
      this.onAmbientEnded = null;
      this.ambientPlaylist = [];
      this.ambientTrackIndex = 0;
      this.ambientTrackPlayCount = 0;
      this.ambienceStarted = false;
    }

    this.ui.destroy?.();
    this.scene.dispose?.();
    delete window.render_game_to_text;
    delete window.advanceTime;
    delete window.__pegaBolaApp;
  }

  toggleFullscreen() {
    const appShell = this.elements.appShell;
    if (!appShell) return;

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }

    appShell.requestFullscreen?.().catch(() => {});
  }
}

function getElements() {
  return {
    appShell: document.getElementById('app-shell'),
    gameRoot: document.getElementById('game-root'),
    menuScreen: document.getElementById('menu-screen'),
    nicknameInput: document.getElementById('nickname-input'),
    musicVolumeInput: document.getElementById('music-volume-input'),
    musicVolumeValue: document.getElementById('music-volume-value'),
    musicMuteButton: document.getElementById('music-mute-button'),
    playButton: document.getElementById('play-button'),
    menuStatus: document.getElementById('menu-status'),
    hud: document.getElementById('hud'),
    scoreValue: document.getElementById('score-value'),
    playerCountValue: document.getElementById('player-count-value'),
    statusLine: document.getElementById('status-line'),
    hudTip: document.getElementById('hud-tip'),
    instructionsPanel: document.getElementById('instructions-panel'),
    leaderboard: document.getElementById('leaderboard'),
    statusChip: document.getElementById('status-chip'),
    toast: document.getElementById('message-toast'),
    pickupFlash: document.getElementById('pickup-flash'),
  };
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new GameApp(getElements());
  app.init();
  window.__pegaBolaApp = app;
  window.addEventListener('pagehide', () => app.destroy(), { once: true });
});
