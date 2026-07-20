// Загрузка изображений (фото галереи, свои иконки).
// Прод (есть BLOB_READ_WRITE_TOKEN) → client-upload прямо в Vercel Blob:
//   браузер шлёт сюда JSON-рукопожатие (handleUpload), получает токен и кладёт
//   файл в Blob напрямую — так обходится лимит Vercel 4,5 МБ на тело запроса.
// Dev без токена → файл приходит FormData'ой и пишется в public/uploads.
import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
const MAX_BYTES = 15 * 1024 * 1024; // 15 МБ

const EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
};

// Пробный запрос клиента: каким способом грузить (Blob напрямую или FormData в dev).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  return NextResponse.json({ blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN) });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  // Ветка client-upload (прод): JSON-рукопожатие от upload() из @vercel/blob/client.
  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    try {
      const body = (await req.json()) as HandleUploadBody;
      const json = await handleUpload({
        body,
        request: req,
        onBeforeGenerateToken: async () => ({
          allowedContentTypes: OK_TYPES,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
        }),
        // Колбэк после загрузки не нужен: URL в БД сохраняет сам редактор (autosave).
        onUploadCompleted: async () => {},
      });
      return NextResponse.json(json);
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }
  if (!OK_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Разрешены только изображения (jpg, png, webp, gif, svg)" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Файл больше 15 МБ" }, { status: 400 });
  }

  const name = `${Date.now()}-${randomUUID()}${EXT[file.type] ?? ""}`;

  // Dev: сохраняем в public/uploads и отдаём по /uploads/...
  const buf = Buffer.from(await file.arrayBuffer());
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf);
  return NextResponse.json({ url: `/uploads/${name}` });
}
