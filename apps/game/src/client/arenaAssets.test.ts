import { describe, expect, it } from 'vitest';
import {
  ARENA_ASSET_DEFINITIONS,
  resolveRenderProfile,
} from './arenaAssets';

describe('arena asset catalog', () => {
  it('exposes required core assets for arena composition', () => {
    const ids = new Set(ARENA_ASSET_DEFINITIONS.map((asset) => asset.id));

    expect(ids.has('lantern')).toBe(true);
    expect(ids.has('plant')).toBe(true);
    expect(ARENA_ASSET_DEFINITIONS.every((asset) => asset.count > 0)).toBe(true);
  });

  it('uses conservative render profile for low-power devices', () => {
    const profile = resolveRenderProfile({
      deviceMemory: 4,
      hardwareConcurrency: 4,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile',
    });

    expect(profile.shadowsEnabled).toBe(false);
    expect(profile.pixelRatioCap).toBeLessThanOrEqual(1.5);
    expect(profile.shadowMapSize).toBe(1024);
  });

  it('keeps full quality profile for desktop-like devices', () => {
    const profile = resolveRenderProfile({
      deviceMemory: 16,
      hardwareConcurrency: 8,
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    });

    expect(profile.shadowsEnabled).toBe(true);
    expect(profile.shadowMapSize).toBe(2048);
  });
});
