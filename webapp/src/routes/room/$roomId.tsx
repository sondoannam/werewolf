import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth, useUser } from '@clerk/clerk-react'
import { useEffect, useCallback, useRef } from 'react'
import { getSocket, connectSocket } from '../../lib/socket'
import { useGameStore } from '../../lib/game-store'
import type { ClientGameState, SeerResult } from '../../lib/game.types'
import { GamePhase } from '../../lib/game.types'
import { LobbyView } from '../../components/game/LobbyView'
import { ActiveGameView } from '../../components/game/ActiveGameView'
import { GameEndedView } from '../../components/game/GameEndedView'

export const Route = createFileRoute('/room/$roomId')({
  component: GameRoomPage,
})

function GameRoomPage() {
  const { roomId } = Route.useParams()
  const navigate = useNavigate()
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const { gameState, setGameState, setRoomId, setError, setSeerResult, reset } =
    useGameStore()

  // Redirect if not signed in
  useEffect(() => {
    if (!isSignedIn) void navigate({ to: '/' })
  }, [isSignedIn, navigate])

  const hasJoined = useRef(false)

  // Socket setup — runs once when user is available
  useEffect(() => {
    if (!user) return

    connectSocket()
    const socket = getSocket()

    // If navigated directly (no state in store), emit join_room once
    if (!hasJoined.current) {
      hasJoined.current = true
      if (!gameState) {
        socket.emit('join_room', {
          roomId,
          userId: user.id,
          name: user.fullName ?? user.username ?? 'Player',
        })
      }
    }

    setRoomId(roomId)

    socket.on('state_update', (state: ClientGameState) => {
      setGameState(state)
    })

    socket.on('seer_result', (result: SeerResult) => {
      setSeerResult(result)
    })

    socket.on('error', ({ message }: { message: string }) => {
      setError(message)
    })

    return () => {
      socket.off('state_update')
      socket.off('seer_result')
      socket.off('error')
    }
  }, [user, roomId, setGameState, setRoomId, setError, setSeerResult])

  const handleLeave = useCallback(() => {
    const socket = getSocket()
    socket.emit('leave_room')
    reset()
    void navigate({ to: '/' })
  }, [navigate, reset])

  if (!gameState) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">
            Connecting to room{' '}
            <span className="text-white font-mono">{roomId}</span>...
          </p>
        </div>
      </div>
    )
  }

  const phase = gameState.phase

  return (
    <div className="min-h-screen bg-slate-950">
      {phase === GamePhase.WAITING && (
        <LobbyView gameState={gameState} onLeave={handleLeave} />
      )}
      {phase === GamePhase.ENDED ? (
        <GameEndedView gameState={gameState} onLeave={handleLeave} />
      ) : phase !== GamePhase.WAITING ? (
        <ActiveGameView gameState={gameState} />
      ) : null}
    </div>
  )
}
