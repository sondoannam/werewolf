import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { RoomService } from './room.service';
import { GameEngineService } from './engine/game-engine.service';
import { StateViewService } from './state-view.service';
import { GamePhase, PlayerRole, PlayerStatus } from './types/game.types';
import type { GameState } from './types/game.types';
import { nanoid } from 'nanoid';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'game',
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(GameGateway.name);

  /** Maps socketId -> { roomId, playerId } for disconnect handling */
  private socketRoomMap = new Map<
    string,
    { roomId: string; playerId: string }
  >();

  constructor(
    private readonly roomService: RoomService,
    private readonly engine: GameEngineService,
    private readonly stateView: StateViewService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    const info = this.socketRoomMap.get(client.id);
    if (!info) return;

    const { roomId, playerId } = info;
    this.socketRoomMap.delete(client.id);

    const state = await this.roomService.handleDisconnect(roomId, client.id);
    if (!state) return;

    this.broadcastState(state);
    this.logger.log(`Player ${playerId} disconnected from room ${roomId}`);

    // Schedule mod-kill after grace period
    setTimeout(async () => {
      const latestState = await this.engine.modKillPlayer(roomId, playerId);
      if (latestState) {
        this.broadcastState(latestState);
        // Check win condition after mod-kill
        const winner = this.engine.checkWinCondition(latestState);
        if (winner) {
          latestState.winner = winner;
          latestState.phase = GamePhase.ENDED;
          this.broadcastState(latestState);
        }
      }
    }, 60_000);
  }

  // ─── Lobby Events ────────────────────────────────────────────────────────────

  @SubscribeMessage('create_room')
  async handleCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { userId: string; name: string; roomId?: string },
  ) {
    const roomId = payload.roomId ?? nanoid(8).toUpperCase();
    const state = await this.roomService.createRoom(roomId, {
      id: payload.userId,
      name: payload.name,
      socketId: client.id,
    });

    this.socketRoomMap.set(client.id, { roomId, playerId: payload.userId });
    await client.join(roomId);

    client.emit('room_created', { roomId });
    this.broadcastState(state);
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string; userId: string; name: string },
  ) {
    const { state, error } = await this.roomService.joinRoom(payload.roomId, {
      id: payload.userId,
      name: payload.name,
      socketId: client.id,
    });

    if (error) {
      client.emit('error', { message: error });
      return;
    }

    this.socketRoomMap.set(client.id, {
      roomId: payload.roomId,
      playerId: payload.userId,
    });
    await client.join(payload.roomId);

    this.broadcastState(state);
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(@ConnectedSocket() client: Socket) {
    const info = this.socketRoomMap.get(client.id);
    if (!info) return;

    const { roomId, playerId } = info;
    this.socketRoomMap.delete(client.id);

    const state = await this.roomService.leaveRoom(roomId, playerId);
    await client.leave(roomId);

    if (state) this.broadcastState(state);
  }

  @SubscribeMessage('update_config')
  async handleUpdateConfig(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      roomId: string;
      userId: string;
      config: Record<string, unknown>;
    },
  ) {
    const { state, error } = await this.roomService.updateConfig(
      payload.roomId,
      payload.userId,
      payload.config as any,
    );
    if (error) {
      client.emit('error', { message: error });
      return;
    }
    if (state) this.broadcastState(state);
  }

  // ─── Game Start ──────────────────────────────────────────────────────────────

  @SubscribeMessage('start_game')
  async handleStartGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string; userId: string },
  ) {
    const state = await this.roomService.getState(payload.roomId);
    if (!state) {
      client.emit('error', { message: 'Room not found' });
      return;
    }

    const host = state.players.find((p) => p.id === payload.userId && p.isHost);
    if (!host) {
      client.emit('error', { message: 'Not authorized' });
      return;
    }

    if (state.players.length < 4) {
      client.emit('error', { message: 'Need at least 4 players to start' });
      return;
    }

    // Assign roles and start first night
    let updated = this.engine.assignRoles(state);
    updated = this.engine.transitionToNight(updated);
    updated.eventLog.push(
      `🎮 Game started with ${updated.players.length} players.`,
    );

    await this.broadcastState(updated);
  }

  // ─── Night Actions ───────────────────────────────────────────────────────────

  @SubscribeMessage('night_action')
  async handleNightAction(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      roomId: string;
      actorId: string;
      targetId: string;
      role: PlayerRole;
    },
  ) {
    const state = await this.roomService.getState(payload.roomId);
    if (!state || state.phase !== GamePhase.NIGHT) return;

    const actor = state.players.find((p) => p.id === payload.actorId);
    if (!actor || actor.role !== payload.role) return;

    switch (payload.role) {
      case PlayerRole.WEREWOLF:
        state.nightActions.killTarget = payload.targetId;
        break;
      case PlayerRole.DOCTOR:
        state.nightActions.protectTarget = payload.targetId;
        break;
      case PlayerRole.SEER: {
        state.nightActions.investigateTarget = payload.targetId;
        const target = state.players.find((p) => p.id === payload.targetId);
        if (target) {
          const isWolf = target.role === PlayerRole.WEREWOLF;
          // Only emit to the seer
          client.emit('seer_result', {
            targetId: target.id,
            targetName: target.name,
            isWerewolf: isWolf,
          });
        }
        break;
      }
    }

    // Check if all required actions are submitted
    const allActionsIn = this.allNightActionsSubmitted(state);
    if (allActionsIn) {
      const updated = this.engine.processNightAndTransitionToDay(state);
      const winner = this.engine.checkWinCondition(updated);
      if (winner) {
        updated.winner = winner;
        updated.phase = GamePhase.ENDED;
      }
      await this.broadcastState(updated);
    } else {
      // Save partial night actions back to Redis
      await this.roomService['redis'].setGameState(state.roomId, state);
    }
  }

  // ─── Voting ──────────────────────────────────────────────────────────────────

  @SubscribeMessage('cast_vote')
  async handleVote(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { roomId: string; voterId: string; targetId: string },
  ) {
    const state = await this.roomService.getState(payload.roomId);
    if (!state || state.phase !== GamePhase.VOTING) return;

    const voter = state.players.find((p) => p.id === payload.voterId);
    if (!voter || voter.status !== PlayerStatus.ALIVE) return;

    this.engine.recordVote(payload.roomId, payload.voterId, payload.targetId);

    // Phase transition is timer-based; emit acknowledgement
    this.server.to(payload.roomId).emit('vote_recorded', {
      voterId: payload.voterId,
      voterName: voter.name,
    });
  }

  @SubscribeMessage('end_voting')
  async handleEndVoting(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string; userId: string },
  ) {
    const state = await this.roomService.getState(payload.roomId);
    if (!state || state.phase !== GamePhase.VOTING) return;

    const host = state.players.find((p) => p.id === payload.userId && p.isHost);
    if (!host) {
      client.emit('error', { message: 'Not authorized' });
      return;
    }

    let updated = this.engine.processVotesAndExecute(state);
    const winner = this.engine.checkWinCondition(updated);

    if (winner) {
      updated.winner = winner;
      updated.phase = GamePhase.ENDED;
    } else {
      // Continue to next night
      updated = this.engine.transitionToNight(updated);
    }

    await this.broadcastState(updated);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Broadcasts a personalized state view to each player in the room.
   */
  private async broadcastState(state: GameState): Promise<void> {
    for (const player of state.players) {
      const sockets = await this.server.in(state.roomId).fetchSockets();
      const playerSocket = sockets.find((s) => s.id === player.socketId);
      if (playerSocket) {
        const view = this.stateView.buildClientView(state, player);
        playerSocket.emit('state_update', view);
      }
    }
  }

  private allNightActionsSubmitted(state: GameState): boolean {
    const { nightActions, players, config } = state;
    const hasKill = !!nightActions.killTarget;
    const needsProtect = config.hasDoctor;
    const needsSeer = config.hasSeer;

    const hasProtect = !needsProtect || !!nightActions.protectTarget;
    const hasSeer = !needsSeer || !!nightActions.investigateTarget;

    return hasKill && hasProtect && hasSeer;
  }
}
