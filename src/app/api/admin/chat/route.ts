// Список диалогов для админки (/admin/chats). Доступ — любой сотрудник.
// История общая: все сотрудники видят одни и те же диалоги.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { TYPING_TTL_MS } from "@/lib/chat-server";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const convs = await prisma.chatConversation.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: {
        select: { messages: { where: { sender: "CLIENT", readByStaff: false } } },
      },
    },
  });

  // Названия «текущих» туров одним запросом.
  const slugs = [...new Set(convs.map((c) => c.currentTourSlug).filter(Boolean))];
  const tours = slugs.length
    ? await prisma.tour.findMany({ where: { slug: { in: slugs } }, select: { slug: true, title: true } })
    : [];
  const titleBySlug = new Map(tours.map((t) => [t.slug, t.title]));

  const now = Date.now();
  return NextResponse.json({
    conversations: convs.map((c) => {
      const last = c.messages[0];
      return {
        id: c.id,
        clientName: c.clientName || "Гость",
        clientPhone: c.clientPhone,
        currentTour: titleBySlug.get(c.currentTourSlug) ?? "",
        tgLinked: Boolean(c.clientTelegramId),
        online: now - c.lastClientSeenAt.getTime() < 30_000,
        typing: Boolean(c.clientTypingAt && now - c.clientTypingAt.getTime() < TYPING_TTL_MS),
        unread: c._count.messages,
        promoCode: c.promoCode,
        updatedAt: c.updatedAt.toISOString(),
        lastPreview: last
          ? last.type === "TEXT" || last.type === "SYSTEM" || last.type === "PROMO"
            ? last.text.slice(0, 80)
            : last.type === "IMAGE" ? "📷 Фото"
            : last.type === "VOICE" ? "🎤 Голосовое"
            : last.type === "TOUR_CARD" ? "🌴 Карточка тура"
            : "📍 Локация"
          : "",
        lastSender: last?.sender ?? null,
      };
    }),
  });
}
