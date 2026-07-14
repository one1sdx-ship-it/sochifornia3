// Общий каркас админки: шапка с пользователем и выходом.
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { logout, logoutEverywhere } from "@/lib/auth-actions";
import { LayoutGrid, LogOut, MonitorSmartphone } from "lucide-react";

export const dynamic = "force-dynamic"; // админка всегда актуальная

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/admin/tours" className="flex items-center gap-2 font-display font-bold text-ink">
              <LayoutGrid className="h-5 w-5 text-primary" /> Админка
            </Link>
            <nav className="flex items-center gap-3 text-sm">
              <Link href="/admin/tours" className="text-ink hover:text-primary">Экскурсии</Link>
              <Link href="/admin/chats" className="text-ink hover:text-primary">Чаты</Link>
              {user.role === "ADMIN" && (
                <Link href="/admin/journal" className="text-ink hover:text-primary">Журнал</Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted">
              {user.email} · <b className="text-ink">{user.role}</b>
            </span>
            <form action={logout}>
              <button className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 font-medium text-ink hover:bg-surface-2">
                <LogOut className="h-4 w-4" /> Выйти
              </button>
            </form>
            <form action={logoutEverywhere}>
              <button
                title="Выйти со всех устройств"
                className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 font-medium text-error hover:bg-error/5"
              >
                <MonitorSmartphone className="h-4 w-4" /> Со всех
              </button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
