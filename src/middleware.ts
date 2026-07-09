// Middleware защищает область /admin/*: неавторизованных редиректит на скрытый вход.
// Использует edge-безопасный authConfig (без Prisma/bcrypt).
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/admin/:path*"],
};
