export const SETTINGS = {
  frameMs: 1000 / 60,
  worldSize: 50,
  playerHeight: 1.15,
  playerRadius: 0.52,
  consumeSizeRatio: 1.1,
  moveSpeed: 0.19,
  sprintMultiplier: 1.45,
  speedBoostMultiplier: 1.35,
  speedBoostDurationMs: 4000,
  respawnInvulnerableMs: 2000,
  acceleration: 0.18,
  deceleration: 0.22,
  collisionPadding: 0.2,
  interpolationSpeed: 0.18,
  collectionDistance: 1.45,
  cameraDistance: 8.8,
  cameraHeight: 6.2,
  cameraLookHeight: 1.25,
  cameraSmoothing: 0.12,
  cameraZoomOutSmoothing: 0.045,
  cameraZoomInSmoothing: 0.08,
  maxSizeMultiplier: 2.5,
  sizeIncreasePerBall: 0.05,
  defaultBallValue: 10,
  inputDeadZone: 0.0001,
};

export const STORAGE_KEY = 'pega-bola-nickname';
export const SESSION_STORAGE_KEY = 'pega-bola-session';

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
  '`F` alterna tela cheia. `Esc` tira você do teatro inteiro.',
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
    .slice(0, 15);

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
