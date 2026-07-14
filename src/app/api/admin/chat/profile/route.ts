// Профиль сотрудника для чата: имя и аватар (видит клиент) + привязка Telegram
// для уведомлений (deep-link t.me/бот?start=emp_<token>).
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { tgBotUsername } from "@/lib/telegram";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  let row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { chatDisplayName: true, chatAvatarUrl: true, telegramChatId: true, tgLinkToken: true },
  });
  // Токен deep-link'а создаётся лениво при первом заходе в профиль.
  if (row && !row.tgLinkToken) {
    row = await prisma.user.update({
      where: { id: user.id },
      data: { tgLinkToken: randomUUID().replaceAll("-", "") },
      select: { chatDisplayName: true, chatAvatarUrl: true, telegramChatId: true, tgLinkToken: true },
    });
  }

  return NextResponse.json({
    displayName: row?.chatDisplayName ?? "",
    avatarUrl: row?.chatAvatarUrl ?? "",
    tgLinked: Boolean(row?.telegramChatId),
    tgLink: row?.tgLinkToken && tgBotUsername()
      ? `https://t.me/${tgBotUsername()}?start=emp_${row.tgLinkToken}`
      : null,
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  let body: { displayName?: string; avatarUrl?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(body.displayName !== undefined && { chatDisplayName: body.displayName.trim().slice(0, 40) }),
      ...(body.avatarUrl !== undefined && { chatAvatarUrl: body.avatarUrl.trim().slice(0, 500) }),
    },
  });
  return NextResponse.json({ ok: true });
}
