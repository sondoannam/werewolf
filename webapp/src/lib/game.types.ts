/**
 * @file game.types.ts
 * @description Shared game types for the Moonfall frontend.
 * These mirror the server-side types but represent the sanitized client view.
 */

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
  OFFLINE = 'OFFLINE',
}

export enum WinCondition {
  VILLAGE = 'VILLAGE',
  WEREWOLF = 'WEREWOLF',
}

export interface PlayerView {
  id: string
  name: string
  status: PlayerStatus
  isHost: boolean
  role: PlayerRole | 'UNKNOWN'
}

export interface RoomConfig {
  maxPlayers: number
  werewolfCount: number
  hasSeer: boolean
  hasDoctor: boolean
  dayDuration: number
  nightDuration: number
  votingDuration: number
}

/** The sanitized game state received from the server */
export interface ClientGameState {
  roomId: string
  phase: GamePhase
  round: number
  players: PlayerView[]
  config: RoomConfig
  phaseEndsAt: number | null
  winner: WinCondition | null
  eventLog: string[]
  myRole: PlayerRole | null
  myStatus: PlayerStatus
}

export interface SeerResult {
  targetId: string
  targetName: string
  isWerewolf: boolean
}
