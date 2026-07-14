// Webhook Telegram-бота. Делает три вещи:
// 1. /start emp_<token> — привязывает TG сотрудника (уведомления о новых сообщениях);
// 2. /start c_<token> — привязывает TG клиента («Продолжить в Telegram»);
// 3. обычные сообщения от привязанного клиента — падают в его диалог на сайте.
// Запросы проверяются секретом (setWebhook ... secret_token=...).
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { site } from "@/data/site";
import { notifyStaff, staffAuthorSelect } from "@/lib/chat-server";
import { tgSendMessage, tgDownloadFile } from "@/lib/telegram";

export const runtime = "nodejs";

type TgUpdate = {
  message?: {
    message_id: number;
    chat: { id: number };
    from?: { first_name?: string; username?: string };
    text?: string;
    caption?: string;
    photo?: { file_id: string; width: number }[];
    voice?: { file_id: string };
  };
};

export async function POST(req: Request) {
  // Секрет из setWebhook — отсекаем чужие запросы.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const msg = update.message;
  if (!msg) return NextResponse.json({ ok: true });
  const chatId = String(msg.chat.id);
  const text = msg.text ?? "";

  // ── /start с deep-link ──
  if (text.startsWith("/start")) {
    const arg = text.split(" ")[1] ?? "";

    if (arg.startsWith("emp_")) {
      const token = arg.slice(4);
      const user = await prisma.user.findUnique({ where: { tgLinkToken: token } });
      if (user) {
        await prisma.user.update({ where: { id: user.id }, data: { telegramChatId: chatId } });
        await tgSendMessage(
          chatId,
          `✅ Готово! Теперь сюда будут приходить уведомления о новых сообщениях клиентов.\n\nОтвечать клиентам: ${site.url}/admin/chats`,
        );
      } else {
        await tgSendMessage(chatId, "Ссылка устарела. Откройте свой профиль в админке и перейдите по новой ссылке.");
      }
      return NextResponse.json({ ok: true });
    }

    if (arg.startsWith("c_")) {
      const token = arg.slice(2);
      const conv = await prisma.chatConversation.findUnique({ where: { tgLinkToken: token } });
      if (conv) {
        await prisma.chatConversation.update({
          where: { id: conv.id },
          data: { clientTelegramId: chatId },
        });
        await tgSendMessage(
          chatId,
          "✅ Диалог подключён! Если вас не будет на сайте, ответы менеджера придут сюда.\n\nМожете писать нам прямо здесь — сообщения попадут в тот же диалог 🌴",
        );
      } else {
        await tgSendMessage(chatId, "Не нашли ваш диалог. Откройте чат на сайте и нажмите «Продолжить в Telegram» ещё раз.");
      }
      return NextResponse.json({ ok: true });
    }

    await tgSendMessage(
      chatId,
      `Здравствуйте! Это бот компании ${site.name} 🌴\nЗадайте вопрос в чате на сайте: ${site.url}`,
    );
    return NextResponse.json({ ok: true });
  }

  // ── Сообщение от привязанного клиента → в его диалог ──
  const conv = await prisma.chatConversation.findFirst({ where: { clientTelegramId: chatId } });
  if (conv) {
    let type: "TEXT" | "IMAGE" | "VOICE" = "TEXT";
    let attachmentUrl = "";
    let body = text || msg.caption || "";

    // Фото/голос: скачиваем у Telegram (их URL содержит токен бота) и перезаливаем к себе.
    const photo = msg.photo?.at(-1);
    if (photo) {
      const file = await tgDownloadFile(photo.file_id);
      if (file) {
        attachmentUrl = await storeFile(file.buf, ".jpg");
        type = "IMAGE";
      }
    } else if (msg.voice) {
      const file = await tgDownloadFile(msg.voice.file_id);
      if (file) {
        attachmentUrl = await storeFile(file.buf, ".ogg");
        type = "VOICE";
      }
    }

    if (!body && type === "TEXT") return NextResponse.json({ ok: true });

    const saved = await prisma.chatMessage.create({
      data: {
        conversationId: conv.id,
        sender: "CLIENT",
        type,
        text: body.slice(0, 2000),
        attachmentUrl,
        readByClient: true,
        meta: { source: "telegram" },
      },
      include: { author: staffAuthorSelect },
    });
    await prisma.chatConversation.update({
      where: { id: conv.id },
      data: { updatedAt: new Date() },
    });
    await notifyStaff(conv, saved);
    return NextResponse.json({ ok: true });
  }

  // ── Сообщение от сотрудника (или незнакомца) ──
  const staff = await prisma.user.findFirst({ where: { telegramChatId: chatId } });
  if (staff) {
    await tgSendMessage(chatId, `Отвечайте клиентам в админке: ${site.url}/admin/chats`);
  }
  return NextResponse.json({ ok: true });
}

// Сохранить файл: Vercel Blob (прод) или public/uploads/chat (dev).
async function storeFile(buf: Buffer, ext: string): Promise<string> {
  const name = `${Date.now()}-${randomUUID()}${ext}`;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`chat/${name}`, buf, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return blob.url;
  }
  const dir = path.join(process.cwd(), "public", "uploads", "chat");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf);
  return `/uploads/chat/${name}`;
}
