// Серверные утилиты клиентской авторизации (вход по номеру телефона).
// ВАЖНО: это отдельный контур от админского (сотрудники — модель User + Auth.js).
// Клиент = модель Customer, сессия хранится в БД (CustomerSession) + токен в httpOnly-cookie.
import "server-only";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

// Имя cookie с токеном клиентской сессии (не пересекается с cookie Auth.js сотрудников).
export const CUSTOMER_COOKIE = "sf_customer";
// Срок жизни сессии — 60 дней.
const SESSION_TTL_MS = 60 * 24 * 60 * 60 * 1000;

// Публичная «облегчённая» форма клиента (без служебных полей) — отдаётся в UI.
export type CurrentCustomer = {
  id: string;
  phone: string;
  name: string;
  avatarUrl: string;
};

// Текущий клиент по cookie (или null). Свежая проверка по БД: срок сессии не истёк.
export async function getCustomer(): Promise<CurrentCustomer | null> {
  const token = (await cookies()).get(CUSTOMER_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.customerSession.findUnique({
    where: { sessionToken: token },
    select: {
      expires: true,
      customer: { select: { id: true, phone: true, name: true, avatarUrl: true } },
    },
  });
  if (!session || session.expires < new Date()) return null;

  return session.customer;
}

// Требует вошедшего клиента для клиентских страниц (иначе — на главную).
export async function requireCustomer(): Promise<CurrentCustomer> {
  const customer = await getCustomer();
  if (!customer) redirect("/");
  return customer;
}

// Создаёт сессию клиента и кладёт токен в httpOnly-cookie.
export async function createCustomerSession(customerId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.customerSession.create({
    data: { sessionToken: token, customerId, expires },
  });

  (await cookies()).set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

// Завершает текущую сессию клиента: удаляет запись в БД и cookie.
export async function destroyCustomerSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(CUSTOMER_COOKIE)?.value;
  if (token) {
    // deleteMany — не падаем, если запись уже удалена.
    await prisma.customerSession.deleteMany({ where: { sessionToken: token } });
  }
  store.delete(CUSTOMER_COOKIE);
}
