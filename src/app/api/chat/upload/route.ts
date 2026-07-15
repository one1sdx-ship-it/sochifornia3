// Загрузка вложений чата клиентом: фото и голосовые.
// Прод/с токеном → Vercel Blob, dev → public/uploads (как в /api/admin/upload).
import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { validClientId } from "@/lib/chat-server";

export const runtime = "nodejs";

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};
// Голосовые: MediaRecorder отдаёт webm/opus (Chrome/Android), mp4/aac (iOS Safari),
// а часть Android-браузеров/WebView — aac/3gpp/x-m4a. Держим список широким.
const AUDIO_TYPES: Record<string, string> = {
  "audio/webm": ".webm",
  "audio/ogg": ".ogg",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/aac": ".aac",
  "audio/3gpp": ".3gp",
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
};

// Запасной разбор: если точного совпадения нет, но это явно аудио (или контейнер,
// который MediaRecorder мог выдать под аудио) — не отклоняем, а берём разумное .webm.
function audioExtFallback(mime: string): string | null {
  if (mime.startsWith("audio/")) return ".webm";
  if (mime === "video/webm") return ".webm"; // MediaRecorder иногда так помечает опус
  if (mime === "video/mp4") return ".m4a";
  return null;
}
const MAX_BYTES = 10 * 1024 * 1024; // 10 МБ

export async function POST(req: Request) {
  const form = await req.formData();
  const clientId = form.get("clientId");
  const file = form.get("file");

  if (!validClientId(clientId)) {
    return NextResponse.json({ error: "Некорректный клиент" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }

  // MediaRecorder может добавлять параметры ("audio/webm;codecs=opus") — отрезаем.
  const mime = file.type.split(";")[0].trim().toLowerCase();
  const isImage = Boolean(IMAGE_TYPES[mime]);
  const ext = IMAGE_TYPES[mime] ?? AUDIO_TYPES[mime] ?? audioExtFallback(mime);
  if (!ext) {
    return NextResponse.json({ error: "Можно только фото (jpg/png/webp/gif) и голосовые" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Файл больше 10 МБ" }, { status: 400 });
  }

  // Лёгкий флуд-контроль: не больше 8 вложений за 5 минут на диалог.
  const conv = await prisma.chatConversation.findUnique({ where: { clientId } });
  if (conv) {
    const recent = await prisma.chatMessage.count({
      where: {
        conversationId: conv.id,
        sender: "CLIENT",
        type: { in: ["IMAGE", "VOICE"] },
        createdAt: { gt: new Date(Date.now() - 5 * 60_000) },
      },
    });
    if (recent >= 8) return NextResponse.json({ error: "Слишком много вложений, подождите" }, { status: 429 });
  }

  const name = `${Date.now()}-${randomUUID()}${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`chat/${name}`, file, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return NextResponse.json({ url: blob.url, kind: isImage ? "image" : "voice" });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const dir = path.join(process.cwd(), "public", "uploads", "chat");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf);
  return NextResponse.json({ url: `/uploads/chat/${name}`, kind: isImage ? "image" : "voice" });
}
