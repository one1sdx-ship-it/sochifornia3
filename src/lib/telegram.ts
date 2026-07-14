// Тонкая обёртка над Telegram Bot API (без сторонних библиотек — обычный fetch).
// Все функции «тихие»: при отсутствии токена или ошибке сети возвращают false,
// не роняя основной запрос (чат на сайте работает и без Telegram).
import "server-only";

const API = () =>
  process.env.TELEGRAM_BOT_TOKEN
    ? `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`
    : null;

// Файлы Telegram отдаёт по URL с токеном бота — наружу такой URL показывать нельзя,
// поэтому файлы клиентов из TG скачиваем и перезаливаем к себе (см. webhook).
export async function tgApi<T = unknown>(
  method: string,
  payload: Record<string, unknown>,
): Promise<T | null> {
  const base = API();
  if (!base) return null;
  try {
    const res = await fetch(`${base}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { ok: boolean; result?: T };
    return data.ok ? (data.result as T) : null;
  } catch {
    return null;
  }
}

export async function tgSendMessage(chatId: string, text: string, extra?: Record<string, unknown>) {
  return tgApi("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra });
}

export async function tgSendPhoto(chatId: string, photoUrl: string, caption?: string) {
  return tgApi("sendPhoto", { chat_id: chatId, photo: photoUrl, caption });
}

export async function tgSendLocation(chatId: string, lat: number, lng: number) {
  return tgApi("sendLocation", { chat_id: chatId, latitude: lat, longitude: lng });
}

// Голосовые/файлы: пробуем как документ (URL должен быть публичным), при неудаче — ссылкой.
export async function tgSendFileOrLink(chatId: string, fileUrl: string, caption: string) {
  const ok = await tgApi("sendDocument", { chat_id: chatId, document: fileUrl, caption });
  if (!ok) await tgSendMessage(chatId, `${caption}\n${fileUrl}`);
}

// Скачать файл, присланный боту (getFile → download). Возвращает Buffer + имя, либо null.
export async function tgDownloadFile(fileId: string): Promise<{ buf: Buffer; path: string } | null> {
  const base = API();
  if (!base) return null;
  const info = await tgApi<{ file_path?: string }>("getFile", { file_id: fileId });
  if (!info?.file_path) return null;
  try {
    const res = await fetch(
      `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${info.file_path}`,
    );
    if (!res.ok) return null;
    return { buf: Buffer.from(await res.arrayBuffer()), path: info.file_path };
  } catch {
    return null;
  }
}

// Имя бота для deep-link'ов (t.me/<username>?start=...). Публичная переменная.
export function tgBotUsername(): string {
  return process.env.NEXT_PUBLIC_TG_BOT_USERNAME || "";
}
