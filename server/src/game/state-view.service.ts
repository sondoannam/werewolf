import { Injectable } from '@nestjs/common';
import {
  GameState,
  Player,
  PlayerRole,
  PlayerStatus,
  ClientGameState,
  PlayerView,
} from './types/game.types';

@Injectable()
export class StateViewService {
  /**
   * Sanitizes the full GameState into a ClientGameState for a specific player.
   * This enforces information asymmetry:
   * - Werewolves can see each other's roles.
   * - Seers see the result of their investigation via the event log.
   * - All other players see 'UNKNOWN' for living players' roles.
   * - Dead players' roles are always revealed.
   */
  buildClientView(state: GameState, viewerPlayer: Player): ClientGameState {
    const isWerewolf = viewerPlayer.role === PlayerRole.WEREWOLF;

    const players: PlayerView[] = state.players.map((p) => {
      let role: PlayerRole | 'UNKNOWN';

      if (p.status === PlayerStatus.DEAD) {
        // Dead players' roles are always revealed
        role = p.role ?? 'UNKNOWN';
      } else if (p.id === viewerPlayer.id) {
        // Player always sees their own role
        role = p.role ?? 'UNKNOWN';
      } else if (isWerewolf && p.role === PlayerRole.WEREWOLF) {
        // Werewolves see each other
        role = PlayerRole.WEREWOLF;
      } else {
        role = 'UNKNOWN';
      }

      return {
        id: p.id,
        name: p.name,
        status: p.status,
        isHost: p.isHost,
        role,
      };
    });

    return {
      roomId: state.roomId,
      phase: state.phase,
      round: state.round,
      players,
      config: state.config,
      phaseEndsAt: state.phaseEndsAt,
      winner: state.winner,
      eventLog: state.eventLog,
      myRole: viewerPlayer.role,
      myStatus: viewerPlayer.status,
    };
  }
}
