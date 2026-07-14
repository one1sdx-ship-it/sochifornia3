// Поллинг виджета (раз в 3 секунды): новые сообщения, «сотрудник печатает…»,
// статусы прочтения, профиль отвечающего сотрудника. Заодно отмечает присутствие
// клиента и триггерит промокод −5%.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  TYPING_TTL_MS, isWorkingHours, maybeSendPromo, staffAuthorSelect, toWire, validClientId,
} from "@/lib/chat-server";
import { tgBotUsername } from "@/lib/telegram";

export const runtime = "nodejs";

type Body = {
  clientId?: string;
  after?: string; // ISO последнего полученного сообщения
  open?: boolean; // окно чата открыто (метим прочитанным + lastOpenAt)
  tourSlug?: string;
  views?: { slug: string; title: string }[];
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  if (!validClientId(body.clientId)) {
    return NextResponse.json({ error: "Некорректный клиент" }, { status: 400 });
  }

  const conv = await prisma.chatConversation.findUnique({
    where: { clientId: body.clientId },
  });
  if (!conv) {
    return NextResponse.json({
      exists: false,
      online: isWorkingHours(),
      botUsername: tgBotUsername(),
    });
  }

  const now = new Date();
  await prisma.chatConversation.update({
    where: { id: conv.id },
    data: {
      lastClientSeenAt: now,
      ...(body.open && { lastOpenAt: now }),
      ...(body.tourSlug !== undefined && { currentTourSlug: body.tourSlug.slice(0, 100) }),
    },
  });

  // Окно открыто → всё входящее помечаем прочитанным клиентом.
  if (body.open) {
    await prisma.chatMessage.updateMany({
      where: { conversationId: conv.id, sender: { not: "CLIENT" }, readByClient: false },
      data: { readByClient: true },
    });
  }

  // Просмотренные экскурсии (докидываются и между сообщениями).
  if (Array.isArray(body.views)) {
    for (const v of body.views.slice(0, 20)) {
      if (typeof v?.slug !== "string" || !v.slug) continue;
      await prisma.chatViewedTour.upsert({
        where: { conversationId_slug: { conversationId: conv.id, slug: v.slug.slice(0, 100) } },
        create: {
          conversationId: conv.id,
          slug: v.slug.slice(0, 100),
          title: String(v.title ?? "").slice(0, 200),
        },
        update: { viewedAt: new Date() },
      });
    }
  }

  // Промокод −5%, если пора (вопрос был ≥10 минут назад, промо ещё не слали).
  await maybeSendPromo(conv);

  // Новые сообщения после курсора (или вся история при первом запросе).
  const after = body.after ? new Date(body.after) : null;
  const messages = await prisma.chatMessage.findMany({
    where: {
      conversationId: conv.id,
      ...(after && !isNaN(after.getTime()) ? { createdAt: { gt: after } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: { author: staffAuthorSelect },
  });

  // «Сотрудник печатает…» — сигнал свежее TYPING_TTL.
  const staffTyping =
    conv.staffTypingAt && now.getTime() - conv.staffTypingAt.getTime() < TYPING_TTL_MS
      ? { name: conv.staffTypingName || "Оператор" }
      : null;

  // Шапка: последний отвечавший сотрудник (имя + аватар).
  const lastStaffMsg = await prisma.chatMessage.findFirst({
    where: { conversationId: conv.id, sender: "STAFF" },
    orderBy: { createdAt: "desc" },
    include: { author: staffAuthorSelect },
  });

  // Бейдж на кнопке «Чат», когда окно закрыто.
  const unread = await prisma.chatMessage.count({
    where: { conversationId: conv.id, sender: { not: "CLIENT" }, readByClient: false },
  });

  // Прочитал ли сотрудник сообщения клиента (для галочек «прочитано»).
  const lastReadByStaff = await prisma.chatMessage.findFirst({
    where: { conversationId: conv.id, sender: "CLIENT", readByStaff: true },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  return NextResponse.json({
    exists: true,
    messages: messages.map(toWire),
    staffTyping,
    unread,
    online: isWorkingHours(),
    tgLinked: Boolean(conv.clientTelegramId),
    tgLinkToken: conv.tgLinkToken,
    botUsername: tgBotUsername(),
    staff: lastStaffMsg?.author
      ? {
          name: lastStaffMsg.author.chatDisplayName || lastStaffMsg.author.name || "Sochifornia",
          avatar: lastStaffMsg.author.chatAvatarUrl,
        }
      : null,
    readUpTo: lastReadByStaff?.createdAt.toISOString() ?? null,
  });
}
