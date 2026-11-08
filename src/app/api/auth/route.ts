import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { AppError, apiError, attachUser, checkOrigin, checkRate, digest, getIdentity, hashPassword, logout, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const identity = await getIdentity();
    const body = await request.json();
    const action = String(body.action ?? "");
    const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
    await checkRate(`auth:${digest(ip)}`, 30, 900000);
    if (action === "logout") { await logout(identity); return Response.json({ ok: true }); }
    if (action === "delete-account") {
      if (!identity.user) throw new AppError("Please sign in first.", 401);
      const [record] = await db.select().from(users).where(eq(users.id, identity.user.id)).limit(1);
      if (!record || typeof body.password !== "string" || !(await verifyPassword(body.password, record.passwordHash))) throw new AppError("Your password is incorrect.");
      await db.delete(users).where(eq(users.id, identity.user.id));
      await logout(identity);
      return Response.json({ ok: true });
    }
    if (action === "change-password") {
      if (!identity.user) throw new AppError("Please sign in first.", 401);
      const [record] = await db.select().from(users).where(eq(users.id, identity.user.id)).limit(1);
      if (!record || typeof body.currentPassword !== "string" || !(await verifyPassword(body.currentPassword, record.passwordHash))) throw new AppError("Your current password is incorrect.");
      if (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 128) throw new AppError("Use a password between 8 and 128 characters.");
      await db.update(users).set({ passwordHash: await hashPassword(body.password) }).where(eq(users.id, record.id));
      await attachUser(identity, identity.user);
      return Response.json({ ok: true });
    }
    if (!["login", "register"].includes(action)) throw new AppError("Unknown action.");
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new AppError("Please enter a valid email address.");
    if (password.length < 8 || password.length > 128) throw new AppError("Your password must be between 8 and 128 characters.");
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (action === "register") {
      const name = String(body.name ?? "").trim();
      if (!name || name.length > 60) throw new AppError("Please enter your name (up to 60 characters).");
      if (existing) throw new AppError("An account with this email already exists. Try signing in.", 409);
      const [created] = await db.insert(users).values({ name, email, passwordHash: await hashPassword(password) }).returning({ id: users.id, name: users.name, email: users.email });
      await attachUser(identity, created);
      return Response.json({ user: created }, { status: 201 });
    }
    if (!existing || !(await verifyPassword(password, existing.passwordHash))) throw new AppError("The email or password doesn’t match. Please try again.", 401);
    const user = { id: existing.id, name: existing.name, email: existing.email };
    await attachUser(identity, user);
    return Response.json({ user });
  } catch (error) { return apiError(error); }
}
