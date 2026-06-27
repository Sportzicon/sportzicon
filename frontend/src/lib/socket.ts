import { io, Socket } from "socket.io-client";

const BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8080") as string;

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(BASE, {
      transports: ["websocket", "polling"],
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(accessToken: string) {
  const s = getSocket();
  s.auth = { token: accessToken };
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  socket?.disconnect();
}
