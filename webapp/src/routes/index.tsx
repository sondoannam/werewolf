import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth, useClerk, useUser } from '@clerk/clerk-react'
import { useState, useEffect, useCallback } from 'react'
import { getSocket, connectSocket } from '@/lib/socket'
import { useGameStore } from '@/lib/game-store'
import { ROLE_MAP } from '@/lib/role-cards'
import { generateGuestName } from '@/lib/guest-names'
import { useCardFanPosition } from '@/hooks/use-card-fan-position'
import Footer from '@/components/Footer'
import type { ClientGameState } from '@/lib/game.types'
import { Pen } from 'lucide-react'

export const Route = createFileRoute('/')({ component: HomePage })

// ── Card fan layout config (visual only — data comes from ROLE_MAP) ──
const CARD_FAN_LAYOUT = [
  {
    role: 'Villager' as const,
    borderColor: 'border-[#b08d57]/50',
    bgColor: 'bg-[#1a1b26]',
    labelColor: 'text-amber-500/80',
    rotation: '-rotate-12',
    offsetX: '-translate-x-[120px] md:-translate-x-[160px]',
    offsetY: 'translate-y-16 md:translate-y-12',
    z: 'z-10',
  },
  {
    role: 'Seer' as const,
    borderColor: 'border-[#6366f1]/50',
    bgColor: 'bg-[#1a1b26]',
    labelColor: 'text-indigo-400/80',
    rotation: '-rotate-4',
    offsetX: '-translate-x-[40px] md:-translate-x-[52px]',
    offsetY: 'translate-y-10 md:translate-y-6',
    z: 'z-20',
  },
  {
    role: 'Werewolf' as const,
    borderColor: 'border-[#9b1c32]',
    bgColor: 'bg-[#2b0e11]',
    labelColor: 'text-red-500/80',
    rotation: 'rotate-4',
    offsetX: 'translate-x-[40px] md:translate-x-[52px]',
    offsetY: 'translate-y-10 md:translate-y-6',
    z: 'z-20',
    featured: true,
  },
  {
    role: 'Doctor' as const,
    borderColor: 'border-[#22c55e]/50',
    bgColor: 'bg-[#1a261b]',
    labelColor: 'text-emerald-500/80',
    rotation: 'rotate-12',
    offsetX: 'translate-x-[120px] md:translate-x-[160px]',
    offsetY: 'translate-y-16 md:translate-y-12',
    z: 'z-10',
  },
]

// ── Reusable SVG thorn divider ──────────────────────────────────
function ThornDivider() {
  return (
    <div className="relative h-px w-full my-2">
      <div className="absolute inset-0 flex items-center justify-center">
        <svg
          className="w-full h-8 text-[#9b1c32]/40"
          preserveAspectRatio="none"
          viewBox="0 0 400 20"
        >
          <path
            className="opacity-30"
            d="M0,10 Q50,15 100,10 T200,10 T300,10 T400,10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
          <path d="M190,10 L200,15 L210,10 L200,5 Z" fill="currentColor" />
          <circle cx="50" cy="10" r="2" fill="currentColor" />
          <circle cx="350" cy="10" r="2" fill="currentColor" />
        </svg>
      </div>
    </div>
  )
}

