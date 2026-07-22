// Кабинет → «Избранное»: сохранённые экскурсии клиента.
import { requireCustomer } from "@/lib/customer-session";
import { getFavoriteTours } from "@/data/account";
import { TourCard } from "@/components/tour-card";

export default async function FavoritesPage() {
  const customer = await requireCustomer();
  const tours = await getFavoriteTours(customer.id);

  if (tours.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-hairline bg-surface p-10 text-center text-muted">
        В избранном пусто. Нажимайте на сердечко на карточке экскурсии, чтобы сохранить её сюда.
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {tours.map((t) => (
        <TourCard key={t.id} tour={t} />
      ))}
    </div>
  );
}
