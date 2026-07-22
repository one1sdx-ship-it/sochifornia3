"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { LoginModal } from "./login-modal";
import { resetFavorites } from "@/lib/customer-favorites";

// Клиентская авторизация (вход по телефону) — контекст на весь сайт.
// Держит текущего клиента, даёт открыть окно входа и выйти. Модалка входа монтируется здесь же.

export type ClientCustomer = {
  id: string;
  phone: string;
  name: string;
  avatarUrl: string;
};

type CustomerAuthValue = {
  customer: ClientCustomer | null;
  openLogin: () => void;
  logout: () => Promise<void>;
  setCustomer: (c: ClientCustomer | null) => void;
};

const CustomerAuthContext = createContext<CustomerAuthValue | null>(null);

export function useCustomerAuth(): CustomerAuthValue {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error("useCustomerAuth должен использоваться внутри CustomerAuthProvider");
  return ctx;
}

export function CustomerAuthProvider({
  initialCustomer,
  children,
}: {
  initialCustomer: ClientCustomer | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [customer, setCustomer] = useState<ClientCustomer | null>(initialCustomer);
  const [loginOpen, setLoginOpen] = useState(false);

  const openLogin = useCallback(() => setLoginOpen(true), []);

  const logout = useCallback(async () => {
    await fetch("/api/customer/auth/logout", { method: "POST" });
    setCustomer(null);
    resetFavorites(); // забываем избранное вошедшего клиента
    router.refresh(); // перерисовать серверные компоненты без клиента
  }, [router]);

  const onSuccess = useCallback(
    (c: ClientCustomer) => {
      setCustomer(c);
      setLoginOpen(false);
      router.refresh(); // подтянуть серверные данные под вошедшего клиента
    },
    [router]
  );

  return (
    <CustomerAuthContext.Provider value={{ customer, openLogin, logout, setCustomer }}>
      {children}
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={onSuccess} />
    </CustomerAuthContext.Provider>
  );
}
