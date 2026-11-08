import { desc } from "drizzle-orm";
import { db } from "@/db";
import { conversations } from "@/db/schema";
import { apiError, checkOrigin, getIdentity, ownership } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const identity = await getIdentity();
    const items = await db.select().from(conversations).where(ownership(identity)).orderBy(desc(conversations.updatedAt)).limit(100);
    return Response.json({ conversations: items }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    const identity = await getIdentity();
    await db.delete(conversations).where(ownership(identity));
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
