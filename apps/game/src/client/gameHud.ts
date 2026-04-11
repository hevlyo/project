export type GameMode = 'menu' | 'connecting' | 'playing' | 'reconnecting';

export type StatusTone = 'danger' | 'live' | 'warning';

export interface StatusChip {
  label: string;
  tone: StatusTone;
}

export interface HudPlayerState {
  dashUnlimitedUntil?: number;
  invulnerableUntil?: number;
  speedBoostUntil?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isTimedStateActive(untilMs?: number, now = Date.now()): boolean {
  return typeof untilMs === 'number' && untilMs > now;
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

export function resolveStatusChip(localPlayer: HudPlayerState | null | undefined, now = Date.now()): StatusChip | null {
  if (!localPlayer) return null;

  if (isTimedStateActive(localPlayer.dashUnlimitedUntil, now)) {
    const remaining = Math.max(1, Math.ceil(((localPlayer.dashUnlimitedUntil || 0) - now) / 1000));
    return {
      label: `Dash ilimitado ${remaining}s`,
      tone: 'danger',
    };
  }

  if (isTimedStateActive(localPlayer.invulnerableUntil, now)) {
    const remaining = Math.max(1, Math.ceil(((localPlayer.invulnerableUntil || 0) - now) / 1000));
    return {
      label: `Protegido ${remaining}s`,
      tone: 'live',
    };
  }

  if (isTimedStateActive(localPlayer.speedBoostUntil, now)) {
    const remaining = Math.max(1, Math.ceil(((localPlayer.speedBoostUntil || 0) - now) / 1000));
    return {
      label: `Turbo ${remaining}s`,
      tone: 'warning',
    };
  }

  return null;
}

export function resolveDashCooldownRatio(params: {
  dashCooldownUntilMs: number;
  simulationTimeMs: number;
  dashCooldownMs: number;
  infinityDashesDurationMs: number;
  dashUnlimitedUntil?: number;
  nowMs?: number;
}): number {
  const nowMs = params.nowMs ?? Date.now();

  if (isTimedStateActive(params.dashUnlimitedUntil, nowMs)) {
    const remaining = (params.dashUnlimitedUntil || 0) - nowMs;
    return clamp(remaining / params.infinityDashesDurationMs, 0, 1);
  }

  if (params.simulationTimeMs >= params.dashCooldownUntilMs) {
    return 1;
  }

  const remaining = params.dashCooldownUntilMs - params.simulationTimeMs;
  return clamp(1 - (remaining / params.dashCooldownMs), 0, 1);
}
