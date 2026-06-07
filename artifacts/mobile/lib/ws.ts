/**
 * WebSocket client for Nexora real-time messaging.
 * Connects to /api/ws?token=<session-token> and broadcasts events to subscribers.
 * Auto-reconnects every 3 seconds on disconnect.
 */

export type WsEventType =
  | "new_message"
  | "message_read"
  | "friend_request"
  | "friend_accepted"
  | "notification";

export interface WsEvent {
  type: WsEventType;
  payload: unknown;
}

type Listener = (event: WsEvent) => void;

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();
let currentToken: string | null = null;

function buildWsUrl(token: string): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) {
    return `wss://${domain}/api/ws?token=${token}`;
  }
  if (typeof window !== "undefined" && window.location) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/api/ws?token=${token}`;
  }
  return `ws://localhost/api/ws?token=${token}`;
}

function connect(token: string) {
  if (ws && ws.readyState <= 1) return;

  ws = new WebSocket(buildWsUrl(token));

  ws.onopen = () => {
    if (__DEV__) console.log("[WS] connected");
  };

  ws.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data as string) as WsEvent;
      for (const l of listeners) l(event);
    } catch {
      /* ignore parse errors */
    }
  };

  ws.onclose = () => {
    ws = null;
    if (currentToken) {
      reconnectTimer = setTimeout(() => {
        if (currentToken) connect(currentToken);
      }, 3000);
    }
  };

  ws.onerror = () => {
    /* onerror is always followed by onclose, reconnect handled there */
  };
}

export function connectWs(token: string) {
  currentToken = token;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  connect(token);
}

export function disconnectWs() {
  currentToken = null;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
}

export function addWsListener(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
