import { describe, expect, it } from 'vitest';
import { ConsumptionResolver } from './ConsumptionResolver';
import type { PlayerState } from './contracts';

function makePlayer(id: string, score: number, x: number, z: number): PlayerState {
  return {
    id,
    nickname: id,
    socketId: `${id}-socket`,
    connected: true,
    color: 0xffffff,
    position: { x, y: 0, z },
    score,
    invulnerableUntil: 0,
    speedBoostUntil: 0,
    dashCooldownUntil: 0,
    consumeIntentUntil: 0,
    lastUpdate: Date.now(),
  };
}

describe('ConsumptionResolver', () => {
  it('returns passive consume when attacker has intent and enough size', () => {
    const a = makePlayer('a', 100, 0, 0);
    const b = makePlayer('b', 20, 0.2, 0);
    const now = Date.now();
    a.consumeIntentUntil = now + 1000;

    const resolver = new ConsumptionResolver({
      sizeRatio: 1.1,
      getRadius: (player) => Math.max(1, player.score / 20),
      hasIntent: (player, at) => (player.consumeIntentUntil || 0) > at,
      isInvulnerable: (player, at) => (player.invulnerableUntil || 0) > at,
    });

    const decision = resolver.findPassiveConsumption([a, b], now);

    expect(decision).toEqual({ winnerId: 'a', loserId: 'b' });
  });

  it('returns null when defender is invulnerable', () => {
    const a = makePlayer('a', 100, 0, 0);
    const b = makePlayer('b', 20, 0.2, 0);
    const now = Date.now();
    a.consumeIntentUntil = now + 1000;
    b.invulnerableUntil = now + 1000;

    const resolver = new ConsumptionResolver({
      sizeRatio: 1.1,
      getRadius: (player) => Math.max(1, player.score / 20),
      hasIntent: (player, at) => (player.consumeIntentUntil || 0) > at,
      isInvulnerable: (player, at) => (player.invulnerableUntil || 0) > at,
    });

    const decision = resolver.findPassiveConsumption([a, b], now);

    expect(decision).toBeNull();
  });

  it('prefers strongest winner when multiple candidates exist', () => {
    const moved = makePlayer('moved', 20, 0, 0);
    const medium = makePlayer('medium', 80, 0.2, 0);
    const giant = makePlayer('giant', 120, 0.22, 0.01);
    const now = Date.now();

    medium.consumeIntentUntil = now + 1000;
    giant.consumeIntentUntil = now + 1000;

    const resolver = new ConsumptionResolver({
      sizeRatio: 1.1,
      getRadius: (player) => Math.max(1, player.score / 20),
      hasIntent: (player, at) => (player.consumeIntentUntil || 0) > at,
      isInvulnerable: (player, at) => (player.invulnerableUntil || 0) > at,
    });

    const decision = resolver.resolveForMovedPlayer([moved, medium, giant], moved.id, now);

    expect(decision).toEqual({ winnerId: 'giant', loserId: moved.id });
  });
});
