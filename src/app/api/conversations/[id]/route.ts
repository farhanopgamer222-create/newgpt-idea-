import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { AppError, apiError, checkOrigin, getIdentity, ownership, validId } from "@/lib/auth";
type Context = { params: Promise<{ id: string }> };
async function owned(context: Context) {
  const { id } = await context.params;
  validId(id);
  const identity = await getIdentity();
  const [conversation] = await db.select().from(conversations).where(and(eq(conversations.id, id), ownership(identity))).limit(1);
  if (!conversation) throw new AppError("Conversation not found.", 404);
  return conversation;
}
export async function GET(_request: Request, context: Context) {
  try {
    const conversation = await owned(context);
    const items = await db.select().from(messages).where(eq(messages.conversationId, conversation.id)).orderBy(asc(messages.createdAt));
    return Response.json({ conversation, messages: items }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
export async function PATCH(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const conversation = await owned(context);
    const { title } = await request.json();
    if (typeof title !== "string" || !title.trim() || title.length > 100) throw new AppError("Use a title between 1 and 100 characters.");
    await db.update(conversations).set({ title: title.trim(), updatedAt: new Date() }).where(eq(conversations.id, conversation.id));
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const conversation = await owned(context);
    await db.delete(conversations).where(eq(conversations.id, conversation.id));
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
