import { desc } from "drizzle-orm";
import { db } from "@/db";
import { conversations } from "@/db/schema";
import { apiError, getIdentity, ownership } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const identity = await getIdentity();
    const chats = await db.select({ id: conversations.id, title: conversations.title, model: conversations.model, updatedAt: conversations.updatedAt }).from(conversations).where(ownership(identity)).orderBy(desc(conversations.updatedAt)).limit(100);
    return Response.json({ user: identity.user, conversations: chats, aiConfigured: Boolean(process.env.OPENROUTER_API_KEY) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
