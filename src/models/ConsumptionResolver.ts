import type { ConsumptionDecision, PlayerState } from './contracts';

export interface ConsumptionResolverOptions {
  sizeRatio: number;
  getRadius(player: PlayerState): number;
  hasIntent(player: PlayerState, now: number): boolean;
  isInvulnerable(player: PlayerState, now: number): boolean;
}

export class ConsumptionResolver {
  private readonly options: ConsumptionResolverOptions;

  constructor(options: ConsumptionResolverOptions) {
    this.options = options;
  }

  private static distance(left: PlayerState, right: PlayerState): number {
    const dx = left.position.x - right.position.x;
    const dz = left.position.z - right.position.z;
    return Math.sqrt((dx * dx) + (dz * dz));
  }

  private canConsume(attacker: PlayerState, defender: PlayerState, now: number): boolean {
    const attackerRadius = this.options.getRadius(attacker);
    const defenderRadius = this.options.getRadius(defender);
    const distance = ConsumptionResolver.distance(attacker, defender);

    return (
      this.options.hasIntent(attacker, now)
      && !this.options.isInvulnerable(defender, now)
      && attackerRadius >= (defenderRadius * this.options.sizeRatio)
      && distance <= attackerRadius
    );
  }

  findPassiveConsumption(players: PlayerState[], now: number): ConsumptionDecision | null {
    if (players.length < 2) return null;

    for (let i = 0; i < players.length; i += 1) {
      for (let j = 0; j < players.length; j += 1) {
        if (i === j) continue;

        const playerA = players[i];
        const playerB = players[j];

        if (this.canConsume(playerA, playerB, now)) {
          return { winnerId: playerA.id, loserId: playerB.id };
        }

        if (this.canConsume(playerB, playerA, now)) {
          return { winnerId: playerB.id, loserId: playerA.id };
        }
      }
    }

    return null;
  }

  resolveForMovedPlayer(players: PlayerState[], movedPlayerId: string, now: number): ConsumptionDecision | null {
    const movedPlayer = players.find((player) => player.id === movedPlayerId);
    if (!movedPlayer) return null;

    const movedRadius = this.options.getRadius(movedPlayer);
    const candidates: Array<{ winnerId: string; loserId: string; winnerRadius: number; distance: number }> = [];

    players.forEach((otherPlayer) => {
      if (otherPlayer.id === movedPlayerId) return;
      if (!otherPlayer.connected) return;

      const otherRadius = this.options.getRadius(otherPlayer);
      const distance = ConsumptionResolver.distance(movedPlayer, otherPlayer);

      if (this.canConsume(movedPlayer, otherPlayer, now)) {
        candidates.push({
          winnerId: movedPlayer.id,
          loserId: otherPlayer.id,
          winnerRadius: movedRadius,
          distance,
        });
        return;
      }

      if (this.canConsume(otherPlayer, movedPlayer, now)) {
        candidates.push({
          winnerId: otherPlayer.id,
          loserId: movedPlayer.id,
          winnerRadius: otherRadius,
          distance,
        });
      }
    });

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((left, right) => {
      if (right.winnerRadius !== left.winnerRadius) {
        return right.winnerRadius - left.winnerRadius;
      }
      return left.distance - right.distance;
    });

    const selected = candidates[0];
    return {
      winnerId: selected.winnerId,
      loserId: selected.loserId,
    };
  }
}
