import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

import { SETTINGS } from './config.js';

function createTextTexture(label, accent) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = 512;
  canvas.height = 128;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(8, 16, 20, 0.72)';
  context.strokeStyle = accent;
  context.lineWidth = 6;
  context.beginPath();
  if (typeof context.roundRect === 'function') {
    context.roundRect(18, 18, canvas.width - 36, canvas.height - 36, 26);
  } else {
    context.rect(18, 18, canvas.width - 36, canvas.height - 36);
  }
  context.fill();
  context.stroke();

  context.font = '700 42px "IBM Plex Mono", monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#fff7dd';
  context.fillText(label, canvas.width / 2, canvas.height / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function disposeMaterial(material) {
  if (!material) return;
  if (Array.isArray(material)) {
    material.forEach(disposeMaterial);
    return;
  }
  if (material.map) {
    material.map.dispose();
  }
  material.dispose();
}

export class SceneController {
  constructor({ container, worldSize }) {
    this.container = container;
    this.worldSize = worldSize;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.floor = null;
    this.innerDisk = null;
    this.brassRing = null;
    this.boundaryRing = null;
    this.grid = null;
    this.posts = [];
    this.playerMeshes = new Map();
    this.ballMeshes = new Map();
    this.pickupBursts = [];
    this.cameraLookTarget = new THREE.Vector3(0, 1.2, 0);
    this.cameraTrackedPlayerId = null;
    this.cameraCurrentFov = SETTINGS.cameraBaseFov;
    this.cameraCurrentDistance = SETTINGS.cameraDistance;
    this.cameraCurrentHeight = SETTINGS.cameraHeight;
    this.cameraCurrentLookHeight = SETTINGS.cameraLookHeight;
    this.cameraPickupDistanceBoost = 0;
    this.cameraPickupHeightBoost = 0;
    this.cameraPickupFovBoost = 0;
    this.cameraPickupDistanceBoostTarget = 0;
    this.cameraPickupHeightBoostTarget = 0;
    this.cameraPickupFovBoostTarget = 0;
    this.cameraDesiredPosition = new THREE.Vector3();
    this.cameraDesiredLookAt = new THREE.Vector3();
    this.idleCameraPosition = new THREE.Vector3();
    this.idleCameraLookAt = new THREE.Vector3(0, 1.8, 0);
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x95b7ba);
    this.scene.fog = new THREE.Fog(0x95b7ba, this.worldSize * 0.95, this.worldSize * 2.8);

    this.camera = new THREE.PerspectiveCamera(SETTINGS.cameraBaseFov, 1, 0.1, 500);
    this.camera.position.set(0, SETTINGS.cameraHeight, SETTINGS.cameraDistance);

    this.renderer = new THREE.WebGLRenderer({
      antialias: SETTINGS.renderAntialias,
      powerPreference: SETTINGS.renderPowerPreference,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, SETTINGS.renderPixelRatioCap));
    this.renderer.shadowMap.enabled = SETTINGS.renderShadows;
    if (SETTINGS.renderShadows) {
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    this.container.appendChild(this.renderer.domElement);

    // Chamar resize ANTES de criar luzes e arena para garantir que o renderer tem tamanho válido
    this.resize();

    this.createLights();
    this.createArena();
  }

  createLights() {
    const hemi = new THREE.HemisphereLight(0xf7e8c5, 0x0f2a32, 1.15);
    this.scene.add(hemi);

    const directional = new THREE.DirectionalLight(0xfff0be, 1.55);
    directional.position.set(18, 28, 12);
    directional.castShadow = SETTINGS.renderShadows;
    if (SETTINGS.renderShadows) {
      directional.shadow.mapSize.width = SETTINGS.renderShadowMapSize;
      directional.shadow.mapSize.height = SETTINGS.renderShadowMapSize;
      directional.shadow.camera.left = -80;
      directional.shadow.camera.right = 80;
      directional.shadow.camera.top = 80;
      directional.shadow.camera.bottom = -80;
      directional.shadow.camera.far = 120;
    }
    this.scene.add(directional);

    const rim = new THREE.PointLight(0x7bdff2, 12, 100, 2);
    rim.position.set(-24, 12, -18);
    this.scene.add(rim);
  }

  createArena() {
    this.floor = new THREE.Mesh(
      new THREE.CircleGeometry(50, 72),
      new THREE.MeshStandardMaterial({
        color: 0x1c5c46,
        roughness: 0.88,
        metalness: 0.1,
      }),
    );
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);

    this.innerDisk = new THREE.Mesh(
      new THREE.CircleGeometry(41, 72),
      new THREE.MeshStandardMaterial({
        color: 0x2d7a54,
        roughness: 0.84,
        metalness: 0.08,
      }),
    );
    this.innerDisk.rotation.x = -Math.PI / 2;
    this.innerDisk.position.y = 0.01;
    this.innerDisk.receiveShadow = true;
    this.scene.add(this.innerDisk);

    this.brassRing = new THREE.Mesh(
      new THREE.RingGeometry(32, 38, 64),
      new THREE.MeshBasicMaterial({
        color: 0xe7b544,
        opacity: 0.3,
        transparent: true,
        side: THREE.DoubleSide,
      }),
    );
    this.brassRing.rotation.x = -Math.PI / 2;
    this.brassRing.position.y = 0.02;
    this.scene.add(this.brassRing);

    this.boundaryRing = new THREE.Mesh(
      new THREE.TorusGeometry(50, 0.45, 14, 120),
      new THREE.MeshStandardMaterial({
        color: 0xf5cf66,
        roughness: 0.32,
        metalness: 0.68,
        emissive: 0x8d5d00,
        emissiveIntensity: 0.22,
      }),
    );
    this.boundaryRing.rotation.x = Math.PI / 2;
    this.boundaryRing.position.y = 0.36;
    this.boundaryRing.receiveShadow = true;
    this.boundaryRing.castShadow = true;
    this.scene.add(this.boundaryRing);

    this.grid = new THREE.GridHelper(100, 18, 0xf7e8c5, 0x0f2a32);
    this.grid.position.y = 0.04;
    this.grid.material.opacity = 0.12;
    this.grid.material.transparent = true;
    this.scene.add(this.grid);

    for (let index = 0; index < 10; index += 1) {
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.65, 4.8, 14),
        new THREE.MeshStandardMaterial({
          color: 0x5d4026,
          roughness: 0.78,
          metalness: 0.18,
        }),
      );
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      this.scene.add(pillar);
      this.posts.push(pillar);
    }

    this.layoutArenaDecor();
  }

  layoutArenaDecor() {
    const scale = this.worldSize / 50;
    const postRadius = this.worldSize * 0.88;

    this.floor.scale.setScalar(scale);
    this.innerDisk.scale.setScalar(scale);
    this.brassRing.scale.setScalar(scale);
    this.boundaryRing.scale.setScalar(scale);
    this.grid.scale.setScalar(scale);

    this.posts.forEach((post, index) => {
      const angle = (Math.PI * 2 * index) / this.posts.length;
      post.position.set(
        Math.cos(angle) * postRadius,
        2.35,
        Math.sin(angle) * postRadius,
      );
      post.rotation.y = -angle;
    });
  }

  setWorldSize(worldSize) {
    this.worldSize = worldSize;
    this.scene.fog.far = this.worldSize * 2.8;
    this.layoutArenaDecor();
  }

  resize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  createPlayerMesh(player, isLocal) {
    const group = new THREE.Group();

    const avatar = new THREE.Group();
    group.add(avatar);

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.72, 1.8, 24),
      new THREE.MeshStandardMaterial({
        color: player.color,
        roughness: 0.42,
        metalness: 0.16,
      }),
    );
    body.castShadow = true;
    body.receiveShadow = true;
    avatar.add(body);

    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.58, 20, 20),
      new THREE.MeshStandardMaterial({
        color: player.color,
        roughness: 0.28,
        metalness: 0.12,
      }),
    );
    cap.position.y = 0.95;
    cap.castShadow = true;
    avatar.add(cap);

    const localRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.92, 0.06, 10, 48),
      new THREE.MeshBasicMaterial({
        color: 0xffe08a,
        transparent: true,
        opacity: isLocal ? 0.95 : 0,
      }),
    );
    localRing.rotation.x = Math.PI / 2;
    localRing.position.y = 0.08;
    group.add(localRing);

    const statusRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.08, 0.05, 10, 48),
      new THREE.MeshBasicMaterial({
        color: 0x7bdff2,
        transparent: true,
        opacity: 0,
      }),
    );
    statusRing.rotation.x = Math.PI / 2;
    statusRing.position.y = 0.12;
    group.add(statusRing);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.82, 24),
      new THREE.MeshBasicMaterial({
        color: 0x071014,
        transparent: true,
        opacity: 0.25,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    group.add(shadow);

    const labelTexture = createTextTexture(player.nickname, isLocal ? '#ffd166' : '#7bdff2');
    const labelMaterial = new THREE.SpriteMaterial({
      map: labelTexture,
      transparent: true,
    });
    const label = new THREE.Sprite(labelMaterial);
    label.scale.set(3.4, 0.86, 1);
    label.position.y = 2.9;
    group.add(label);

    this.scene.add(group);

    return {
      group,
      avatar,
      body,
      cap,
      localRing,
      statusRing,
      shadow,
      label,
      labelTexture,
      labelText: player.nickname,
      localState: isLocal,
      displayScale: player.sizeMultiplier || 1,
    };
  }

  upsertPlayer(player, { isLocal }) {
    let entry = this.playerMeshes.get(player.id);
    if (!entry) {
      entry = this.createPlayerMesh(player, isLocal);
      this.playerMeshes.set(player.id, entry);
    }

    if (entry.labelText !== player.nickname || entry.localState !== isLocal) {
      entry.labelTexture.dispose();
      entry.labelTexture = createTextTexture(player.nickname, isLocal ? '#ffd166' : '#7bdff2');
      entry.label.material.map = entry.labelTexture;
      entry.label.material.needsUpdate = true;
      entry.labelText = player.nickname;
      entry.localState = isLocal;
    }

    const targetScale = player.sizeMultiplier || 1;
    if (!Number.isFinite(entry.displayScale)) {
      entry.displayScale = targetScale;
    }
    const scaleSmoothing = targetScale > entry.displayScale
      ? SETTINGS.playerScaleGrowSmoothing
      : SETTINGS.playerScaleShrinkSmoothing;
    entry.displayScale = THREE.MathUtils.lerp(entry.displayScale, targetScale, scaleSmoothing);
    if (Math.abs(entry.displayScale - targetScale) < 0.002) {
      entry.displayScale = targetScale;
    }

    const scale = entry.displayScale;
    const bobOffset = player.bobOffset || 0;
    const now = Date.now();
    const invulnerable = (player.invulnerableUntil || 0) > now;
    const boosted = !invulnerable && (player.speedBoostUntil || 0) > now;

    entry.group.position.set(player.position.x, 0, player.position.z);
    entry.group.rotation.y = player.rotationY || 0;

    entry.avatar.position.y = SETTINGS.playerHeight * scale + bobOffset;
    entry.avatar.rotation.x = player.tilt || 0;
    entry.avatar.scale.set(scale, scale, scale);

    entry.localRing.material.opacity = isLocal ? 0.95 : 0.08;
    entry.localRing.scale.setScalar(1 + ((scale - 1) * 0.25));
    if (invulnerable || boosted) {
      const pulse = 0.58 + (Math.sin(now * 0.012) * 0.2);
      entry.statusRing.visible = true;
      entry.statusRing.material.opacity = pulse;
      entry.statusRing.material.color.setHex(invulnerable ? 0x7bdff2 : 0xc7f464);
      entry.statusRing.scale.setScalar(
        1.12 + ((scale - 1) * 0.34) + (Math.sin(now * 0.008) * 0.04),
      );
    } else {
      entry.statusRing.visible = false;
      entry.statusRing.material.opacity = 0;
      entry.statusRing.scale.setScalar(1 + ((scale - 1) * 0.28));
    }
    entry.shadow.scale.setScalar(scale * 1.1);
    entry.label.position.y = (2.8 * scale) + bobOffset;
    entry.label.quaternion.copy(this.camera.quaternion);
  }

  removePlayer(playerId) {
    const entry = this.playerMeshes.get(playerId);
    if (!entry) return;

    this.scene.remove(entry.group);
    entry.labelTexture.dispose();
    entry.group.traverse((node) => {
      if (node.geometry) {
        node.geometry.dispose();
      }
      if (node.material) {
        disposeMaterial(node.material);
      }
    });

    this.playerMeshes.delete(playerId);
  }

  createBallMesh(ball) {
    const group = new THREE.Group();
    group.position.set(ball.position.x, 0.88, ball.position.z);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.36, 24, 24),
      new THREE.MeshStandardMaterial({
        color: ball.color,
        roughness: 0.2,
        metalness: 0.7,
        emissive: ball.color,
        emissiveIntensity: ball.type === 'GOLDEN' ? 0.28 : 0.14,
      }),
    );
    core.castShadow = true;
    core.receiveShadow = true;
    group.add(core);

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 18, 18),
      new THREE.MeshBasicMaterial({
        color: ball.color,
        transparent: true,
        opacity: 0.14,
      }),
    );
    group.add(glow);

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.48, 0.7, 28),
      new THREE.MeshBasicMaterial({
        color: ball.color,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
      }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = -0.74;
    group.add(halo);

    this.scene.add(group);

    return {
      group,
      core,
      glow,
      halo,
      phase: Math.random() * Math.PI * 2,
      baseY: 0.88,
    };
  }

  upsertBall(ball) {
    let entry = this.ballMeshes.get(ball.id);
    if (!entry) {
      entry = this.createBallMesh(ball);
      this.ballMeshes.set(ball.id, entry);
    }

    entry.group.visible = !ball.hidden;
    entry.group.position.x = ball.position.x;
    entry.group.position.z = ball.position.z;
    entry.core.material.color.setHex(ball.color);
    entry.core.material.emissive.setHex(ball.color);
    entry.glow.material.color.setHex(ball.color);
    entry.halo.material.color.setHex(ball.color);
  }

  removeBall(ballId) {
    const entry = this.ballMeshes.get(ballId);
    if (!entry) return;

    this.scene.remove(entry.group);
    entry.group.traverse((node) => {
      if (node.geometry) {
        node.geometry.dispose();
      }
      if (node.material) {
        disposeMaterial(node.material);
      }
    });
    this.ballMeshes.delete(ballId);
  }

  spawnPickupBurst(position, color, simulationTimeMs) {
    this.spawnBurst({
      position,
      color,
      simulationTimeMs,
      innerRadius: 0.4,
      outerRadius: 0.62,
      duration: 520,
      opacity: 0.75,
      grow: 3.2,
    });
  }

  spawnConsumeBurst(position, color, simulationTimeMs) {
    this.spawnBurst({
      position,
      color,
      simulationTimeMs,
      innerRadius: 0.75,
      outerRadius: 1.05,
      duration: 760,
      opacity: 0.86,
      grow: 4.3,
    });
  }

  spawnRespawnBurst(position, color, simulationTimeMs) {
    this.spawnBurst({
      position,
      color,
      simulationTimeMs,
      innerRadius: 0.58,
      outerRadius: 0.9,
      duration: 980,
      opacity: 0.68,
      grow: 3.4,
      y: 0.18,
    });
  }

  spawnBurst({
    position,
    color,
    simulationTimeMs,
    innerRadius,
    outerRadius,
    duration,
    opacity,
    grow,
    y = 0.08,
  }) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(innerRadius, outerRadius, 26),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(position.x, y, position.z);
    this.scene.add(mesh);

    this.pickupBursts.push({
      mesh,
      bornAt: simulationTimeMs,
      duration,
      opacity,
      grow,
    });
  }

  step(simulationTimeMs) {
    this.ballMeshes.forEach((entry) => {
      const hover = Math.sin((simulationTimeMs * 0.004) + entry.phase) * 0.18;
      entry.group.position.y = entry.baseY + hover;
      entry.core.rotation.y += 0.02;
      entry.glow.scale.setScalar(1 + (Math.sin((simulationTimeMs * 0.006) + entry.phase) * 0.08));
    });

    this.pickupBursts = this.pickupBursts.filter((burst) => {
      const age = simulationTimeMs - burst.bornAt;
      const progress = age / burst.duration;

      if (progress >= 1) {
        this.scene.remove(burst.mesh);
        burst.mesh.geometry.dispose();
        disposeMaterial(burst.mesh.material);
        return false;
      }

      burst.mesh.scale.setScalar(1 + (progress * burst.grow));
      burst.mesh.material.opacity = burst.opacity * (1 - progress);
      return true;
    });
  }

  updateCamera(player, heading) {
    const scale = this.playerMeshes.get(player.id)?.displayScale || player.sizeMultiplier || 1;
    const growth = Math.max(0, scale - 1);
    const maxGrowth = Math.max(0.001, SETTINGS.maxSizeMultiplier - 1);
    const growthProgress = THREE.MathUtils.clamp(growth / maxGrowth, 0, 1);
    const targetDistance = SETTINGS.cameraDistance * (
      1
      + (growth * SETTINGS.cameraDistanceGrowthFactor)
      + (growthProgress * SETTINGS.cameraDistanceProgressFactor)
    );
    const targetHeight = SETTINGS.cameraHeight * (
      1
      + (growth * SETTINGS.cameraHeightGrowthFactor)
      + (growthProgress * SETTINGS.cameraHeightProgressFactor)
    );
    const targetLookHeight = SETTINGS.cameraLookHeight * scale;
    const targetFov = THREE.MathUtils.clamp(
      SETTINGS.cameraBaseFov
      + (growth * SETTINGS.cameraFovGrowthFactor)
      + (growthProgress * SETTINGS.cameraFovProgressFactor),
      SETTINGS.cameraBaseFov,
      SETTINGS.cameraMaxFov,
    );

    if (this.cameraTrackedPlayerId !== player.id) {
      this.cameraTrackedPlayerId = player.id;
      this.cameraCurrentFov = targetFov;
      this.cameraCurrentDistance = targetDistance;
      this.cameraCurrentHeight = targetHeight;
      this.cameraCurrentLookHeight = targetLookHeight;
      this.cameraPickupFovBoost = 0;
      this.cameraPickupDistanceBoost = 0;
      this.cameraPickupHeightBoost = 0;
      this.cameraPickupFovBoostTarget = 0;
      this.cameraPickupDistanceBoostTarget = 0;
      this.cameraPickupHeightBoostTarget = 0;
    } else {
      this.cameraPickupFovBoost = THREE.MathUtils.lerp(
        this.cameraPickupFovBoost,
        this.cameraPickupFovBoostTarget,
        SETTINGS.cameraPickupBoostSmoothing,
      );
      this.cameraPickupDistanceBoost = THREE.MathUtils.lerp(
        this.cameraPickupDistanceBoost,
        this.cameraPickupDistanceBoostTarget,
        SETTINGS.cameraPickupBoostSmoothing,
      );
      this.cameraPickupHeightBoost = THREE.MathUtils.lerp(
        this.cameraPickupHeightBoost,
        this.cameraPickupHeightBoostTarget,
        SETTINGS.cameraPickupBoostSmoothing,
      );
      this.cameraPickupDistanceBoostTarget = THREE.MathUtils.lerp(
        this.cameraPickupDistanceBoostTarget,
        0,
        SETTINGS.cameraPickupBoostDecay,
      );
      this.cameraPickupHeightBoostTarget = THREE.MathUtils.lerp(
        this.cameraPickupHeightBoostTarget,
        0,
        SETTINGS.cameraPickupBoostDecay,
      );
      this.cameraPickupFovBoostTarget = THREE.MathUtils.lerp(
        this.cameraPickupFovBoostTarget,
        0,
        SETTINGS.cameraPickupBoostDecay,
      );

      const zoomingOut = targetDistance > this.cameraCurrentDistance;
      let smoothing = zoomingOut
        ? SETTINGS.cameraZoomOutSmoothing
        : SETTINGS.cameraZoomInSmoothing;
      if (this.cameraPickupDistanceBoost > 0.02 || this.cameraPickupDistanceBoostTarget > 0.02) {
        smoothing = Math.max(smoothing, SETTINGS.cameraPickupZoomResponseSmoothing);
      }
      this.cameraCurrentDistance = THREE.MathUtils.lerp(
        this.cameraCurrentDistance,
        targetDistance + this.cameraPickupDistanceBoost,
        smoothing,
      );
      this.cameraCurrentHeight = THREE.MathUtils.lerp(
        this.cameraCurrentHeight,
        targetHeight + this.cameraPickupHeightBoost,
        smoothing,
      );
      this.cameraCurrentLookHeight = THREE.MathUtils.lerp(
        this.cameraCurrentLookHeight,
        targetLookHeight,
        SETTINGS.cameraLookHeightSmoothing,
      );
      const wideningFov = (targetFov + this.cameraPickupFovBoost) > this.cameraCurrentFov;
      let fovSmoothing = wideningFov
        ? SETTINGS.cameraFovZoomOutSmoothing
        : SETTINGS.cameraFovZoomInSmoothing;
      if (this.cameraPickupFovBoost > 0.05 || this.cameraPickupFovBoostTarget > 0.05) {
        fovSmoothing = Math.max(fovSmoothing, SETTINGS.cameraPickupZoomResponseSmoothing);
      }
      this.cameraCurrentFov = THREE.MathUtils.lerp(
        this.cameraCurrentFov,
        targetFov + this.cameraPickupFovBoost,
        fovSmoothing,
      );
      if (Math.abs(this.cameraCurrentDistance - targetDistance) < 0.01) {
        this.cameraCurrentDistance = targetDistance;
      }
      if (Math.abs(this.cameraCurrentHeight - targetHeight) < 0.01) {
        this.cameraCurrentHeight = targetHeight;
      }
      if (Math.abs(this.cameraCurrentLookHeight - targetLookHeight) < 0.01) {
        this.cameraCurrentLookHeight = targetLookHeight;
      }
      if (Math.abs(this.cameraCurrentFov - targetFov) < 0.05) {
        this.cameraCurrentFov = targetFov;
      }
    }

    const cameraLimit = this.worldSize * 0.84;

    const desiredPosition = this.cameraDesiredPosition.set(
      player.position.x - (Math.sin(heading) * this.cameraCurrentDistance),
      this.cameraCurrentHeight,
      player.position.z - (Math.cos(heading) * this.cameraCurrentDistance),
    );
    const desiredLookAt = this.cameraDesiredLookAt.set(
      player.position.x,
      this.cameraCurrentLookHeight,
      player.position.z,
    );

    desiredPosition.x = THREE.MathUtils.clamp(desiredPosition.x, -cameraLimit, cameraLimit);
    desiredPosition.z = THREE.MathUtils.clamp(desiredPosition.z, -cameraLimit, cameraLimit);

    this.camera.position.lerp(desiredPosition, SETTINGS.cameraSmoothing);
    this.cameraLookTarget.lerp(desiredLookAt, SETTINGS.cameraSmoothing + 0.04);
    if (Math.abs(this.camera.fov - this.cameraCurrentFov) > 0.01) {
      this.camera.fov = this.cameraCurrentFov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.lookAt(this.cameraLookTarget);
  }

  updateIdleCamera(simulationTimeMs) {
    this.cameraTrackedPlayerId = null;
    this.cameraCurrentFov = SETTINGS.cameraBaseFov;
    this.cameraCurrentDistance = SETTINGS.cameraDistance;
    this.cameraCurrentHeight = SETTINGS.cameraHeight;
    this.cameraCurrentLookHeight = SETTINGS.cameraLookHeight;
    this.cameraPickupFovBoost = 0;
    this.cameraPickupDistanceBoost = 0;
    this.cameraPickupHeightBoost = 0;
    this.cameraPickupFovBoostTarget = 0;
    this.cameraPickupDistanceBoostTarget = 0;
    this.cameraPickupHeightBoostTarget = 0;

    const angle = simulationTimeMs * 0.00022;
    const radius = this.worldSize * 0.85;
    const desiredPosition = this.idleCameraPosition.set(
      Math.cos(angle) * radius,
      this.worldSize * 0.17,
      Math.sin(angle) * radius,
    );
    const desiredLookAt = this.idleCameraLookAt;

    this.camera.position.lerp(desiredPosition, 0.035);
    this.cameraLookTarget.lerp(desiredLookAt, 0.05);
    if (Math.abs(this.camera.fov - SETTINGS.cameraBaseFov) > 0.01) {
      this.camera.fov = SETTINGS.cameraBaseFov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.lookAt(this.cameraLookTarget);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  getCanvasElement() {
    return this.renderer?.domElement || null;
  }

  triggerPickupCameraBoost(value = 10, playerScale = 1) {
    const growth = Math.max(0, playerScale - 1);
    const maxGrowth = Math.max(0.001, SETTINGS.maxSizeMultiplier - 1);
    const growthProgress = THREE.MathUtils.clamp(growth / maxGrowth, 0, 1);
    const proportionalFactor = 0.85 + (growthProgress * 0.95);

    const distanceBoost = Math.min(
      SETTINGS.cameraPickupMaxZoomBoost,
      value * SETTINGS.cameraPickupZoomPerPoint * proportionalFactor,
    );
    const heightBoost = Math.min(
      SETTINGS.cameraPickupMaxHeightBoost,
      value * SETTINGS.cameraPickupHeightPerPoint * proportionalFactor,
    );
    const fovBoost = Math.min(
      SETTINGS.cameraPickupMaxFovBoost,
      value * SETTINGS.cameraPickupFovPerPoint * proportionalFactor,
    );

    this.cameraPickupDistanceBoostTarget = Math.min(
      SETTINGS.cameraPickupMaxZoomBoost,
      this.cameraPickupDistanceBoostTarget + distanceBoost,
    );
    this.cameraPickupHeightBoostTarget = Math.min(
      SETTINGS.cameraPickupMaxHeightBoost,
      this.cameraPickupHeightBoostTarget + heightBoost,
    );
    this.cameraPickupFovBoostTarget = Math.min(
      SETTINGS.cameraPickupMaxFovBoost,
      this.cameraPickupFovBoostTarget + fovBoost,
    );
  }

  disposeStaticNode(node) {
    if (!node) return;
    this.scene?.remove(node);
    node.traverse?.((child) => {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        disposeMaterial(child.material);
      }
    });
  }

  dispose() {
    this.playerMeshes.forEach((_, playerId) => this.removePlayer(playerId));
    this.ballMeshes.forEach((_, ballId) => this.removeBall(ballId));

    this.pickupBursts.forEach((burst) => {
      this.scene?.remove(burst.mesh);
      burst.mesh.geometry.dispose();
      disposeMaterial(burst.mesh.material);
    });
    this.pickupBursts = [];

    this.posts.forEach((post) => this.disposeStaticNode(post));
    this.posts = [];
    this.disposeStaticNode(this.floor);
    this.disposeStaticNode(this.innerDisk);
    this.disposeStaticNode(this.brassRing);
    this.disposeStaticNode(this.boundaryRing);
    this.disposeStaticNode(this.grid);

    if (this.renderer) {
      this.renderer.renderLists?.dispose?.();
      this.renderer.dispose();
      this.renderer.forceContextLoss?.();
      this.renderer.domElement?.remove();
    }

    this.scene?.clear();
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.floor = null;
    this.innerDisk = null;
    this.brassRing = null;
    this.boundaryRing = null;
    this.grid = null;
  }
}

export { THREE };
