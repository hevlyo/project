import { describe, expect, it, vi } from "vitest";
import gameConfig from "../config/gameConfig";
import GameState from "./GameState";

function expectJoinedPlayer(
	result: ReturnType<GameState["joinPlayer"]>,
): NonNullable<ReturnType<GameState["joinPlayer"]>["player"]> {
	if (!result.player) {
		throw new Error("Expected joinPlayer to return player data");
	}

	return result.player;
}

function expectSocketId(socketId: string | null): string {
	if (!socketId) {
		throw new Error("Expected player to have an active socket id");
	}

	return socketId;
}

function setupTwoPlayers() {
	const state = new GameState(gameConfig);
	const aId = expectJoinedPlayer(
		state.joinPlayer("socket-a", "Alpha", "player-a"),
	).id;
	const bId = expectJoinedPlayer(
		state.joinPlayer("socket-b", "Bravo", "player-b"),
	).id;
	const playerA = state.players[aId];
	const playerB = state.players[bId];

	// Keep distinct scores for scaling checks.
	playerA.score = 60;
	playerB.score = 10;

	// Keep both close for push/collision validation when needed.
	playerA.position = { x: 0, y: 0, z: 0 };
	playerB.position = { x: 0.3, y: 0, z: 0 };

	return { state, playerA, playerB, aId, bId };
}

