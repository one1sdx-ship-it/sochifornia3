// Кабинет → «История чата»: переписка клиента с поддержкой (только просмотр).
import { requireCustomer } from "@/lib/customer-session";
import { getCustomerChat } from "@/data/account";
import { cn } from "@/lib/utils";

export default async function AccountChatPage() {
  const customer = await requireCustomer();
  const messages = await getCustomerChat(customer.id, customer.phone);

  if (!messages || messages.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-hairline bg-surface p-10 text-center text-muted">
        Переписки с поддержкой пока нет.
      </div>
    );
  }

  const fmt = (d: Date) => new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(d);

  return (
    <div className="space-y-3 rounded-2xl border border-hairline bg-surface p-4 sm:p-6">
      {messages.map((m) => {
        const mine = m.sender === "CLIENT";
        return (
          <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5 text-[15px]",
                mine ? "bg-primary text-white" : "bg-surface-2 text-ink"
              )}
            >
              {/* Вложение (фото/голос) — ссылкой; текстовые типы — как есть */}
              {m.type === "IMAGE" && m.attachmentUrl ? (
                <a href={m.attachmentUrl} target="_blank" rel="noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.attachmentUrl} alt="" className="max-h-48 rounded-lg" />
                </a>
              ) : m.type === "VOICE" && m.attachmentUrl ? (
                <a href={m.attachmentUrl} target="_blank" rel="noreferrer" className="underline">
                  Голосовое сообщение
                </a>
              ) : m.text ? (
                <span className="whitespace-pre-line">{m.text}</span>
              ) : (
                <span className="opacity-70">[сообщение]</span>
              )}
              <span className={cn("mt-1 block text-[11px]", mine ? "text-white/70" : "text-muted")}>
                {fmt(m.createdAt)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
