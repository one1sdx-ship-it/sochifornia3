// Каркас личного кабинета: требует входа, шапка с навигацией и выходом.
import type { Metadata } from "next";
import { requireCustomer } from "@/lib/customer-session";
import { AccountNav } from "@/components/account/account-nav";
import { LogoutButton } from "@/components/auth/logout-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Личный кабинет",
  robots: { index: false, follow: false },
};

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireCustomer(); // гость — на главную

  return (
    <div className="container-wide py-28">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-bold text-ink">Личный кабинет</h1>
          <LogoutButton />
        </div>
        <AccountNav />
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}
