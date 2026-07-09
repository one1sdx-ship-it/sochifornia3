// Серверные действия входа/выхода.
"use server";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";

// Обычный выход (только на этом устройстве).
export async function logout() {
  await signOut({ redirectTo: "/alexxx-admin" });
}

// Выход со всех устройств: увеличиваем sessionVersion — все старые токены
// становятся невалидными (см. getCurrentUser в src/lib/session.ts).
export async function logoutEverywhere() {
  const session = await auth();
  if (session?.user?.id) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { sessionVersion: { increment: 1 } },
    });
  }
  await signOut({ redirectTo: "/alexxx-admin" });
}
