import type { ClientGameState } from '../../lib/game.types'
import { WinCondition } from '../../lib/game.types'

interface GameEndedViewProps {
  gameState: ClientGameState
  onLeave: () => void
}

export function GameEndedView({ gameState, onLeave }: GameEndedViewProps) {
  const { winner, players, eventLog } = gameState
  const isVillageWin = winner === WinCondition.VILLAGE

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 flex flex-col items-center justify-center p-6">
      <div className="text-center max-w-lg w-full">
        {/* Result */}
        <div className="text-8xl mb-6">{isVillageWin ? '🏡' : '🐺'}</div>
        <h1 className="text-5xl font-black text-white mb-2">
          {isVillageWin ? 'Village Wins!' : 'Werewolves Win!'}
        </h1>
        <p className="text-slate-400 text-lg mb-10">
          {isVillageWin
            ? 'All werewolves have been eliminated. The village is safe!'
            : 'The werewolves have taken over the village. Darkness prevails.'}
        </p>

        {/* Players reveal */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-8 text-left">
          <h2 className="text-slate-400 text-sm font-medium mb-4 uppercase tracking-wider">
            Final Roles
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {players.map((player) => (
              <div
                key={player.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-slate-700/50"
              >
                <span>
                  {player.role === 'WEREWOLF'
                    ? '🐺'
                    : player.role === 'SEER'
                      ? '🔮'
                      : player.role === 'DOCTOR'
                        ? '💊'
                        : '🏡'}
                </span>
                <div>
                  <p className="text-white text-sm font-medium">
                    {player.name}
                  </p>
                  <p className="text-slate-500 text-xs">{player.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Last events */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 mb-8 text-left">
          <h2 className="text-slate-500 text-xs font-medium mb-3 uppercase tracking-wider">
            Game Summary
          </h2>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {[...eventLog]
              .reverse()
              .slice(0, 10)
              .map((event, i) => (
                <p key={i} className="text-slate-400 text-sm">
                  {event}
                </p>
              ))}
          </div>
        </div>

        <button
          onClick={onLeave}
          className="px-8 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-colors"
        >
          Back to Lobby
        </button>
      </div>
    </div>
  )
}
