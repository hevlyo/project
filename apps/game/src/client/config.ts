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
  arenaMonolithCount: 8,
  arenaMonolithRingScale: 0.435,
  arenaMonolithRadius: 1.2,
  arenaLanternCount: 8,
  arenaLanternRingScale: 0.405,
  arenaLanternRadius: 1.1,
  arenaBrazierCount: 20,
  arenaBrazierRingScale: 0.79,
  arenaBrazierRadius: 0.9,
  arenaPlantCount: 6,
  arenaPlantRingScale: 0.285,
  arenaPlantRadius: 1,
  moveSpeed: 0.19,
  sprintMultiplier: 1.45,
  dashSpeedMultiplier: 3.1,
  dashDurationMs: 130,
  dashCooldownMs: 1700,
  infinityDashesDurationMs: 5000,
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

export const JOIN_MESSAGES = [
  'Entrou. O nível médio do servidor acabou de cair.',
  'Bem-vindo. Ninguém te chamou, mas aqui estamos.',
  'Parabéns por não ter nada melhor pra fazer.',
  'O matchmaking te encontrou. Boa sorte, vai precisar.',
  'Chegou mais um. A fila de quem vai te xingar já está formada.',
];

export const DISCONNECT_MESSAGES = [
  'Desconectou. O servidor agradece.',
  'Caiu. Melhor assim.',
  'Conexão perdida. Sua dignidade já tinha ido antes.',
  'Saiu. Pelo menos uma coisa certa você fez hoje.',
];

export const HUD_TIPS = [
  'WASD pra mover. Tenta não tropeçar.',
  'Shift pra correr. Não vai ajudar muito, mas tenta.',
  'Clique esquerdo atira. Mira ajuda, se souber usar.',
  'Colete as bolas. Sobreviver já é lucro.',
  'Bola dourada vale 3x. A branca vale o mesmo que seu impacto no jogo.',
  'Até os bons já foram ruins. A diferença é que eles saíram dessa fase.',
];

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + ((b - a) * t);
}

export function lerpAngle(a: number, b: number, t: number): number {
  const difference = ((((b - a) % (Math.PI * 2)) + (Math.PI * 3)) % (Math.PI * 2)) - Math.PI;
  return a + (difference * t);
}

export function scoreToScale(score: number): number {
  const ballsCollected = score / SETTINGS.defaultBallValue;
  return Math.min(
    1 + (ballsCollected * SETTINGS.sizeIncreasePerBall),
    SETTINGS.maxSizeMultiplier,
  );
}

export function normalizeNickname(rawValue: unknown): string {
  const fallback = `Bola${Math.floor(Math.random() * 900) + 100}`;
  if (typeof rawValue !== 'string') {
    return fallback;
  }

  const cleaned = sanitizeNickname(rawValue).slice(0, NICKNAME_MAX_LENGTH);

  if (cleaned.length >= 2) {
    return cleaned;
  }

  return fallback;
}

function sanitizeNickname(value: string): string {
  const trimmed = value.trim();
  let sanitized = '';

  for (const character of trimmed) {
    if (isAllowedNicknameCharacter(character)) {
      sanitized += character;
    }
  }

  let collapsed = '';
  let previousWasSpace = false;
  for (const character of sanitized) {
    const isSpace = character === ' ';
    if (isSpace && previousWasSpace) {
      continue;
    }

    collapsed += character;
    previousWasSpace = isSpace;
  }

  return collapsed;
}

function isAllowedNicknameCharacter(character: string): boolean {
  const code = character.codePointAt(0);
  if (code === undefined) {
    return false;
  }

  if (isAsciiLetter(code)) {
    return true;
  }

  if (isAsciiDigit(code)) {
    return true;
  }

  return code === 32 || code === 95 || code === 45;
}

function isAsciiLetter(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isAsciiDigit(code: number): boolean {
  return code >= 48 && code <= 57;
}

export function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function isTimedStateActive(untilMs: number | undefined, now = Date.now()): boolean {
  return typeof untilMs === 'number' && untilMs > now;
}

export function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
