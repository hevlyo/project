export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface BallTypeConfig {
  value: number;
  color: number;
}

export interface GameConfig {
  PORT: number;
  WORLD_SIZE: number;
  MIN_BALL_COUNT: number;
  MAX_BALL_COUNT: number;
  BALLS_PER_PLAYER: number;
  DEFAULT_BALL_VALUE: number;
  SIZE_INCREASE_PER_BALL: number;
  MAX_SIZE_MULTIPLIER: number;
  PLAYER_BASE_RADIUS: number;
  PLAYER_COLLISION_PADDING: number;
  PLAYER_NAME_MAX_LENGTH: number;
  PLAYER_NAME_MIN_LENGTH: number;
  PLAYER_SPAWN_CLEARANCE: number;
  BALL_CLEARANCE: number;
  PLAYER_EDGE_MARGIN: number;
  BALL_EDGE_MARGIN: number;
  ARENA_WALL_PADDING: number;
  ARENA_EDGE_SKIN: number;
  ARENA_POST_COUNT: number;
  ARENA_POST_RING_SCALE: number;
  ARENA_POST_RADIUS: number;
  ARENA_MONOLITH_COUNT: number;
  ARENA_MONOLITH_RING_SCALE: number;
  ARENA_MONOLITH_RADIUS: number;
  ARENA_LANTERN_COUNT: number;
  ARENA_LANTERN_RING_SCALE: number;
  ARENA_LANTERN_RADIUS: number;
  ARENA_PLANT_COUNT: number;
  ARENA_PLANT_RING_SCALE: number;
  ARENA_PLANT_RADIUS: number;
  MOVEMENT_THROTTLE_MS: number;
  COLLECTION_THROTTLE_MS: number;
  PLAYER_MAX_HEALTH: number;
  ATTACK_COOLDOWN_MS: number;
  FIREBALL_SPEED: number;
  FIREBALL_DAMAGE: number;
  FIREBALL_RADIUS: number;
  FIREBALL_LIFETIME_MS: number;
  BALL_TYPES: Record<string, BallTypeConfig>;
  PLAYER_COLORS: number[];
  RESPAWN_DELAY: number;
  PLAYER_RESPAWN_INVULNERABLE_MS: number;
  PLAYER_RECONNECT_GRACE_MS: number;
  SPEED_BOOST_DURATION_MS: number;
  SPEED_BOOST_MULTIPLIER: number;
  DASH_COOLDOWN_MS: number;
  DASH_INVULNERABLE_MS: number;
  INFINITY_DASHES_DURATION_MS: number;
  INFINITY_DASHES_CHANCE: number;
  MAX_COLLECTION_DISTANCE: number;
  SOCKET_CONFIG?: {
    pingInterval: number;
    pingTimeout: number;
    cors: {
      origin: string;
      methods: string[];
    };
  };
}

export interface BallState {
  id: string;
  type: string;
  value: number;
  color: number;
  position: Vector3;
}

export interface ProjectileState {
  id: string;
  ownerId: string;
  position: Vector3;
  direction: Vector3;
  speed: number;
  radius: number;
  damage: number;
  color: number;
  createdAt: number;
  expiresAt: number;
}

export interface PlayerState {
  id: string;
  nickname: string;
  socketId: string | null;
  connected: boolean;
  color: number;
  position: Vector3;
  score: number;
  health: number;
  maxHealth: number;
  invulnerableUntil: number;
  speedBoostUntil: number;
  dashCooldownUntil: number;
  dashUnlimitedUntil: number;
  attackCooldownUntil: number;
  disconnectedAt?: number;
  lastUpdate: number;
}

export interface SerializedPlayer {
  id: string;
  nickname: string;
  color: number;
  score: number;
  sizeMultiplier: number;
  serverTimeMs: number;
  health: number;
  maxHealth: number;
  invulnerableUntil: number;
  speedBoostUntil: number;
  dashCooldownUntil: number;
  dashUnlimitedUntil: number;
  attackCooldownUntil: number;
  position: Vector3;
}

export interface SerializedProjectile {
  id: string;
  ownerId: string;
  position: Vector3;
  direction: Vector3;
  speed: number;
  radius: number;
  damage: number;
  color: number;
  createdAt: number;
  expiresAt: number;
}

export interface SerializedBall {
  id: string;
  type: string;
  value: number;
  color: number;
  position: Vector3;
}
