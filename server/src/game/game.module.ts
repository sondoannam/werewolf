import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { LiveKitModule } from './livekit.module';

@Module({
  imports: [LiveKitModule],
  providers: [GameGateway],
})
export class GameModule {}
