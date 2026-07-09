// Серверные утилиты доступа (node-рантайм): текущий пользователь + защита по роли.
// Здесь делаем свежую проверку по БД: роль (могла измениться) и версию сессии
// (для «выхода со всех устройств»).
import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "EDITOR";
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, role: true, sessionVersion: true },
  });
  if (!user) return null;

  // Токен устарел (был «выход со всех устройств») — считаем неавторизованным.
  if (session.user.sv !== user.sessionVersion) return null;

  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

// Требует любого залогиненного пользователя.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/alexxx-admin");
  return user;
}

// Требует роль ADMIN.
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/alexxx-admin?forbidden=1");
  return user;
}

// Может ли пользователь редактировать конкретную экскурсию.
// ADMIN — любую; EDITOR — только свою (созданную им).
export function canEditTour(
  user: Pick<CurrentUser, "id" | "role">,
  tour: { createdById: string | null },
): boolean {
  if (user.role === "ADMIN") return true;
  return tour.createdById === user.id;
}
