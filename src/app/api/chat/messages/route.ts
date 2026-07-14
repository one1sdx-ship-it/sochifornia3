// Отправка сообщения клиентом (виджет чата на сайте).
// Первый раз создаёт диалог (требуется телефон), дальше просто пишет в него.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  MAX_TEXT_LEN, checkFlood, notifyStaff, staffAuthorSelect, toWire, validClientId,
  isWorkingHours,
} from "@/lib/chat-server";

export const runtime = "nodejs";

type Body = {
  clientId?: string;
  name?: string;
  phone?: string;
  tourSlug?: string;
  views?: { slug: string; title: string }[];
  message?: { type?: "TEXT" | "IMAGE" | "VOICE"; text?: string; attachmentUrl?: string };
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
  const clientId = body.clientId;

  const type = body.message?.type ?? "TEXT";
  const text = (body.message?.text ?? "").trim().slice(0, MAX_TEXT_LEN);
  const attachmentUrl = (body.message?.attachmentUrl ?? "").trim();

  if (!["TEXT", "IMAGE", "VOICE"].includes(type))
    return NextResponse.json({ error: "Некорректный тип" }, { status: 400 });
  if (type === "TEXT" && !text)
    return NextResponse.json({ error: "Пустое сообщение" }, { status: 400 });
  // Вложения принимаем только со своих хранилищ (Vercel Blob / локальный /uploads).
  if (type !== "TEXT") {
    const ownStorage =
      attachmentUrl.startsWith("/uploads/") ||
      /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//.test(attachmentUrl);
    if (!ownStorage) return NextResponse.json({ error: "Некорректное вложение" }, { status: 400 });
  }

  const existing = await prisma.chatConversation.findUnique({ where: { clientId } });

  // Телефон обязателен для создания диалога (форма «имя + телефон» в виджете).
  const phone = (body.phone ?? "").trim().slice(0, 20);
  const name = (body.name ?? "").trim().slice(0, 60);
  if (!existing && !/^\+\d{7,15}$/.test(phone)) {
    return NextResponse.json({ error: "Укажите номер телефона" }, { status: 400 });
  }

  // Лёгкая защита от флуда (по существующему диалогу).
  if (existing) {
    const flood = await checkFlood(existing.id);
    if (flood) return NextResponse.json({ error: flood }, { status: 429 });
  }

  const now = new Date();
  const conv = existing
    ? await prisma.chatConversation.update({
        where: { id: existing.id },
        data: {
          lastClientSeenAt: now,
          lastOpenAt: now,
          clientTypingAt: null,
          ...(name && { clientName: name }),
          ...(phone && { clientPhone: phone }),
          ...(body.tourSlug !== undefined && { currentTourSlug: body.tourSlug.slice(0, 100) }),
        },
      })
    : await prisma.chatConversation.create({
        data: {
          clientId,
          clientName: name,
          clientPhone: phone,
          currentTourSlug: (body.tourSlug ?? "").slice(0, 100),
          lastOpenAt: now,
        },
      });

  // Просмотренные экскурсии (контекст для сотрудника).
  if (Array.isArray(body.views)) {
    for (const v of body.views.slice(0, 20)) {
      if (typeof v?.slug !== "string" || !v.slug) continue;
      await prisma.chatViewedTour.upsert({
        where: { conversationId_slug: { conversationId: conv.id, slug: v.slug.slice(0, 100) } },
        create: {
          conversationId: conv.id,
          slug: v.slug.slice(0, 100),
          title: String(v.title ?? "").slice(0, 200),
          viewedAt: new Date(),
        },
        update: { viewedAt: new Date() },
      });
    }
  }

  // Само сообщение клиента.
  const msg = await prisma.chatMessage.create({
    data: {
      conversationId: conv.id,
      sender: "CLIENT",
      type,
      text,
      attachmentUrl: type === "TEXT" ? "" : attachmentUrl,
      readByClient: true,
    },
    include: { author: staffAuthorSelect },
  });

  const extra = [];
  // Первое сообщение в диалоге → автоответ + вопрос про Telegram на случай отсутствия.
  if (!existing) {
    const auto = await prisma.chatMessage.create({
      data: {
        conversationId: conv.id,
        sender: "BOT",
        type: "TEXT",
        text: isWorkingHours()
          ? "Сообщение доставлено! Обычно отвечаем за пару минут 🌴"
          : "Сообщение доставлено! Сейчас нерабочее время (мы на связи с 9:00 до 21:00) — честно ответим утром ☀️",
      },
      include: { author: staffAuthorSelect },
    });
    const ask = await prisma.chatMessage.create({
      data: {
        conversationId: conv.id,
        sender: "BOT",
        type: "SYSTEM",
        text:
          "В случае вашего отсутствия тут, где удобнее чтобы мы с вами связались… ?",
        meta: { kind: "absence", tgLinkToken: conv.tgLinkToken },
      },
      include: { author: staffAuthorSelect },
    });
    await prisma.chatConversation.update({
      where: { id: conv.id },
      data: { absenceAskedAt: new Date() },
    });
    extra.push(toWire(auto), toWire(ask));
  }

  // Уведомляем сотрудников в Telegram (не блокируем ответ надолго — но в serverless
  // нужно дождаться, иначе функция завершится раньше отправки).
  await notifyStaff(conv, msg);

  return NextResponse.json({ ok: true, message: toWire(msg), extra, conversation: true });
}
