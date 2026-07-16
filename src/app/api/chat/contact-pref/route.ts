// Клиент выбрал предпочтительный канал обратной связи в сообщении «где удобнее связаться…?»
// (задача 5). Сохраняем выбор в meta системного сообщения — без изменения схемы БД: владелец
// увидит его в админке (доп. панель под шапкой диалога).
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validClientId } from "@/lib/chat-server";

export const runtime = "nodejs";

// Допустимые каналы (совпадают с иконками в chat-bubbles.tsx: phone/tg/wa/max).
const CHANNELS = ["phone", "tg", "wa", "max"];

export async function POST(req: Request) {
  let body: { clientId?: string; channel?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  if (!validClientId(body.clientId)) {
    return NextResponse.json({ error: "Некорректный клиент" }, { status: 400 });
  }
  if (!body.channel || !CHANNELS.includes(body.channel)) {
    return NextResponse.json({ error: "Некорректный канал" }, { status: 400 });
  }

  const conv = await prisma.chatConversation.findUnique({
    where: { clientId: body.clientId },
    select: { id: true },
  });
  if (!conv) return NextResponse.json({ ok: true }); // диалога ещё нет — молча пропускаем

  // Последнее системное сообщение — это и есть вопрос об офлайн-связи (meta.kind === "absence").
  const sys = await prisma.chatMessage.findFirst({
    where: { conversationId: conv.id, type: "SYSTEM" },
    orderBy: { createdAt: "desc" },
    select: { id: true, meta: true },
  });
  if (!sys) return NextResponse.json({ ok: true });

  const meta = { ...((sys.meta as Record<string, unknown>) ?? {}), preferredContact: body.channel };
  await prisma.chatMessage
    .update({ where: { id: sys.id }, data: { meta: meta as Prisma.InputJsonValue } })
    .catch(() => {});

  return NextResponse.json({ ok: true });
}
