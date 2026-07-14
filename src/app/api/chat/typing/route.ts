// Клиент печатает: виджет шлёт сигнал раз в ~2 секунды, пока идёт ввод.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validClientId } from "@/lib/chat-server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { clientId?: string; typing?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  if (!validClientId(body.clientId)) {
    return NextResponse.json({ error: "Некорректный клиент" }, { status: 400 });
  }
  await prisma.chatConversation
    .update({
      where: { clientId: body.clientId },
      data: { clientTypingAt: body.typing ? new Date() : null },
    })
    .catch(() => {}); // диалога ещё нет — молча пропускаем
  return NextResponse.json({ ok: true });
}
