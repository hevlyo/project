import { describe, expect, it } from 'vitest';
import {
  resolveDashCooldownRatio,
  resolveStatusChip,
  resolveStatusLine,
} from './gameHud';

describe('gameHud helpers', () => {
  it('resolves status line by mode', () => {
    expect(resolveStatusLine('playing', 12)).toContain('12 bolas vivas');
    expect(resolveStatusLine('reconnecting', 0)).toContain('Conexão em estado terminal');
    expect(resolveStatusLine('menu', 0)).toContain('Aguardando conexão');
  });

  it('prioritizes dash unlimited status chip', () => {
    const now = 1_000;
    const status = resolveStatusChip({
      dashUnlimitedUntil: now + 4_000,
      invulnerableUntil: now + 2_000,
      speedBoostUntil: now + 3_000,
    }, now);

    expect(status?.tone).toBe('danger');
    expect(status?.label).toContain('Dash ilimitado');
  });

  it('computes cooldown ratio for normal cooldown and unlimited window', () => {
    const cooldownRatio = resolveDashCooldownRatio({
      dashCooldownUntilMs: 3_000,
      simulationTimeMs: 2_000,
      dashCooldownMs: 1_700,
      infinityDashesDurationMs: 5_000,
      nowMs: 2_000,
    });

    expect(cooldownRatio).toBeGreaterThan(0);
    expect(cooldownRatio).toBeLessThan(1);

    const unlimitedRatio = resolveDashCooldownRatio({
      dashCooldownUntilMs: 3_000,
      simulationTimeMs: 2_000,
      dashCooldownMs: 1_700,
      infinityDashesDurationMs: 5_000,
      dashUnlimitedUntil: 6_000,
      nowMs: 2_000,
    });

    expect(unlimitedRatio).toBeCloseTo(0.8, 1);
  });
});
