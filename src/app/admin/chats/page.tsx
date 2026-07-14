// Страница «Чаты» в админке: список диалогов + окно переписки + профиль сотрудника.
// Вся интерактивность — в клиентском компоненте (поллинг раз в 3 секунды).
import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { AdminChat } from "@/components/admin/chat/admin-chat";

export const metadata: Metadata = { title: "Чаты с клиентами", robots: { index: false } };

export default async function AdminChatsPage() {
  await requireUser(); // доступ — любой сотрудник (ADMIN и EDITOR)
  return <AdminChat />;
}
