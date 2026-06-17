import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
app.set("trust proxy", 1);

const ALLOWED_ORIGINS: (string | RegExp)[] = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-zA-Z0-9-]+\.sisko\.replit\.dev$/,
  /^https:\/\/[a-zA-Z0-9-]+\.expo\.sisko\.replit\.dev$/,
  /^https:\/\/[a-zA-Z0-9-]+\.replit\.app$/,
];
if (process.env["REPLIT_DEV_DOMAIN"]) {
  ALLOWED_ORIGINS.push(`https://${process.env["REPLIT_DEV_DOMAIN"]}`);
}
if (process.env["REPLIT_EXPO_DEV_DOMAIN"]) {
  ALLOWED_ORIGINS.push(`https://${process.env["REPLIT_EXPO_DEV_DOMAIN"]}`);
}

// ── CORS must come first so that ALL responses (including 429s from rate
// limiters) carry the correct Access-Control-Allow-Origin header.
// Without this, the browser treats rate-limit responses as network errors
// because it cannot read a response that has no CORS headers.
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) { callback(null, true); return; }
    const allowed = ALLOWED_ORIGINS.some((o) =>
      typeof o === "string" ? o === origin : o.test(origin),
    );
    if (allowed) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "محاولات كثيرة جداً، يرجى المحاولة بعد 15 دقيقة" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS",
});

const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: "طلبات كثيرة جداً، يرجى المحاولة بعد قليل" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS",
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api", generalApiLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
