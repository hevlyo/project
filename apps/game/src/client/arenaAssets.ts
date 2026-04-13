import { SETTINGS } from './config';

export type ArenaAssetDefinition = {
  id: string;
  url: string;
  count: number;
  ringScale: number;
  visualScale: number;
  baseY: number;
  yOffset: number;
  rotationOffset: number;
  phaseOffset: number;
  physicsAligned?: boolean;
};

export type RenderProfile = {
  pixelRatioCap: number;
  shadowsEnabled: boolean;
  shadowMapSize: number;
};

type DeviceInfo = {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  userAgent?: string;
};

const MOBILE_SHADOW_MAP_SIZE = 1024;
const MOBILE_PIXEL_RATIO_CAP = 1.5;

export const ARENA_ASSET_DEFINITIONS: readonly ArenaAssetDefinition[] = [
  {
    id: 'lantern',
    url: '/assets/models/lantern.glb',
    count: SETTINGS.arenaLanternCount,
    ringScale: SETTINGS.arenaLanternRingScale,
    visualScale: 0.68,
    baseY: 0.03,
    yOffset: 0.02,
    rotationOffset: Math.PI,
    phaseOffset: 0,
    physicsAligned: true,
  },
  {
    id: 'plant',
    url: '/assets/models/diffuse-transmission-plant.glb',
    count: SETTINGS.arenaPlantCount,
    ringScale: SETTINGS.arenaPlantRingScale,
    visualScale: 0.52,
    baseY: 0.02,
    yOffset: 0.05,
    rotationOffset: Math.PI / 2,
    phaseOffset: Math.PI / 7,
    physicsAligned: true,
  },
  {
    id: 'lantern-sentinels',
    url: '/assets/models/lantern.glb',
    count: 16,
    ringScale: 0.74,
    visualScale: 0.44,
    baseY: 0.06,
    yOffset: 0.03,
    rotationOffset: 0,
    phaseOffset: Math.PI / 3,
    physicsAligned: false,
  },
  {
    id: 'lantern-crown',
    url: '/assets/models/lantern.glb',
    count: 20,
    ringScale: 0.82,
    visualScale: 0.36,
    baseY: 0.08,
    yOffset: 0.06,
    rotationOffset: Math.PI / 4,
    phaseOffset: Math.PI / 5,
    physicsAligned: false,
  },
  {
    id: 'plant-rim',
    url: '/assets/models/diffuse-transmission-plant.glb',
    count: 18,
    ringScale: 0.68,
    visualScale: 0.42,
    baseY: 0.03,
    yOffset: 0.04,
    rotationOffset: Math.PI,
    phaseOffset: Math.PI / 6,
    physicsAligned: false,
  },
  {
    id: 'plant-barricade',
    url: '/assets/models/diffuse-transmission-plant.glb',
    count: 12,
    ringScale: 0.9,
    visualScale: 0.5,
    baseY: 0.05,
    yOffset: 0.02,
    rotationOffset: 0,
    phaseOffset: Math.PI / 2,
    physicsAligned: false,
  },
];

export function resolveRenderProfile(deviceInfo = readDeviceInfo()): RenderProfile {
  const isLowPower = isLowPowerDevice(deviceInfo);
  if (!isLowPower) {
    return {
      pixelRatioCap: SETTINGS.renderPixelRatioCap,
      shadowsEnabled: SETTINGS.renderShadows,
      shadowMapSize: SETTINGS.renderShadowMapSize,
    };
  }

  return {
    pixelRatioCap: Math.min(SETTINGS.renderPixelRatioCap, MOBILE_PIXEL_RATIO_CAP),
    shadowsEnabled: false,
    shadowMapSize: MOBILE_SHADOW_MAP_SIZE,
  };
}

function readDeviceInfo(): DeviceInfo {
  const nav = globalThis.navigator;
  if (!nav) {
    return {};
  }

  return {
    deviceMemory: 'deviceMemory' in nav ? Number(nav.deviceMemory) : undefined,
    hardwareConcurrency: Number(nav.hardwareConcurrency),
    userAgent: nav.userAgent,
  };
}

function isLowPowerDevice(deviceInfo: DeviceInfo): boolean {
  const memory = Number(deviceInfo.deviceMemory);
  const cores = Number(deviceInfo.hardwareConcurrency);
  const userAgent = String(deviceInfo.userAgent || '').toLowerCase();

  const looksMobile = /android|iphone|ipad|ipod|mobile/.test(userAgent);
  const hasLowMemory = Number.isFinite(memory) && memory > 0 && memory <= 4;
  const hasFewCores = Number.isFinite(cores) && cores > 0 && cores <= 4;

  return looksMobile || hasLowMemory || hasFewCores;
}
