import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { GameState } from '../game/types/game.types';

const GAME_STATE_TTL = 60 * 60 * 4; // 4 hours

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClientType;
  private readonly logger = new Logger(RedisService.name);

  async onModuleInit() {
    this.client = createClient({
      url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    }) as RedisClientType;

    this.client.on('error', (err) => this.logger.error('Redis error', err));
    await this.client.connect();
    this.logger.log('Redis connected');
  }

  async onModuleDestroy() {
    await this.client.disconnect();
  }

  // ─── Game State ─────────────────────────────────────────────────────────────

  async getGameState(roomId: string): Promise<GameState | null> {
    const raw = await this.client.get(`game:${roomId}:state`);
    if (!raw) return null;
    return JSON.parse(raw) as GameState;
  }

  async setGameState(roomId: string, state: GameState): Promise<void> {
    await this.client.set(`game:${roomId}:state`, JSON.stringify(state), {
      EX: GAME_STATE_TTL,
    });
  }

  async deleteGameState(roomId: string): Promise<void> {
    await this.client.del(`game:${roomId}:state`);
  }

  // ─── Disconnect Timers ───────────────────────────────────────────────────────

  async setDisconnectTimer(
    roomId: string,
    playerId: string,
    ttlSeconds: number,
  ): Promise<void> {
    await this.client.set(`game:${roomId}:disconnect:${playerId}`, '1', {
      EX: ttlSeconds,
    });
  }

  async clearDisconnectTimer(roomId: string, playerId: string): Promise<void> {
    await this.client.del(`game:${roomId}:disconnect:${playerId}`);
  }

  async isDisconnectTimerActive(
    roomId: string,
    playerId: string,
  ): Promise<boolean> {
    const val = await this.client.get(`game:${roomId}:disconnect:${playerId}`);
    return val !== null;
  }
}
