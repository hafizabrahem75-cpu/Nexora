import {
  db,
  emailVerificationTokensTable,
  passwordResetTokensTable,
  sessionsTable,
  usersTable,
} from "@workspace/db";
import bcrypt from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { sendPasswordResetEmail, sendVerificationEmail } from "../lib/email";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const BCRYPT_ROUNDS = 12;

function makeToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

function stripPassword(user: typeof usersTable.$inferSelect) {
  const { passwordHash: _ph, ...pub } = user;
  return pub;
}

// ─── Register ────────────────────────────────────────────────────────────────
const RegisterBody = z.object({
  email: z.email(),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
  name: z.string().min(1).max(60),
});

router.post("/register", async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" });
    return;
  }
  const { email, password, name } = parsed.data;

  try {
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: "البريد الإلكتروني مسجل بالفعل" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const [user] = await db
      .insert(usersTable)
      .values({ email: email.toLowerCase(), passwordHash, name })
      .returning();

    if (!user) throw new Error("insert returned nothing");

    const sessionToken = makeToken();
    await db.insert(sessionsTable).values({
      userId: user.id,
      token: sessionToken,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });

    const verifyToken = makeToken();
    await db.insert(emailVerificationTokensTable).values({
      userId: user.id,
      token: verifyToken,
      expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
    });
    await sendVerificationEmail(user.email, verifyToken);

    res.status(201).json({ token: sessionToken, user: stripPassword(user) });
  } catch (err) {
    req.log.error(err, "register failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── Login ────────────────────────────────────────────────────────────────────
const LoginBody = z.object({
  email: z.email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صالحة" });
    return;
  }
  const { email, password } = parsed.data;

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
      return;
    }

    if (user.suspendedAt) {
      res.status(403).json({ error: "account_suspended" });
      return;
    }

    if (!user.emailVerified) {
      res.status(403).json({ error: "email_not_verified" });
      return;
    }

    const sessionToken = makeToken();
    await db.insert(sessionsTable).values({
      userId: user.id,
      token: sessionToken,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });

    res.json({ token: sessionToken, user: stripPassword(user) });
  } catch (err) {
    req.log.error(err, "login failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── Logout ───────────────────────────────────────────────────────────────────
router.post("/logout", requireAuth, async (req: AuthRequest, res) => {
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.slice(7).trim();

  try {
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "logout failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── Me ───────────────────────────────────────────────────────────────────────
router.get("/me", requireAuth, (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

// ─── Update profile ───────────────────────────────────────────────────────────
const UpdateProfileBody = z.object({
  name: z.string().min(1).max(60).optional(),
  avatarColor: z.string().optional(),
  avatarImageUri: z.string().nullable().optional(),
  profileVisibility: z.enum(["everyone", "friends", "nobody"]).optional(),
  messagingPrivacy: z.enum(["everyone", "friends", "nobody"]).optional(),
});

router.put("/profile", requireAuth, async (req: AuthRequest, res) => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صالحة" });
    return;
  }

  try {
    const [updated] = await db
      .update(usersTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(usersTable.id, req.userId!))
      .returning();

    res.json({ user: stripPassword(updated!) });
  } catch (err) {
    req.log.error(err, "update profile failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── Change password ──────────────────────────────────────────────────────────
const ChangePasswordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
});

router.post("/change-password", requireAuth, async (req: AuthRequest, res) => {
  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.userId!))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "المستخدم غير موجود" });
      return;
    }

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!valid) {
      res.status(400).json({ error: "كلمة المرور الحالية غير صحيحة" });
      return;
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, BCRYPT_ROUNDS);
    await db
      .update(usersTable)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(usersTable.id, req.userId!));

    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "change-password failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── Delete account ───────────────────────────────────────────────────────────
router.delete("/account", requireAuth, async (req: AuthRequest, res) => {
  try {
    await db.delete(usersTable).where(eq(usersTable.id, req.userId!));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "delete account failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── Forgot password ──────────────────────────────────────────────────────────
const ForgotPasswordBody = z.object({ email: z.email() });

router.post("/forgot-password", async (req, res) => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بريد إلكتروني غير صالح" });
    return;
  }

  try {
    const [user] = await db
      .select({ id: usersTable.id, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.email, parsed.data.email.toLowerCase()))
      .limit(1);

    if (user) {
      const token = makeToken();
      await db.insert(passwordResetTokensTable).values({
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      });
      await sendPasswordResetEmail(user.email, token);
    }

    res.json({ ok: true, message: "إذا كان البريد مسجلاً، ستصل رسالة استعادة كلمة المرور" });
  } catch (err) {
    req.log.error(err, "forgot-password failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── Reset password ───────────────────────────────────────────────────────────
const ResetPasswordBody = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
});

router.post("/reset-password", async (req, res) => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" });
    return;
  }
  const { token, password } = parsed.data;

  try {
    const [row] = await db
      .select()
      .from(passwordResetTokensTable)
      .where(
        and(
          eq(passwordResetTokensTable.token, token),
          eq(passwordResetTokensTable.used, false),
          gt(passwordResetTokensTable.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!row) {
      res.status(400).json({ error: "رابط إعادة التعيين غير صالح أو منتهي الصلاحية" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await db
      .update(usersTable)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(usersTable.id, row.userId));

    await db
      .update(passwordResetTokensTable)
      .set({ used: true })
      .where(eq(passwordResetTokensTable.id, row.id));

    await db
      .delete(sessionsTable)
      .where(eq(sessionsTable.userId, row.userId));

    res.json({ ok: true, message: "تم تغيير كلمة المرور بنجاح" });
  } catch (err) {
    req.log.error(err, "reset-password failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── Verify email ─────────────────────────────────────────────────────────────
const VerifyEmailBody = z.object({ token: z.string().min(1) });

router.post("/verify-email", async (req, res) => {
  const parsed = VerifyEmailBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "رمز غير صالح" });
    return;
  }

  try {
    const [row] = await db
      .select()
      .from(emailVerificationTokensTable)
      .where(
        and(
          eq(emailVerificationTokensTable.token, parsed.data.token),
          gt(emailVerificationTokensTable.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!row) {
      res.status(400).json({ error: "رابط التحقق غير صالح أو منتهي الصلاحية" });
      return;
    }

    await db
      .update(usersTable)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(usersTable.id, row.userId));

    await db
      .delete(emailVerificationTokensTable)
      .where(eq(emailVerificationTokensTable.id, row.id));

    res.json({ ok: true, message: "تم التحقق من البريد الإلكتروني بنجاح" });
  } catch (err) {
    req.log.error(err, "verify-email failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

export default router;
