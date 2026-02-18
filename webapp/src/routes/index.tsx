import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth, useUser } from '@clerk/clerk-react'
import { useState, useEffect } from 'react'
import { getSocket, connectSocket } from '../lib/socket'
import { useGameStore } from '../lib/game-store'
import type { ClientGameState } from '../lib/game.types'

export const Route = createFileRoute('/')({ component: HomePage })

function HomePage() {
  const navigate = useNavigate()
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const { setRoomId, setGameState, setError } = useGameStore()

  const [joinCode, setJoinCode] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)

  useEffect(() => {
    if (!isSignedIn) return

    const socket = getSocket()
    connectSocket()

    socket.on('room_created', ({ roomId }: { roomId: string }) => {
      setRoomId(roomId)
      void navigate({ to: '/room/$roomId', params: { roomId } })
    })

    socket.on('state_update', (state: ClientGameState) => {
      setGameState(state)
    })

    socket.on('error', ({ message }: { message: string }) => {
      setError(message)
      setIsCreating(false)
      setIsJoining(false)
    })

    return () => {
      socket.off('room_created')
      socket.off('state_update')
      socket.off('error')
    }
  }, [isSignedIn, navigate, setRoomId, setGameState, setError])

  const handleCreateRoom = () => {
    if (!user) return
    setIsCreating(true)
    const socket = getSocket()
    socket.emit('create_room', {
      userId: user.id,
      name: user.fullName ?? user.username ?? 'Player',
    })
  }

  const handleJoinRoom = () => {
    if (!user || !joinCode.trim()) return
    setIsJoining(true)
    const socket = getSocket()
    socket.emit('join_room', {
      roomId: joinCode.trim().toUpperCase(),
      userId: user.id,
      name: user.fullName ?? user.username ?? 'Player',
    })
    setRoomId(joinCode.trim().toUpperCase())
    void navigate({
      to: '/room/$roomId',
      params: { roomId: joinCode.trim().toUpperCase() },
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center px-4">
      {/* Hero */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium mb-6">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          Realtime Multiplayer
        </div>
        <h1 className="text-7xl font-black text-white mb-4 tracking-tight">
          Moon<span className="text-amber-400">fall</span>
        </h1>
        <p className="text-slate-400 text-xl max-w-md mx-auto">
          A social deduction game of trust, deception, and survival.
        </p>
      </div>

      {/* Actions */}
      {isSignedIn ? (
        <div className="w-full max-w-sm space-y-4">
          <button
            onClick={handleCreateRoom}
            disabled={isCreating}
            className="w-full py-4 px-6 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-lg rounded-xl transition-all duration-200 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:-translate-y-0.5"
          >
            {isCreating ? 'Creating...' : '🌙 Create Room'}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-slate-900 text-slate-500">
                or join with code
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
              placeholder="ROOM CODE"
              maxLength={8}
              className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 focus:border-amber-500 rounded-xl text-white placeholder-slate-500 font-mono text-center text-lg tracking-widest outline-none transition-colors"
            />
            <button
              onClick={handleJoinRoom}
              disabled={isJoining || !joinCode.trim()}
              className="px-5 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
            >
              {isJoining ? '...' : 'Join'}
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-slate-400 mb-4">Sign in to play</p>
          <a
            href="/sign-in"
            className="px-8 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-colors"
          >
            Sign In
          </a>
        </div>
      )}

      {/* Role preview */}
      <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl w-full">
        {[
          {
            emoji: '🐺',
            name: 'Werewolf',
            desc: 'Hunt the village',
            color: 'red',
          },
          {
            emoji: '🔮',
            name: 'Seer',
            desc: 'Reveal the truth',
            color: 'purple',
          },
          {
            emoji: '💊',
            name: 'Doctor',
            desc: 'Protect the innocent',
            color: 'green',
          },
          {
            emoji: '🏡',
            name: 'Villager',
            desc: 'Find the wolves',
            color: 'blue',
          },
        ].map((role) => (
          <div
            key={role.name}
            className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center hover:border-slate-600 transition-colors"
          >
            <div className="text-3xl mb-2">{role.emoji}</div>
            <div className="text-white font-semibold text-sm">{role.name}</div>
            <div className="text-slate-500 text-xs mt-1">{role.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
