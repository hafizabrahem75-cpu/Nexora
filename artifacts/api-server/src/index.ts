import { db, sessionsTable } from "@workspace/db";
import { and, eq, gt, or } from "drizzle-orm";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import app from "./app";
import { logger } from "./lib/logger";
import { startSessionCleanup } from "./lib/sessionCleanup";
import { wsManager } from "./lib/wsManager";
import { hashSessionToken } from "./lib/sessionToken";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = createServer(app);

const wss = new WebSocketServer({ server, path: "/api/ws", maxPayload: 1024 });

wss.on("connection", (ws) => {
  let authenticated = false;
  let authInProgress = false;

  const authTimeout = setTimeout(() => {
    if (!authenticated) ws.close(4001, "unauthorized");
  }, 10_000);

  ws.on("message", async (raw) => {
    // The only client-to-server frame currently supported is the initial auth frame.
    if (authenticated || authInProgress) return;

    let token: string | undefined;
    try {
      const message = JSON.parse(raw.toString()) as { type?: unknown; token?: unknown };
      if (message.type !== "auth" || typeof message.token !== "string") {
        ws.close(4000, "bad_request");
        return;
      }
      token = message.token;
      if (token.length < 32 || token.length > 512) {
        ws.close(4001, "unauthorized");
        return;
      }
    } catch {
      ws.close(4000, "bad_request");
      return;
    }

    authInProgress = true;

    try {
      const [row] = await db
        .select({
          id: sessionsTable.id,
          userId: sessionsTable.userId,
          storedToken: sessionsTable.token,
        })
        .from(sessionsTable)
        .where(
          and(
            or(
              eq(sessionsTable.token, hashSessionToken(token)),
              // Temporary compatibility for existing sessions; upgrade after auth.
              eq(sessionsTable.token, token),
            ),
            gt(sessionsTable.expiresAt, new Date()),
          ),
        )
        .limit(1);

      if (!row) {
        ws.close(4001, "unauthorized");
        return;
      }

      const tokenDigest = hashSessionToken(token);
      if (row.storedToken !== tokenDigest) {
        await db.update(sessionsTable)
          .set({ token: tokenDigest })
          .where(eq(sessionsTable.id, row.id));
      }

      authenticated = true;
      clearTimeout(authTimeout);
      wsManager.register(row.userId, ws);
      ws.send(JSON.stringify({ type: "authenticated", payload: { ok: true } }));
      logger.info({ userId: row.userId }, "WS connected");

      ws.on("close", () => {
        wsManager.unregister(row.userId, ws);
        logger.info({ userId: row.userId }, "WS disconnected");
      });

      ws.on("error", (err) => {
        logger.error({ err, userId: row.userId }, "WS error");
      });
    } catch (err) {
      logger.error({ err }, "WS auth lookup failed");
      ws.close(4500, "server_error");
    }
  });

  ws.on("close", () => clearTimeout(authTimeout));
});

server.on("error", (err) => {
  logger.error({ err }, "Server error");
  process.exit(1);
});

server.listen(port, () => {
  logger.info({ port }, "Server listening");
  startSessionCleanup();
});
