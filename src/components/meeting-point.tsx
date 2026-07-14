// «Место встречи» на странице экскурсии (бывший раздел «Маршрут»).
// Координаты и адрес задаются в админке (раздел «Чаты» → отправка локации с галочкой
// «Сохранить как место встречи тура») и хранятся в Tour.meetingAddress/meetingLat/meetingLng.
import { MapPin } from "lucide-react";

export function MeetingPoint({
  address,
  lat,
  lng,
}: {
  address: string;
  lat: number | null;
  lng: number | null;
}) {
  const hasCoords = typeof lat === "number" && typeof lng === "number";
  if (!hasCoords) {
    // Точка ещё не задана — честная заглушка.
    return (
      <div className="mt-6 flex aspect-[16/8] w-full items-center justify-center rounded-lg border border-dashed border-hairline bg-surface-2 text-center">
        <div className="px-6">
          <MapPin className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-2 font-medium text-ink">{address || "Точку сбора уточняйте у менеджера"}</p>
          <p className="text-sm text-muted">Напишите в чат — пришлём точку на карте</p>
        </div>
      </div>
    );
  }

  const d = 0.005;
  const bbox = `${lng! - d},${lat! - d},${lng! + d},${lat! + d}`;
  return (
    <div className="mt-6">
      {address && (
        <p className="mb-3 flex items-center gap-2 font-medium text-ink">
          <MapPin className="h-5 w-5 shrink-0 text-primary" /> {address}
        </p>
      )}
      <iframe
        title="Место встречи на карте"
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`}
        className="aspect-[16/8] w-full rounded-lg border border-hairline"
        loading="lazy"
      />
      <a
        href={`https://yandex.ru/maps/?pt=${lng},${lat}&z=16&l=map`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-sm font-medium text-primary underline"
      >
        Открыть в Яндекс.Картах
      </a>
    </div>
  );
}
