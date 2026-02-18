import { Injectable, OnModuleInit } from '@nestjs/common';
import { RoomServiceClient, AccessToken } from 'livekit-server-sdk';

@Injectable()
export class LiveKitService implements OnModuleInit {
  private roomService: RoomServiceClient;

  onModuleInit() {
    const url = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const secret = process.env.LIVEKIT_API_SECRET;

    if (!url || !apiKey || !secret) {
      throw new Error('LiveKit configuration missing');
    }

    this.roomService = new RoomServiceClient(url, apiKey, secret);
  }

  async generateToken(
    roomName: string,
    participantName: string,
    identity: string,
  ): Promise<string> {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const secret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !secret) {
      throw new Error('LiveKit configuration missing');
    }

    const at = new AccessToken(apiKey, secret, {
      identity,
      name: participantName,
    });
    at.addGrant({ roomJoin: true, room: roomName });
    return at.toJwt();
  }

  async muteParticipant(
    roomName: string,
    identity: string,
    muted: boolean,
  ): Promise<void> {
    await this.roomService.mutePublishedTrack(
      roomName,
      identity,
      'audio_track_id',
      muted,
    ); // Simplification, need actual track ID or mute all
  }
}
