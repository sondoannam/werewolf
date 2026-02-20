# Moonfall — Project Progress

> **Last updated:** 2026-02-19  
> **Purpose:** LLM-readable snapshot of project state, decisions, and next steps.

---

## 1. What Is Moonfall?

Moonfall is a **real-time, browser-based Werewolf (Mafia) game** for 4–20 players. Players join rooms, receive hidden roles, and play through Night/Day/Voting cycles until one faction wins. The app uses voice chat (LiveKit) for immersive, lobby-style communication.

**Project root:** `c:\Users\sondo\my_projects\werewolf`

---

## 2. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | TanStack Start (React, SSR) | Vite-based, file-based routing |
| Backend | NestJS (Node.js) | WebSocket gateway + REST |
| Real-time | Socket.io | NestJS gateway, `/game` namespace |
| Voice | LiveKit (self-hosted) | Docker container |
| Hot State | Redis | Game state storage during active games |
| Database | PostgreSQL + Prisma | Persistent data (users, history) |
| Auth | Clerk | Identity, JWT, user management |
| State (client) | Zustand | Ephemeral in-browser game state |

---

## 3. Infrastructure

### Docker Compose (`docker-compose.yml`)
Three services:

| Container | Image | Ports |
|---|---|---|
| `moonfall_postgres` | `postgres:16-alpine` | `5432` |
| `moonfall_redis` | `redis:7-alpine` | `6379` |
| `moonfall_livekit` | `livekit/livekit-server:latest` | `7880` (HTTP/WS), `7881` (TCP), `7882/udp` |

### LiveKit Config (`livekit.yaml`)
```yaml
port: 7880
rtc:
  udp_port: 7882
  tcp_port: 7881
  use_external_ip: false
logging:
  level: info
```
Keys are injected via `LIVEKIT_KEYS` env var (not in yaml) in the format `"key: secret"` (space required).

### Root `.env`
```
POSTGRES_USER=moonfall
POSTGRES_PASSWORD=password123
POSTGRES_DB=moonfall_db
LIVEKIT_KEYS=devkey: secret
```

### Server `.env` (`server/.env`)
```
DATABASE_URL=postgresql://moonfall:password123@localhost:5432/moonfall_db?schema=public
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
```

---

## 4. Backend (`server/`)

**Entry:** `src/main.ts` → `AppModule`

### Module Tree
```
AppModule
├── ConfigModule (global, loads server/.env)
├── PrismaModule
├── RedisModule
└── GameModule
    ├── RoomService
    ├── GameEngineService
    ├── StateViewService
    ├── LiveKitModule / LiveKitService
    └── GameGateway  ← Socket.io entry point
```

### Key Files

#### `src/game/types/game.types.ts`
Canonical type definitions shared across all services:
- **Enums:** `GamePhase` (`WAITING | NIGHT | DAY | VOTING | EXECUTION | ENDED`), `PlayerRole` (`WEREWOLF | SEER | DOCTOR | VILLAGER`), `PlayerStatus` (`ALIVE | DEAD | OFFLINE`)
- **Interfaces:** `Player`, `GameState`, `NightActions`, `RoomConfig`, `ClientPlayerView`, `ClientGameState`
- **Payload types:** `JoinRoomPayload`, `StartGamePayload`, `NightActionPayload`, `VotePayload`

#### `src/game/room.service.ts`
Manages lobby lifecycle using Redis:
- `createRoom(roomId, player)` — initializes `GameState` in Redis with host player
- `joinRoom(roomId, player)` — adds player; rejects if game in progress or room full
- `leaveRoom(roomId, socketId)` — removes player; promotes new host if needed
- `handleDisconnect(roomId, socketId)` — marks player `OFFLINE`, starts 60s Redis timer
- `updateConfig(roomId, config)` — host-only config update (werewolf count, max players, phase durations)
- `getState(roomId)` — Redis read

#### `src/game/engine/game-engine.service.ts`
Stateless game logic (reads/writes Redis via `RoomService`):
- `assignRoles(state)` — random role assignment respecting `config.werewolfCount`
- `transitionToNight(state)` — resets night actions, sets `phaseEndsAt`
- `transitionToDay(state)` — applies night kill/protect results, adds event log entries
- `recordVote(roomId, voterId, targetId)` — stores vote in in-memory `Map`
- `processVotesAndExecute(state)` — tallies votes, eliminates plurality target
- `checkWinCondition(state)` — returns `'village' | 'werewolf' | null`
- `modKillPlayer(roomId, playerId)` — marks disconnected player `DEAD` after grace period