/** The actual card elements — shared between fixed and in-flow modes. */
function CardFanCards() {
  return (
    <>
      {CARD_FAN_LAYOUT.map((layout) => {
        const role = ROLE_MAP.get(layout.role)
        if (!role) return null
        return (
          <div
            key={role.name}
            className={`role-card absolute ${layout.featured ? 'w-36 h-52 md:w-44 md:h-60' : 'w-32 h-48 md:w-40 md:h-56'} rounded-xl border-2 ${layout.borderColor} shadow-2xl transform ${layout.offsetX} ${layout.offsetY} ${layout.rotation} ${layout.z} cursor-pointer overflow-hidden`}
            style={{
              backgroundImage:
                'linear-gradient(135deg, #2a1b1d 0%, #1a1011 100%)',
            }}
          >
            <div
              className={`absolute inset-1 border border-white/5 rounded-lg ${layout.bgColor} flex flex-col items-center`}
            >
              <div
                className="h-3/5 w-full bg-cover bg-center rounded-t-lg"
                style={{ backgroundImage: `url('${role.image}')` }}
              />
              <div className="p-2 text-center">
                <p
                  className={`${layout.labelColor} text-xs font-bold uppercase tracking-widest mt-2 border-b border-white/10 pb-1`}
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  Role
                </p>
                <p
                  className={`text-slate-200 ${layout.featured ? 'font-bold text-lg' : 'text-sm'} mt-1 tracking-wide`}
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  {role.name}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}

function HomePage() {
  const navigate = useNavigate()
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const { signOut } = useClerk()
  const { setRoomId, setGameState, setError } = useGameStore()
  const { anchorRef, footerRef, mode, bottomOffset } = useCardFanPosition()

  const [guestName, setGuestName] = useState(() => generateGuestName())
  const rerollGuestName = useCallback(
    () => setGuestName(generateGuestName()),
    [],
  )
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
    <div className="min-h-screen relative flex flex-col items-center overflow-x-hidden">
      {/* ── Full-screen background ── */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(15, 10, 11, 0.5), rgba(15, 10, 11, 0.8)), url('/assets/images/background-1.webp')`,
        }}
      />

      {/* ── Main content ── */}
      <main className="relative z-10 w-full max-w-7xl px-4 pt-6 flex flex-col items-center gap-8 justify-center lg:justify-start lg:pt-10">
        {/* ── Logo + Title ── */}
        <header className="text-center mb-5">
          <img
            src="/assets/logo/game-icon-1.png"
            alt="Moonfall Logo"
            className="w-20 h-20 md:w-24 md:h-24 lg:w-30 lg:h-30 mx-auto drop-shadow-2xl"
          />
          <h1
            className="text-6xl md:text-8xl font-black tracking-wider mb-2 drop-shadow-2xl"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            <span className="text-silver-gradient">MOON</span>
            <span className="text-[#9b1c32]">FALL</span>
          </h1>
          <p className="text-slate-400 text-sm md:text-base tracking-[0.2em] uppercase font-light opacity-80">
            Trust No One. Survive the Night.
          </p>
        </header>

        {/* ── Glassmorphic Main Panel ── */}
        <div className="glass-panel w-full max-w-[520px] rounded-2xl shadow-glass p-1 md:p-2">
          <div className="rounded-xl border border-white/5 bg-[#0f0a0b]/40 p-5 md:p-8 flex flex-col gap-6 relative overflow-hidden">
            {/* Decorative corner accents */}
            <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-[#9b1c32]/30 rounded-tl-xl pointer-events-none" />
            <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-[#9b1c32]/30 rounded-tr-xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-16 h-16 border-b-2 border-l-2 border-[#9b1c32]/30 rounded-bl-xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-[#9b1c32]/30 rounded-br-xl pointer-events-none" />

            {isSignedIn ? (
              <>
                {/* ── Identity Section (Logged In) ── */}
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="relative group cursor-pointer">
                    <div className="w-24 h-24 rounded-full border-2 border-[#9b1c32]/50 p-1 shadow-[0_0_15px_rgba(155,28,50,0.3)] bg-[#1a0f10] relative overflow-hidden">
                      <img
                        alt="Player avatar"
                        className="w-full h-full rounded-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                        src={user?.imageUrl ?? '/assets/logo/game-icon-1.png'}
                      />
                      <div className="absolute inset-0 bg-[#9b1c32]/10 rounded-full" />
                    </div>
                  </div>
                  <div className="flex-1 text-center md:text-left w-full">
                    <label className="text-slate-400 text-xs uppercase tracking-widest font-semibold mb-2 block">
                      Your Identity
                    </label>
                    <div className="flex items-center justify-center md:justify-between gap-3 bg-black/30 p-3 rounded-lg border border-white/10">
                      <span
                        className="text-slate-200 text-xl"
                        style={{ fontFamily: "'Cinzel', serif" }}
                      >
                        {user?.fullName ?? user?.username ?? 'Adventurer'}
                      </span>
                      <button
                        onClick={() => void signOut()}
                        className="text-slate-500 hover:text-red-400 transition-colors"
                        title="Sign Out"
                      >
                        <span className="material-symbols-outlined text-xl">
                          logout
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                <ThornDivider />

                {/* ── Action Buttons ── */}
                <div className="flex flex-col gap-6">
                  {/* Create Room */}
                  <button
                    onClick={handleCreateRoom}
                    disabled={isCreating}
                    className="group relative w-full overflow-hidden rounded-xl bg-linear-to-r from-[#701020] to-[#9b1c32] p-px shadow-glow-red transition-all hover:scale-[1.01] hover:shadow-[0_0_30px_-5px_rgba(155,28,50,0.8)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="relative flex h-14 items-center justify-center gap-3 rounded-xl bg-[#260a0f] px-8 transition-all group-hover:bg-opacity-0">
                      <span className="material-symbols-outlined text-red-200 group-hover:text-white transition-colors">
                        add_circle
                      </span>
                      <span className="font-bold text-lg tracking-wide text-red-100 group-hover:text-white transition-colors">
                        {isCreating ? 'Creating...' : 'Create New Lobby'}
                      </span>
                    </div>
                  </button>

                  {/* Divider */}
                  <div className="flex items-center gap-4 text-slate-500 text-sm font-medium">
                    <div className="h-px bg-white/10 flex-1" />
                    <span className="uppercase tracking-widest text-xs">
                      Or Join Existing
                    </span>
                    <div className="h-px bg-white/10 flex-1" />
                  </div>
                </div>
              </>
            ) : (
              /* ── Not signed in ── */
              <div className="flex flex-col gap-6">
                {/* Guest identity */}
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="relative shrink-0">
                    <div className="w-20 h-20 rounded-full border-2 border-slate-600/50 p-1 shadow-[0_0_10px_rgba(100,100,120,0.2)] bg-[#1a0f10] overflow-hidden">
                      <img
                        alt="Guest avatar"
                        className="w-full h-full rounded-full object-cover opacity-60"
                        src="/assets/logo/game-icon-1.png"
                      />
                      <div className="absolute inset-0 bg-slate-500/10 rounded-full" />
                    </div>
                    <div className="absolute bottom-0 right-0 h-7 w-7 flex items-center justify-center bg-slate-700 text-slate-300 rounded-full shadow-lg border border-slate-600 transform translate-x-1 translate-y-1">
                      <Pen className="w-3 h-3" />
                    </div>
                  </div>
                  <div className="flex-1 w-full">
                    <label className="text-slate-400 text-xs uppercase tracking-widest font-semibold mb-2 block">
                      Guest Identity
                    </label>
                    <div className="flex items-center gap-3 bg-black/30 p-3 rounded-lg border border-white/10">
                      <span
                        className="flex-1 text-slate-300 text-lg"
                        style={{ fontFamily: "'Cinzel', serif" }}
                      >
                        {guestName}
                      </span>
                      <button
                        onClick={rerollGuestName}
                        className="text-slate-500 hover:text-white transition-colors"
                        title="Randomize Name"
                      >
                        <span className="material-symbols-outlined">
                          refresh
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                <ThornDivider />

                {/* Sign in / Play as Guest buttons */}
                <div className="flex flex-col gap-4">
                  <a
                    href="/sign-in"
                    className="group relative w-full overflow-hidden rounded-xl bg-linear-to-r from-[#701020] to-[#9b1c32] p-px shadow-glow-red transition-all hover:scale-[1.01] hover:shadow-[0_0_30px_-5px_rgba(155,28,50,0.8)]"
                  >
                    <div className="relative flex h-14 items-center justify-center gap-3 rounded-xl bg-[#260a0f] px-8 transition-all group-hover:bg-opacity-0">
                      <span className="material-symbols-outlined text-red-200 group-hover:text-white transition-colors">
                        login
                      </span>
                      <span className="font-bold text-lg tracking-wide text-red-100 group-hover:text-white transition-colors">
                        Login with Google
                      </span>
                    </div>
                  </a>

                  <div className="flex items-center gap-4 text-slate-500 text-sm font-medium">
                    <div className="h-px bg-white/10 flex-1" />
                    <span className="uppercase tracking-widest text-xs">
                      or
                    </span>
                    <div className="h-px bg-white/10 flex-1" />
                  </div>
                </div>
              </div>
            )}

            {/* Join Room */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                    tag
                  </span>
                </div>
                <input
                  className="w-full h-14 bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 text-slate-200 placeholder-slate-600 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono tracking-widest text-lg uppercase shadow-inner outline-none"
                  maxLength={6}
                  placeholder="Enter Room Code"
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                />
              </div>
              <button
                onClick={handleJoinRoom}
                disabled={isJoining || !joinCode.trim()}
                className="h-14 px-8 rounded-xl bg-[#1e1b4b] border border-indigo-500/30 text-indigo-100 font-bold tracking-wide hover:bg-indigo-900/50 hover:border-indigo-400 hover:text-white hover:shadow-glow-blue transition-all flex items-center justify-center gap-2 min-w-[140px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{isJoining ? '...' : 'Join'}</span>
                <span className="material-symbols-outlined text-sm">
                  arrow_forward
                </span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Anchor: the hook measures the gap from here to viewport bottom */}
      <div ref={anchorRef} className="w-full mt-10" />

      {/* ── Role Card Fan ── */}
      <div className="relative z-20 w-full flex justify-center h-[400px] pointer-events-auto">
        {mode === 'fixed' ? (
          // Fixed to viewport bottom, lifting by however many px of footer are visible
          <div
            className="fixed z-20 w-full max-w-4xl left-1/2 -translate-x-1/2 flex justify-center h-[300px] pointer-events-auto transition-[bottom] duration-150"
            style={{ bottom: bottomOffset }}
          >
            <CardFanCards />
          </div>
        ) : (
          // In-flow: sits directly below the panel
          <div className="relative w-full max-w-4xl flex justify-center h-full">
            <CardFanCards />
          </div>
        )}
      </div>

      {/* ── Copyright Footer ── */}
      <Footer ref={footerRef} />
    </div>
  )
}
