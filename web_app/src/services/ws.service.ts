/**
 * Mirror of mobile_app/lib/services/websocket_service.dart.
 *
 * - URL: baseUrl with http→ws and /api→/ws, plus `?token=…`
 * - frames are `{ "type": string, "payload": object }`
 * - messages sent while disconnected are queued and flushed on connect
 * - reconnects automatically (3s) unless disconnect() was requested
 */
type WsMessage = { type: string; payload: Record<string, any> };
type Handler = (message: WsMessage) => void;

const RECONNECT_DELAY = 3000;

function buildUrl(token: string): string {
  const configured = (import.meta.env.VITE_WS_URL as string | undefined)?.trim();
  let base: string;
  if (configured) {
    base = configured;
  } else if (import.meta.env.DEV) {
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    base = `${scheme}://${window.location.host}/ws`;
  } else {
    const apiBase =
      (import.meta.env.VITE_API_URL as string | undefined)?.trim() ||
      'https://lemon16.onrender.com/api';
    base = apiBase.replace(/^http/, 'ws').replace(/\/api$/, '/ws').replace('/api', '/ws');
  }
  return `${base}?token=${encodeURIComponent(token)}`;
}

class WebSocketService {
  private socket: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private queue: WsMessage[] = [];
  private shouldReconnect = true;
  private reconnectTimer: number | null = null;
  private token: string | null = null;

  get connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  connect(token?: string | null): void {
    const effective = token ?? this.token ?? this.readToken();
    if (!effective) return;
    this.token = effective;
    this.shouldReconnect = true;
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    try {
      const socket = new WebSocket(buildUrl(effective));
      this.socket = socket;

      socket.onopen = () => {
        this.flushQueue();
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data as string);
          if (!parsed || typeof parsed !== 'object') return;
          const message: WsMessage = {
            type: String(parsed.type ?? ''),
            payload:
              parsed.payload && typeof parsed.payload === 'object'
                ? parsed.payload
                : parsed,
          };
          this.handlers.forEach((handler) => handler(message));
        } catch {
          /* ignore malformed frames */
        }
      };

      socket.onclose = () => {
        this.socket = null;
        if (this.shouldReconnect) this.scheduleReconnect();
      };

      socket.onerror = () => {
        /* onclose handles the retry */
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
  }

  send(type: string, payload: Record<string, any>): void {
    const message: WsMessage = { type, payload };
    if (this.connected) {
      this.socket!.send(JSON.stringify(message));
    } else {
      this.queue.push(message);
      this.connect();
    }
  }

  subscribe(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  private flushQueue(): void {
    const pending = this.queue;
    this.queue = [];
    pending.forEach((message) => {
      if (this.connected) this.socket!.send(JSON.stringify(message));
      else this.queue.push(message);
    });
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, RECONNECT_DELAY);
  }

  private readToken(): string | null {
    try {
      return localStorage.getItem('token') || sessionStorage.getItem('token');
    } catch {
      return null;
    }
  }
}

export const wsService = new WebSocketService();
export type { WsMessage };
