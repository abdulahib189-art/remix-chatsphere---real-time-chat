import { WSEvent } from '../types';
import { getCurrentUserId } from './api';

type Listener = (event: WSEvent) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Set<Listener> = new Set();
  private reconnectTimer: any = null;

  public connect() {
    const userId = getCurrentUserId();
    if (!userId) {
      this.disconnect();
      return;
    }

    // If already connected, make sure we re-authenticate with the current user ID
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({ type: 'auth', payload: { userId } });
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        const uid = getCurrentUserId();
        if (uid) {
          this.send({ type: 'auth', payload: { userId: uid } });
        }
      };

      this.ws.onmessage = (e) => {
        try {
          const event: WSEvent = JSON.parse(e.data);
          this.listeners.forEach((listener) => listener(event));
        } catch (err) {
          console.error('Failed to parse WS payload:', err);
        }
      };

      this.ws.onclose = () => {
        this.ws = null;
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        // Silently close socket to trigger onclose and scheduled reconnect
        try {
          if (this.ws) {
            this.ws.close();
          }
        } catch {
          // ignore error on close
        }
        this.ws = null;
      };
    } catch {
      this.ws = null;
      this.scheduleReconnect();
    }
  }

  public disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }

  private scheduleReconnect() {
    if (!getCurrentUserId()) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 3000);
  }

  public send(event: WSEvent) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }

  public subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public startTyping(conversationId: string, userName: string) {
    const userId = getCurrentUserId();
    this.send({
      type: 'typing_start',
      payload: { conversationId, userId, userName },
    });
  }

  public stopTyping(conversationId: string) {
    const userId = getCurrentUserId();
    this.send({
      type: 'typing_stop',
      payload: { conversationId, userId },
    });
  }
}

export const wsClient = new WebSocketClient();
