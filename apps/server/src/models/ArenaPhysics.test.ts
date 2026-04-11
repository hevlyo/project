import { describe, expect, it } from 'vitest';
import gameConfig from '../config/gameConfig';
import { ArenaPhysics } from './ArenaPhysics';

describe('ArenaPhysics', () => {
  const physics = new ArenaPhysics(gameConfig);

  it('clamps position to arena boundary', () => {
    const radius = 1;
    const position = { x: 999, y: 0, z: 0 };

    physics.clampPositionToArena(position, radius);

    const limit = physics.getArenaLimit(radius) - gameConfig.ARENA_EDGE_SKIN;
    expect(position.x).toBeLessThanOrEqual(limit + 0.0001);
    expect(Math.abs(position.z)).toBeLessThanOrEqual(0.0001);
  });

  it('slides when trying to move outside arena', () => {
    const radius = 1;
    const limit = physics.getArenaLimit(radius) - gameConfig.ARENA_EDGE_SKIN;
    const previous = { x: limit - 0.1, y: 0, z: 0 };
    const next = { x: limit + 3, y: 0, z: 0.5 };

    const corrected = physics.resolveArenaSlide(previous, next, radius);

    expect(corrected).toBe(true);
    expect((next.x * next.x) + (next.z * next.z)).toBeLessThanOrEqual((limit * limit) + 0.01);
  });

  it('pushes out from arena post on collision', () => {
    const posts = physics.getArenaPosts();
    const post = posts[0];
    const moverRadius = 0.5;
    const obstacleRadius = gameConfig.ARENA_POST_RADIUS + gameConfig.PLAYER_COLLISION_PADDING;
    const previous = { x: post.x + 0.1, y: 0, z: post.z + 0.1 };
    const next = { x: post.x, y: 0, z: post.z };

    const corrected = physics.resolveObstacleSlide(
      previous,
      next,
      moverRadius,
      post,
      obstacleRadius,
      gameConfig.ARENA_EDGE_SKIN,
    );

    const dx = next.x - post.x;
    const dz = next.z - post.z;
    const distance = Math.hypot(dx, dz);

    expect(corrected).toBe(true);
    expect(distance).toBeGreaterThanOrEqual(moverRadius + obstacleRadius);
  });

  it('pushes out from arena monolith collision', () => {
    const obstacle = physics.getArenaObstacleCircles().find((circle) => circle.radius === gameConfig.ARENA_MONOLITH_RADIUS);

    expect(obstacle).toBeDefined();
    if (!obstacle) {
      throw new Error('Expected monolith obstacle circle');
    }

    const moverRadius = 0.5;
    const previous = { x: obstacle.x + 0.1, y: 0, z: obstacle.z + 0.1 };
    const next = { x: obstacle.x, y: 0, z: obstacle.z };

    const corrected = physics.resolvePostCollisions(previous, next, moverRadius);

    const dx = next.x - obstacle.x;
    const dz = next.z - obstacle.z;
    const distance = Math.hypot(dx, dz);

    expect(corrected).toBe(true);
    expect(distance).toBeGreaterThanOrEqual(moverRadius + obstacle.radius + gameConfig.PLAYER_COLLISION_PADDING);
  });

  it('does not apply legacy post collision circles in movement resolution', () => {
    const post = physics.getArenaPosts()[0];
    const moverRadius = 0.5;
    const previous = { x: post.x + 0.1, y: 0, z: post.z + 0.1 };
    const next = { x: post.x, y: 0, z: post.z };

    const corrected = physics.resolvePostCollisions(previous, next, moverRadius);

    expect(corrected).toBe(false);
  });
});
