import io, { Socket } from "socket.io-client";
import { API_BASE_URL } from "./api"; // Ensure this exports the base URL

// Remove /api from the URL to get the base socket URL
const SOCKET_URL = API_BASE_URL.replace("/api", "");

class SocketService {
  private socket: Socket | null = null;
  private listeners: { [key: string]: Function[] } = {};

  connect() {
    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      transports: ["websocket"],
      autoConnect: true,
      reconnection: true,
    });

    this.socket.on("connect", () => {
      console.log("Socket connected:", this.socket?.id);

      // Always join the delivery partners room for new order notifications
      this.socket?.emit("join-delivery-updates");
    });

    this.socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });

    this.socket.on("connect_error", (err) => {
      console.error("Socket connection error:", err);
    });

    // Handle generic events
    this.socket.onAny((event, ...args) => {
      if (this.listeners[event]) {
        this.listeners[event].forEach((callback) => callback(...args));
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinOrderRoom(orderId: string) {
    if (this.socket?.connected) {
      this.socket.emit("join-order", orderId);
      console.log(`Joined order room: ${orderId}`);
    }
  }

  updateLocation(
    orderId: string,
    location: { latitude: number; longitude: number },
    heading: number = 0,
  ) {
    if (this.socket?.connected) {
      this.socket.emit("update-location", {
        orderId,
        location,
        heading,
      });
    }
  }

  // Event Listeners
  on(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    // Also attach to actual socket if it exists (for specific events)
    if (this.socket) {
      this.socket.on(event, (...args) => callback(...args));
    }
  }

  off(event: string, callback: Function) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(
        (cb) => cb !== callback,
      );
    }
    if (this.socket) {
      this.socket.off(event);
    }
  }
}

export const socketService = new SocketService();
