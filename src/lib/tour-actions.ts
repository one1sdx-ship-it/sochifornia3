// Серверные действия админки над экскурсиями.
// Права: ADMIN — всё; EDITOR — только создать черновик и копировать (копия — его черновик).
// Публикация/снятие/архив/восстановление/удаление — только ADMIN (модерация).
"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, type CurrentUser } from "@/lib/session";
import { uniqueSlug } from "@/lib/slug";

const DEFAULT_BLOCK_ICONS = ["Sparkles", "MapPin", "Clock", "Camera"];

// Сброс кеша затронутых страниц.
function revalidateAll(slug?: string) {
  revalidatePath("/admin/tours");
  revalidatePath("/tours");
  revalidatePath("/");
  if (slug) revalidatePath(`/tours/${slug}`);
}

// Запись в журнал изменений.
async function writeLog(
  action: AuditAction,
  user: CurrentUser,
  tour: { id: string; title: string } | null,
  summary: string,
) {
  await prisma.auditLog.create({
    data: {
      action,
      userId: user.id,
      tourId: tour?.id ?? null,
      tourTitle: tour?.title ?? "",
      summary,
    },
  });
}

function assertAdmin(user: CurrentUser) {
  if (user.role !== "ADMIN") {
    throw new Error("Недостаточно прав: действие доступно только администратору");
  }
}

// ── Создать новую экскурсию (черновик) ───────────────────────────────
export async function createTour() {
  const user = await requireUser(); // создавать может и ADMIN, и EDITOR
  const slug = await uniqueSlug("novaya-ekskursiya");

  const tour = await prisma.tour.create({
    data: {
      slug,
      status: "DRAFT",
      title: "Новая экскурсия",
      excerpt: "",
      adultPrice: 0,
      childPrice: 0,
      priceSuffix: "₽/чел",
      createdById: user.id,
      updatedById: user.id,
      // Каркас для последующего inline-редактирования:
      blocks: {
        create: DEFAULT_BLOCK_ICONS.map((icon, order) => ({
          icon,
          iconType: "LUCIDE",
          title: "",
          order,
        })),
      },
      program: {
        create: [{ time: "09:00", title: "Сбор группы", text: "", order: 0 }],
      },
    },
  });

  await writeLog("CREATE", user, tour, "Создан черновик экскурсии");
  revalidateAll();
  redirect(`/admin/tours?tab=drafts`);
}

// ── Копировать экскурсию (→ черновик автора-копировщика) ──────────────
export async function copyTour(formData: FormData) {
  const user = await requireUser(); // копировать могут ADMIN и EDITOR
  const id = String(formData.get("id"));

  const src = await prisma.tour.findUnique({
    where: { id },
    include: { gallery: true, blocks: true, program: true, listItems: true, extraTariffs: true },
  });
  if (!src) throw new Error("Экскурсия не найдена");

  const slug = await uniqueSlug(`${src.slug}-kopiya`);

  const copy = await prisma.tour.create({
    data: {
      slug,
      status: "DRAFT",
      title: `${src.title} (копия)`,
      excerpt: src.excerpt,
      category: src.category,
      format: src.format,
      adultPrice: src.adultPrice,
      childPrice: src.childPrice,
      priceSuffix: src.priceSuffix,
      durationHours: src.durationHours,
      startTime: src.startTime,
      rating: src.rating,
      reviewsCount: src.reviewsCount,
      seasonal: src.seasonal,
      vip: src.vip,
      image: src.image,
      createdById: user.id,
      updatedById: user.id,
      gallery: { create: src.gallery.map((g) => ({ url: g.url, alt: g.alt, order: g.order })) },
      blocks: { create: src.blocks.map((b) => ({ icon: b.icon, iconType: b.iconType, title: b.title, order: b.order })) },
      program: { create: src.program.map((p) => ({ time: p.time, title: p.title, text: p.text, order: p.order })) },
      listItems: { create: src.listItems.map((i) => ({ kind: i.kind, text: i.text, icon: i.icon, iconType: i.iconType, order: i.order })) },
      extraTariffs: { create: src.extraTariffs.map((t) => ({ label: t.label, price: t.price, order: t.order })) },
    },
  });

  await writeLog("COPY", user, copy, `Скопировано из «${src.title}»`);
  revalidateAll();
  redirect(`/admin/tours?tab=drafts`);
}

// ── Опубликовать (черновик/архив → опубликован) — только ADMIN ────────
export async function publishTour(formData: FormData) {
  const user = await requireUser();
  assertAdmin(user);
  const id = String(formData.get("id"));
  const tour = await prisma.tour.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date(), archivedAt: null, updatedById: user.id },
  });
  await writeLog("PUBLISH", user, tour, "Опубликована");
  revalidateAll(tour.slug);
}

// ── Снять с публикации (→ черновик) — только ADMIN ────────────────────
export async function unpublishTour(formData: FormData) {
  const user = await requireUser();
  assertAdmin(user);
  const id = String(formData.get("id"));
  const tour = await prisma.tour.update({
    where: { id },
    data: { status: "DRAFT", updatedById: user.id },
  });
  await writeLog("UPDATE", user, tour, "Снята с публикации (в черновики)");
  revalidateAll(tour.slug);
}

// ── Архивировать — только ADMIN ──────────────────────────────────────
export async function archiveTour(formData: FormData) {
  const user = await requireUser();
  assertAdmin(user);
  const id = String(formData.get("id"));
  const tour = await prisma.tour.update({
    where: { id },
    data: { status: "ARCHIVED", archivedAt: new Date(), updatedById: user.id },
  });
  await writeLog("ARCHIVE", user, tour, "Перемещена в архив");
  revalidateAll(tour.slug);
}

// ── Восстановить из архива (→ черновик) — только ADMIN ────────────────
export async function restoreTour(formData: FormData) {
  const user = await requireUser();
  assertAdmin(user);
  const id = String(formData.get("id"));
  const tour = await prisma.tour.update({
    where: { id },
    data: { status: "DRAFT", archivedAt: null, updatedById: user.id },
  });
  await writeLog("RESTORE", user, tour, "Восстановлена из архива (в черновики)");
  revalidateAll(tour.slug);
}

// ── Удалить навсегда — только ADMIN ──────────────────────────────────
export async function deleteTour(formData: FormData) {
  const user = await requireUser();
  assertAdmin(user);
  const id = String(formData.get("id"));
  const tour = await prisma.tour.findUnique({ where: { id }, select: { id: true, title: true, slug: true } });
  if (!tour) return;
  await prisma.tour.delete({ where: { id } }); // связанные записи удалятся каскадно
  await writeLog("DELETE", user, null, `Удалена навсегда: «${tour.title}»`);
  revalidateAll(tour.slug);
}
