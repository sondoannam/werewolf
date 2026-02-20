import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { GameEngineService } from './engine/game-engine.service';
import { RoomService } from './room.service';
import { StateViewService } from './state-view.service';
import { LiveKitModule } from './livekit.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [LiveKitModule, RedisModule],
  providers: [GameGateway, GameEngineService, RoomService, StateViewService],
  exports: [RoomService, GameEngineService],
})
export class GameModule {}
