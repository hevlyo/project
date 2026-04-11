export interface ArenaPosition {
  x: number;
  y: number;
  z: number;
}

export interface ArenaPost {
  x: number;
  z: number;
}

export interface ArenaObstacleCircle {
  x: number;
  z: number;
  radius: number;
}

export interface ArenaPhysicsConfig {
  WORLD_SIZE: number;
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
  PLAYER_COLLISION_PADDING: number;
}

export class ArenaPhysics {
  private readonly config: ArenaPhysicsConfig;
  private cachedPosts: ArenaPost[] | null;

  constructor(config: ArenaPhysicsConfig) {
    this.config = config;
    this.cachedPosts = null;
  }

  getArenaLimit(radius = 0): number {
    return Math.max(0, this.config.WORLD_SIZE - radius - this.config.ARENA_WALL_PADDING);
  }

  clampPositionToArena(position: ArenaPosition, radius = 0, skin = this.config.ARENA_EDGE_SKIN || 0): ArenaPosition {
    const limit = this.getArenaLimit(radius);
    const effectiveLimit = Math.max(0, limit - skin);
    const distanceSq = (position.x * position.x) + (position.z * position.z);
    const limitSq = effectiveLimit * effectiveLimit;

    if (distanceSq <= limitSq || distanceSq === 0) {
      return position;
    }

    const distance = Math.sqrt(distanceSq);
    const scale = effectiveLimit / distance;
    position.x *= scale;
    position.z *= scale;
    return position;
  }

  resolveArenaSlide(previousPosition: ArenaPosition, nextPosition: ArenaPosition, radius = 0): boolean {
    const limit = this.getArenaLimit(radius);
    const skin = this.config.ARENA_EDGE_SKIN || 0;
    const effectiveLimit = Math.max(0, limit - skin);
    const nextDistanceSq = (nextPosition.x * nextPosition.x) + (nextPosition.z * nextPosition.z);

    if (nextDistanceSq <= (effectiveLimit * effectiveLimit)) {
      return false;
    }

    const distance = Math.sqrt(nextDistanceSq);
    const scale = effectiveLimit / distance;
    nextPosition.x *= scale;
    nextPosition.z *= scale;
    
    return true;
  }

  getArenaPosts(): ArenaPost[] {
    if (this.cachedPosts) {
      return this.cachedPosts;
    }

    const ringRadius = this.config.WORLD_SIZE * this.config.ARENA_POST_RING_SCALE;
    const postCount = this.config.ARENA_POST_COUNT;

    this.cachedPosts = Array.from({ length: postCount }, (_, index) => {
      const angle = (Math.PI * 2 * index) / postCount;
      return {
        x: Math.cos(angle) * ringRadius,
        z: Math.sin(angle) * ringRadius,
      };
    });

    return this.cachedPosts;
  }

  private getRingObstacleCircles(count: number, ringScale: number, radius: number): ArenaObstacleCircle[] {
    if (count <= 0 || radius <= 0) {
      return [];
    }

    const ringRadius = this.config.WORLD_SIZE * ringScale;

    return Array.from({ length: count }, (_, index) => {
      const angle = (Math.PI * 2 * index) / count;
      return {
        x: Math.cos(angle) * ringRadius,
        z: Math.sin(angle) * ringRadius,
        radius,
      };
    });
  }

  getArenaObstacleCircles(): ArenaObstacleCircle[] {
    return [
      ...this.getRingObstacleCircles(
        this.config.ARENA_POST_COUNT,
        this.config.ARENA_POST_RING_SCALE,
        this.config.ARENA_POST_RADIUS,
      ),
      ...this.getRingObstacleCircles(
        this.config.ARENA_MONOLITH_COUNT,
        this.config.ARENA_MONOLITH_RING_SCALE,
        this.config.ARENA_MONOLITH_RADIUS,
      ),
      ...this.getRingObstacleCircles(
        this.config.ARENA_LANTERN_COUNT,
        this.config.ARENA_LANTERN_RING_SCALE,
        this.config.ARENA_LANTERN_RADIUS,
      ),
      ...this.getRingObstacleCircles(
        this.config.ARENA_PLANT_COUNT,
        this.config.ARENA_PLANT_RING_SCALE,
        this.config.ARENA_PLANT_RADIUS,
      ),
    ];
  }

