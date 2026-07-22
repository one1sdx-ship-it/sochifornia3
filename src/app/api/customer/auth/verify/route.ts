// Шаг 2 входа клиента: проверка кода и создание сессии.
// Временно код фиксированный — «7777» (позже заменим на реальную проверку SMS-кода).
// По номеру телефона находим или создаём Customer и открываем клиентскую сессию.
import { NextResponse } from "next/server";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { prisma } from "@/lib/prisma";
import { createCustomerSession } from "@/lib/customer-session";

// Временный код подтверждения (общий для всех номеров). Убрать при подключении SMS.
const TEMP_CODE = "7777";

export async function POST(req: Request) {
  let phone = "";
  let code = "";
  try {
    ({ phone, code } = await req.json());
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const pn = parsePhoneNumberFromString(String(phone || ""));
  if (!pn?.isValid()) {
    return NextResponse.json({ error: "Неверный номер телефона" }, { status: 400 });
  }

  if (String(code || "").trim() !== TEMP_CODE) {
    return NextResponse.json({ error: "Неверный код" }, { status: 401 });
  }

  const e164 = pn.number; // нормализованный E.164

  // Находим клиента по телефону или создаём нового.
  const customer = await prisma.customer.upsert({
    where: { phone: e164 },
    update: {},
    create: { phone: e164 },
    select: { id: true, phone: true, name: true, avatarUrl: true },
  });

  // Привязываем к клиенту его прежние диалоги чата (были анонимными) — по совпадению телефона.
  // Нужно для раздела «История чата» в личном кабинете.
  await prisma.chatConversation.updateMany({
    where: { clientPhone: e164, customerId: null },
    data: { customerId: customer.id },
  });

  await createCustomerSession(customer.id);

  return NextResponse.json({ customer });
}
