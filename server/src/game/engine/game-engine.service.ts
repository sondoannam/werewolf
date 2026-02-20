import { Injectable, Logger } from '@nestjs/common';
import {
  GameState,
  GamePhase,
  PlayerRole,
  PlayerStatus,
  WinCondition,
} from '@/game/types/game.types';
import { RedisService } from '@/redis/redis.service';

@Injectable()
export class GameEngineService {
  private readonly logger = new Logger(GameEngineService.name);

  constructor(private readonly redis: RedisService) {}

  // ─── Role Assignment ─────────────────────────────────────────────────────────

  /**
   * Assigns roles to all players based on the room config.
   * Uses Fisher-Yates shuffle for fairness.
   */
  assignRoles(state: GameState): GameState {
    const { config, players } = state;
    const roles: PlayerRole[] = [];

    // Build role pool
    for (let i = 0; i < config.werewolfCount; i++)
      roles.push(PlayerRole.WEREWOLF);
    if (config.hasSeer) roles.push(PlayerRole.SEER);
    if (config.hasDoctor) roles.push(PlayerRole.DOCTOR);
    while (roles.length < players.length) roles.push(PlayerRole.VILLAGER);

    // Fisher-Yates shuffle
    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }

    state.players = players.map((p, i) => ({ ...p, role: roles[i] }));
    return state;
  }

  // ─── Phase Transitions ───────────────────────────────────────────────────────

  /**
   * Transitions the game to the NIGHT phase.
   */
  transitionToNight(state: GameState): GameState {
    state.phase = GamePhase.NIGHT;
    state.nightActions = {};
    state.phaseEndsAt = Date.now() + state.config.nightDuration * 1000;
    state.round += 1;
    state.eventLog.push(
      `🌙 Night ${state.round} begins. Werewolves are hunting...`,
    );
    this.logger.log(`Room ${state.roomId}: -> NIGHT (round ${state.round})`);
    return state;
  }

  /**
   * Processes all night actions atomically and transitions to DAY.
   * Kill > Protect: if doctor protects the kill target, no one dies.
   */
  processNightAndTransitionToDay(state: GameState): GameState {
    const { killTarget, protectTarget } = state.nightActions;

    if (killTarget && killTarget !== protectTarget) {
      const victim = state.players.find((p) => p.id === killTarget);
      if (victim) {
        victim.status = PlayerStatus.DEAD;
        state.eventLog.push(
          `☀️ Day ${state.round}: The village woke to find ${victim.name} was killed in the night.`,
        );
      }
    } else if (killTarget && killTarget === protectTarget) {
      state.eventLog.push(
        `☀️ Day ${state.round}: The village woke to find everyone safe. The Doctor saved someone!`,
      );
    } else {
      state.eventLog.push(
        `☀️ Day ${state.round}: The village woke to find everyone safe.`,
      );
    }

    state.phase = GamePhase.DAY;
    state.phaseEndsAt = Date.now() + state.config.dayDuration * 1000;
    this.logger.log(`Room ${state.roomId}: -> DAY`);
    return state;
  }

  /**
   * Transitions to the VOTING phase.
   */
  transitionToVoting(state: GameState): GameState {
    state.phase = GamePhase.VOTING;
    state.phaseEndsAt = Date.now() + state.config.votingDuration * 1000;
    state.eventLog.push(`🗳️ Voting has begun. Choose wisely.`);
    this.logger.log(`Room ${state.roomId}: -> VOTING`);
    return state;
  }

  // ─── Voting ──────────────────────────────────────────────────────────────────

  private votes: Map<string, Map<string, string>> = new Map(); // roomId -> (voterId -> targetId)

  recordVote(roomId: string, voterId: string, targetId: string): void {
    if (!this.votes.has(roomId)) this.votes.set(roomId, new Map());
    this.votes.get(roomId)!.set(voterId, targetId);
  }

  /**
   * Tallies votes, eliminates the player with the most votes, and transitions to WIN_CHECK.
   * Ties result in no elimination.
   */
  processVotesAndExecute(state: GameState): GameState {
    const roomVotes = this.votes.get(state.roomId) ?? new Map<string, string>();
    const tally = new Map<string, number>();

    for (const targetId of roomVotes.values()) {
      tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
    }

    this.votes.delete(state.roomId); // Clear votes for next round

    let maxVotes = 0;
    let eliminated: string | null = null;
    let isTie = false;

    for (const [targetId, count] of tally.entries()) {
      if (count > maxVotes) {
        maxVotes = count;
        eliminated = targetId;
        isTie = false;
      } else if (count === maxVotes) {
        isTie = true;
      }
    }

    if (isTie || !eliminated) {
      state.eventLog.push(`⚖️ The vote was tied. No one was eliminated.`);
    } else {
      const victim = state.players.find((p) => p.id === eliminated);
      if (victim) {
        victim.status = PlayerStatus.DEAD;
        state.eventLog.push(
          `⚖️ The village voted to eliminate ${victim.name} (${victim.role}).`,
        );
      }
    }

    state.phase = GamePhase.EXECUTION;
    this.logger.log(`Room ${state.roomId}: -> EXECUTION`);
    return state;
  }

  // ─── Win Condition ───────────────────────────────────────────────────────────

  /**
   * Checks if either faction has won.
   * Village wins if all werewolves are dead.
   * Werewolves win if they equal or outnumber the remaining villagers.
   *
   * @returns WinCondition if game is over, null if it continues.
   */
  checkWinCondition(state: GameState): WinCondition | null {
    // OFFLINE players are still in the grace window — treat them as alive
    // so a disconnect doesn't prematurely trigger a win condition.
    const alivePlayers = state.players.filter(
      (p) =>
        p.status === PlayerStatus.ALIVE || p.status === PlayerStatus.OFFLINE,
    );
    const aliveWolves = alivePlayers.filter(
      (p) => p.role === PlayerRole.WEREWOLF,
    );
    const aliveVillagers = alivePlayers.filter(
      (p) => p.role !== PlayerRole.WEREWOLF,
    );

    if (aliveWolves.length === 0) {
      return WinCondition.VILLAGE;
    }
    if (aliveWolves.length >= aliveVillagers.length) {
      return WinCondition.WEREWOLF;
    }
    return null;
  }

  /**
   * Handles a player being "mod-killed" after the reconnect grace period expires.
   */
  async modKillPlayer(
    roomId: string,
    playerId: string,
  ): Promise<GameState | null> {
    const state = await this.redis.getGameState(roomId);
    if (!state) return null;

    const player = state.players.find((p) => p.id === playerId);
    if (player && player.status === PlayerStatus.OFFLINE) {
      player.status = PlayerStatus.DEAD;
      state.eventLog.push(
        `💀 ${player.name} was removed from the game (disconnected).`,
      );
      await this.redis.setGameState(roomId, state);
      this.logger.log(`Player ${player.name} mod-killed in room ${roomId}`);
    }

    return state;
  }
}
