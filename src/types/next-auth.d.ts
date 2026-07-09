// Расширение типов Auth.js: добавляем в сессию и токен id, роль и версию сессии.
import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      sv: number; // версия сессии (sessionVersion) для «выхода со всех устройств»
    } & DefaultSession["user"];
  }

  interface User {
    role?: Role;
    sessionVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    sv?: number;
  }
}
