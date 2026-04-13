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

  it('pushes out from arena brazier collision', () => {
    const obstacle = physics.getArenaObstacleCircles().find((circle) => circle.radius === gameConfig.ARENA_BRAZIER_RADIUS);

    expect(obstacle).toBeDefined();
    if (!obstacle) {
      throw new Error('Expected brazier obstacle circle');
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

  it('returns cached posts and validates inside-arena checks', () => {
    const first = physics.getArenaPosts();
    const second = physics.getArenaPosts();

    expect(first).toBe(second);
    expect(physics.isInsideArena({ x: 0, y: 0, z: 0 }, 0)).toBe(true);
    expect(physics.isInsideArena({ x: 9999, y: 0, z: 9999 }, 0)).toBe(false);
  });

  it('covers obstacle slide fallback branches for zero-length normals', () => {
    const obstacle = { x: 0, z: 0 };
    const moverRadius = 1;
    const obstacleRadius = 1;
    const previous = { x: 0, y: 0, z: 0 };
    const next = { x: 0, y: 0, z: 0 };

    // When both previous and next are exactly at obstacle origin, the method should safely return false.
    const corrected = physics.resolveObstacleSlide(previous, next, moverRadius, obstacle, obstacleRadius, 0);
    expect(corrected).toBe(false);

    // If previous provides a direction, the fallback should correct position.
    const previousDirected = { x: 1, y: 0, z: 0 };
    const nextDirected = { x: 0, y: 0, z: 0 };
    const correctedDirected = physics.resolveObstacleSlide(previousDirected, nextDirected, moverRadius, obstacle, obstacleRadius, 0);
    expect(correctedDirected).toBe(true);
  });

  it('supports config with zero obstacle rings', () => {
    const zeroPhysics = new ArenaPhysics({
      ...gameConfig,
      ARENA_POST_COUNT: 0,
      ARENA_MONOLITH_COUNT: 0,
      ARENA_LANTERN_COUNT: 0,
      ARENA_BRAZIER_COUNT: 0,
      ARENA_PLANT_COUNT: 0,
    });

    expect(zeroPhysics.getArenaObstacleCircles()).toEqual([]);
    expect(zeroPhysics.resolvePostCollisions(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      1,
    )).toBe(false);
  });

  it('uses zero fallback for skin when edge skin config is zero', () => {
    const zeroSkinPhysics = new ArenaPhysics({
      ...gameConfig,
      ARENA_EDGE_SKIN: 0,
    });

    const inside = { x: 1, y: 0, z: 1 };
    const wasCorrected = zeroSkinPhysics.resolveArenaSlide({ ...inside }, inside, 0);
    expect(wasCorrected).toBe(false);

    const outside = { x: 999, y: 0, z: 999 };
    zeroSkinPhysics.clampPositionToArena(outside, 0);
    expect(zeroSkinPhysics.isInsideArena(outside, 0)).toBe(true);

    const next = { x: 50, y: 0, z: 50 };
    expect(zeroSkinPhysics.resolvePostCollisions({ x: 0, y: 0, z: 0 }, next, 0.5)).toBeTypeOf('boolean');
  });

  it('returns false when obstacle is farther than minimum collision distance', () => {
    const corrected = physics.resolveObstacleSlide(
      { x: 0, y: 0, z: 0 },
      { x: 20, y: 0, z: 20 },
      1,
      { x: 0, z: 0 },
      1,
      0,
    );

    expect(corrected).toBe(false);
  });

  it('resolves obstacle collision without needing zero-distance fallback', () => {
    const corrected = physics.resolveObstacleSlide(
      { x: 0, y: 0, z: 0 },
      { x: 1.2, y: 0, z: 0 },
      1,
      { x: 0, z: 0 },
      1,
      0,
    );

    expect(corrected).toBe(true);
  });
});
