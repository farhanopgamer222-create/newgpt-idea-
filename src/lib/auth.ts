import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { cookies, headers } from "next/headers";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, sessions, conversations, rateLimits } from "@/db/schema";
import type { User } from "@/lib/types";

const scrypt = promisify(scryptCallback);
const COOKIE = "farhangpt_session";
export class AppError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, encoded] = stored.split(":");
  if (!salt || !encoded) return false;
  const actual = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(encoded, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export type Identity = { sessionId: string; user: User | null };
export async function setSessionCookie(token: string) {
  const h = await headers();
  const secure = h.get("x-forwarded-proto") === "https" || (process.env.NODE_ENV === "production" && !(h.get("host") ?? "").includes("localhost") && !(h.get("host") ?? "").includes("127.0.0.1"));
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}
export async function getIdentity(): Promise<Identity> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token && token.length < 200) {
    const [session] = await db.select({ id: sessions.id, userId: sessions.userId }).from(sessions).where(and(eq(sessions.tokenHash, digest(token)), gt(sessions.expiresAt, new Date()))).limit(1);
    if (session) {
      const [user] = session.userId ? await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, session.userId)).limit(1) : [];
      return { sessionId: session.id, user: user ?? null };
    }
  }
  const newToken = randomBytes(32).toString("hex");
  const [session] = await db.insert(sessions).values({ tokenHash: digest(newToken), expiresAt: new Date(Date.now() + 30 * 86400000) }).returning({ id: sessions.id });
  await setSessionCookie(newToken);
  return { sessionId: session.id, user: null };
}
export async function attachUser(identity: Identity, user: User) {
  const token = randomBytes(32).toString("hex");
  await db.transaction(async (tx) => {
    await tx.update(sessions).set({ tokenHash: digest(token), userId: user.id, expiresAt: new Date(Date.now() + 30 * 86400000) }).where(eq(sessions.id, identity.sessionId));
    await tx.update(conversations).set({ userId: user.id }).where(and(eq(conversations.sessionId, identity.sessionId), isNull(conversations.userId)));
  });
  await setSessionCookie(token);
}
export async function logout(identity: Identity) {
  await db.delete(sessions).where(eq(sessions.id, identity.sessionId));
  (await cookies()).delete(COOKIE);
}
export function ownership(identity: Identity) {
  return identity.user ? eq(conversations.userId, identity.user.id) : and(eq(conversations.sessionId, identity.sessionId), isNull(conversations.userId));
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  if (origin && new URL(origin).host !== host) throw new AppError("This request is not allowed.", 403);
}
export async function checkRate(id: string, limit: number, windowMs = 3600000) {
  const cutoff = new Date(Date.now() - windowMs).toISOString();
  const [row] = await db.insert(rateLimits).values({ id, count: 1, windowStart: new Date() }).onConflictDoUpdate({
    target: rateLimits.id,
    set: {
      count: sql`case when ${rateLimits.windowStart} < ${cutoff}::timestamptz then 1 else ${rateLimits.count} + 1 end`,
      windowStart: sql`case when ${rateLimits.windowStart} < ${cutoff}::timestamptz then now() else ${rateLimits.windowStart} end`,
    },
  }).returning({ count: rateLimits.count });
  if (row.count > limit) throw new AppError("You’ve reached the limit for now. Take a little break and try again later.", 429);
}
export function apiError(error: unknown) {
  if (error instanceof AppError) return Response.json({ error: error.message }, { status: error.status });
  console.error("FarhanGPT request failed:", error instanceof Error ? error.name : "Unknown error");
  return Response.json({ error: "Something went wrong. Please try again in a moment." }, { status: 500 });
}
export function validId(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new AppError("Conversation not found.", 404);
  return id;
}
