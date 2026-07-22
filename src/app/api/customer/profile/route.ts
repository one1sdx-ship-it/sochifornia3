// Обновление профиля клиента (имя, аватар). Телефон менять нельзя — это логин.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomer } from "@/lib/customer-session";

export async function PATCH(req: Request) {
  const customer = await getCustomer();
  if (!customer) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  let body: { name?: string; avatarUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const data: { name?: string; avatarUrl?: string } = {};
  if (typeof body.name === "string") data.name = body.name.trim().slice(0, 80);
  if (typeof body.avatarUrl === "string") data.avatarUrl = body.avatarUrl;

  const updated = await prisma.customer.update({
    where: { id: customer.id },
    data,
    select: { id: true, phone: true, name: true, avatarUrl: true },
  });

  return NextResponse.json({ customer: updated });
}
