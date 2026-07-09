// Скрипт создания/обновления пользователя админки.
// Запуск: pnpm create-admin <email> <password> [ADMIN|EDITOR]
// По умолчанию роль ADMIN. Пароль хешируется bcrypt.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

async function main() {
  const [, , emailArg, password, roleArg] = process.argv;
  if (!emailArg || !password) {
    console.error("Использование: pnpm create-admin <email> <password> [ADMIN|EDITOR]");
    process.exit(1);
  }
  const email = emailArg.toLowerCase().trim();
  const role = roleArg === "EDITOR" ? "EDITOR" : "ADMIN";

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role },
    create: { email, name: email.split("@")[0], passwordHash, role },
  });

  console.log(`Готово: ${user.email} — роль ${user.role}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
