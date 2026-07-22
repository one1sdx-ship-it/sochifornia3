"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, User } from "lucide-react";
import { useCustomerAuth } from "@/components/auth/customer-auth";
import { uploadReviewImage } from "@/lib/customer-upload";

// Профиль клиента: правка имени и аватара. Телефон — только для чтения (это логин).
export function ProfileForm() {
  const { customer, setCustomer } = useCustomerAuth();
  const router = useRouter();
  const [name, setName] = useState(customer?.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(customer?.avatarUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!customer) return null;

  async function onPickAvatar(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      setAvatarUrl(await uploadReviewImage(file));
    } catch (e) {
      setError((e as Error).message || "Не удалось загрузить фото");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/customer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), avatarUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Не удалось сохранить");
        setStatus("idle");
        return;
      }
      setCustomer(data.customer);
      setStatus("done");
      router.refresh();
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setError("Ошибка сети");
      setStatus("idle");
    }
  }

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-primary"
          aria-label="Сменить аватар"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <User className="h-9 w-9" />
          )}
          {uploading && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
              <Loader2 className="h-5 w-5 animate-spin" />
            </span>
          )}
        </button>
        <div>
          <p className="font-semibold text-ink">{customer.phone}</p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-1 text-sm text-primary hover:underline"
          >
            Сменить фото
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPickAvatar(e.target.files?.[0] ?? null)} />
      </div>

      <label className="mt-5 block">
        <span className="mb-1.5 block text-sm font-medium text-ink">Имя</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Как вас показывать в отзывах"
          className="w-full rounded-xl border border-hairline bg-surface-2 px-3 py-2.5 text-ink shadow-inner outline-none transition-colors placeholder:text-muted focus:border-primary focus:bg-surface focus:ring-2 focus:ring-primary/20"
        />
      </label>

      {error && <p className="mt-3 text-sm font-medium text-error">{error}</p>}

      <button
        type="button"
        onClick={save}
        disabled={status === "loading" || uploading}
        className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-semibold text-white transition-opacity disabled:opacity-40"
      >
        {status === "loading" ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : status === "done" ? (
          <>
            <Check className="h-5 w-5" /> Сохранено
          </>
        ) : (
          "Сохранить"
        )}
      </button>
    </div>
  );
}
