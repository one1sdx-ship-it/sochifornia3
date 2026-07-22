"use client";

import { useRouter } from "next/navigation";

// Селектор экскурсии для режима «Выбранная экскурсия»: при выборе переходит
// на /admin/reviews с нужным туром, сохраняя текущую группу (status).
export function TourFilterSelect({
  tours,
  value,
  status,
}: {
  tours: { id: string; title: string }[];
  value: string;
  status: string;
}) {
  const router = useRouter();
  return (
    <select
      value={value}
      onChange={(e) => {
        const id = e.target.value;
        router.push(`/admin/reviews?scope=tour&tourId=${id}&status=${status}`);
      }}
      className="w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 text-ink outline-none focus:border-primary"
    >
      <option value="" disabled>
        Выберите экскурсию…
      </option>
      {tours.map((t) => (
        <option key={t.id} value={t.id}>
          {t.title}
        </option>
      ))}
    </select>
  );
}
