// Токен Vercel Blob. При подключении стора Vercel может создать переменную
// с префиксом имени стора (sochifornia3_blob_...), а не стандартную BLOB_...
// Проверяем оба имени, чтобы не зависеть от префикса в панели Vercel.
export const BLOB_TOKEN =
  process.env.BLOB_READ_WRITE_TOKEN || process.env.sochifornia3_blob_READ_WRITE_TOKEN;
