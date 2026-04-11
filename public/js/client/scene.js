import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { SETTINGS } from './config.js';

function createTextTexture(label, accent) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const safeLabel = String(label);

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

  context.font = '700 48px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineWidth = 10;
  context.strokeStyle = 'rgba(8, 16, 20, 0.92)';
  context.strokeText(safeLabel, canvas.width / 2, canvas.height / 2 + 2);
  context.fillStyle = '#fff7dd';
  context.fillText(safeLabel, canvas.width / 2, canvas.height / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createDetailBumpTexture(size = 192) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = size;
  canvas.height = size;

  const image = context.createImageData(size, size);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const grain = 120 + Math.floor(Math.random() * 95);
    data[i] = grain;
    data[i + 1] = grain;
    data[i + 2] = grain;
    data[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);

  // Add broad soft variation to avoid flat repeated noise patterns.
  const gradient = context.createRadialGradient(
    size * 0.5,
    size * 0.5,
    size * 0.1,
    size * 0.5,
    size * 0.5,
    size * 0.7,
  );
  gradient.addColorStop(0, 'rgba(255,255,255,0.16)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.16)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createPillarColorTexture(width = 160, height = 384) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = width;
  canvas.height = height;

  const baseGradient = context.createLinearGradient(0, 0, width, 0);
  baseGradient.addColorStop(0, '#4e351f');
  baseGradient.addColorStop(0.5, '#6b4727');
  baseGradient.addColorStop(1, '#4b321d');
  context.fillStyle = baseGradient;
  context.fillRect(0, 0, width, height);

  for (let x = 0; x < width; x += 8) {
    const alpha = 0.06 + (Math.random() * 0.08);
    context.fillStyle = `rgba(255, 214, 166, ${alpha})`;
    context.fillRect(x, 0, 2, height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createBrassBandTexture(width = 512, height = 64) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = width;
  canvas.height = height;

  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#fff2b8');
  gradient.addColorStop(0.22, '#efc45a');
  gradient.addColorStop(0.5, '#d49f3a');
  gradient.addColorStop(0.78, '#efc45a');
  gradient.addColorStop(1, '#b77e1e');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  for (let x = 0; x < width; x += 14) {
    const alpha = 0.04 + (Math.random() * 0.08);
    context.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    context.fillRect(x, 0, 2, height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createSkyTexture(width = 1024, height = 512) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = width;
  canvas.height = height;

  const verticalGradient = context.createLinearGradient(0, 0, 0, height);
  verticalGradient.addColorStop(0, '#93c2cf');
  verticalGradient.addColorStop(0.42, '#b7dce0');
  verticalGradient.addColorStop(1, '#f4dfb7');
  context.fillStyle = verticalGradient;
  context.fillRect(0, 0, width, height);

  const hazeGradient = context.createRadialGradient(
    width * 0.52,
    height * 0.26,
    width * 0.1,
    width * 0.52,
    height * 0.26,
    width * 0.7,
  );
  hazeGradient.addColorStop(0, 'rgba(255,255,255,0.42)');
  hazeGradient.addColorStop(0.6, 'rgba(255,255,255,0.08)');
  hazeGradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = hazeGradient;
  context.fillRect(0, 0, width, height);

  const sunGradient = context.createRadialGradient(
    width * 0.78,
    height * 0.22,
    width * 0.02,
    width * 0.78,
    height * 0.22,
    width * 0.2,
  );
  sunGradient.addColorStop(0, 'rgba(255, 244, 200, 0.96)');
  sunGradient.addColorStop(0.2, 'rgba(255, 231, 166, 0.5)');
  sunGradient.addColorStop(1, 'rgba(255, 231, 166, 0)');
  context.fillStyle = sunGradient;
  context.fillRect(0, 0, width, height);

  const cloudCount = 14;
  for (let index = 0; index < cloudCount; index += 1) {
    const cloudX = (width * 0.12) + (Math.random() * width * 0.78);
    const cloudY = (height * 0.08) + (Math.random() * height * 0.42);
    const cloudWidth = width * (0.08 + (Math.random() * 0.12));
    const cloudHeight = height * (0.035 + (Math.random() * 0.04));
    const cloudGradient = context.createRadialGradient(
      cloudX,
      cloudY,
      0,
      cloudX,
      cloudY,
      Math.max(cloudWidth, cloudHeight),
    );
    cloudGradient.addColorStop(0, 'rgba(255,255,255,0.34)');
    cloudGradient.addColorStop(0.55, 'rgba(255,255,255,0.14)');
    cloudGradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = cloudGradient;
    context.beginPath();
    context.ellipse(cloudX, cloudY, cloudWidth, cloudHeight, Math.random() * 0.4, 0, Math.PI * 2);
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createArenaPatchTexture(size = 256) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = size;
  canvas.height = size;
  context.clearRect(0, 0, size, size);

  const blotchGradient = context.createRadialGradient(
    size * 0.5,
    size * 0.5,
    size * 0.08,
    size * 0.5,
    size * 0.5,
    size * 0.5,
  );
  blotchGradient.addColorStop(0, 'rgba(58, 88, 44, 0.68)');
  blotchGradient.addColorStop(0.52, 'rgba(77, 115, 54, 0.48)');
  blotchGradient.addColorStop(1, 'rgba(32, 40, 24, 0)');
  context.fillStyle = blotchGradient;
  context.fillRect(0, 0, size, size);

  const dirtGradient = context.createRadialGradient(
    size * 0.46,
    size * 0.54,
    size * 0.04,
    size * 0.46,
    size * 0.54,
    size * 0.42,
  );
  dirtGradient.addColorStop(0, 'rgba(134, 108, 64, 0.78)');
  dirtGradient.addColorStop(1, 'rgba(134, 108, 64, 0)');
  context.fillStyle = dirtGradient;
  context.beginPath();
  context.ellipse(size * 0.46, size * 0.54, size * 0.34, size * 0.22, -0.42, 0, Math.PI * 2);
  context.fill();

  for (let index = 0; index < 42; index += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const radius = size * (0.012 + (Math.random() * 0.03));
    const color = Math.random() > 0.6
      ? 'rgba(214, 175, 106, 0.08)'
      : 'rgba(13, 34, 19, 0.16)';
    context.fillStyle = color;
    context.beginPath();
    context.ellipse(x, y, radius, radius * (0.55 + Math.random() * 0.8), Math.random() * Math.PI, 0, Math.PI * 2);
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createStoneTexture(width = 256, height = 512) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = width;
  canvas.height = height;

  const gradient = context.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, '#3d4345');
  gradient.addColorStop(0.38, '#677173');
  gradient.addColorStop(0.62, '#4b5457');
  gradient.addColorStop(1, '#2f3537');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  for (let x = 0; x < width; x += 16) {
    context.fillStyle = `rgba(255, 255, 255, ${0.02 + (Math.random() * 0.05)})`;
    context.fillRect(x, 0, 3, height);
  }

  for (let y = 0; y < height; y += 28) {
    context.strokeStyle = 'rgba(18, 22, 24, 0.28)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(0, y + (Math.random() * 4));
    context.lineTo(width, y + (Math.random() * 4));
    context.stroke();
  }

  const cracks = 24;
  for (let index = 0; index < cracks; index += 1) {
    const startX = Math.random() * width;
    const startY = Math.random() * height;
    const segments = 3 + Math.floor(Math.random() * 5);
    context.strokeStyle = 'rgba(14, 16, 17, 0.22)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(startX, startY);
    let cursorX = startX;
    let cursorY = startY;
    for (let segment = 0; segment < segments; segment += 1) {
      cursorX += (Math.random() - 0.5) * 34;
      cursorY += (Math.random() - 0.5) * 42;
      context.lineTo(cursorX, cursorY);
    }
    context.stroke();
  }

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

  ['map', 'alphaMap', 'aoMap', 'bumpMap', 'displacementMap', 'emissiveMap', 'metalnessMap', 'normalMap', 'roughnessMap'].forEach((key) => {
    if (material[key]) {
      material[key].dispose();
    }
  });

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
    this.posts = [];
    this.skyDome = null;
    this.arenaDecorGroup = null;
    this.arenaAssetGroup = null;
    this.arenaAssetRoots = [];
    this.playerMeshes = new Map();
    this.ballMeshes = new Map();
    this.pickupBursts = [];
    this.valuePopups = [];
    this.valuePopupLayer = null;
    this.valuePopupProjectPoint = new THREE.Vector3();
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
    this.cameraForward = new THREE.Vector3();
    this.idleCameraPosition = new THREE.Vector3();
    this.idleCameraLookAt = new THREE.Vector3(0, 1.8, 0);
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fb8bf);
    this.scene.fog = new THREE.Fog(0x8fb8bf, this.worldSize * 0.9, this.worldSize * 3.1);

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
    this.ensureValuePopupLayer();

    // Chamar resize ANTES de criar luzes e arena para garantir que o renderer tem tamanho válido
    this.resize();

    this.createLights();
    this.createArena();
    void this.loadArenaAssets();
  }

  ensureValuePopupLayer() {
    if (this.valuePopupLayer) {
      return;
    }

    const layer = document.createElement('div');
    layer.className = 'floating-value-layer';
    this.container.appendChild(layer);
    this.valuePopupLayer = layer;
  }

  createLights() {
    this.ambientLight = new THREE.AmbientLight(0xfff4d7, 0.34);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0xf7e8c5, 0x0f2a32, 1.15);
    this.scene.add(this.hemiLight);

    this.directionalLight = new THREE.DirectionalLight(0xfff0be, 1.55);
    this.directionalLight.position.set(18, 28, 12);
    this.directionalLight.castShadow = SETTINGS.renderShadows;
    if (SETTINGS.renderShadows) {
      this.directionalLight.shadow.mapSize.width = SETTINGS.renderShadowMapSize;
      this.directionalLight.shadow.mapSize.height = SETTINGS.renderShadowMapSize;
      this.directionalLight.shadow.camera.left = -80;
      this.directionalLight.shadow.camera.right = 80;
      this.directionalLight.shadow.camera.top = 80;
      this.directionalLight.shadow.camera.bottom = -80;
      this.directionalLight.shadow.camera.far = 120;
    }
    this.scene.add(this.directionalLight);

    const rim = new THREE.PointLight(0x7bdff2, 12, 100, 2);
    rim.position.set(-24, 12, -18);
    this.scene.add(rim);
  }

  setNightMode(isNight) {
    this.isNightMode = isNight;
    if (isNight) {
      this.scene.background.setHex(0x1a1a2e);
      this.scene.fog.color.setHex(0x1a1a2e);
      if (this.skyDome) this.skyDome.material.color.setHex(0x222233);
      if (this.ambientLight) this.ambientLight.intensity = 0.1;
      if (this.hemiLight) {
        this.hemiLight.intensity = 0.3;
        this.hemiLight.color.setHex(0x405580);
        this.hemiLight.groundColor.setHex(0x081016);
      }
      if (this.directionalLight) {
        this.directionalLight.intensity = 0.25;
        this.directionalLight.color.setHex(0x8aa8d4);
      }
    } else {
      this.scene.background.setHex(0x8fb8bf);
      this.scene.fog.color.setHex(0x8fb8bf);
      if (this.skyDome) this.skyDome.material.color.setHex(0xffffff);
      if (this.ambientLight) this.ambientLight.intensity = 0.34;
      if (this.hemiLight) {
        this.hemiLight.intensity = 1.15;
        this.hemiLight.color.setHex(0xf7e8c5);
        this.hemiLight.groundColor.setHex(0x0f2a32);
      }
      if (this.directionalLight) {
        this.directionalLight.intensity = 1.55;
        this.directionalLight.color.setHex(0xfff0be);
      }
    }
  }

  createArena() {
    const maxAnisotropy = Math.min(8, this.renderer?.capabilities?.getMaxAnisotropy?.() || 1);
    const grassMap = new THREE.TextureLoader().load('/assets/textures/grass.jpg');
    grassMap.colorSpace = THREE.SRGBColorSpace;
    grassMap.wrapS = THREE.RepeatWrapping;
    grassMap.wrapT = THREE.RepeatWrapping;
    grassMap.repeat.set(14, 14);
    grassMap.anisotropy = maxAnisotropy;

    const innerGrassMap = grassMap.clone();
    innerGrassMap.repeat.set(9, 9);
    innerGrassMap.offset.set(0.18, 0.23);
    innerGrassMap.needsUpdate = true;
    innerGrassMap.anisotropy = maxAnisotropy;

    const floorDetailMap = createDetailBumpTexture();
    floorDetailMap.wrapS = THREE.RepeatWrapping;
    floorDetailMap.wrapT = THREE.RepeatWrapping;
    floorDetailMap.repeat.set(32, 32);
    floorDetailMap.anisotropy = maxAnisotropy;

    const innerDetailMap = createDetailBumpTexture();
    innerDetailMap.wrapS = THREE.RepeatWrapping;
    innerDetailMap.wrapT = THREE.RepeatWrapping;
    innerDetailMap.repeat.set(22, 22);
    innerDetailMap.anisotropy = maxAnisotropy;

    const brassBandMap = createBrassBandTexture();
    brassBandMap.wrapS = THREE.RepeatWrapping;
    brassBandMap.wrapT = THREE.RepeatWrapping;
    brassBandMap.repeat.set(9, 1);
    brassBandMap.anisotropy = maxAnisotropy;

    const brassDetailMap = createDetailBumpTexture();
    brassDetailMap.wrapS = THREE.RepeatWrapping;
    brassDetailMap.wrapT = THREE.RepeatWrapping;
    brassDetailMap.repeat.set(30, 4);
    brassDetailMap.anisotropy = maxAnisotropy;

    const pillarMap = createPillarColorTexture();
    pillarMap.wrapS = THREE.RepeatWrapping;
    pillarMap.wrapT = THREE.RepeatWrapping;
    pillarMap.repeat.set(2.2, 1);
    pillarMap.anisotropy = maxAnisotropy;

    const pillarDetailMap = createDetailBumpTexture();
    pillarDetailMap.wrapS = THREE.RepeatWrapping;
    pillarDetailMap.wrapT = THREE.RepeatWrapping;
    pillarDetailMap.repeat.set(8, 4);
    pillarDetailMap.anisotropy = maxAnisotropy;

    const skyTexture = createSkyTexture();
    skyTexture.colorSpace = THREE.SRGBColorSpace;
    skyTexture.wrapS = THREE.RepeatWrapping;
    skyTexture.wrapT = THREE.ClampToEdgeWrapping;
    skyTexture.repeat.set(1, 1);

    const patchTexture = createArenaPatchTexture();
    patchTexture.colorSpace = THREE.SRGBColorSpace;
    patchTexture.wrapS = THREE.RepeatWrapping;
    patchTexture.wrapT = THREE.RepeatWrapping;
    patchTexture.anisotropy = maxAnisotropy;

    const stoneTexture = createStoneTexture();
    stoneTexture.wrapS = THREE.RepeatWrapping;
    stoneTexture.wrapT = THREE.RepeatWrapping;
    stoneTexture.repeat.set(1.1, 1);
    stoneTexture.anisotropy = maxAnisotropy;

    this.skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(250, 40, 24),
      new THREE.MeshBasicMaterial({
        map: skyTexture,
        side: THREE.BackSide,
      }),
    );
    this.scene.add(this.skyDome);

    this.arenaDecorGroup = new THREE.Group();
    this.scene.add(this.arenaDecorGroup);

    this.arenaAssetGroup = new THREE.Group();
    this.scene.add(this.arenaAssetGroup);

    this.floor = new THREE.Mesh(
      new THREE.CircleGeometry(50, 72),
      new THREE.MeshStandardMaterial({
        color: 0xcfe8cf,
        map: grassMap,
        bumpMap: floorDetailMap,
        bumpScale: 0.3,
        roughness: 0.92,
        metalness: 0.03,
      }),
    );
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);

    this.innerDisk = new THREE.Mesh(
      new THREE.CircleGeometry(41, 72),
      new THREE.MeshStandardMaterial({
        color: 0xb8ddb8,
        map: innerGrassMap,
        bumpMap: innerDetailMap,
        bumpScale: 0.2,
        roughness: 0.86,
        metalness: 0.04,
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
        color: 0xf5d277,
        map: brassBandMap,
        bumpMap: brassDetailMap,
        bumpScale: 0.1,
        roughness: 0.26,
        metalness: 0.76,
        emissive: 0x8d5d00,
        emissiveIntensity: 0.26,
      }),
    );
    this.boundaryRing.rotation.x = Math.PI / 2;
    this.boundaryRing.position.y = 0.36;
    this.boundaryRing.receiveShadow = true;
    this.boundaryRing.castShadow = true;
    this.scene.add(this.boundaryRing);

    for (let index = 0; index < SETTINGS.arenaPostCount; index += 1) {
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.65, 4.8, 14),
        new THREE.MeshStandardMaterial({
          color: 0xb08f72,
          map: pillarMap,
          bumpMap: pillarDetailMap,
          bumpScale: 0.22,
          roughness: 0.72,
          metalness: 0.14,
        }),
      );
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      this.scene.add(pillar);
      this.posts.push(pillar);
    }

    this.arenaDecorations = [];
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8;
      const monolith = new THREE.Group();

      const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 1.1, 1.15, 10),
        new THREE.MeshStandardMaterial({
          color: 0x4c5759,
          map: stoneTexture,
          roughness: 0.84,
          metalness: 0.06,
        }),
      );
      pedestal.castShadow = true;
      pedestal.receiveShadow = true;
      monolith.add(pedestal);

      const spire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.48, 0.74, 3.9, 10),
        new THREE.MeshStandardMaterial({
          color: 0x667376,
          map: stoneTexture.clone(),
          roughness: 0.8,
          metalness: 0.08,
        }),
      );
      spire.position.y = 2.52;
      spire.castShadow = true;
      spire.receiveShadow = true;
      monolith.add(spire);

      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.36, 14, 14),
        new THREE.MeshBasicMaterial({
          color: index % 2 === 0 ? 0x7bdff2 : 0xffd166,
          transparent: true,
          opacity: 0.82,
        }),
      );
      cap.position.y = 4.75;
      monolith.add(cap);

      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.86, 0.06, 8, 24),
        new THREE.MeshBasicMaterial({
          color: index % 2 === 0 ? 0x7bdff2 : 0xffd166,
          transparent: true,
          opacity: 0.24,
          side: THREE.DoubleSide,
        }),
      );
      band.rotation.x = Math.PI / 2;
      band.position.y = 2.12;
      monolith.add(band);

      monolith.userData = {
        angle,
        radius: 50 * SETTINGS.arenaMonolithRingScale,
        baseY: 0.15,
        bobPhase: Math.random() * Math.PI * 2,
      };
      this.arenaDecorGroup.add(monolith);
      this.arenaDecorations.push(monolith);
    }

    for (let index = 0; index < 12; index += 1) {
      const patch = new THREE.Mesh(
        new THREE.PlaneGeometry(8 + (Math.random() * 4), 4.8 + (Math.random() * 2.6), 1, 1),
        new THREE.MeshBasicMaterial({
          map: patchTexture.clone(),
          transparent: true,
          opacity: 0.82,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      patch.rotation.x = -Math.PI / 2;
      patch.rotation.z = Math.random() * Math.PI;
      patch.position.set(
        (Math.cos((Math.PI * 2 * index) / 12) * (13 + (Math.random() * 18))),
        0.03,
        (Math.sin((Math.PI * 2 * index) / 12) * (13 + (Math.random() * 18))),
      );
      patch.userData = {
        pulsePhase: Math.random() * Math.PI * 2,
      };
      this.arenaDecorGroup.add(patch);
      this.arenaDecorations.push(patch);
    }

    this.layoutArenaDecor();
  }

  async loadArenaAssets() {
    const loader = new GLTFLoader();
    const assetDefinitions = [
      {
        url: '/assets/models/lantern.glb',
        count: SETTINGS.arenaLanternCount,
        ringScale: SETTINGS.arenaLanternRingScale,
        scale: 0.68,
        y: 0.03,
        yOffset: 0.02,
        yRotationOffset: Math.PI,
        phaseOffset: 0,
      },
      {
        url: '/assets/models/diffuse-transmission-plant.glb',
        count: SETTINGS.arenaPlantCount,
        ringScale: SETTINGS.arenaPlantRingScale,
        scale: 0.52,
        y: 0.02,
        yOffset: 0.05,
        yRotationOffset: Math.PI / 2,
        phaseOffset: Math.PI / 7,
      },
    ];

    const loadedAssets = await Promise.all(assetDefinitions.map(async (definition) => {
      try {
        const gltf = await loader.loadAsync(definition.url);
        return { definition, root: gltf.scene || gltf.scenes?.[0] || null };
      } catch (error) {
        console.warn('Failed to load arena asset', definition.url, error);
        return { definition, root: null };
      }
    }));

    if (!this.arenaAssetGroup || !this.scene) {
      return;
    }

    loadedAssets.forEach(({ definition, root }) => {
      if (!root) {
        return;
      }

      root.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          materials.forEach((material) => {
            if (!material) return;
            material.roughness = Math.min(0.95, material.roughness ?? 0.8);
            material.metalness = Math.max(0, Math.min(0.2, material.metalness ?? 0));
          });
        }
      });

      for (let index = 0; index < definition.count; index += 1) {
        const angle = (Math.PI * 2 * index) / definition.count;
        const instance = root.clone(true);
        instance.userData = {
          angle,
          radiusScale: definition.ringScale,
          baseY: definition.y,
          bobPhase: definition.phaseOffset + (Math.random() * Math.PI * 2),
          rotationOffset: definition.yRotationOffset,
          yOffset: definition.yOffset,
        };
        instance.scale.setScalar(definition.scale);
        this.arenaAssetGroup.add(instance);
        this.arenaAssetRoots.push(instance);
      }
    });

    this.layoutArenaDecor();
  }

  layoutArenaDecor() {
    const scale = this.worldSize / 50;
    const postRadius = this.worldSize * SETTINGS.arenaPostRingScale;

    this.floor.scale.setScalar(scale);
    this.innerDisk.scale.setScalar(scale);
    this.brassRing.scale.setScalar(scale);
    this.boundaryRing.scale.setScalar(scale);
    if (this.skyDome) {
      this.skyDome.scale.setScalar(scale);
    }
    if (this.arenaDecorGroup) {
      this.arenaDecorGroup.scale.setScalar(scale);
    }

    this.posts.forEach((post, index) => {
      const angle = (Math.PI * 2 * index) / this.posts.length;
      post.position.set(
        Math.cos(angle) * postRadius,
        2.35,
        Math.sin(angle) * postRadius,
      );
      post.rotation.y = -angle;
    });

    if (this.arenaDecorations?.length) {
      this.arenaDecorations.forEach((decor) => {
        if (!decor.userData) return;
        if (decor.geometry?.type === 'PlaneGeometry') {
          return;
        }

        const { angle, radius, baseY } = decor.userData;
        decor.position.set(
          Math.cos(angle) * radius,
          baseY,
          Math.sin(angle) * radius,
        );
        decor.rotation.y = -angle + (Math.PI / 2);
      });
    }

    if (this.arenaAssetRoots?.length) {
      this.arenaAssetRoots.forEach((asset) => {
        const { angle, radiusScale, baseY, rotationOffset = 0, yOffset = 0, bobPhase = 0 } = asset.userData || {};
        if (!Number.isFinite(angle) || !Number.isFinite(radiusScale)) {
          return;
        }

        const radius = this.worldSize * radiusScale;
        const bob = Math.sin((simulationTimeMs * 0.001) + bobPhase) * 0.08;
        asset.position.set(
          Math.cos(angle) * radius,
          baseY + yOffset + bob,
          Math.sin(angle) * radius,
        );
        asset.rotation.y = -angle + rotationOffset;
      });
    }
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

    const baseColor = new THREE.Color(player.color);
    const bodyColor = baseColor.clone().offsetHSL(0, -0.05, -0.05);
    const capColor = baseColor.clone().offsetHSL(0, 0.02, 0.06);
    const accentColor = baseColor.clone().offsetHSL(0.02, -0.12, -0.18);
    const bellyColor = baseColor.clone().lerp(new THREE.Color(0xf9f1da), 0.52);

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.36,
      metalness: 0.08,
      emissive: bodyColor.clone().multiplyScalar(0.06),
    });

    const capMaterial = new THREE.MeshStandardMaterial({
      color: capColor,
      roughness: 0.26,
      metalness: 0.1,
      emissive: capColor.clone().multiplyScalar(0.05),
    });

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.72, 1.8, 24),
      bodyMaterial,
    );
    body.castShadow = true;
    body.receiveShadow = true;
    avatar.add(body);

    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.58, 20, 20),
      capMaterial,
    );
    cap.position.y = 0.95;
    cap.castShadow = true;
    cap.receiveShadow = true;
    avatar.add(cap);

    const belly = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 16, 16),
      new THREE.MeshStandardMaterial({
        color: bellyColor,
        roughness: 0.48,
        metalness: 0.03,
      }),
    );
    belly.position.set(0, 0.12, 0.38);
    belly.scale.set(1.1, 0.9, 0.62);
    belly.castShadow = true;
    belly.receiveShadow = true;
    avatar.add(belly);

    const facePanel = new THREE.Mesh(
      new THREE.SphereGeometry(0.36, 14, 14),
      new THREE.MeshStandardMaterial({
        color: bellyColor,
        roughness: 0.42,
        metalness: 0.03,
      }),
    );
    facePanel.position.set(0, 0.98, 0.43);
    facePanel.scale.set(0.94, 0.84, 0.54);
    facePanel.castShadow = true;
    facePanel.receiveShadow = true;
    avatar.add(facePanel);

    const snout = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.17, 0.22, 14),
      new THREE.MeshStandardMaterial({
        color: bellyColor.clone().offsetHSL(0, 0, -0.06),
        roughness: 0.46,
        metalness: 0.02,
      }),
    );
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, 0.87, 0.61);
    snout.castShadow = true;
    snout.receiveShadow = true;
    avatar.add(snout);

    const eyeMaterial = new THREE.MeshStandardMaterial({
      color: 0x121f25,
      roughness: 0.2,
      metalness: 0.36,
      emissive: 0x3d5963,
      emissiveIntensity: 0.35,
    });

    const eyeLeft = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), eyeMaterial.clone());
    eyeLeft.position.set(-0.16, 1.05, 0.58);
    avatar.add(eyeLeft);

    const eyeRight = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), eyeMaterial.clone());
    eyeRight.position.set(0.16, 1.05, 0.58);
    avatar.add(eyeRight);

    const nostrilMaterial = new THREE.MeshBasicMaterial({ color: 0x2f383d });
    const nostrilLeft = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), nostrilMaterial);
    nostrilLeft.position.set(-0.056, 0.87, 0.72);
    avatar.add(nostrilLeft);

    const nostrilRight = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), nostrilMaterial);
    nostrilRight.position.set(0.056, 0.87, 0.72);
    avatar.add(nostrilRight);

    const earMaterial = new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.34,
      metalness: 0.08,
    });

    const leftEar = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.32, 10), earMaterial);
    leftEar.position.set(-0.33, 1.42, 0.03);
    leftEar.rotation.z = 0.24;
    leftEar.castShadow = true;
    avatar.add(leftEar);

    const rightEar = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.32, 10), earMaterial.clone());
    rightEar.position.set(0.33, 1.42, 0.03);
    rightEar.rotation.z = -0.24;
    rightEar.castShadow = true;
    avatar.add(rightEar);

    const belt = new THREE.Mesh(
      new THREE.TorusGeometry(0.56, 0.055, 10, 40),
      new THREE.MeshStandardMaterial({
        color: accentColor.clone().offsetHSL(0, 0, 0.03),
        roughness: 0.24,
        metalness: 0.58,
        emissive: accentColor.clone().multiplyScalar(0.12),
        emissiveIntensity: 0.3,
      }),
    );
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.28;
    belt.castShadow = true;
    belt.receiveShadow = true;
    avatar.add(belt);

    const leftArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.11, 0.46, 6, 10),
      bodyMaterial.clone(),
    );
    leftArm.position.set(-0.56, 0.32, 0.04);
    leftArm.rotation.z = -0.24;
    leftArm.castShadow = true;
    avatar.add(leftArm);

    const rightArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.11, 0.46, 6, 10),
      bodyMaterial.clone(),
    );
    rightArm.position.set(0.56, 0.32, 0.04);
    rightArm.rotation.z = 0.24;
    rightArm.castShadow = true;
    avatar.add(rightArm);

    const leftLeg = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.12, 0.26, 5, 8),
      bodyMaterial.clone(),
    );
    leftLeg.position.set(-0.22, -0.8, 0.03);
    leftLeg.castShadow = true;
    avatar.add(leftLeg);

    const rightLeg = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.12, 0.26, 5, 8),
      bodyMaterial.clone(),
    );
    rightLeg.position.set(0.22, -0.8, 0.03);
    rightLeg.castShadow = true;
    avatar.add(rightLeg);

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
    label.position.y = 3.5;
    group.add(label);

    this.scene.add(group);

    return {
      group,
      avatar,
      body,
      cap,
      belly,
      facePanel,
      leftEar,
      rightEar,
      leftArm,
      rightArm,
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

    const movementEnergy = Math.min(1, Math.abs(player.tilt || 0) * 4.5 + Math.abs(bobOffset) * 5);
    const gaitWave = Math.sin(now * 0.018 + (player.position.x * 0.4));
    entry.leftArm.rotation.x = (-0.24 * movementEnergy) + (gaitWave * 0.34 * movementEnergy);
    entry.rightArm.rotation.x = (-0.24 * movementEnergy) - (gaitWave * 0.34 * movementEnergy);
    entry.leftEar.rotation.x = 0.06 + (gaitWave * 0.04);
    entry.rightEar.rotation.x = 0.06 - (gaitWave * 0.04);

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
    entry.label.position.y = (3.4 * scale) + bobOffset;
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

  getBallValueAccent(ball) {
    if (ball.type === 'GOLDEN') {
      return '#ffd166';
    }

    if (ball.type === 'SPEED') {
      return '#7bdff2';
    }

    return '#fff5d8';
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

  spawnFloatingValue(position, text, color, simulationTimeMs, scaleMultiplier = 1) {
    const safeScale = THREE.MathUtils.clamp(scaleMultiplier || 1, 1, SETTINGS.maxSizeMultiplier);
    const popupScale = 1 + ((safeScale - 1) * 0.7);
    this.ensureValuePopupLayer();

    const element = document.createElement('div');
    element.className = 'floating-value-popup';
    element.textContent = String(text);
    element.style.setProperty('--popup-accent', new THREE.Color(color).getStyle());
    this.valuePopupLayer?.appendChild(element);

    this.valuePopups.push({
      element,
      bornAt: simulationTimeMs,
      duration: 1150,
      startX: position.x,
      startY: position.y + (1.12 * popupScale),
      startZ: position.z,
      riseHeight: 1.75 + ((popupScale - 1) * 0.5),
      driftX: (Math.random() - 0.5) * 0.34,
      driftZ: (Math.random() - 0.5) * 0.3,
      baseScale: popupScale,
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

  spawnDashTrail(position, color, simulationTimeMs, scale = 1) {
    const safeScale = Math.max(0.8, Math.min(2.8, scale || 1));
    this.spawnBurst({
      position,
      color,
      simulationTimeMs,
      innerRadius: 0.24 * safeScale,
      outerRadius: 0.42 * safeScale,
      duration: 260,
      opacity: 0.42,
      grow: 1.35,
      y: 0.22,
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
    if (this.skyDome) {
      this.skyDome.rotation.y = simulationTimeMs * 0.000015;
    }

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

    this.valuePopups = this.valuePopups.filter((popup) => {
      const age = simulationTimeMs - popup.bornAt;
      const progress = age / popup.duration;

      if (progress >= 1) {
        popup.element?.remove();
        return false;
      }

      const eased = 1 - Math.pow(1 - progress, 2);
      this.valuePopupProjectPoint.set(
        popup.startX + (popup.driftX * eased),
        popup.startY + (popup.riseHeight * eased),
        popup.startZ + (popup.driftZ * eased),
      );
      this.valuePopupProjectPoint.project(this.camera);

      const isBehindCamera = this.valuePopupProjectPoint.z > 1;
      if (isBehindCamera) {
        popup.element.style.opacity = '0';
        return true;
      }

      const width = this.container.clientWidth || window.innerWidth;
      const height = this.container.clientHeight || window.innerHeight;
      const screenX = (this.valuePopupProjectPoint.x * 0.5 + 0.5) * width;
      const screenY = (-this.valuePopupProjectPoint.y * 0.5 + 0.5) * height;
      const visualScale = popup.baseScale * (1 + (progress * 0.1));
      const opacity = Math.max(0, 1 - Math.pow(progress, 1.35));

      popup.element.style.opacity = opacity.toFixed(3);
      popup.element.style.transform = `translate3d(${screenX.toFixed(1)}px, ${screenY.toFixed(1)}px, 0) translate(-50%, -50%) scale(${visualScale.toFixed(3)})`;
      return true;
    });

    if (this.arenaDecorations?.length) {
      this.arenaDecorations.forEach((decor) => {
        if (!decor.userData?.pulsePhase) return;
        if (decor.geometry?.type === 'PlaneGeometry') {
          decor.material.opacity = 0.66 + (Math.sin((simulationTimeMs * 0.0011) + decor.userData.pulsePhase) * 0.08);
          decor.position.y = 0.03 + (Math.sin((simulationTimeMs * 0.0014) + decor.userData.pulsePhase) * 0.02);
          return;
        }

        decor.position.y = decor.userData.baseY + (Math.sin((simulationTimeMs * 0.0017) + decor.userData.bobPhase) * 0.08);
      });
    }

    if (this.arenaAssetRoots?.length) {
      this.arenaAssetRoots.forEach((asset) => {
        const { angle, radius, baseY, rotationOffset = 0, yOffset = 0, bobPhase = 0 } = asset.userData || {};
        if (!Number.isFinite(angle) || !Number.isFinite(radius)) {
          return;
        }

        const bob = Math.sin((simulationTimeMs * 0.001) + bobPhase) * 0.08;
        asset.position.set(
          Math.cos(angle) * radius,
          baseY + yOffset + bob,
          Math.sin(angle) * radius,
        );
        asset.rotation.y = -angle + rotationOffset + (Math.sin((simulationTimeMs * 0.0004) + bobPhase) * 0.02);
      });
    }
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

  getCameraHeading(fallback = 0) {
    if (!this.camera) {
      return fallback;
    }

    this.camera.getWorldDirection(this.cameraForward);
    const planarLengthSq = (this.cameraForward.x * this.cameraForward.x) + (this.cameraForward.z * this.cameraForward.z);
    if (planarLengthSq < 0.000001) {
      return fallback;
    }

    return Math.atan2(this.cameraForward.x, this.cameraForward.z);
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
    this.playerMeshes.forEach((_, playerId) => { this.removePlayer(playerId); });
    this.ballMeshes.forEach((_, ballId) => { this.removeBall(ballId); });

    this.pickupBursts.forEach((burst) => {
      this.scene?.remove(burst.mesh);
      burst.mesh.geometry.dispose();
      disposeMaterial(burst.mesh.material);
    });
    this.pickupBursts = [];

    this.valuePopups.forEach((popup) => {
      popup.element?.remove();
    });
    this.valuePopups = [];
    this.valuePopupLayer?.remove();
    this.valuePopupLayer = null;

    this.posts.forEach((post) => { this.disposeStaticNode(post); });
    this.posts = [];
    this.disposeStaticNode(this.skyDome);
    this.disposeStaticNode(this.arenaDecorGroup);
    this.disposeStaticNode(this.arenaAssetGroup);
    this.arenaDecorations = [];
    this.arenaAssetRoots = [];
    this.disposeStaticNode(this.floor);
    this.disposeStaticNode(this.innerDisk);
    this.disposeStaticNode(this.brassRing);
    this.disposeStaticNode(this.boundaryRing);

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
    this.skyDome = null;
    this.arenaDecorGroup = null;
    this.arenaAssetGroup = null;
  }
}

export { THREE };
