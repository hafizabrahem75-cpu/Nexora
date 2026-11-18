/**
 * WebSocket client for Nexora real-time messaging.
 * Authenticates with the session token in the first WebSocket frame (never in the URL).
 * Auto-reconnects every 3 seconds on disconnect.
 */

export type WsEventType =
  | "new_message"
  | "message_read"
  | "friend_request"
  | "friend_accepted"
  | "notification"
  | "post_liked"
  | "post_commented"
  | "post_deleted"
  | "post_updated";

export interface WsEvent {
  type: WsEventType;
  payload: unknown;
}

type Listener = (event: WsEvent) => void;

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();
let currentToken: string | null = null;

function buildWsUrl(): string {
  const configuredWsUrl = process.env.EXPO_PUBLIC_WS_URL?.trim();
  if (configuredWsUrl) return configuredWsUrl;

  // Temporary backwards compatibility for the old preview environment.
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `wss://${domain}/api/ws`;

  if (typeof window !== "undefined" && window.location) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/api/ws`;
  }
  return "ws://localhost:8080/api/ws";
}

function connect(token: string) {
  if (ws && ws.readyState <= 1) return;

  ws = new WebSocket(buildWsUrl());

  ws.onopen = () => {
    // Send the bearer token in the first encrypted WebSocket frame, not the URL.
    ws?.send(JSON.stringify({ type: "auth", token }));
    if (__DEV__) console.log("[WS] connected");
  };

  let authenticated = false;

  ws.onmessage = (e) => {
    try {
      const message = JSON.parse(e.data as string) as {
        type?: string;
        payload?: unknown;
      };

      // Do not deliver application events until the server confirms this session.
      if (message.type === "authenticated") {
        authenticated = true;
        if (__DEV__) console.log("[WS] authenticated");
        return;
      }
      if (!authenticated || typeof message.type !== "string") return;

      const event = message as WsEvent;
      for (const l of listeners) l(event);
    } catch {
      /* ignore parse errors */
    }
  };

  ws.onclose = () => {
    authenticated = false;
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
