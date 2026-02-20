import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import {
  GameState,
  GamePhase,
  Player,
  PlayerStatus,
  DEFAULT_ROOM_CONFIG,
  RoomConfig,
} from './types/game.types';

@Injectable()
export class RoomService {
  private readonly logger = new Logger(RoomService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Creates a new room with the given host player.
   */
  async createRoom(
    roomId: string,
    host: Omit<Player, 'role' | 'status' | 'isHost'>,
    config?: Partial<RoomConfig>,
  ): Promise<GameState> {
    const hostPlayer: Player = {
      ...host,
      role: null,
      status: PlayerStatus.ALIVE,
      isHost: true,
    };

    const state: GameState = {
      roomId,
      phase: GamePhase.WAITING,
      round: 0,
      players: [hostPlayer],
      config: { ...DEFAULT_ROOM_CONFIG, ...config },
      nightActions: {},
      phaseEndsAt: null,
      winner: null,
      eventLog: [],
    };

    await this.redis.setGameState(roomId, state);
    this.logger.log(`Room ${roomId} created by ${host.name}`);
    return state;
  }

  /**
   * Adds a player to an existing room.
   * Returns the updated state, or null if the room is full or not in WAITING phase.
   */
  async joinRoom(
    roomId: string,
    player: Omit<Player, 'role' | 'status' | 'isHost'>,
  ): Promise<{ state: GameState; error?: string }> {
    const state = await this.redis.getGameState(roomId);

    if (!state) {
      return { state: null!, error: 'Room not found' };
    }

    // Handle reconnect: player already exists (same userId)
    const existingIdx = state.players.findIndex((p) => p.id === player.id);
    if (existingIdx !== -1) {
      state.players[existingIdx].socketId = player.socketId;
      state.players[existingIdx].status = PlayerStatus.ALIVE;
      delete state.players[existingIdx].disconnectedAt;
      await this.redis.setGameState(roomId, state);
      return { state };
    }

    if (state.phase !== GamePhase.WAITING) {
      return { state, error: 'Game already in progress' };
    }
    if (state.players.length >= state.config.maxPlayers) {
      return { state, error: 'Room is full' };
    }

    const newPlayer: Player = {
      ...player,
      role: null,
      status: PlayerStatus.ALIVE,
      isHost: false,
    };

    state.players.push(newPlayer);
    await this.redis.setGameState(roomId, state);
    return { state };
  }

  /**
   * Marks a player as OFFLINE and starts the 60s reconnect timer.
   */
  async handleDisconnect(
    roomId: string,
    socketId: string,
  ): Promise<GameState | null> {
    const state = await this.redis.getGameState(roomId);
    if (!state) return null;

    const player = state.players.find((p) => p.socketId === socketId);
    if (!player) return null;

    player.status = PlayerStatus.OFFLINE;
    player.disconnectedAt = Date.now();

    await this.redis.setGameState(roomId, state);
    await this.redis.setDisconnectTimer(roomId, player.id, 60);

    this.logger.log(
      `Player ${player.name} disconnected from room ${roomId}. 60s grace period started.`,
    );
    return state;
  }

  /**
   * Removes a player from a WAITING room (full leave, not disconnect).
   */
  async leaveRoom(roomId: string, playerId: string): Promise<GameState | null> {
    const state = await this.redis.getGameState(roomId);
    if (!state || state.phase !== GamePhase.WAITING) return null;

    state.players = state.players.filter((p) => p.id !== playerId);

    // If host left, assign new host
    if (state.players.length > 0 && !state.players.some((p) => p.isHost)) {
      state.players[0].isHost = true;
    }

    await this.redis.setGameState(roomId, state);
    return state;
  }

  async getState(roomId: string): Promise<GameState | null> {
    return this.redis.getGameState(roomId);
  }

  /**
   * Persists an already-mutated GameState to Redis.
   * Use whenever the gateway has modified state and needs to save it
   * without going through a higher-level method.
   */
  async saveState(state: GameState): Promise<void> {
    await this.redis.setGameState(state.roomId, state);
  }

  /**
   * Updates the room configuration (host only, WAITING phase only).
   */
  async updateConfig(
    roomId: string,
    hostId: string,
    config: Partial<RoomConfig>,
  ): Promise<{ state: GameState | null; error?: string }> {
    const state = await this.redis.getGameState(roomId);
    if (!state) return { state: null, error: 'Room not found' };

    const host = state.players.find((p) => p.id === hostId && p.isHost);
    if (!host) return { state, error: 'Not authorized' };
    if (state.phase !== GamePhase.WAITING)
      return { state, error: 'Game already started' };

    state.config = { ...state.config, ...config };
    await this.redis.setGameState(roomId, state);
    return { state };
  }
}
