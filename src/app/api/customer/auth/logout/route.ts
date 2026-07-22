// Выход клиента: удаляем сессию из БД и cookie.
import { NextResponse } from "next/server";
import { destroyCustomerSession } from "@/lib/customer-session";

export async function POST() {
  await destroyCustomerSession();
  return NextResponse.json({ ok: true });
}
