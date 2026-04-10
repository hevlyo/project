export const SETTINGS = {
  frameMs: 1000 / 60,
  hudUpdateIntervalMs: 120,
  worldSize: 100,
  playerHeight: 1.15,
  playerRadius: 0.52,
  arenaWallPadding: 0.7,
  arenaEdgeSkin: 0.12,
  arenaPostCount: 10,
  arenaPostRingScale: 0.88,
  arenaPostRadius: 0.72,
  consumeSizeRatio: 1.1,
  moveSpeed: 0.19,
  sprintMultiplier: 1.45,
  dashSpeedMultiplier: 3.1,
  dashDurationMs: 130,
  dashCooldownMs: 1700,
  dashAcceleration: 0.58,
  speedBoostMultiplier: 1.35,
  speedBoostDurationMs: 4000,
  respawnInvulnerableMs: 2000,
  acceleration: 0.18,
  deceleration: 0.22,
  collisionPadding: 0.2,
  interpolationSpeed: 0.18,
  collectionDistance: 1.45,
  cameraBaseFov: 60,
  cameraMaxFov: 74,
  cameraDistance: 8.8,
  cameraHeight: 5.75,
  cameraLookHeight: 1.05,
  cameraDistanceGrowthFactor: 1.9,
  cameraDistanceProgressFactor: 0.35,
  cameraHeightGrowthFactor: 1.25,
  cameraHeightProgressFactor: 0.22,
  cameraFovGrowthFactor: 8,
  cameraFovProgressFactor: 10,
  cameraSmoothing: 0.12,
  cameraZoomOutSmoothing: 0.024,
  cameraZoomInSmoothing: 0.05,
  cameraLookHeightSmoothing: 0.05,
  cameraFovZoomOutSmoothing: 0.035,
  cameraFovZoomInSmoothing: 0.06,
  cameraPickupZoomPerPoint: 0.024,
  cameraPickupHeightPerPoint: 0.013,
  cameraPickupFovPerPoint: 0.048,
  cameraPickupBoostSmoothing: 0.22,
  cameraPickupBoostDecay: 0.075,
  cameraPickupZoomResponseSmoothing: 0.075,
  cameraPickupMaxZoomBoost: 1.85,
  cameraPickupMaxHeightBoost: 1.15,
  cameraPickupMaxFovBoost: 3.2,
  playerScaleGrowSmoothing: 0.08,
  playerScaleShrinkSmoothing: 0.12,
  maxSizeMultiplier: 2.5,
  sizeIncreasePerBall: 0.05,
  defaultBallValue: 10,
  inputDeadZone: 0.0001,
  renderPixelRatioCap: 2,
  renderAntialias: true,
  renderShadows: true,
  renderPowerPreference: 'high-performance',
  renderShadowMapSize: 2048,
};

export const STORAGE_KEY = 'pega-bola-nickname';
export const SESSION_STORAGE_KEY = 'pega-bola-session';
export const NICKNAME_MAX_LENGTH = 16;

export const NICKNAME_PATTERN = /^[a-zA-Z0-9\s\-_]+$/;

export const JOIN_MESSAGES = [
  'O salão abriu. Tente não passar vergonha logo no primeiro giro.',
  'A arena está brilhando. O bom senso, nem tanto.',
  'Entrou na pocilga. Agora é tu contra as bolinhas e a própria dignidade.',
];

export const DISCONNECT_MESSAGES = [
  'O servidor deu aquela tossida. Segura que estou tentando voltar.',
  'Caiu a conexão, não o personagem. Reconectando.',
  'O fio da vergonha soltou. Estou costurando de novo.',
];

export const HUD_TIPS = [
  'WASD ou setas para se mexer. Shift para correr feito devedor.',
  'Aperta Space para dash. Tem cooldown, então usa na hora certa.',
  'R tenta devorar. Dash (Space) também ativa janela de devorar.',
  'Bola dourada vale mais. A verdinha vale menos, mas ainda paga o almoço.',
];

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a, b, t) {
  return a + ((b - a) * t);
}

export function lerpAngle(a, b, t) {
  const difference = ((((b - a) % (Math.PI * 2)) + (Math.PI * 3)) % (Math.PI * 2)) - Math.PI;
  return a + (difference * t);
}

export function scoreToScale(score) {
  const ballsCollected = score / SETTINGS.defaultBallValue;
  return Math.min(
    1 + (ballsCollected * SETTINGS.sizeIncreasePerBall),
    SETTINGS.maxSizeMultiplier,
  );
}

export function normalizeNickname(rawValue) {
  const fallback = `Bola${Math.floor(Math.random() * 900) + 100}`;
  if (typeof rawValue !== 'string') return fallback;

  const cleaned = rawValue
    .trim()
    .replace(/[^a-zA-Z0-9\s\-_]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, NICKNAME_MAX_LENGTH);

  if (cleaned.length >= 2 && NICKNAME_PATTERN.test(cleaned)) {
    return cleaned;
  }

  return fallback;
}

export function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function isTimedStateActive(untilMs, now = Date.now()) {
  return typeof untilMs === 'number' && untilMs > now;
}

export function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
