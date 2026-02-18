/**
 * @file game.types.ts
 * @description Canonical type definitions for the Moonfall game state machine.
 * These types define the shape of all data flowing through the system.
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum GamePhase {
  WAITING = 'WAITING',
  NIGHT = 'NIGHT',
  DAY = 'DAY',
  VOTING = 'VOTING',
  EXECUTION = 'EXECUTION',
  WIN_CHECK = 'WIN_CHECK',
  ENDED = 'ENDED',
}

export enum PlayerRole {
  VILLAGER = 'VILLAGER',
  WEREWOLF = 'WEREWOLF',
  SEER = 'SEER',
  DOCTOR = 'DOCTOR',
}

export enum PlayerStatus {
  ALIVE = 'ALIVE',
  DEAD = 'DEAD',
  OFFLINE = 'OFFLINE', // Disconnected, within grace period
}

export enum WinCondition {
  VILLAGE = 'VILLAGE',
  WEREWOLF = 'WEREWOLF',
}

// ─── Player ───────────────────────────────────────────────────────────────────

export interface Player {
  id: string; // Clerk user ID
  name: string;
  socketId: string;
  role: PlayerRole | null; // null until game starts
  status: PlayerStatus;
  isHost: boolean;
  disconnectedAt?: number; // timestamp for reconnect window
}

/** A sanitized view of a player sent to OTHER players (hides role) */
export interface PlayerView {
  id: string;
  name: string;
  status: PlayerStatus;
  isHost: boolean;
  role: PlayerRole | 'UNKNOWN'; // Only revealed if dead or if viewer is werewolf
}

// ─── Room Config ──────────────────────────────────────────────────────────────

export interface RoomConfig {
  /** Total player slots */
  maxPlayers: number;
  /** Number of werewolves */
  werewolfCount: number;
  /** Include Seer role */
  hasSeer: boolean;
  /** Include Doctor role */
  hasDoctor: boolean;
  /** Day discussion phase duration in seconds */
  dayDuration: number;
  /** Night action phase duration in seconds */
  nightDuration: number;
  /** Voting phase duration in seconds */
  votingDuration: number;
}

export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  maxPlayers: 10,
  werewolfCount: 2,
  hasSeer: true,
  hasDoctor: true,
  dayDuration: 120,
  nightDuration: 60,
  votingDuration: 60,
};

// ─── Night Actions ────────────────────────────────────────────────────────────

export interface NightActions {
  /** Werewolf kill target player ID */
  killTarget?: string;
  /** Doctor protect target player ID */
  protectTarget?: string;
  /** Seer investigate target player ID */
  investigateTarget?: string;
}

// ─── Game State ───────────────────────────────────────────────────────────────

/**
 * The full authoritative game state stored in Redis.
 * Only the server should mutate this object.
 */
export interface GameState {
  roomId: string;
  phase: GamePhase;
  round: number;
  players: Player[];
  config: RoomConfig;
  nightActions: NightActions;
  /** Timestamp (ms) when the current phase timer expires */
  phaseEndsAt: number | null;
  winner: WinCondition | null;
  /** Log of events for the current game (e.g. "Player X was eliminated") */
  eventLog: string[];
}

// ─── Socket Event Payloads ────────────────────────────────────────────────────

/** Client -> Server */
export interface JoinRoomPayload {
  roomId: string;
  userId: string;
  name: string;
}

export interface StartGamePayload {
  roomId: string;
  userId: string; // Must be host
}

export interface NightActionPayload {
  roomId: string;
  actorId: string;
  targetId: string;
  role: PlayerRole;
}

export interface VotePayload {
  roomId: string;
  voterId: string;
  targetId: string;
}

/** Server -> Client */
export interface GameStateUpdatePayload {
  /** The sanitized state for this specific player */
  state: ClientGameState;
}

/**
 * The sanitized game state sent to each client.
 * Role information is filtered based on the viewer's own role.
 */
export interface ClientGameState {
  roomId: string;
  phase: GamePhase;
  round: number;
  players: PlayerView[];
  config: RoomConfig;
  phaseEndsAt: number | null;
  winner: WinCondition | null;
  eventLog: string[];
  /** The viewer's own role (only they can see this) */
  myRole: PlayerRole | null;
  myStatus: PlayerStatus;
}
