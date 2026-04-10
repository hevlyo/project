export interface ArenaPosition {
  x: number;
  y: number;
  z: number;
}

export interface ArenaPost {
  x: number;
  z: number;
}

export interface ArenaPhysicsConfig {
  WORLD_SIZE: number;
  ARENA_WALL_PADDING: number;
  ARENA_EDGE_SKIN: number;
  ARENA_POST_COUNT: number;
  ARENA_POST_RING_SCALE: number;
  ARENA_POST_RADIUS: number;
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

    const currentDistanceSq = (previousPosition.x * previousPosition.x) + (previousPosition.z * previousPosition.z);
    const deltaX = nextPosition.x - previousPosition.x;
    const deltaZ = nextPosition.z - previousPosition.z;

    if (currentDistanceSq > 0.000001) {
      const currentDistance = Math.sqrt(currentDistanceSq);
      const normalX = previousPosition.x / currentDistance;
      const normalZ = previousPosition.z / currentDistance;
      const outwardSpeed = (deltaX * normalX) + (deltaZ * normalZ);

      if (outwardSpeed > 0) {
        nextPosition.x -= normalX * outwardSpeed;
        nextPosition.z -= normalZ * outwardSpeed;
      }
    }

    this.clampPositionToArena(nextPosition, radius, skin);
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

    const deltaX = nextPosition.x - previousPosition.x;
    const deltaZ = nextPosition.z - previousPosition.z;
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

    const outwardSpeed = (deltaX * normalX) + (deltaZ * normalZ);
    if (outwardSpeed > 0) {
      nextPosition.x -= normalX * outwardSpeed;
      nextPosition.z -= normalZ * outwardSpeed;
    }

    nextPosition.x = obstaclePosition.x + (normalX * effectiveDistance);
    nextPosition.z = obstaclePosition.z + (normalZ * effectiveDistance);
    return true;
  }

  resolvePostCollisions(previousPosition: ArenaPosition, nextPosition: ArenaPosition, radius = 0): boolean {
    const posts = this.getArenaPosts();
    const obstacleRadius = this.config.ARENA_POST_RADIUS + this.config.PLAYER_COLLISION_PADDING;
    const skin = this.config.ARENA_EDGE_SKIN || 0;
    let corrected = false;

    for (let pass = 0; pass < 2; pass += 1) {
      let passCorrected = false;
      for (const obstaclePosition of posts) {
        if (this.resolveObstacleSlide(previousPosition, nextPosition, radius, obstaclePosition, obstacleRadius, skin)) {
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
