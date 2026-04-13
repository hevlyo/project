export type GameMode = 'menu' | 'connecting' | 'playing' | 'reconnecting';

export type StatusTone = 'danger' | 'live' | 'warning';

export type StatusChip = {
  label: string;
  tone: StatusTone;
}

export type HudPlayerState = {
  attackCooldownUntil?: number;
  dashUnlimitedUntil?: number;
  invulnerableUntil?: number;
  speedBoostUntil?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveRemainingSeconds(untilMs: number | undefined, now: number, maxSeconds: number): number {
  const rawRemaining = Math.ceil(((untilMs || 0) - now) / 1000);
  return clamp(rawRemaining, 1, maxSeconds);
}

function isTimedStateActive(untilMs?: number, now = Date.now()): boolean {
  return typeof untilMs === 'number' && untilMs > now;
}

export function resolveHealthRatio(health: number, maxHealth: number): number {
  const safeMaxHealth = Math.max(1, maxHealth || 0);
  return clamp((Number(health) || 0) / safeMaxHealth, 0, 1);
}

export function resolveStatusLine(mode: GameMode, visibleBallCount: number): string {
  if (mode === 'playing') {
    return `${visibleBallCount} bolas vivas. Nenhuma veio voluntariamente.`;
  }

  if (mode === 'reconnecting') {
    return 'Conexão em estado terminal. Tentando ressuscitar.';
  }

  return 'Aguardando conexão...';
}

export function resolveStatusChip(localPlayer: HudPlayerState | undefined, now = Date.now()): StatusChip | undefined {
  if (!localPlayer) {
return null;
}

  if (isTimedStateActive(localPlayer.dashUnlimitedUntil, now)) {
    const remaining = resolveRemainingSeconds(localPlayer.dashUnlimitedUntil, now, 15);
    return {
      label: `Dash ilimitado ${remaining}s`,
      tone: 'danger',
    };
  }

  if (isTimedStateActive(localPlayer.invulnerableUntil, now)) {
    const remaining = resolveRemainingSeconds(localPlayer.invulnerableUntil, now, 15);
    return {
      label: `Protegido ${remaining}s`,
      tone: 'live',
    };
  }

  if (isTimedStateActive(localPlayer.speedBoostUntil, now)) {
    const remaining = resolveRemainingSeconds(localPlayer.speedBoostUntil, now, 15);
    return {
      label: `Turbo ${remaining}s`,
      tone: 'warning',
    };
  }

  if (isTimedStateActive(localPlayer.attackCooldownUntil, now)) {
    const remaining = resolveRemainingSeconds(localPlayer.attackCooldownUntil, now, 8);
    return {
      label: `Fire ball ${remaining}s`,
      tone: 'warning',
    };
  }

  return null;
}

export function resolveDashCooldownRatio(parameters: {
  dashCooldownUntilMs: number;
  dashCooldownMs: number;
  infinityDashesDurationMs: number;
  dashUnlimitedUntil?: number;
  nowMs?: number;
}): number {
  const nowMs = parameters.nowMs ?? Date.now();

  if (isTimedStateActive(parameters.dashUnlimitedUntil, nowMs)) {
    const remaining = (parameters.dashUnlimitedUntil || 0) - nowMs;
    return clamp(remaining / parameters.infinityDashesDurationMs, 0, 1);
  }

  if (nowMs >= parameters.dashCooldownUntilMs) {
    return 1;
  }

  const remaining = parameters.dashCooldownUntilMs - nowMs;
  return clamp(1 - (remaining / parameters.dashCooldownMs), 0, 1);
}
