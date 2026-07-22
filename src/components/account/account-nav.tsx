"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, MessageSquare, Star, User } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/account", label: "Профиль", icon: User },
  { href: "/account/reviews", label: "Мои отзывы", icon: Star },
  { href: "/account/favorites", label: "Избранное", icon: Heart },
  { href: "/account/chat", label: "История чата", icon: MessageSquare },
];

export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2">
      {ITEMS.map((it) => {
        const active = pathname === it.href;
        const Icon = it.icon;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-white"
                : "border border-hairline bg-surface text-ink hover:bg-surface-2"
            )}
          >
            <Icon className="h-4 w-4" /> {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
