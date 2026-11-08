import { inArray, asc } from "drizzle-orm";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { apiError, getIdentity, ownership } from "@/lib/auth";
export async function GET() {
  try {
    const identity = await getIdentity();
    const chats = await db.select().from(conversations).where(ownership(identity));
    const items = chats.length ? await db.select().from(messages).where(inArray(messages.conversationId, chats.map(c => c.id))).orderBy(asc(messages.createdAt)) : [];
    const data = { exportedAt: new Date().toISOString(), user: identity.user, conversations: chats.map(c => ({ id: c.id, title: c.title, model: c.model, createdAt: c.createdAt, messages: items.filter(m => m.conversationId === c.id).map(m => ({ role: m.role, content: m.content, createdAt: m.createdAt })) })) };
    return new Response(JSON.stringify(data, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": "attachment; filename=farhangpt-my-data.json", "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
