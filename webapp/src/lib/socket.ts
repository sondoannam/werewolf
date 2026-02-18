import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

const SOCKET_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export function getSocket(): Socket {
  if (!socket) {
    socket = io(`${SOCKET_URL}/game`, {
      autoConnect: false,
      // Allow polling fallback — pure websocket fails during SSR/redirect
      transports: ['polling', 'websocket'],
    })
  }
  return socket
}

export function connectSocket(): void {
  // Guard: never run in SSR/Node context
  if (typeof window === 'undefined') return
  const s = getSocket()
  if (!s.connected) s.connect()
}

export function disconnectSocket(): void {
  socket?.disconnect()
  socket = null
}
