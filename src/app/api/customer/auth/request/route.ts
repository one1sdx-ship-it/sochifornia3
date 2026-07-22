// Шаг 1 входа клиента: запрос кода на номер телефона.
// Пока SMS не отправляем — код фиксированный «7777» (см. verify). Здесь только
// валидируем номер, чтобы UI мог перейти ко второму шагу. Задел под реальную отправку SMS.
import { NextResponse } from "next/server";
import { parsePhoneNumberFromString } from "libphonenumber-js";

export async function POST(req: Request) {
  let phone = "";
  try {
    ({ phone } = await req.json());
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const pn = parsePhoneNumberFromString(String(phone || ""));
  if (!pn?.isValid()) {
    return NextResponse.json({ error: "Неверный номер телефона" }, { status: 400 });
  }

  // TODO: здесь будет реальная отправка кода по SMS. Сейчас код всегда «7777».
  return NextResponse.json({ ok: true });
}
