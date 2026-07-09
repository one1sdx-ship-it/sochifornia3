// Базовый конфиг Auth.js — БЕЗ обращений к БД, чтобы его можно было использовать
// в middleware (edge-рантайм). Credentials-провайдер (нужен bcrypt+Prisma) добавляется
// отдельно в src/auth.ts (node-рантайм).
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/alexxx-admin", // скрытая страница входа
  },
  session: {
    strategy: "jwt", // Credentials-провайдер работает только с JWT-стратегией
    maxAge: 60 * 60 * 24, // сессия живёт сутки
  },
  providers: [], // реальные провайдеры — в src/auth.ts
  callbacks: {
    // Кладём в токен id/роль/версию сессии при входе (без запросов к БД).
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.sv = user.sessionVersion;
      }
      return token;
    },
    // Прокидываем поля из токена в сессию.
    session({ session, token }) {
      const t = token as { id?: string; role?: "ADMIN" | "EDITOR"; sv?: number };
      if (t.id) {
        session.user.id = t.id;
        if (t.role) session.user.role = t.role;
        if (typeof t.sv === "number") session.user.sv = t.sv;
      }
      return session;
    },
    // Защита областей: /admin/* доступен только залогиненным.
    // Детальную проверку роли и свежести сессии делаем в самих страницах/действиях.
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isAdminArea = request.nextUrl.pathname.startsWith("/admin");
      if (isAdminArea) return isLoggedIn;
      return true;
    },
  },
} satisfies NextAuthConfig;