describe("GameState core rules", () => {
	it("applies dash invulnerability window", () => {
		const { state, playerA } = setupTwoPlayers();
		const now = Date.now();

		const dash = state.activateDash(expectSocketId(playerA.socketId), now);
		expect(dash.error).toBeUndefined();
		expect(state.players[playerA.id].invulnerableUntil).toBeGreaterThan(now);
		expect(state.isInvulnerable(state.players[playerA.id], now + 1)).toBe(true);
	});

	it("grants five seconds of unlimited dash after collecting INFINITY_DASHES", () => {
		const state = new GameState(gameConfig);
		const join = state.joinPlayer("socket-dash", "Dash", "player-dash");
		const joinedPlayer = expectJoinedPlayer(join);
		const player = state.players[joinedPlayer.id];
		const now = Date.now();

		state.balls = {
			"ball-double-dash": {
				id: "ball-double-dash",
				type: "INFINITY_DASHES",
				value: gameConfig.BALL_TYPES.INFINITY_DASHES.value,
				color: gameConfig.BALL_TYPES.INFINITY_DASHES.color,
				position: { x: player.position.x, y: 0, z: player.position.z },
			},
		};

		const collected = state.collectBall(
			expectSocketId(player.socketId),
			"ball-double-dash",
		);
		if (!collected.player) {
			throw new Error("Expected collected player data");
		}
		expect(collected.player.dashUnlimitedUntil).toBeGreaterThanOrEqual(
			now + gameConfig.INFINITY_DASHES_DURATION_MS - 1,
		);

		const firstDash = state.activateDash(expectSocketId(player.socketId), now);
		const secondDash = state.activateDash(
			expectSocketId(player.socketId),
			now + 100,
		);

		expect(firstDash.error).toBeUndefined();
		expect(secondDash.error).toBeUndefined();
	});

	it("spawns INFINITY_DASHES only below the 10 percent threshold", () => {
		const state = new GameState(gameConfig);
		const positionSpy = vi
			.spyOn(state, "getRandomArenaPosition")
			.mockReturnValue({ x: 0, z: 0 });
		const randomSpy = vi
			.spyOn(Math, "random")
			.mockImplementationOnce(() => 0.5)
			.mockImplementationOnce(() => 0.09);

		try {
			const ball = state.createBall();
			expect(ball.type).toBe("INFINITY_DASHES");
		} finally {
			positionSpy.mockRestore();
			randomSpy.mockRestore();
		}
	});

	it("keeps non infinity dashes rolls above the 10 percent threshold", () => {
		const state = new GameState(gameConfig);
		const positionSpy = vi
			.spyOn(state, "getRandomArenaPosition")
			.mockReturnValue({ x: 0, z: 0 });
		const randomSpy = vi
			.spyOn(Math, "random")
			.mockImplementationOnce(() => 0.5)
			.mockImplementationOnce(() => 0.11);

		try {
			const ball = state.createBall();
			expect(ball.type).not.toBe("INFINITY_DASHES");
		} finally {
			positionSpy.mockRestore();
			randomSpy.mockRestore();
		}
	});

	it("does not apply movement correction for overlapping players without movement", () => {
		const { state, playerA } = setupTwoPlayers();
		const before = { ...playerA.position };

		const result = state.updatePlayerPosition(
			expectSocketId(playerA.socketId),
			before,
		);

		expect(result.error).toBeUndefined();
		expect(result.player).toBeDefined();
	});

	it("corrects movement when player attempts to leave arena boundary", () => {
		const state = new GameState(gameConfig);
		const join = state.joinPlayer("socket-edge", "Edge", "player-edge");
		const joinedPlayer = expectJoinedPlayer(join);
		const player = state.players[joinedPlayer.id];
		const radius = state.getPlayerRadius(player);
		const limit = state.getArenaLimit(radius) - gameConfig.ARENA_EDGE_SKIN;

		player.position = { x: limit - 0.5, y: 0, z: 0 };
		const result = state.updatePlayerPosition(expectSocketId(player.socketId), {
			x: limit + 4,
			y: 0,
			z: 0,
		});

		const current = state.players[player.id].position;
		const distanceSq = current.x * current.x + current.z * current.z;

		expect(result.error).toBeUndefined();
		expect(result.corrected).toBe(true);
		expect(distanceSq).toBeLessThanOrEqual(limit * limit + 0.01);
	});

	it("scales ball value beyond fixed base in solo progression", () => {
		const state = new GameState(gameConfig);
		const join = state.joinPlayer("socket-solo", "Solo", "player-solo");
		const joinedPlayer = expectJoinedPlayer(join);
		const solo = state.players[joinedPlayer.id];

		const baseNormal = gameConfig.BALL_TYPES.NORMAL.value;
		expect(state.getScaledBallValue(baseNormal, 0)).toBe(baseNormal);

		solo.score = 10;
		state.recalculateTopScore();

		const boosted = state.getScaledBallValue(baseNormal, solo.score);
		expect(boosted).toBeGreaterThan(baseNormal);
	});

	it("grants stronger value to trailing player in comeback scenario", () => {
		const { state, playerA, playerB } = setupTwoPlayers();

		// A lidera, B esta atras e deve receber valor maior na mesma bola.
		playerA.score = 120;
		playerB.score = 20;
		state.recalculateTopScore();

		const base = gameConfig.BALL_TYPES.SPEED.value;
		const leaderValue = state.getScaledBallValue(base, playerA.score);
		const trailingValue = state.getScaledBallValue(base, playerB.score);

		expect(trailingValue).toBeGreaterThan(leaderValue);
		expect(trailingValue).toBeGreaterThan(base);
	});

	it("returns awardedValue equal to real score delta on collect", () => {
		const state = new GameState(gameConfig);
		const join = state.joinPlayer("socket-delta", "Delta", "player-delta");
		const joinedPlayer = expectJoinedPlayer(join);
		const player = state.players[joinedPlayer.id];

		player.score = 40;
		state.recalculateTopScore();

		const ballId = Object.keys(state.balls)[0];
		const ball = state.balls[ballId];
		player.position.x = ball.position.x;
		player.position.z = ball.position.z;

		const scoreBefore = player.score;
		const result = state.collectBall("socket-delta", ballId);
		if (!result.player) {
			throw new Error("Expected collectBall to return player data");
		}
		const scoreAfter = result.player.score;

		expect(result.awardedValue).toBe(scoreAfter - scoreBefore);
		expect(result.awardedValue).toBeGreaterThan(0);
	});

	it("keeps player spawn away from arena obstacles", () => {
		const state = new GameState(gameConfig);
		state.players = {};
		state.balls = {};

		const randomSpy = vi
			.spyOn(Math, "random")
			.mockImplementationOnce(() => 0)
			.mockImplementationOnce(() => 1)
			.mockImplementationOnce(() => 0)
			.mockImplementationOnce(() => 0);

		try {
			const spawn = state.getSpawnPosition();
			const obstacles = state.arenaPhysics.getArenaObstacleCircles();

			obstacles.forEach((obstacle) => {
				const dx = spawn.x - obstacle.x;
				const dz = spawn.z - obstacle.z;
				const distance = Math.hypot(dx, dz);
				expect(distance).toBeGreaterThanOrEqual(
					obstacle.radius + gameConfig.PLAYER_SPAWN_CLEARANCE - 0.0001,
				);
			});
		} finally {
			randomSpy.mockRestore();
		}
	});

	it("sanitizes nickname and rejects invalid inputs", () => {
		const state = new GameState(gameConfig);

		expect(state.sanitizeNickname(123)).toBe("");
		expect(state.sanitizeNickname(" a@@  b  ")).toBe("a b");
		expect(state.sanitizeNickname("  jogador-legal  ")).toBe("jogador-legal");
		expect(state.sanitizeNickname("x")).toBe("");
		expect(state.sanitizeNickname("  jogador_valido  ")).toBe("jogador_valido");
	});

	it("supports world info, player count and active balls snapshot", () => {
		const state = new GameState(gameConfig);
		const beforeJoin = state.getWorldInfo();
		expect(beforeJoin.worldSize).toBe(gameConfig.WORLD_SIZE);

		state.joinPlayer("socket-a", "Alpha", "player-a");
		state.joinPlayer("socket-b", "Bravo", "player-b");
		expect(state.getPlayerCount()).toBe(2);
		expect(state.getActiveBalls().length).toBeGreaterThan(0);
	});

	it("handles player id generation and lookup mapping", () => {
		const state = new GameState(gameConfig);
		const generated = state.makePlayerId(undefined);
		expect(generated.startsWith("player-")).toBe(true);
		expect(state.makePlayerId("abcdefgh")).toBe("abcdefgh");

		const join = state.joinPlayer("socket-map", "Map", "player-map");
		expect(state.resolvePlayerId("socket-map")).toBe(join.player?.id);
		expect(state.getPlayer("socket-map")?.id).toBe(join.player?.id);
		expect(state.getPlayer("missing-socket")).toBeUndefined();
	});

	it("reconnects existing player preserving id and replacing old socket mapping", () => {
		const state = new GameState(gameConfig);
		state.joinPlayer("socket-old", "Alpha", "persistent-player");

		const rejoined = state.joinPlayer(
			"socket-new",
			"Alpha2",
			"persistent-player",
		);

		expect(rejoined.player?.id).toBe("persistent-player");
		expect(state.resolvePlayerId("socket-old")).toBeUndefined();
		expect(state.resolvePlayerId("socket-new")).toBe("persistent-player");
		expect(state.players["persistent-player"].nickname).toBe("Alpha2");
	});

	it("handles player removal and expiration lifecycle", () => {
		vi.useFakeTimers();
		const state = new GameState(gameConfig);
		state.joinPlayer("socket-remove", "Alpha", "player-remove");

		const removed = state.removePlayer("socket-remove");
		expect(removed?.id).toBe("player-remove");
		expect(state.players["player-remove"].connected).toBe(false);

		vi.advanceTimersByTime(gameConfig.PLAYER_RECONNECT_GRACE_MS + 1);
		expect(state.players["player-remove"]).toBeUndefined();
		expect(state.expireDisconnectedPlayer("missing-player")).toBeUndefined();

		vi.useRealTimers();
	});

	it("does not expire a still-connected player", () => {
		const state = new GameState(gameConfig);
		state.joinPlayer("socket-keep", "Keep", "player-keep");

		expect(state.expireDisconnectedPlayer("player-keep")).toBeUndefined();
		expect(state.players["player-keep"]).toBeDefined();
	});

	it("maintains and respawns ball count in both directions", () => {
		const state = new GameState(gameConfig);

		state.balls = {};
		const grow = state.maintainBallCount();
		expect(grow.spawned.length).toBe(state.getTargetBallCount());

		const ids = Object.keys(state.balls);
		state.balls[`${ids[0]}-extra-a`] = {
			...state.balls[ids[0]],
			id: `${ids[0]}-extra-a`,
		};
		state.balls[`${ids[0]}-extra-b`] = {
			...state.balls[ids[0]],
			id: `${ids[0]}-extra-b`,
		};

		const shrink = state.maintainBallCount();
		expect(shrink.despawned.length).toBeGreaterThan(0);

		const blockedRespawn = state.respawnBall();
		expect(blockedRespawn).toBeUndefined();

		const oneId = Object.keys(state.balls)[0];
		delete state.balls[oneId];
		const respawned = state.respawnBall();
		expect(respawned).not.toBeNull();
	});

	it("covers createBall random branches for day/night and non-mode fallback", () => {
		const state = new GameState(gameConfig);
		const positionSpy = vi
			.spyOn(state, "getRandomArenaPosition")
			.mockReturnValue({ x: 1, z: 1 });

		const nightRandom = vi.spyOn(Math, "random").mockReturnValue(0.005);
		state.isNightMode = false;
		expect(state.createBall().type).toBe("NIGHT_MODE");

		nightRandom.mockRestore();
		const dayRandom = vi.spyOn(Math, "random").mockReturnValue(0.01);
		state.isNightMode = true;
		expect(state.createBall().type).toBe("DAY_MODE");

		dayRandom.mockRestore();
		const fallbackRandom = vi
			.spyOn(Math, "random")
			.mockImplementationOnce(() => 0.8)
			.mockImplementationOnce(() => 0.9)
			.mockImplementationOnce(() => 0.2);
		state.isNightMode = false;
		const fallbackBall = state.createBall();
		expect(fallbackBall.type).not.toBe("NIGHT_MODE");
		expect(fallbackBall.type).not.toBe("DAY_MODE");
		expect(fallbackBall.type).not.toBe("INFINITY_DASHES");

		fallbackRandom.mockRestore();
		positionSpy.mockRestore();
	});

	it("validates movement and collect errors", () => {
		const state = new GameState(gameConfig);

		expect(
			state.updatePlayerPosition("missing", { x: 0, y: 0, z: 0 }).error,
		).toBe("Player not found");
		state.joinPlayer("socket-move", "Move", "player-move");
		expect(state.updatePlayerPosition("socket-move", undefined).error).toBe(
			"Invalid movement data",
		);
		expect(
			state.updatePlayerPosition("socket-move", { x: Number.NaN, y: 0, z: 0 })
				.error,
		).toBe("Invalid movement data");

		expect(state.collectBall("missing", "x").error).toBe("Player not found");
		expect(state.collectBall("socket-move", "").error).toBe(
			"Invalid ball data",
		);
		expect(state.collectBall("socket-move", "missing-ball").error).toBe(
			"Ball not found",
		);
	});

	it("marks movement corrected when only post-collision adjusts the position", () => {
		const state = new GameState(gameConfig);
		state.joinPlayer("socket-post", "Post", "player-post");

		const arenaSpy = vi
			.spyOn(state, "resolveArenaSlide")
			.mockReturnValue(false);
		const postSpy = vi
			.spyOn(state, "resolvePostCollisions")
			.mockReturnValue(true);
		const pushSpy = vi.spyOn(state, "resolvePlayerPush").mockReturnValue(false);

		const result = state.updatePlayerPosition("socket-post", {
			x: 1,
			y: 0,
			z: 1,
		});

		expect(result.error).toBeUndefined();
		expect(result.corrected).toBe(true);
		expect(arenaSpy).toHaveBeenCalled();
		expect(postSpy).toHaveBeenCalled();
		expect(pushSpy).toHaveBeenCalled();

		arenaSpy.mockRestore();
		postSpy.mockRestore();
		pushSpy.mockRestore();
	});

	it("rejects collecting ball when too far and toggles speed/day-night states", () => {
		const state = new GameState(gameConfig);
		const join = state.joinPlayer(
			"socket-collect",
			"Collector",
			"player-collect",
		);
		const joinedPlayer = expectJoinedPlayer(join);
		const player = state.players[joinedPlayer.id];

		state.balls = {
			far: {
				id: "far",
				type: "NORMAL",
				value: 10,
				color: 0xffffff,
				position: { x: 999, y: 0, z: 999 },
			},
		};
		expect(state.collectBall("socket-collect", "far").error).toBe(
			"Ball too far to collect",
		);

		player.position = { x: 0, y: 0, z: 0 };
		state.balls = {
			speed: {
				id: "speed",
				type: "SPEED",
				value: 5,
				color: 0x00ff00,
				position: { x: 0, y: 0, z: 0 },
			},
			night: {
				id: "night",
				type: "NIGHT_MODE",
				value: 50,
				color: 0x000000,
				position: { x: 0, y: 0, z: 0 },
			},
			day: {
				id: "day",
				type: "DAY_MODE",
				value: 50,
				color: 0xffffff,
				position: { x: 0, y: 0, z: 0 },
			},
		};

		const speedResult = state.collectBall("socket-collect", "speed");
		expect(speedResult.player?.speedBoostUntil).toBeGreaterThan(0);

		state.collectBall("socket-collect", "night");
		expect(state.isNightMode).toBe(true);

		state.collectBall("socket-collect", "day");
		expect(state.isNightMode).toBe(false);

		state.isNightMode = true;
		state.balls = {
			normal: {
				id: "normal",
				type: "NORMAL",
				value: 10,
				color: 0xffffff,
				position: { x: 0, y: 0, z: 0 },
			},
		};
		state.collectBall("socket-collect", "normal");
		expect(state.isNightMode).toBe(true);
	});

	it("resets timed states and invulnerability checks", () => {
		const state = new GameState(gameConfig);
		const join = state.joinPlayer("socket-timed", "Timer", "player-timed");
		const joinedPlayer = expectJoinedPlayer(join);
		const player = state.players[joinedPlayer.id];
		const now = Date.now();

		player.invulnerableUntil = now - 1;
		player.speedBoostUntil = now - 1;
		player.dashUnlimitedUntil = now - 1;

		state.refreshPlayerTimedState(player, now);
		expect(player.invulnerableUntil).toBe(0);
		expect(player.speedBoostUntil).toBe(0);
		expect(player.dashUnlimitedUntil).toBe(0);
		expect(state.isInvulnerable(player, now)).toBe(false);
		expect(state.isInvulnerable(undefined, now)).toBe(false);
	});

	it("resets player on respawn and handles missing respawn target", () => {
		const state = new GameState(gameConfig);
		const join = state.joinPlayer(
			"socket-respawn",
			"Respawn",
			"player-respawn",
		);
		const joinedPlayer = expectJoinedPlayer(join);
		const player = state.players[joinedPlayer.id];

		player.score = 100;
		player.health = 10;
		player.speedBoostUntil = Date.now() + 1000;
		player.dashUnlimitedUntil = Date.now() + 1000;

		const respawned = state.respawnPlayer(player.id, 10000);
		expect(respawned).not.toBeNull();
		expect(respawned?.player.health).toBe(gameConfig.PLAYER_MAX_HEALTH);
		expect(respawned?.player.score).toBe(0);
		expect(respawned?.player.dashCooldownUntil).toBe(0);
		expect(state.respawnPlayer("missing")).toBeNull();
	});

	it("spawns fireball attacks and applies fatal damage on combat tick", () => {
		const state = new GameState(gameConfig);
		const attackerJoin = state.joinPlayer(
			"socket-attacker",
			"Caster",
			"player-attacker",
		);
		const victimJoin = state.joinPlayer(
			"socket-victim",
			"Target",
			"player-victim",
		);

		const attackerPlayer = expectJoinedPlayer(attackerJoin);
		const victimPlayer = expectJoinedPlayer(victimJoin);
		const attacker = state.players[attackerPlayer.id];
		const victim = state.players[victimPlayer.id];
		const now = Date.now();

		attacker.position = { x: 0, y: 0, z: 0 };
		victim.position = { x: 5.5, y: 0, z: 0 };
		victim.health = 20;
		state.lastCombatUpdateAt = now;

		const attack = state.fireballAttack(
			expectSocketId(attacker.socketId),
			{ x: 1, y: 0, z: 0 },
			now,
		);
		expect(attack.error).toBeUndefined();
		expect(attack.projectile).toBeDefined();
		if (!attack.projectile) {
			throw new Error("Expected fireballAttack to spawn a projectile");
		}

		expect(state.projectiles[attack.projectile.id]).toBeDefined();

		const tick = state.advanceCombat(now + 100);
		expect(tick.hits).toHaveLength(1);
		expect(tick.hits[0].wasFatal).toBe(true);
		expect(state.projectiles[attack.projectile.id]).toBeUndefined();
		expect(state.players[victim.id].health).toBe(gameConfig.PLAYER_MAX_HEALTH);
		expect(state.players[victim.id].invulnerableUntil).toBeGreaterThan(now);
	});

	it("pushes overlapping players and handles exact overlap axis fallback", () => {
		const state = new GameState(gameConfig);
		state.joinPlayer("socket-a", "Alpha", "aaa-player");
		state.joinPlayer("socket-b", "Bravo", "bbb-player");

		const a = state.players["aaa-player"];
		const b = state.players["bbb-player"];
		a.position = { x: 0, y: 0, z: 0 };
		b.position = { x: 0, y: 0, z: 0 };

		expect(state.resolvePlayerPush("aaa-player")).toBe(true);
		expect(state.resolvePlayerPush("missing-player")).toBe(false);
	});

	it("handles top score recomputation and score map snapshot with disconnected players", () => {
		const state = new GameState(gameConfig);
		state.joinPlayer("socket-a", "Alpha", "player-a");
		state.joinPlayer("socket-b", "Bravo", "player-b");
		state.players["player-a"].score = 10;
		state.players["player-b"].score = 20;
		state.players["player-b"].connected = false;

		state.recalculateTopScore();
		expect(state.topScore).toBe(10);
		expect(state.topScorePlayer).toBe("player-a");

		const scoreMap = state.getScoreMap();
		expect(scoreMap).toEqual({ "player-a": 10 });

		const snapshot = state.getPlayersSnapshot();
		expect(snapshot["player-a"]).toBeDefined();
		expect(snapshot["player-b"]).toBeUndefined();
	});

	it("covers random position fallback and utility passthrough methods", () => {
		const state = new GameState(gameConfig);
		state.players = {
			p1: {
				id: "p1",
				nickname: "P1",
				socketId: "p1",
				connected: true,
				color: 1,
				position: { x: 0, y: 0, z: 0 },
				score: 0,
				health: gameConfig.PLAYER_MAX_HEALTH,
				maxHealth: gameConfig.PLAYER_MAX_HEALTH,
				invulnerableUntil: 0,
				speedBoostUntil: 0,
				dashCooldownUntil: 0,
				dashUnlimitedUntil: 0,
				attackCooldownUntil: 0,
				lastUpdate: 0,
			},
		};

		const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
		const position = state.getRandomArenaPosition(1000, 1);
		expect(position).toBeDefined();
		randomSpy.mockRestore();

		expect(gameConfig.PLAYER_COLORS).toContain(state.getPlayerColor());
		expect(state.clamp(5, 0, 3)).toBe(3);
		expect(state.clamp(-1, 0, 3)).toBe(0);
		expect(state.getArenaLimit(1)).toBeGreaterThan(0);
		expect(state.isInsideArena({ x: 0, y: 0, z: 0 }, 1)).toBe(true);

		const prev = { x: 0, y: 0, z: 0 };
		const next = { x: 999, y: 0, z: 999 };
		expect(state.resolveArenaSlide(prev, next, 1)).toBe(true);
		expect(Array.isArray(state.getArenaPosts())).toBe(true);
		expect(
			typeof state.resolveObstacleSlide(prev, next, 1, { x: 0, z: 0 }, 1, 0.1),
		).toBe("boolean");
		expect(typeof state.resolvePostCollisions(prev, next, 1)).toBe("boolean");
	});

	it("handles removePlayer unresolved mapping and stale player mapping cases", () => {
		const state = new GameState(gameConfig);
		expect(state.removePlayer("missing")).toBeUndefined();

		state.socketToPlayerId.set("socket-stale", "ghost-player");
		expect(state.removePlayer("socket-stale")).toBeUndefined();
	});

	it("returns dash cooldown error when unlimited window is over", () => {
		const state = new GameState(gameConfig);
		state.joinPlayer("socket-dash-error", "DashError", "player-dash-error");
		const player = state.players["player-dash-error"];

		player.dashCooldownUntil = 200;
		player.dashUnlimitedUntil = 100;

		const result = state.activateDash("socket-dash-error", 150);
		expect(result.error).toBe("Dash on cooldown");
		expect(result.dashCooldownUntil).toBe(200);
	});

	it("returns player not found for dash when socket is unknown", () => {
		const state = new GameState(gameConfig);
		const result = state.activateDash("missing-socket");
		expect(result.error).toBe("Player not found");
	});

	it("rejects invalid nickname in joinPlayer", () => {
		const state = new GameState(gameConfig);
		const result = state.joinPlayer("socket-invalid", "x", "player-invalid");
		expect(result.error).toBe("Invalid nickname");
	});

	it("cancels pending reconnect removal timer explicitly", () => {
		vi.useFakeTimers();
		const state = new GameState(gameConfig);
		state.joinPlayer("socket-cancel", "Cancel", "player-cancel");
		state.removePlayer("socket-cancel");

		expect(state.playerReconnectTimers.has("player-cancel")).toBe(true);
		state.cancelPendingRemoval("player-cancel");
		expect(state.playerReconnectTimers.has("player-cancel")).toBe(false);

		vi.useRealTimers();
	});

	it("expires disconnected player and clears old socket mapping when socket id is still present", () => {
		const state = new GameState(gameConfig);
		state.players["player-expire"] = {
			id: "player-expire",
			nickname: "Expire",
			socketId: "socket-expire",
			connected: false,
			color: 1,
			position: { x: 0, y: 0, z: 0 },
			score: 10,
			health: gameConfig.PLAYER_MAX_HEALTH,
			maxHealth: gameConfig.PLAYER_MAX_HEALTH,
			invulnerableUntil: 0,
			speedBoostUntil: 0,
			dashCooldownUntil: 0,
			dashUnlimitedUntil: 0,
			attackCooldownUntil: 0,
			lastUpdate: Date.now(),
			disconnectedAt: Date.now(),
		};
		state.socketToPlayerId.set("socket-expire", "player-expire");

		const expired = state.expireDisconnectedPlayer("player-expire");
		expect(expired?.id).toBe("player-expire");
		expect(state.resolvePlayerId("socket-expire")).toBeUndefined();
	});

	it("returns false when resolvePlayerPush finds no overlap", () => {
		const state = new GameState(gameConfig);
		state.joinPlayer("socket-a", "Alpha", "player-a");
		state.joinPlayer("socket-b", "Bravo", "player-b");

		state.players["player-a"].position = { x: 0, y: 0, z: 0 };
		state.players["player-b"].position = { x: 999, y: 0, z: 999 };

		expect(state.resolvePlayerPush("player-a")).toBe(false);
	});

	it("covers player scale ceiling and player radius calculation", () => {
		const state = new GameState(gameConfig);
		const hugeScale = state.getPlayerScale(999999);
		expect(hugeScale).toBe(gameConfig.MAX_SIZE_MULTIPLIER);

		const join = state.joinPlayer("socket-radius", "Radius", "player-radius");
		const joinedPlayer = expectJoinedPlayer(join);
		const player = state.players[joinedPlayer.id];
		player.score = 50;
		expect(state.getPlayerRadius(player)).toBeGreaterThan(
			gameConfig.PLAYER_BASE_RADIUS,
		);
	});

	it("returns undefined for getPlayer when mapping exists but player is missing", () => {
		const state = new GameState(gameConfig);
		state.socketToPlayerId.set("socket-ghost", "ghost-player");
		expect(state.getPlayer("socket-ghost")).toBeUndefined();
	});

	it("keeps ball count stable when already at target", () => {
		const state = new GameState(gameConfig);
		const result = state.maintainBallCount();
		expect(result.spawned).toEqual([]);
		expect(result.despawned).toEqual([]);
	});

	it("rejoins with same socket without removing previous mapping", () => {
		const state = new GameState(gameConfig);
		state.joinPlayer("socket-same", "Alpha", "player-same");
		const rejoined = state.joinPlayer("socket-same", "Alpha2", "player-same");

		expect(rejoined.player?.id).toBe("player-same");
		expect(state.resolvePlayerId("socket-same")).toBe("player-same");
	});

	it("keeps socket id when removePlayer is called through alternate mapping", () => {
		const state = new GameState(gameConfig);
		state.players.player = {
			id: "player",
			nickname: "Mismatch",
			socketId: "socket-real",
			connected: true,
			color: 1,
			position: { x: 0, y: 0, z: 0 },
			score: 0,
			health: gameConfig.PLAYER_MAX_HEALTH,
			maxHealth: gameConfig.PLAYER_MAX_HEALTH,
			invulnerableUntil: 0,
			speedBoostUntil: 0,
			dashCooldownUntil: 0,
			dashUnlimitedUntil: 0,
			attackCooldownUntil: 0,
			lastUpdate: Date.now(),
		};
		state.socketToPlayerId.set("socket-alias", "player");

		const removed = state.removePlayer("socket-alias");
		expect(removed?.id).toBe("player");
		expect(state.players.player.socketId).toBe("socket-real");
	});

	it("covers no-comeback branch when top score is zero but player score is positive", () => {
		const state = new GameState(gameConfig);
		state.players = {};
		state.topScore = 0;

		const scaled = state.getScaledBallValue(10, 5);
		expect(scaled).toBeGreaterThan(10);
	});

	it("covers both exact-overlap axis choices in player push", () => {
		const state = new GameState(gameConfig);

		state.players.aaa = {
			id: "aaa",
			nickname: "A",
			socketId: "aaa",
			connected: true,
			color: 1,
			position: { x: 0, y: 0, z: 0 },
			score: 0,
			health: gameConfig.PLAYER_MAX_HEALTH,
			maxHealth: gameConfig.PLAYER_MAX_HEALTH,
			invulnerableUntil: 0,
			speedBoostUntil: 0,
			dashCooldownUntil: 0,
			dashUnlimitedUntil: 0,
			attackCooldownUntil: 0,
			lastUpdate: 0,
		};
		state.players.bbb = {
			id: "bbb",
			nickname: "B",
			socketId: "bbb",
			connected: true,
			color: 1,
			position: { x: 0, y: 0, z: 0 },
			score: 0,
			health: gameConfig.PLAYER_MAX_HEALTH,
			maxHealth: gameConfig.PLAYER_MAX_HEALTH,
			invulnerableUntil: 0,
			speedBoostUntil: 0,
			dashCooldownUntil: 0,
			dashUnlimitedUntil: 0,
			attackCooldownUntil: 0,
			lastUpdate: 0,
		};

		expect(state.resolvePlayerPush("aaa")).toBe(true);
		state.players.aaa.position = { x: 0, y: 0, z: 0 };
		state.players.bbb.position = { x: 0, y: 0, z: 0 };
		expect(state.resolvePlayerPush("bbb")).toBe(true);
	});

	it("uses clampPositionToArena default skin fallback when config skin is zero", () => {
		const zeroSkinState = new GameState({
			...gameConfig,
			ARENA_EDGE_SKIN: 0,
		});

		const position = { x: 999, y: 0, z: 999 };
		zeroSkinState.clampPositionToArena(position, 0);
		expect(zeroSkinState.isInsideArena(position, 0)).toBe(true);
	});

	it("supports schedulePlayerRemoval when timeout handle has no unref", () => {
		const state = new GameState(gameConfig);
		const setTimeoutSpy = vi
			.spyOn(globalThis, "setTimeout")
			.mockImplementation(((handler: TimerHandler) => {
				if (typeof handler === "function") {
					handler();
				}
				return 123 as unknown as ReturnType<typeof setTimeout>;
			}) as unknown as typeof setTimeout);

		state.schedulePlayerRemoval("player-no-unref");
		expect(state.playerReconnectTimers.has("player-no-unref")).toBe(true);

		setTimeoutSpy.mockRestore();
	});
});
