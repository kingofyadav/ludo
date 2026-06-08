import { io, type Socket } from 'socket.io-client'

let _socket: Socket | null = null

export function getSocket(token: string): Socket {
  if (_socket && _socket.connected) return _socket
  if (_socket) _socket.disconnect()

  _socket = io('/', {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    transports: ['websocket', 'polling'],
  })
  return _socket
}

export function disconnectSocket(): void {
  _socket?.disconnect()
  _socket = null
}

export function getExistingSocket(): Socket | null {
  return _socket
}
