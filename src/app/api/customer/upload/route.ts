// Загрузка фото к отзыву от вошедшего клиента.
// Логика та же, что в /api/admin/upload, но доступ — по клиентской сессии (Customer),
// а не по админской. Прод (есть BLOB_TOKEN) → client-upload прямо в Vercel Blob;
// dev без токена → FormData пишется в public/uploads.
import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getCustomer } from "@/lib/customer-session";
import { BLOB_TOKEN } from "@/lib/blob-token";

export const runtime = "nodejs";

const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 15 * 1024 * 1024; // 15 МБ

const EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

// Пробный запрос: каким способом грузить (Blob напрямую или FormData в dev).
export async function GET() {
  const customer = await getCustomer();
  if (!customer) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  return NextResponse.json({ blob: Boolean(BLOB_TOKEN) });
}

export async function POST(req: Request) {
  const customer = await getCustomer();
  if (!customer) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  // Ветка client-upload (прод): JSON-рукопожатие от upload() из @vercel/blob/client.
  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    try {
      const body = (await req.json()) as HandleUploadBody;
      const json = await handleUpload({
        body,
        request: req,
        token: BLOB_TOKEN,
        onBeforeGenerateToken: async () => ({
          allowedContentTypes: OK_TYPES,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
        }),
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
    return NextResponse.json({ error: "Разрешены только изображения (jpg, png, webp, gif)" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Файл больше 15 МБ" }, { status: 400 });
  }

  const name = `${Date.now()}-${randomUUID()}${EXT[file.type] ?? ""}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf);
  return NextResponse.json({ url: `/uploads/${name}` });
}
