import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { AppError, apiError, checkOrigin, checkRate, digest, getIdentity, ownership, validId } from "@/lib/auth";
import { MODELS } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const identity = await getIdentity();
    const body = await request.json();
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message || message.length > 30000) throw new AppError("Please write a message under 30,000 characters.");
    const model = MODELS.find(m => m.id === body.model) ?? MODELS[0];
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new AppError("The AI connection isn’t configured yet. Add OPENROUTER_API_KEY to the server environment to get started.", 503);
    await checkRate(`chat:${identity.user?.id ?? identity.sessionId}`, identity.user ? 100 : 25);
    const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
    await checkRate(`chat-ip:${digest(ip)}`, 150);
    let conversationId: string;
    if (body.conversationId) {
      const id = validId(String(body.conversationId));
      const [conversation] = await db.select({ id: conversations.id }).from(conversations).where(and(eq(conversations.id, id), ownership(identity))).limit(1);
      if (!conversation) throw new AppError("This conversation couldn’t be found.", 404);
      conversationId = conversation.id;
    } else {
      const cleanTitle = message.replace(/\n/g, " ").slice(0, 52);
      const [created] = await db.insert(conversations).values({ title: cleanTitle + (message.length > 52 ? "…" : ""), model: model.id, userId: identity.user?.id, sessionId: identity.sessionId }).returning({ id: conversations.id });
      conversationId = created.id;
    }
    await db.insert(messages).values({ conversationId, role: "user", content: message });
    await db.update(conversations).set({ updatedAt: new Date(), model: model.id }).where(eq(conversations.id, conversationId));
    const history = await db.select({ role: messages.role, content: messages.content }).from(messages).where(eq(messages.conversationId, conversationId)).orderBy(desc(messages.createdAt)).limit(30);
    const preference = typeof body.instructions === "string" ? body.instructions.slice(0, 1000) : "";
    const system = `You are FarhanGPT, a warm, intelligent, honest and helpful AI companion created by Farhan. Help with writing, programming, learning, and everyday tasks. Use clear Markdown where helpful. Match the user's language, including Urdu and Roman Urdu. Never claim you can do something you cannot do or that you have browsed the web unless web tools were provided. Never disclose server credentials or invent facts. ${body.deepThink ? "Consider the problem carefully and provide a well-structured explanation with a concise reasoning summary, without revealing private internal chain-of-thought." : "Be conversational and concise unless the user asks for detail."} ${preference ? `User preferences: ${preference}` : ""}`;
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-OpenRouter-Title": "FarhanGPT" },
      body: JSON.stringify({ model: model.apiModel, messages: [{ role: "system", content: system }, ...history.reverse()], stream: true, max_tokens: 4096, ...(body.webSearch ? { plugins: [{ id: "web", max_results: 3 }] } : {}) }),
      signal: request.signal,
    });
    if (!upstream.ok || !upstream.body) {
      const status = upstream.status;
      const error = status === 401 ? "The AI connection needs a new server API key. Please ask the administrator to update it." : status === 402 ? "The AI provider needs additional credits. Try FarhanGPT’s free model, or add credits to OpenRouter." : status === 429 ? (model.id === "farhan" ? "The free AI provider is currently rate-limiting this connection. Please try again later, or select another model if your OpenRouter account has credits." : "This model is a little busy. Try another model or come back in a moment.") : status === 404 ? "This model is temporarily unavailable. Please try another model." : "The AI provider is temporarily unavailable. Please try another model in a moment.";
      return Response.json({ error, conversationId }, { status: status === 429 ? 429 : 502 });
    }
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let content = "";
        let cancelled = false;
        const send = (value: object) => { try { controller.enqueue(encoder.encode(JSON.stringify(value) + "\n")); } catch { cancelled = true; } };
        send({ type: "meta", conversationId });
        const reader = upstream.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        try {
          while (!cancelled) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.startsWith("data:")) continue;
              const text = line.slice(5).trim();
              if (!text || text === "[DONE]") continue;
              const chunk = JSON.parse(text);
              if (chunk.error) throw new Error("The AI provider interrupted this response. Please try again.");
              const delta = chunk.choices?.[0]?.delta?.content;
              if (typeof delta === "string") { content += delta; send({ type: "delta", content: delta }); }
            }
          }
          if (!content && !cancelled) send({ type: "error", error: "The model returned an empty response. Try another model." });
        } catch (error) {
          if (!(error instanceof Error && error.name === "AbortError")) send({ type: "error", error: "The response was interrupted. Your conversation is saved; please try again." });
        } finally {
          if (cancelled) await reader.cancel().catch(() => {});
          if (content) await db.insert(messages).values({ conversationId, role: "assistant", content }).catch(() => { send({ type: "error", error: "The response could not be saved. Export it to keep a copy." }); });
          send({ type: "done" });
          try { controller.close(); } catch { /* The client stopped generation. */ }
        }
      },
    });
    return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-store", "X-Accel-Buffering": "no" } });
  } catch (error) { return apiError(error); }
}
