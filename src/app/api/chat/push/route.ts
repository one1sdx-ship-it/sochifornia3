// Подписка на браузерные push-уведомления (Web Push / VAPID).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validClientId } from "@/lib/chat-server";

export const runtime = "nodejs";

type Body = {
  clientId?: string;
  subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const sub = body.subscription;
  if (
    !validClientId(body.clientId) ||
    typeof sub?.endpoint !== "string" ||
    !sub.endpoint.startsWith("https://") ||
    typeof sub.keys?.p256dh !== "string" ||
    typeof sub.keys?.auth !== "string"
  ) {
    return NextResponse.json({ error: "Некорректная подписка" }, { status: 400 });
  }

  const conv = await prisma.chatConversation.findUnique({ where: { clientId: body.clientId } });
  if (!conv) return NextResponse.json({ error: "Диалог не найден" }, { status: 404 });

  await prisma.chatPushSub.upsert({
    where: { endpoint: sub.endpoint },
    create: {
      conversationId: conv.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
    update: { conversationId: conv.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
  return NextResponse.json({ ok: true });
}
