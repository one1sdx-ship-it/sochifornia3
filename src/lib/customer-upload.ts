// Клиентская загрузка фото к отзыву. Аналог uploadImage из админ-редактора,
// но обращается к /api/customer/upload (доступ по клиентской сессии).

// Способ загрузки: true → напрямую в Vercel Blob (прод), false → FormData на сервер (dev).
let blobMode: boolean | null = null;

// Загрузка одного изображения. Возвращает URL сохранённого файла.
export async function uploadReviewImage(file: File): Promise<string> {
  if (blobMode === null) {
    try {
      const res = await fetch("/api/customer/upload");
      blobMode = res.ok ? Boolean(((await res.json()) as { blob?: boolean }).blob) : false;
    } catch {
      blobMode = false;
    }
  }

  // Прод: браузер кладёт файл в Blob напрямую (обходит лимит Vercel 4,5 МБ на запрос).
  if (blobMode) {
    const { upload } = await import("@vercel/blob/client");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_") || "photo";
    const blob = await upload(`reviews/${Date.now()}-${safeName}`, file, {
      access: "public",
      handleUploadUrl: "/api/customer/upload",
    });
    return blob.url;
  }

  // Dev: файл идёт на сервер и сохраняется в public/uploads.
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/customer/upload", { method: "POST", body: form });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || "Не удалось загрузить фото");
  }
  return ((await res.json()) as { url: string }).url;
}