  private getCollisionObstacleCircles(): ArenaObstacleCircle[] {
    return [
      ...this.getRingObstacleCircles(
        this.config.ARENA_MONOLITH_COUNT,
        this.config.ARENA_MONOLITH_RING_SCALE,
        this.config.ARENA_MONOLITH_RADIUS,
      ),
      ...this.getRingObstacleCircles(
        this.config.ARENA_LANTERN_COUNT,
        this.config.ARENA_LANTERN_RING_SCALE,
        this.config.ARENA_LANTERN_RADIUS,
      ),
      ...this.getRingObstacleCircles(
        this.config.ARENA_PLANT_COUNT,
        this.config.ARENA_PLANT_RING_SCALE,
        this.config.ARENA_PLANT_RADIUS,
      ),
    ];
  }

  resolveObstacleSlide(
    previousPosition: ArenaPosition,
    nextPosition: ArenaPosition,
    moverRadius: number,
    obstaclePosition: ArenaPost,
    obstacleRadius: number,
    skin = 0,
  ): boolean {
    const minDistance = moverRadius + obstacleRadius;
    const effectiveDistance = minDistance + skin;
    const nextDx = nextPosition.x - obstaclePosition.x;
    const nextDz = nextPosition.z - obstaclePosition.z;
    const nextDistanceSq = (nextDx * nextDx) + (nextDz * nextDz);

    if (nextDistanceSq > (minDistance * minDistance)) {
      return false;
    }

    let normalX = nextDx;
    let normalZ = nextDz;
    let normalDistanceSq = nextDistanceSq;

    if (normalDistanceSq < 0.000001) {
      const previousDx = previousPosition.x - obstaclePosition.x;
      const previousDz = previousPosition.z - obstaclePosition.z;
      normalX = previousDx;
      normalZ = previousDz;
      normalDistanceSq = (previousDx * previousDx) + (previousDz * previousDz);
    }

    if (normalDistanceSq < 0.000001) {
      normalX = -obstaclePosition.x;
      normalZ = -obstaclePosition.z;
      normalDistanceSq = (normalX * normalX) + (normalZ * normalZ);
    }

    if (normalDistanceSq < 0.000001) {
      return false;
    }

    const normalDistance = Math.sqrt(normalDistanceSq);
    normalX /= normalDistance;
    normalZ /= normalDistance;

    nextPosition.x = obstaclePosition.x + (normalX * effectiveDistance);
    nextPosition.z = obstaclePosition.z + (normalZ * effectiveDistance);
    return true;
  }

  resolvePostCollisions(previousPosition: ArenaPosition, nextPosition: ArenaPosition, radius = 0): boolean {
    const obstacles = this.getCollisionObstacleCircles();
    const skin = this.config.ARENA_EDGE_SKIN || 0;
    let corrected = false;

    for (let pass = 0; pass < 2; pass += 1) {
      let passCorrected = false;
      for (const obstaclePosition of obstacles) {
        if (this.resolveObstacleSlide(
          previousPosition,
          nextPosition,
          radius,
          obstaclePosition,
          obstaclePosition.radius + this.config.PLAYER_COLLISION_PADDING,
          skin,
        )) {
          passCorrected = true;
          corrected = true;
        }
      }

      if (!passCorrected) {
        break;
      }
    }

    return corrected;
  }

  isInsideArena(position: ArenaPosition, radius = 0): boolean {
    const limit = this.getArenaLimit(radius);
    const distanceSq = (position.x * position.x) + (position.z * position.z);
    return distanceSq <= (limit * limit);
  }
}
