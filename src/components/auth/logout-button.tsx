"use client";

import { LogOut } from "lucide-react";
import { useCustomerAuth } from "./customer-auth";

// Кнопка выхода клиента из личного кабинета. После выхода провайдер обновляет
// серверные данные — страница /account (требует входа) сама уводит на главную.
export function LogoutButton() {
  const { logout } = useCustomerAuth();
  return (
    <button
      type="button"
      onClick={() => logout()}
      className="inline-flex items-center gap-2 rounded-xl border border-hairline bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
    >
      <LogOut className="h-4 w-4" /> Выйти
    </button>
  );
}
