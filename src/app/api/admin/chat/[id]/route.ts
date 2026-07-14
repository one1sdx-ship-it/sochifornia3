// Один диалог в админке: GET — поллинг сообщений (раз в 3с), POST — ответ сотрудника,
// PATCH — сигнал «сотрудник печатает…».
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import {
  MAX_TEXT_LEN, TYPING_TTL_MS, deliverToClientIfAway, staffAuthorSelect, toWire,
} from "@/lib/chat-server";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  const { id } = await params;

  const url = new URL(req.url);
  const after = url.searchParams.get("after");
  const open = url.searchParams.get("open") === "1";

  const conv = await prisma.chatConversation.findUnique({
    where: { id },
    include: { viewedTours: { orderBy: { viewedAt: "desc" }, take: 10 } },
  });
  if (!conv) return NextResponse.json({ error: "Диалог не найден" }, { status: 404 });

  // Диалог открыт у сотрудника → сообщения клиента прочитаны.
  if (open) {
    await prisma.chatMessage.updateMany({
      where: { conversationId: id, sender: "CLIENT", readByStaff: false },
      data: { readByStaff: true },
    });
  }

  const afterDate = after ? new Date(after) : null;
  const messages = await prisma.chatMessage.findMany({
    where: {
      conversationId: id,
      ...(afterDate && !isNaN(afterDate.getTime()) ? { createdAt: { gt: afterDate } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 300,
    include: { author: staffAuthorSelect },
  });

  const now = Date.now();
  const tour = conv.currentTourSlug
    ? await prisma.tour.findUnique({
        where: { slug: conv.currentTourSlug },
        select: { slug: true, title: true },
      })
    : null;

  return NextResponse.json({
    messages: messages.map(toWire),
    client: {
      name: conv.clientName || "Гость",
      phone: conv.clientPhone,
      online: now - conv.lastClientSeenAt.getTime() < 30_000,
      lastSeenAt: conv.lastClientSeenAt.toISOString(),
      typing: Boolean(conv.clientTypingAt && now - conv.clientTypingAt.getTime() < TYPING_TTL_MS),
      tgLinked: Boolean(conv.clientTelegramId),
      promoCode: conv.promoCode,
      currentTour: tour,
      viewedTours: conv.viewedTours.map((v) => ({ slug: v.slug, title: v.title })),
    },
  });
}

type PostBody = {
  type?: "TEXT" | "IMAGE" | "VOICE" | "TOUR_CARD" | "LOCATION";
  text?: string;
  attachmentUrl?: string;
  meta?: Record<string, unknown>;
};

export async function POST(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  const { id } = await params;

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const conv = await prisma.chatConversation.findUnique({ where: { id } });
  if (!conv) return NextResponse.json({ error: "Диалог не найден" }, { status: 404 });

  const type = body.type ?? "TEXT";
  const text = (body.text ?? "").trim().slice(0, MAX_TEXT_LEN);
  if (!["TEXT", "IMAGE", "VOICE", "TOUR_CARD", "LOCATION"].includes(type))
    return NextResponse.json({ error: "Некорректный тип" }, { status: 400 });
  if (type === "TEXT" && !text)
    return NextResponse.json({ error: "Пустое сообщение" }, { status: 400 });

  // Карточка тура: собираем метаданные из БД по slug — надёжнее, чем доверять клиенту.
  let meta: Record<string, unknown> | undefined;
  if (type === "TOUR_CARD") {
    const slug = String(body.meta?.slug ?? "");
    const tour = await prisma.tour.findUnique({
      where: { slug },
      include: { gallery: { orderBy: { order: "asc" }, take: 1 } },
    });
    if (!tour) return NextResponse.json({ error: "Тур не найден" }, { status: 400 });
    meta = {
      slug: tour.slug,
      title: tour.title,
      price: tour.adultPrice,
      image: tour.gallery[0]?.url || tour.image,
      duration: tour.durationHours,
    };
  } else if (type === "LOCATION") {
    const lat = Number(body.meta?.lat);
    const lng = Number(body.meta?.lng);
    if (!isFinite(lat) || !isFinite(lng))
      return NextResponse.json({ error: "Некорректные координаты" }, { status: 400 });
    meta = { lat, lng, label: String(body.meta?.label ?? "").slice(0, 200) };
  }

  const msg = await prisma.chatMessage.create({
    data: {
      conversationId: id,
      sender: "STAFF",
      authorId: user.id,
      type,
      text,
      attachmentUrl: (body.attachmentUrl ?? "").slice(0, 500),
      meta: meta as Prisma.InputJsonValue | undefined,
      readByStaff: true,
    },
    include: { author: staffAuthorSelect },
  });

  await prisma.chatConversation.update({
    where: { id },
    data: { staffTypingAt: null, updatedAt: new Date() },
  });

  // Клиент офлайн >5 мин → дублируем в его Telegram; окно закрыто → браузерный push.
  await deliverToClientIfAway(conv, msg);

  return NextResponse.json({ ok: true, message: toWire(msg) });
}

// «Сотрудник печатает…» — клиент увидит три точки.
export async function PATCH(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  const { id } = await params;

  let body: { typing?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { chatDisplayName: true },
  });

  await prisma.chatConversation
    .update({
      where: { id },
      data: body.typing
        ? { staffTypingAt: new Date(), staffTypingName: profile?.chatDisplayName || user.name || "Оператор" }
        : { staffTypingAt: null },
    })
    .catch(() => {});
  return NextResponse.json({ ok: true });
}
