import { db, sessionsTable } from "@workspace/db";
import { and, eq, gt } from "drizzle-orm";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import app from "./app";
import { logger } from "./lib/logger";
import { startSessionCleanup } from "./lib/sessionCleanup";
import { wsManager } from "./lib/wsManager";

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

const wss = new WebSocketServer({ server, path: "/api/ws" });

wss.on("connection", async (ws, req) => {
  const rawUrl = req.url ?? "";
  let token: string | null = null;
  try {
    const url = new URL(rawUrl, "http://localhost");
    token = url.searchParams.get("token");
  } catch {
    ws.close(4000, "bad_request");
    return;
  }

  if (!token) {
    ws.close(4001, "unauthorized");
    return;
  }

  try {
    const [row] = await db
      .select({ userId: sessionsTable.userId })
      .from(sessionsTable)
      .where(
        and(eq(sessionsTable.token, token), gt(sessionsTable.expiresAt, new Date())),
      )
      .limit(1);

    if (!row) {
      ws.close(4001, "unauthorized");
      return;
    }

    const { userId } = row;
    wsManager.register(userId, ws);
    logger.info({ userId }, "WS connected");

    ws.on("close", () => {
      wsManager.unregister(userId, ws);
      logger.info({ userId }, "WS disconnected");
    });

    ws.on("error", (err) => {
      logger.error({ err, userId }, "WS error");
    });
  } catch (err) {
    logger.error({ err }, "WS auth lookup failed");
    ws.close(4500, "server_error");
  }
});

server.on("error", (err) => {
  logger.error({ err }, "Server error");
  process.exit(1);
});

server.listen(port, () => {
  logger.info({ port }, "Server listening");
  startSessionCleanup();
});