#### `src/game/state-view.service.ts`
**Information asymmetry enforcer.** `buildClientView(state, viewer)` returns a `ClientGameState` where:
- Viewer always sees their own role
- Dead players' roles are always revealed
- Werewolves see each other's identity
- All other living players appear as `'UNKNOWN'`

#### `src/game/game.gateway.ts`
NestJS WebSocket gateway (`namespace: '/game'`, `cors: '*'`).  
Internal `socketRoomMap: Map<socketId, {roomId, playerId}>` tracks connected sockets.

| Event (in) | Handler | Description |
|---|---|---|
| `create_room` | `handleCreateRoom` | Creates room, emits `room_created` |
| `join_room` | `handleJoinRoom` | Joins existing room |
| `leave_room` | `handleLeaveRoom` | Removes player, broadcasts |
| `update_config` | `handleUpdateConfig` | Host updates lobby settings |
| `start_game` | `handleStartGame` | Assigns roles, transitions to Night |
| `night_action` | `handleNightAction` | Records kill/protect/investigate; transitions to Day when all submitted |
| `cast_vote` | `handleVote` | Records vote, emits `vote_recorded` |
| `end_voting` | `handleEndVoting` | Processes votes, checks win, transitions |

| Event (out) | Trigger |
|---|---|
| `room_created` | After `create_room` |
| `state_update` | After any state change (personalized per player via `StateViewService`) |
| `seer_result` | Emitted only to the Seer socket |
| `vote_recorded` | Broadcast to room on each vote |
| `error` | On validation failures |

**Disconnect handling:** 60-second grace period. If player doesn't reconnect, `modKillPlayer` is called and win condition is re-checked.

#### `src/game/livekit.service.ts`
- `generateToken(roomName, participantName, identity)` — creates a LiveKit access token for voice join
- `muteParticipant(roomName, identity, muted)` — mutes/unmutes via `RoomServiceClient`

#### `src/redis/redis.service.ts`
Thin wrapper around the `redis` npm client:
- `getGameState(roomId)` → `GameState | null`
- `setGameState(roomId, state)` → stores as JSON with no expiry during game
- `setDisconnectTimer(roomId, playerId, ttlSeconds)` → Redis TTL key for reconnect window

---

## 5. Frontend (`webapp/`)

**Framework:** TanStack Start (SSR React). Routes are file-based under `src/routes/`.

### Routes

| Path | File | Description |
|---|---|---|
| `/` | `routes/index.tsx` | Home page — Create Room / Join Room |
| `/room/$roomId` | `routes/room/$roomId.tsx` | Game room — dynamic, renders phase-appropriate view |

### Key Libraries (`src/lib/`)

#### `socket.ts`
Singleton Socket.io client factory:
- `getSocket()` — creates `io('http://localhost:3000/game', { autoConnect: false, transports: ['polling', 'websocket'] })`
- `connectSocket()` — SSR-safe (`typeof window === 'undefined'` guard), only connects once
- `disconnectSocket()` — full teardown

> **Critical:** `transports: ['polling', 'websocket']` is required. Pure `['websocket']` fails during SSR because TanStack Start renders on Node.js first.

#### `game-store.ts`
Zustand store (`useGameStore`):
```ts
{
  gameState: ClientGameState | null
  roomId: string | null
  error: string | null
  seerResult: SeerResult | null
  // actions: setGameState, setRoomId, setError, setSeerResult, reset
}
```

#### `game.types.ts`
Client-side mirror of server types. `ClientGameState` and `ClientPlayerView` use `role: PlayerRole | 'UNKNOWN'` to reflect the asymmetric view.

### Components (`src/components/game/`)

| Component | Props | Description |
|---|---|---|
| `LobbyView` | `gameState`, `onLeave` | Player list, room code copy, host config panel (werewolf count, max players, phase durations), Start Game button |
| `ActiveGameView` | `gameState` | Phase header + countdown timer, role banner, Seer result panel, player grid with clickable targets for night actions / voting, event log |
| `GameEndedView` | `gameState`, `onLeave` | Winner announcement, full role reveal table, event log, Play Again / Leave buttons |

### Route: `/room/$roomId`
Critical implementation notes:
- Uses `useRef(hasJoined)` to ensure `join_room` is emitted only once (not on re-renders)
- `gameState` is **excluded** from the `useEffect` dependency array to prevent reconnect loops on every `state_update`
- Socket listeners (`state_update`, `seer_result`, `error`) are registered once and cleaned up on unmount

