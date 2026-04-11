// src/frontend/client/gameHud.ts
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function isTimedStateActive(untilMs, now = Date.now()) {
  return typeof untilMs === "number" && untilMs > now;
}
function resolveStatusLine(mode, visibleBallCount) {
  if (mode === "playing") {
    return `${visibleBallCount} bolas vivas. Nenhuma veio voluntariamente.`;
  }
  if (mode === "reconnecting") {
    return "Conexão em estado terminal. Tentando ressuscitar.";
  }
  return "Aguardando conexão...";
}
function resolveStatusChip(localPlayer, now = Date.now()) {
  if (!localPlayer)
    return null;
  if (isTimedStateActive(localPlayer.dashUnlimitedUntil, now)) {
    const remaining = Math.max(1, Math.ceil(((localPlayer.dashUnlimitedUntil || 0) - now) / 1000));
    return {
      label: `Dash ilimitado ${remaining}s`,
      tone: "danger"
    };
  }
  if (isTimedStateActive(localPlayer.invulnerableUntil, now)) {
    const remaining = Math.max(1, Math.ceil(((localPlayer.invulnerableUntil || 0) - now) / 1000));
    return {
      label: `Protegido ${remaining}s`,
      tone: "live"
    };
  }
  if (isTimedStateActive(localPlayer.speedBoostUntil, now)) {
    const remaining = Math.max(1, Math.ceil(((localPlayer.speedBoostUntil || 0) - now) / 1000));
    return {
      label: `Turbo ${remaining}s`,
      tone: "warning"
    };
  }
  return null;
}
function resolveDashCooldownRatio(params) {
  const nowMs = params.nowMs ?? Date.now();
  if (isTimedStateActive(params.dashUnlimitedUntil, nowMs)) {
    const remaining2 = (params.dashUnlimitedUntil || 0) - nowMs;
    return clamp(remaining2 / params.infinityDashesDurationMs, 0, 1);
  }
  if (params.simulationTimeMs >= params.dashCooldownUntilMs) {
    return 1;
  }
  const remaining = params.dashCooldownUntilMs - params.simulationTimeMs;
  return clamp(1 - remaining / params.dashCooldownMs, 0, 1);
}
export {
  resolveStatusLine,
  resolveStatusChip,
  resolveDashCooldownRatio
};
