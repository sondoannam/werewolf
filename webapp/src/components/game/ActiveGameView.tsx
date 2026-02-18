import { useUser } from '@clerk/clerk-react'
import { useState, useEffect } from 'react'
import { getSocket } from '../../lib/socket'
import { useGameStore } from '../../lib/game-store'
import type { ClientGameState } from '../../lib/game.types'
import { GamePhase, PlayerRole, PlayerStatus } from '../../lib/game.types'

interface ActiveGameViewProps {
  gameState: ClientGameState
}

export function ActiveGameView({ gameState }: ActiveGameViewProps) {
  const { user } = useUser()
  const { seerResult } = useGameStore()
  const {
    players,
    phase,
    round,
    phaseEndsAt,
    eventLog,
    myRole,
    myStatus,
    roomId,
  } = gameState

  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null)
  const [hasActed, setHasActed] = useState(false)

  // Countdown timer
  useEffect(() => {
    if (!phaseEndsAt) {
      setTimeLeft(null)
      return
    }
    const update = () => {
      const remaining = Math.max(
        0,
        Math.floor((phaseEndsAt - Date.now()) / 1000),
      )
      setTimeLeft(remaining)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [phaseEndsAt])

  // Reset action state on phase change
  useEffect(() => {
    setSelectedTarget(null)
    setHasActed(false)
  }, [phase])

  const isAlive = myStatus === PlayerStatus.ALIVE

  const handleNightAction = (targetId: string) => {
    if (!user || hasActed || !isAlive) return
    setSelectedTarget(targetId)
    setHasActed(true)
    getSocket().emit('night_action', {
      roomId,
      actorId: user.id,
      targetId,
      role: myRole,
    })
  }

  const handleVote = (targetId: string) => {
    if (!user || hasActed || !isAlive) return
    setSelectedTarget(targetId)
    setHasActed(true)
    getSocket().emit('cast_vote', {
      roomId,
      voterId: user.id,
      targetId,
    })
  }

  const phaseConfig = {
    [GamePhase.NIGHT]: {
      bg: 'from-slate-950 via-indigo-950/20 to-slate-950',
      label: '🌙 Night Phase',
      labelColor: 'text-indigo-400',
      desc: 'The village sleeps. Roles act in the dark.',
    },
    [GamePhase.DAY]: {
      bg: 'from-slate-950 via-amber-950/10 to-slate-950',
      label: '☀️ Day Phase',
      labelColor: 'text-amber-400',
      desc: 'Discuss and find the werewolves.',
    },
    [GamePhase.VOTING]: {
      bg: 'from-slate-950 via-red-950/10 to-slate-950',
      label: '🗳️ Voting Phase',
      labelColor: 'text-red-400',
      desc: 'Vote to eliminate a suspect.',
    },
    [GamePhase.EXECUTION]: {
      bg: 'from-slate-950 to-slate-950',
      label: '⚖️ Execution',
      labelColor: 'text-slate-400',
      desc: 'The village has spoken.',
    },
  } as const

  const currentPhase = phaseConfig[phase as keyof typeof phaseConfig] ?? {
    bg: 'from-slate-950 to-slate-950',
    label: phase,
    labelColor: 'text-slate-400',
    desc: '',
  }

  return (
    <div className={`min-h-screen bg-gradient-to-b ${currentPhase.bg} p-6`}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <span className={`text-lg font-bold ${currentPhase.labelColor}`}>
              {currentPhase.label}
            </span>
            <p className="text-slate-500 text-sm">{currentPhase.desc}</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-500 text-sm">Round {round}</span>
            {timeLeft !== null && (
              <div
                className={`px-4 py-2 rounded-xl font-mono text-xl font-bold ${
                  timeLeft <= 10
                    ? 'text-red-400 bg-red-500/10'
                    : 'text-white bg-slate-800'
                }`}
              >
                {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:
                {String(timeLeft % 60).padStart(2, '0')}
              </div>
            )}
          </div>
        </div>

        {/* My Role Banner */}
        {myRole && (
          <div className="mb-6 p-4 rounded-xl bg-slate-800/50 border border-slate-700 flex items-center gap-3">
            <span className="text-2xl">
              {myRole === PlayerRole.WEREWOLF
                ? '🐺'
                : myRole === PlayerRole.SEER
                  ? '🔮'
                  : myRole === PlayerRole.DOCTOR
                    ? '💊'
                    : '🏡'}
            </span>
            <div>
              <p className="text-white font-semibold">
                You are the <span className="text-amber-400">{myRole}</span>
              </p>
              {myStatus === PlayerStatus.DEAD && (
                <p className="text-slate-500 text-sm">
                  You have been eliminated. You can still observe.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Seer result */}
        {seerResult && myRole === PlayerRole.SEER && (
          <div className="mb-6 p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
            <p className="text-purple-300 font-medium">
              🔮 Your vision:{' '}
              <span className="text-white">{seerResult.targetName}</span> is{' '}
              <span
                className={
                  seerResult.isWerewolf ? 'text-red-400' : 'text-green-400'
                }
              >
                {seerResult.isWerewolf ? 'a Werewolf! 🐺' : 'not a Werewolf ✓'}
              </span>
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Player Grid */}
          <div className="lg:col-span-2">
            <h2 className="text-slate-400 text-sm font-medium mb-3 uppercase tracking-wider">
              Players
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {players.map((player) => {
                const isDead = player.status === PlayerStatus.DEAD
                const isMe = player.id === user?.id
                const isSelected = selectedTarget === player.id
                const canTarget = isAlive && !hasActed && !isMe && !isDead

                const showAction =
                  (phase === GamePhase.NIGHT &&
                    myRole !== PlayerRole.VILLAGER &&
                    !isMe) ||
                  (phase === GamePhase.VOTING && !isMe)

                return (
                  <button
                    key={player.id}
                    onClick={() => {
                      if (!canTarget || !showAction) return
                      if (phase === GamePhase.VOTING) handleVote(player.id)
                      else handleNightAction(player.id)
                    }}
                    disabled={!canTarget || !showAction || isDead}
                    className={`relative p-4 rounded-xl border text-left transition-all duration-200 ${
                      isDead
                        ? 'bg-slate-900/50 border-slate-800 opacity-50'
                        : isSelected
                          ? 'bg-amber-500/20 border-amber-500 shadow-lg shadow-amber-500/20'
                          : isMe
                            ? 'bg-amber-500/10 border-amber-500/30'
                            : canTarget && showAction
                              ? 'bg-slate-800/50 border-slate-700 hover:border-slate-500 hover:bg-slate-700/50 cursor-pointer'
                              : 'bg-slate-800/50 border-slate-700'
                    }`}
                  >
                    {isDead && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-900/60">
                        <span className="text-2xl">💀</span>
                      </div>
                    )}
                    <div className="text-lg mb-1">
                      {player.role === PlayerRole.WEREWOLF
                        ? '🐺'
                        : player.role === PlayerRole.SEER
                          ? '🔮'
                          : player.role === PlayerRole.DOCTOR
                            ? '💊'
                            : player.role === PlayerRole.VILLAGER
                              ? '🏡'
                              : '👤'}
                    </div>
                    <p className="text-white font-medium text-sm truncate">
                      {player.name}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      {player.isHost && (
                        <span className="text-amber-400 text-xs">Host</span>
                      )}
                      {isMe && (
                        <span className="text-slate-500 text-xs">You</span>
                      )}
                    </div>
                    {player.role !== 'UNKNOWN' && !isMe && (
                      <span className="text-xs text-slate-500 mt-1 block">
                        {player.role}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {hasActed && phase === GamePhase.NIGHT && (
              <p className="mt-4 text-center text-slate-500 text-sm">
                ✓ Action submitted. Waiting for others...
              </p>
            )}
            {hasActed && phase === GamePhase.VOTING && (
              <p className="mt-4 text-center text-slate-500 text-sm">
                ✓ Vote cast. Waiting for others...
              </p>
            )}
          </div>

          {/* Event Log */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
            <h2 className="text-slate-400 text-sm font-medium mb-3 uppercase tracking-wider">
              Event Log
            </h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {[...eventLog].reverse().map((event, i) => (
                <p key={i} className="text-slate-300 text-sm leading-relaxed">
                  {event}
                </p>
              ))}
              {eventLog.length === 0 && (
                <p className="text-slate-600 text-sm">No events yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