---

## 6. Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Server authority | All game logic on backend | Prevents cheating; clients only receive sanitized views |
| State storage | Redis for hot game state | Low-latency reads/writes during active game; no DB overhead |
| Transport | Socket.io (polling → WS upgrade) | Required for TanStack Start SSR compatibility |
| Info asymmetry | `StateViewService` per-player broadcast | Each `state_update` emission is personalized |
| Disconnect handling | 60s grace period → mod-kill | Allows reconnection without ruining games |
| Auth | Clerk | Handles identity; `user.id` is the canonical player ID |
| Voice | LiveKit self-hosted | Full control, no per-minute SaaS costs |

---

## 7. What Works (Verified)

- [x] Docker services start cleanly (Postgres, Redis, LiveKit)
- [x] NestJS server starts: all modules initialize, all gateway events subscribed
- [x] Home page renders: Create Room / Join Room UI
- [x] `create_room` → navigates to `/room/$roomId` without crash
- [x] Room page connects to Socket.io without SSR crash
- [x] `join_room` emitted exactly once (ref-guarded)
- [x] `state_update` received and rendered in `LobbyView`
- [x] TypeScript: 0 errors on both `server/` and `webapp/`

---

## 8. What Is Not Yet Done

| Feature | Status | Notes |
|---|---|---|
| LiveKit voice join | ❌ | Token generation works; frontend integration not started |
| Phase timers (server-side) | ❌ | `phaseEndsAt` is set but no server-side `setTimeout` auto-transitions phases |
| End-voting trigger | ❌ | `end_voting` event exists; no timer or UI button to trigger it |
| Persistent game history | ❌ | Prisma schema exists but no game recording logic |
| Auth guards on gateway | ❌ | Gateway accepts any `userId` from payload; no Clerk JWT validation |
| Reconnect flow | ❌ | Grace period logic runs but UI has no "reconnecting..." feedback |
| Production build / deploy | ❌ | Dev-only setup; no env for production |
| Tests | ❌ | No unit or integration tests yet |

---

## 9. Known Gotchas

- **`LIVEKIT_KEYS` format:** Must be `"key: secret"` with a space after the colon. `"key:secret"` silently fails.
- **`transports` in socket.ts:** Must include `'polling'` first. Pure `['websocket']` crashes SSR.
- **`routeTree.gen.ts`:** Auto-generated by TanStack Router's Vite plugin on `pnpm dev`. Do not manually edit; changes will be overwritten.
- **`gameState` in useEffect deps:** Must NOT be included — causes an infinite reconnect loop on every state update.
- **`@nestjs/config`** must be installed and `ConfigModule.forRoot({ isGlobal: true })` must be the first import in `AppModule` for `process.env` vars to load from `server/.env`.

---

## 10. File Map (Quick Reference)

```
werewolf/
├── docker-compose.yml          # Postgres, Redis, LiveKit containers
├── livekit.yaml                # LiveKit server config (no hardcoded keys)
├── .env                        # Root env: Postgres creds + LIVEKIT_KEYS
│
├── server/
│   ├── .env                    # Server env: DATABASE_URL, LIVEKIT_*
│   ├── src/
│   │   ├── app.module.ts       # Root module (ConfigModule, Prisma, Redis, Game)
│   │   ├── main.ts             # Bootstrap, port 3000
│   │   ├── redis/
│   │   │   └── redis.service.ts
│   │   ├── prisma/
│   │   │   └── prisma.service.ts
│   │   └── game/
│   │       ├── types/game.types.ts      # All shared enums + interfaces
│   │       ├── game.module.ts
│   │       ├── game.gateway.ts          # Socket.io events
│   │       ├── room.service.ts          # Lobby management
│   │       ├── state-view.service.ts    # Info asymmetry
│   │       ├── livekit.service.ts       # Voice token generation
│   │       └── engine/
│   │           └── game-engine.service.ts  # Game logic state machine
│
└── webapp/
    └── src/
        ├── lib/
        │   ├── socket.ts           # Singleton Socket.io client (SSR-safe)
        │   ├── game-store.ts       # Zustand store
        │   └── game.types.ts       # Client-side type mirror
        ├── routes/
        │   ├── index.tsx           # Home: Create/Join room
        │   └── room/$roomId.tsx    # Game room (Lobby/Active/Ended views)
        └── components/game/
            ├── LobbyView.tsx
            ├── ActiveGameView.tsx
            └── GameEndedView.tsx
```
