import { useUser } from '@clerk/clerk-react'
import { useState } from 'react'
import { getSocket } from '../../lib/socket'
import type { ClientGameState, RoomConfig } from '../../lib/game.types'
import { PlayerStatus } from '../../lib/game.types'

interface LobbyViewProps {
  gameState: ClientGameState
  onLeave: () => void
}

export function LobbyView({ gameState, onLeave }: LobbyViewProps) {
  const { user } = useUser()
  const { players, config, roomId } = gameState
  const me = players.find((p) => p.id === user?.id)
  const isHost = me?.isHost ?? false
  const [copied, setCopied] = useState(false)

  const handleCopyLink = () => {
    void navigator.clipboard.writeText(
      `${window.location.origin}/room/${roomId}`,
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleStartGame = () => {
    if (!user) return
    getSocket().emit('start_game', { roomId, userId: user.id })
  }

  const handleConfigChange = (
    key: keyof RoomConfig,
    value: number | boolean,
  ) => {
    if (!user) return
    getSocket().emit('update_config', {
      roomId,
      userId: user.id,
      config: { [key]: value },
    })
  }

  const canStart = players.length >= 4

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-white">
              Moon<span className="text-amber-400">fall</span>
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Waiting for players...
            </p>
          </div>
          <button
            onClick={onLeave}
            className="px-4 py-2 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg transition-colors text-sm"
          >
            Leave Room
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Players */}
          <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">
                Players ({players.length}/{config.maxPlayers})
              </h2>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
              >
                {copied ? '✓ Copied!' : `🔗 ${roomId}`}
              </button>
            </div>

            <div className="space-y-2">
              {players.map((player) => (
                <div
                  key={player.id}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    player.id === user?.id
                      ? 'bg-amber-500/10 border border-amber-500/20'
                      : 'bg-slate-700/50'
                  }`}
                >
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      player.status === PlayerStatus.OFFLINE
                        ? 'bg-slate-500'
                        : 'bg-green-400'
                    }`}
                  />
                  <span className="text-white font-medium flex-1">
                    {player.name}
                  </span>
                  <div className="flex items-center gap-2">
                    {player.isHost && (
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full border border-amber-500/30">
                        Host
                      </span>
                    )}
                    {player.id === user?.id && (
                      <span className="px-2 py-0.5 bg-slate-600 text-slate-300 text-xs rounded-full">
                        You
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {/* Empty slots */}
              {Array.from({ length: config.maxPlayers - players.length }).map(
                (_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-slate-700"
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                    <span className="text-slate-600 text-sm">
                      Waiting for player...
                    </span>
                  </div>
                ),
              )}
            </div>
          </div>

          {/* Config */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-4">Game Settings</h2>

            <div className="space-y-4">
              <ConfigRow
                label="Werewolves"
                value={config.werewolfCount}
                min={1}
                max={4}
                disabled={!isHost}
                onChange={(v) => handleConfigChange('werewolfCount', v)}
              />
              <ConfigRow
                label="Max Players"
                value={config.maxPlayers}
                min={4}
                max={20}
                disabled={!isHost}
                onChange={(v) => handleConfigChange('maxPlayers', v)}
              />
              <ConfigRow
                label="Day Duration (s)"
                value={config.dayDuration}
                min={30}
                max={300}
                step={30}
                disabled={!isHost}
                onChange={(v) => handleConfigChange('dayDuration', v)}
              />
              <ConfigRow
                label="Night Duration (s)"
                value={config.nightDuration}
                min={30}
                max={120}
                step={15}
                disabled={!isHost}
                onChange={(v) => handleConfigChange('nightDuration', v)}
              />

              <div className="pt-2 border-t border-slate-700 space-y-3">
                <ToggleRow
                  label="🔮 Seer"
                  enabled={config.hasSeer}
                  disabled={!isHost}
                  onChange={(v) => handleConfigChange('hasSeer', v)}
                />
                <ToggleRow
                  label="💊 Doctor"
                  enabled={config.hasDoctor}
                  disabled={!isHost}
                  onChange={(v) => handleConfigChange('hasDoctor', v)}
                />
              </div>
            </div>

            {isHost && (
              <button
                onClick={handleStartGame}
                disabled={!canStart}
                className="w-full mt-6 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl transition-all duration-200 shadow-lg shadow-amber-500/25"
              >
                {canStart
                  ? '🌙 Start Game'
                  : `Need ${4 - players.length} more players`}
              </button>
            )}

            {!isHost && (
              <p className="mt-6 text-center text-slate-500 text-sm">
                Waiting for host to start...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConfigRow({
  label,
  value,
  min,
  max,
  step = 1,
  disabled,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  disabled: boolean
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400 text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(min, value - step))}
          disabled={disabled || value <= min}
          className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white text-sm transition-colors"
        >
          −
        </button>
        <span className="text-white font-mono w-8 text-center">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + step))}
          disabled={disabled || value >= max}
          className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white text-sm transition-colors"
        >
          +
        </button>
      </div>
    </div>
  )
}

function ToggleRow({
  label,
  enabled,
  disabled,
  onChange,
}: {
  label: string
  enabled: boolean
  disabled: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400 text-sm">{label}</span>
      <button
        onClick={() => onChange(!enabled)}
        disabled={disabled}
        className={`relative w-10 h-5 rounded-full transition-colors ${
          enabled ? 'bg-amber-500' : 'bg-slate-600'
        } disabled:opacity-40`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
