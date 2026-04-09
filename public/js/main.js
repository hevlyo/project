import { SETTINGS, STORAGE_KEY, SESSION_STORAGE_KEY, JOIN_MESSAGES, DISCONNECT_MESSAGES, HUD_TIPS, clamp, isTimedStateActive, lerpAngle, normalizeNickname, randomItem, round, scoreToScale } from './client/config.js';
import { SceneController, THREE } from './client/scene.js';
import { createUIController } from './client/ui.js';

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
    this.ambienceStarted = false;
    this.ambientAudio = null;
    this.hasShownSessionInstructions = false;
    this.hasShownJoinToast = false;
  }

  init() {
    this.scene.init();
    this.ui.bindStart(() => this.handleStart());
    this.ui.setMenuStatus('Servidor quieto. Tu decide se isso continua assim.', 'idle');
    this.ui.setConnectionState(this.connectionText, this.connectionTone);
    this.ui.setHUDVisible(false);
    this.ui.setNickname(this.restoreNickname());
    this.sessionId = this.restoreSessionId();
    this.ui.focusNickname();

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

  bindWindowEvents() {
    window.addEventListener('resize', () => this.scene.resize());
    document.addEventListener('fullscreenchange', () => this.scene.resize());

    window.addEventListener('keydown', (event) => {
      const targetTag = event.target?.tagName;
      const typing = targetTag === 'INPUT' || targetTag === 'TEXTAREA';

      if (event.key.toLowerCase() === 'f' && !typing) {
        event.preventDefault();
        this.toggleFullscreen();
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

    window.addEventListener('keyup', (event) => {
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

    window.addEventListener('blur', () => {
      Object.keys(this.keys).forEach((key) => {
        this.keys[key] = false;
      });
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
      this.updateHud();
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
    if (this.ambienceStarted) return;

    this.ambienceStarted = true;
    this.ambientAudio = new Audio('/assets/background_sound.mp3');
    this.ambientAudio.loop = true;
    this.ambientAudio.volume = 0.08;
    this.ambientAudio.play().catch(() => {
      // Audio is optional.
    });
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

    if (hardSync || payload.id === this.localPlayerId) {
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
  }

  handleBallCollected(payload) {
    const ball = this.balls.get(payload.ballId);
    if (ball) {
      this.balls.delete(payload.ballId);
    }
    this.scene.removeBall(payload.ballId);

    if (payload.playerId === this.localPlayerId) {
      this.ui.hideToast();
      this.ui.showPickup(`+${payload.value}`);
      this.scene.spawnPickupBurst(payload.position, payload.color, this.simulationTimeMs);
    }
  }

  handlePlayerState(payload) {
    this.upsertPlayerFromServer(payload, { hardSync: true });

    if (payload?.id === this.localPlayerId) {
      this.updateHud();
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

    this.updateHud();
    this.syncScene();
    this.scene.render();

    if (payload.winner.id === this.localPlayerId) {
      this.ui.hideToast();
      this.ui.showToast(`Tu engoliu ${payload.loser.nickname}.`, 'live', 1800);
    } else if (payload.loser.id === this.localPlayerId) {
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
    this.balls.forEach((ball) => {
      if (ball.hidden && ball.pendingUntilMs <= this.simulationTimeMs) {
        ball.hidden = false;
        ball.pendingUntilMs = 0;
      }
    });

    this.updateRemotePlayers();

    const localPlayer = this.players.get(this.localPlayerId);
    if (localPlayer && this.mode === 'playing') {
      this.updateLocalPlayer(localPlayer, { allowNetwork });
      this.checkBallCollisions(localPlayer);
    }

    this.updateHud();
  }

  updateRemotePlayers() {
    this.players.forEach((player) => {
      if (player.id === this.localPlayerId) return;

      const delta = new THREE.Vector3().subVectors(player.targetPosition, player.position);
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

    const desiredVelocity = new THREE.Vector3();
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
    player.position.x = clamp(player.position.x, -this.worldSize, this.worldSize);
    player.position.z = clamp(player.position.z, -this.worldSize, this.worldSize);

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

  updateHud() {
    const localPlayer = this.players.get(this.localPlayerId);
    const activeBalls = [...this.balls.values()].filter((ball) => !ball.hidden).length;
    const statusLine = this.mode === 'playing'
      ? `${activeBalls} bolas vivas na arena.`
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

  toggleFullscreen() {
    const canvas = this.scene.getCanvasElement();
    if (!canvas) return;

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }

    canvas.requestFullscreen?.().catch(() => {});
  }
}

function getElements() {
  return {
    gameRoot: document.getElementById('game-root'),
    menuScreen: document.getElementById('menu-screen'),
    nicknameInput: document.getElementById('nickname-input'),
    playButton: document.getElementById('play-button'),
    menuStatus: document.getElementById('menu-status'),
    hud: document.getElementById('hud'),
    connectionBadge: document.getElementById('connection-badge'),
    scoreValue: document.getElementById('score-value'),
    playerCountValue: document.getElementById('player-count-value'),
    statusLine: document.getElementById('status-line'),
    hudTip: document.getElementById('hud-tip'),
    instructionsPanel: document.getElementById('instructions-panel'),
    leaderboard: document.getElementById('leaderboard'),
    killfeed: document.getElementById('killfeed'),
    statusChip: document.getElementById('status-chip'),
    toast: document.getElementById('message-toast'),
    pickupFlash: document.getElementById('pickup-flash'),
  };
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new GameApp(getElements());
  app.init();
  window.__pegaBolaApp = app;
});
