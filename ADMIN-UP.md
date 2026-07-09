# ADMIN-UP.md — Система модерации контента экскурсий (sochifornia)

> Исчерпывающая документация по админке/CMS сайта экскурсий. Читать в новой сессии
> ПЕРЕД любой доработкой, починкой или расширением. Здесь — вся картина: что сделано,
> как устроено, где что лежит, на что смотреть, как решать типовые задачи и баги.
>
> Дата создания: этап разработки — реализованы этапы 0–6. Проверено: `tsc` чист + `next build` проходит.
> Комментарии и общение по проекту — на русском.

---

## 0. Оглавление

1. Что это и зачем
2. Технологии и версии
3. КРИТИЧНО: расположение проекта и особенности pnpm (Windows)
4. Переменные окружения (.env)
5. База данных (Prisma 7 + PostgreSQL)
6. Как публичный сайт читает данные
7. Аутентификация и роли (Auth.js v5)
8. Панель `/admin/tours` (управление списком)
9. Inline-редактор на странице тура (mobile-first)
10. Фотографии (загрузка, галерея, синхронизация карусели)
11. Журнал изменений
12. Полная карта файлов (что где и зачем)
13. Важные нюансы и «грабли» (обязательно к прочтению)
14. Как решать типовые задачи (how-to)
15. Развёртывание на Vercel (прод)
16. Что НЕ сделано (отложено осознанно)
17. Траблшутинг (частые ошибки и их причины)

---

## 1. Что это и зачем

Владелец сайта должен сам, без программиста, редактировать контент экскурсий и управлять
их публикацией. Реализована **гибридная система**:

- **Inline-редактирование** прямо на странице тура (`/tours/<slug>`) — заголовок, описание,
  4 блока, программа, «что входит/не входит», «что взять», цены, фотографии. Заточено под
  **мобильную версию** (владелец правит с телефона).
- **Панель `/admin/tours`** — список всех экскурсий: добавить, копировать, опубликовать,
  снять с публикации, архивировать, восстановить, удалить; поиск, сортировка, вкладки.
- **Журнал `/admin/journal`** — кто, что и когда менял.

Контент раньше был захардкожен в `src/data/tours.ts`. Теперь он в БД PostgreSQL, а старый
файл оставлен только как источник для первичного наполнения (seed).

---

## 2. Технологии и версии

| Технология | Версия | Роль |
|---|---|---|
| Next.js | 16.2.9 (App Router, Turbopack) | фреймворк |
| React | 19 | UI |
| TypeScript | 5.7 | типы |
| Tailwind CSS | 3.4 | стили |
| PostgreSQL | локально на ПК (dev) | база данных |
| Prisma | 7.8 (`prisma`, `@prisma/client`) | ORM |
| @prisma/adapter-pg | 7.8 | driver adapter (Prisma 7 требует адаптер) |
| pg | 8.22 | драйвер Postgres |
| next-auth | 5.0.0-beta.31 (Auth.js v5) | вход/сессии |
| bcryptjs | 3.0 | хеш паролей (в v3 типы встроены, `@types/bcryptjs` НЕ нужен) |
| @vercel/blob | 2.6 | хранилище фото (прод) |
| tsx | 4.x | запуск TS-скриптов (seed, create-admin) |
| dotenv | 17 | загрузка .env для CLI-скриптов |

Пакетный менеджер — **pnpm 11** (см. раздел 3, там важные грабли).

---

## 3. КРИТИЧНО: расположение проекта и особенности pnpm (Windows)

### 3.1. Проект — в подпапке
Реальное приложение лежит в **`X:\SITE-CLIENT\TOUR3d1\sochifornia`** (там `package.json`).
Родитель `X:\SITE-CLIENT\TOUR3d1` — НЕ node-проект (там только графы/доки).

**Всегда запускай pnpm с абсолютным `--dir`:**
```
pnpm --dir X:\SITE-CLIENT\TOUR3d1\sochifornia <команда>
```
Относительный `--dir sochifornia` ломается, если текущая папка терминала уже `sochifornia`
(путь задваивается → `sochifornia\sochifornia` → ENOENT). В прошлый раз из-за неверного cwd
`pnpm add` создал ФАНТОМНЫЙ проект в корне `TOUR3d1` (package.json + node_modules). Если увидишь
package.json/node_modules прямо в `TOUR3d1` — это мусор, удалять.

### 3.2. Блокировка build-скриптов (ERR_PNPM_IGNORED_BUILDS)
pnpm 11 блокирует нативные build-скрипты (`sharp`, `prisma`, `@prisma/engines`, `esbuild`)
до одобрения. Симптом: `pnpm exec`/`install`/`build` падает с
`ERR_PNPM_IGNORED_BUILDS: ... sharp`. **Лечится неинтерактивно:**
```
pnpm --dir X:\SITE-CLIENT\TOUR3d1\sochifornia approve-builds --all
```
Важно: **каждый `pnpm add` заново пере-скаффолдит `pnpm-workspace.yaml`** (появляется блок
`allowBuilds:` с плейсхолдерами) и сбрасывает одобрения → после установки новых пакетов
может снова понадобиться `approve-builds --all`. `onlyBuiltDependencies` в
`pnpm-workspace.yaml` сам по себе НЕ снимает блокировку — нужен именно `approve-builds --all`.

---

## 4. Переменные окружения (.env)

Файл `sochifornia/.env` (для CLI и Next). Пример — в `.env.example`.

| Переменная | Назначение | Где брать |
|---|---|---|
| `DATABASE_URL` | подключение к Postgres | dev: локальный ПК; прод: облачный Neon/Vercel Postgres |
| `AUTH_SECRET` | секрет сессий Auth.js | сгенерирован (dev); на проде задать свой |
| `BLOB_READ_WRITE_TOKEN` | токен Vercel Blob (фото) | Vercel подставит сам, если создать Blob store |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google-вход (пока не подключён) | Google Cloud Console (на будущее) |

- **Локальный `DATABASE_URL`** сейчас указывает на `postgres@localhost:5432/sochifornia`
  (пароль хранится прямо в `.env`, не дублирую его здесь). Формат:
  `postgresql://ПОЛЬЗОВАТЕЛЬ:ПАРОЛЬ@localhost:5432/ИМЯ_БД?schema=public`.
- Prisma 7 **не читает .env автоматически** для CLI — его подгружает `prisma.config.ts`
  через `import "dotenv/config"`. Next читает .env сам.

**Первый администратор (dev):** `gurumvster@gmail.com`, роль `ADMIN`. Пароль задан при
создании через скрипт (см. раздел 7.6). Если забыт — пересоздать скриптом `create-admin`.

---

## 5. База данных (Prisma 7 + PostgreSQL)

### 5.1. Особенности Prisma 7 (отличия от 6 — важно!)
- В `schema.prisma` датасорс **без `url`** (только `provider = "postgresql"`). Строка
  подключения задаётся в **`prisma.config.ts`** (`datasource.url = process.env.DATABASE_URL`).
- Рантайм работает через **driver adapter**: `PrismaPg` из `@prisma/adapter-pg`
  (см. `src/lib/prisma.ts`). Без адаптера клиент не подключится.
- Если увидишь ошибку `The datasource property 'url' is no longer supported in schema files`
  — это ровно про это (не возвращать `url` в schema).

### 5.2. Модели (`prisma/schema.prisma`)
- `User` — email, passwordHash (bcrypt), role (`ADMIN`/`EDITOR`), `sessionVersion`
  (счётчик для «выхода со всех устройств»), связи.
- `Account`, `Session`, `VerificationToken` — таблицы адаптера Auth.js (заведены на будущее;
  сейчас стратегия JWT, БД-сессии не используются — см. раздел 7).
- `Tour` — экскурсия: `slug`, `status` (`DRAFT`/`PUBLISHED`/`ARCHIVED`), `title`, `excerpt`,
  `category`, `format`, `adultPrice`, `childPrice`, `priceSuffix`, `durationHours`, `startTime`,
  `rating`, `reviewsCount`, `seasonal`, `vip`, `image` (обложка), `sortOrder`,
  `createdById`/`updatedById`, `publishedAt`/`archivedAt`.
- `TourImage` — фото галереи (url, alt, order). Галерея = единый источник карусели.
- `TourBlock` — 4 блока: `icon`, `iconType` (`LUCIDE`/`CUSTOM`), `title`, `order`.
- `ProgramPoint` — точка программы: `time`, `title`, `text`, `order`.
- `TourListItem` — пункт списков: `kind` (`INCLUDED`/`EXCLUDED`/`BRING`), `text`, `icon`,
  `iconType`, `order`. «Что взять» (BRING) может иметь свою иконку.
- `ExtraTariff` — доп. тариф: `label`, `price`, `order`.
- `AuditLog` — журнал: `action`, `userId`, `tourId`, `tourTitle` (копия названия, переживает
  удаление тура), `summary`, `meta` (Json, задел под откат версий), `createdAt`.
- Все вложенные модели удаляются каскадно при удалении тура (`onDelete: Cascade`).

### 5.3. Команды БД (из `package.json`, запускать с `--dir <абс.путь>`)
```
pnpm db:generate     # prisma generate — регенерировать клиент после правок schema
pnpm db:push         # prisma db push — применить schema к БД (dev, без миграций)
pnpm db:seed         # наполнить БД из src/data/tours.ts (идемпотентно, по slug)
pnpm db:studio       # prisma studio — GUI для просмотра/правки БД
pnpm create-admin <email> <пароль> [ADMIN|EDITOR]   # создать/обновить пользователя
```
- После любой правки `schema.prisma`: `db:push` затем `db:generate`.
- `db push` НЕ ведёт историю миграций. Если позже нужны миграции — перейти на `prisma migrate`.
- Seed переносит 12 исходных туров как `PUBLISHED`, детскую цену ставит 0, иконки блоков —
  дефолтные (Sparkles/MapPin/Clock/Camera). Повторный запуск безопасен.

---

## 6. Как публичный сайт читает данные

Файл **`src/data/tours-db.ts`** — слой доступа. Возвращает данные в СТАРОМ формате `Tour`
(тип из `src/data/types.ts`), чтобы существующие компоненты не переписывать.

- `getPublishedTours()` — все `PUBLISHED` (каталог, «популярные», похожие).
- `getPublishedTourBySlug(slug)` — один опубликованный (для метаданных).
- `getPublishedSlugs()` — slugs (для `generateStaticParams`, sitemap).
- `getTourEntity(slug)` — ПОЛНАЯ сущность с id всех вложенных записей (любой статус) — для
  редактирования. Тип `TourEntity`.
- `toLegacyTour(entity)` — маппинг полной сущности в формат `Tour` для read-only рендера.

Маппинг: `adultPrice → price` (на сайте показывается взрослая цена как «от»),
`blocks[].title → highlights[]`, списки по `kind` → `included/excluded/bring`.

**Кеш:** `/` и `/tours` — `export const revalidate = 60` (обновление раз в минуту, ISR).
**НО** `/tours/[slug]` стал **динамическим** (`ƒ`), потому что читает сессию (`getCurrentUser`)
для показа кнопки редактирования — см. раздел 13, п. 1.

Потребители данных (все переведены на БД): `src/app/tours/page.tsx`,
`src/app/tours/[slug]/page.tsx`, `src/components/sections/popular-tours-section.tsx`,
`src/app/sitemap.ts`.

---

## 7. Аутентификация и роли (Auth.js v5)

### 7.1. Общая схема
- Вход по **email + паролю** (Google — на будущее, код-задел есть).
- **Скрытый адрес входа: `/alexxx-admin`** (страница `src/app/alexxx-admin/page.tsx`).
- Стратегия сессии — **JWT** (не БД-сессии!), потому что Credentials-провайдер Auth.js
  работает только с JWT. Срок сессии — **1 сутки** (`maxAge: 60*60*24`).
- Роли: `ADMIN` (всё) / `EDITOR` (только создавать черновики и править свои; публикация/
  архив/удаление — запрещены).

### 7.2. Разделение конфигов (важно для edge!)
- `src/auth.config.ts` — **edge-безопасный** базовый конфиг БЕЗ Prisma/bcrypt. Используется
  в middleware. Содержит `pages`, `session`, `callbacks` (jwt/session/authorized).
- `src/auth.ts` — **полный** конфиг (node-рантайм): добавляет Credentials-провайдер с
  `authorize()` (Prisma + bcrypt.compare). Экспортит `handlers, auth, signIn, signOut`.
- Причина разделения: middleware исполняется в edge, где Prisma/bcrypt недоступны. Поэтому
  БД-запросы в jwt/session-колбэках ЗАПРЕЩЕНЫ (их там нет).

### 7.3. «Выход со всех устройств» (sessionVersion)
- В токене хранится `sv` (sessionVersion пользователя на момент входа).
- Действие «выйти со всех устройств» (`logoutEverywhere` в `src/lib/auth-actions.ts`)
  инкрементит `User.sessionVersion` в БД.
- Свежесть проверяется НЕ в middleware (edge), а в `getCurrentUser()` (`src/lib/session.ts`,
  node): если `session.user.sv !== user.sessionVersion` → считаем неавторизованным.
- Итог: старые токены становятся невалидны при следующем заходе на защищённую страницу/действие.

### 7.4. Middleware
`src/middleware.ts` защищает `/admin/*` (matcher). Использует `auth.config.ts`.
Неавторизованных редиректит на `/alexxx-admin` (через колбэк `authorized`).
⚠️ Next 16 переименовал `middleware` → `proxy` (предупреждение при сборке; пока работает).

### 7.5. Серверные утилиты доступа (`src/lib/session.ts`)
- `getCurrentUser()` — текущий пользователь + свежая проверка роли и sessionVersion по БД.
- `requireUser()` — требует вход (иначе redirect на вход).
- `requireAdmin()` — требует роль ADMIN.
- `canEditTour(user, tour)` — ADMIN правит любой тур; EDITOR — только свой (`createdById`).

### 7.6. Управление пользователями
- Создать/сменить пароль/роль: `pnpm create-admin <email> <пароль> [ADMIN|EDITOR]`
  (скрипт `scripts/create-admin.ts`, upsert по email, bcrypt-хеш).
- Сброс пароля — только вручную этим же скриптом (по решению владельца, автосброса по email нет).

---

## 8. Панель `/admin/tours` (управление списком)

- Страница: `src/app/admin/tours/page.tsx`. Каркас (шапка+выход): `src/app/admin/layout.tsx`.
- Вкладки по статусу: **Активные** (PUBLISHED) / **Черновики** (DRAFT) / **Архив** (ARCHIVED),
  со счётчиками.
- **Поиск** (по названию/slug) + **сортировка** (обновлённые / название / цена) — GET-форма.
- Запросы: `src/data/admin-tours.ts` (`getAdminTours`, `getStatusCounts`).
- **Действия** — серверные, в `src/lib/tour-actions.ts`:
  - `createTour` — новый черновик-каркас (4 пустых блока, 1 точка программы). Доступно ADMIN+EDITOR.
  - `copyTour` — полная копия как черновик автора-копировщика. ADMIN+EDITOR.
  - `publishTour`, `unpublishTour`, `archiveTour`, `restoreTour`, `deleteTour` — **только ADMIN**.
- Удаление — с подтверждением (клиентская `DangerButton`, `src/components/admin/danger-button.tsx`).
- Каждое действие пишет в журнал (`AuditLog`) и делает `revalidatePath` затронутых страниц.
- Права проверяются на сервере (`assertAdmin`) — прятание кнопок в UI НЕ единственная защита.

---

## 9. Inline-редактор на странице тура (mobile-first)

### 9.1. Логика показа
В `src/app/tours/[slug]/page.tsx`:
- Грузим `getTourEntity(slug)` (любой статус).
- `canEdit = canEditTour(currentUser, entity)`.
- Если тур не `PUBLISHED` и `!canEdit` → `notFound()` (посторонние черновики не видят).
- Авторизованный редактор ВИДИТ черновики/архив (с плашкой «виден только вам»).
- Внизу рендерится `<TourEditLauncher>` только если `canEdit`.

### 9.2. UI (mobile-first)
`src/components/admin/tour-editor/`:
- `tour-edit-launcher.tsx` — плавающая кнопка «Редактировать» (внизу справа, зона большого
  пальца) → меню разделов → отдельные редакторы. Тип данных редактора — `EditorTour`.
- `sheet.tsx` — нижняя панель (bottom-sheet): снизу на мобиле, по центру на десктопе.
  Показывает индикатор сохранения.
- `use-autosave.ts` — хук `useAutosave(tourId, queueKey)`: дебаунс **700 мс**, статус
  (`saving/saved/error`), **очередь в localStorage** при обрыве связи + `flushQueue` при
  возврате сети (слушатель `online`). Плюс `uploadImage(file)` — загрузка на `/api/admin/upload`.
- Разделы: Заголовок/описание, Фотографии, 4 блока, Программа, Что входит, Не входит,
  Что взять, Стоимость. Порядок пунктов — кнопками ↑↓ (не drag — удобнее на телефоне).

### 9.3. API автосохранения
`src/app/api/admin/tours/[id]/route.ts` (метод **PATCH**):
- Проверяет `getCurrentUser` (401) и `canEditTour` (403).
- Тело — размеченный union `SavePayload` по `type`: `meta` (заголовок/описание/цены),
  `blocks`, `program`, `list` (+`kind`), `tariffs`, `gallery`.
- Для коллекций (blocks/program/list/tariffs/gallery) — стратегия **«удалить всё и создать
  заново»** в транзакции (проще и атомарно). Скаляры (`meta`) — обычный update.
- Есть ограничения-«клампы» (длина строк, максимум элементов). Полноценной Zod-валидации
  пока НЕТ (отложено).
- После сохранения: пишет в журнал `UPDATE` с человекочитаемым разделом (`sectionLabel`),
  делает `revalidatePath` публичной страницы/каталога/главной.

### 9.4. Иконки
`src/components/dynamic-icon.tsx` — `<DynamicIcon name iconType />`:
- `iconType==="CUSTOM"` → рисует `<img src={name}>` (загруженный файл).
- иначе → иконка lucide по имени (`name`), фолбэк `Check`.
- Используется на публичной странице для 4 блоков и пунктов «что взять», и в редакторе для превью.

---

## 10. Фотографии (загрузка, галерея, синхронизация карусели)

### 10.1. Загрузка — `src/app/api/admin/upload/route.ts` (POST, multipart, node-рантайм)
- Проверка авторизации (`getCurrentUser`).
- Разрешены: jpg, png, webp, gif, svg. Лимит **15 МБ**.
- **Двойной режим:**
  - Есть `BLOB_READ_WRITE_TOKEN` → грузит в **Vercel Blob** (`put`, папка `tours/`), вернёт https-url.
  - Нет токена (dev) → сохраняет в **`public/uploads/`**, вернёт `/uploads/<имя>`.
- ⚠️ На Vercel файловая система эфемерна — в проде ОБЯЗАТЕЛЬНО Blob (см. раздел 15).

### 10.2. Галерея и синхронизация
- Раздел «Фотографии» в редакторе (`GalleryEditor` в launcher): загрузка нескольких фото,
  порядок ↑↓, удаление. **Первое фото = обложка** (при сохранении `type: "gallery"` сервер
  ставит `Tour.image = images[0].url`).
- **Единый источник:** галерея (`TourImage`) питает карусель героя, карточку в каталоге и
  секцию «Фотографии» — как требовалось (синхронно).
  - `src/components/tour-hero-carousel.tsx` — принимает `images: string[]` (раньше был один
    `image`).
  - `src/components/tour-card.tsx` — карусель = `tour.gallery` (фолбэк на обложку, если пусто).
  - `src/components/tour-gallery.tsx` — секция «Фотографии», уже брала массив.
- `src/components/gradient-image.tsx` — рисует РЕАЛЬНОЕ фото, если `id` начинается с `/` или
  `http`; иначе — CSS-градиент-заглушку по ключу (например `grad-mountains-2`). Поэтому в БД
  часть галерей — реальные пути, часть — id градиентов (из исходных данных).

### 10.3. Свои иконки-картинки
В редакторах 4 блоков и «что взять» — кнопка загрузки картинки (`IconUpload`) рядом с полем
имени иконки. Загружает файл → ставит `icon = url`, `iconType = "CUSTOM"`.

---

## 11. Журнал изменений

- Модель `AuditLog`. Запросы — `src/data/audit.ts` (`getAuditLog({limit, action})`).
- Страница `/admin/journal` (`src/app/admin/journal/page.tsx`) — **только ADMIN**, ссылка в
  шапке. Фильтр по типу действия, до 300 последних записей.
- Что логируется:
  - Действия из `tour-actions.ts`: CREATE, COPY, PUBLISH, UPDATE (снятие с публикации),
    ARCHIVE, RESTORE, DELETE.
  - Правки контента из API автосохранения: `UPDATE` с названием раздела.
- ⚠️ Автосохранение пишет запись на КАЖДОЕ сохранение раздела (дебаунс 700 мс). При активном
  редактировании журнал может быстро расти. Если станет шумно — добавить коалесинг
  (не логировать чаще N сек на тур+раздел) или не логировать `meta`-автосейвы. `meta` в
  `AuditLog` (Json) — задел под откат версий (пока не используется).

---

## 12. Полная карта файлов

### Новые файлы
```
prisma/schema.prisma                         # модели БД
prisma.config.ts                             # конфиг Prisma 7 (url тут, не в schema)
prisma/seed.ts                               # наполнение из src/data/tours.ts
scripts/create-admin.ts                      # создание пользователя
.env / .env.example                          # переменные окружения

src/lib/prisma.ts                            # singleton PrismaClient + PrismaPg адаптер
src/lib/session.ts                           # getCurrentUser/requireUser/requireAdmin/canEditTour
src/lib/auth-actions.ts                      # logout / logoutEverywhere (server actions)
src/lib/tour-actions.ts                      # create/copy/publish/unpublish/archive/restore/delete
src/lib/slug.ts                              # slugify (транслит рус) + uniqueSlug

src/auth.config.ts                           # edge-безопасный базовый конфиг Auth.js
src/auth.ts                                  # полный конфиг + Credentials (bcrypt)
src/middleware.ts                            # защита /admin/* (в Next16 переименовать в proxy.ts)
src/types/next-auth.d.ts                     # расширение типов сессии/токена (role, sv, id)

src/data/tours-db.ts                         # чтение туров из БД (public + entity + маппинг)
src/data/admin-tours.ts                      # список для админки (фильтр/поиск/сортировка/счётчики)
src/data/audit.ts                            # запрос журнала

src/app/alexxx-admin/page.tsx                # скрытая страница входа
src/app/admin/layout.tsx                     # каркас админки (шапка, выход, навигация)
src/app/admin/tours/page.tsx                 # панель управления списком
src/app/admin/journal/page.tsx               # журнал (только ADMIN)
src/app/api/auth/[...nextauth]/route.ts      # роут Auth.js
src/app/api/admin/tours/[id]/route.ts        # PATCH — автосохранение контента
src/app/api/admin/upload/route.ts            # POST — загрузка фото (Blob / public/uploads)

src/components/dynamic-icon.tsx              # иконка lucide по имени или своя картинка
src/components/admin/danger-button.tsx       # кнопка с confirm() для удаления
src/components/admin/tour-editor/sheet.tsx           # нижняя панель (bottom-sheet)
src/components/admin/tour-editor/use-autosave.ts     # автосейв + очередь + uploadImage
src/components/admin/tour-editor/tour-edit-launcher.tsx  # редактор: кнопка/меню/разделы
```

### Изменённые файлы
```
package.json                                 # скрипты db:*, create-admin, prisma.seed
pnpm-workspace.yaml                          # onlyBuiltDependencies (см. раздел 3.2)
src/app/tours/[slug]/page.tsx                # загрузка entity, canEdit, иконки блоков/bring,
                                             #   launcher, hero принимает массив images
src/app/tours/page.tsx                       # читает getPublishedTours + revalidate 60
src/app/page.tsx                             # revalidate 60
src/app/sitemap.ts                           # async + getPublishedSlugs
src/components/sections/popular-tours-section.tsx  # async + getPublishedTours
src/components/tour-card.tsx                  # карусель = tour.gallery
src/components/tour-hero-carousel.tsx         # проп images: string[] (было image: string)
```

### НЕ трогать без нужды
`src/data/tours.ts` — исходные данные, используется ТОЛЬКО сидом. Сайт читает из БД.

---

## 13. Важные нюансы и «грабли» (обязательно к прочтению)

1. **`/tours/[slug]` — динамическая страница.** Читает сессию (`getCurrentUser`) → Next
   помечает маршрут `ƒ` (SSR по запросу), `revalidate 60` для неё НЕ действует. Для анонимных
   чуть медленнее (каждый заход = запросы в БД). Чтобы вернуть кеш: вынести проверку входа на
   клиент (клиентский компонент дёргает `/api/auth/session` и показывает кнопку) — тогда
   страница снова статична/ISR. Пока оставлено как есть (масштаб небольшой).

2. **`middleware` → `proxy` (Next 16).** Сборка предупреждает. Работает, но лучше переименовать
   `src/middleware.ts` в `src/proxy.ts` (и default-экспорт оставить). Мелкая задача.

3. **JWT-аугментация типов.** В session-колбэке (`auth.config.ts`) токен приводится к локальному
   типу `{ id?, role?, sv? }` через `as`, потому что аугментация `next-auth/jwt` не долетает до
   типа токена в v5 (он берётся из `@auth/core/jwt`). Если ломается типизация токена — смотреть сюда.

4. **`useSearchParams` требует `<Suspense>`.** Страница входа `/alexxx-admin` обёрнута в Suspense
   (иначе падает сборка). При добавлении клиентских страниц с `useSearchParams` — помнить об этом.

5. **Credentials + JWT (не БД-сессии).** Нельзя переключить на `session.strategy: "database"`,
   пока используется Credentials-провайдер — Auth.js это не поддерживает. Таблицы
   `Session/Account/VerificationToken` заведены на будущее (например под Google), сейчас не задействованы.

6. **Права — на сервере.** Каждое серверное действие и API проверяет `requireUser`/`assertAdmin`/
   `canEditTour`. Скрытие кнопок в UI — только UX, не защита. При добавлении новых действий —
   ОБЯЗАТЕЛЬНО проверять права на сервере.

7. **Автосохранение = «заменить коллекцию».** blocks/program/list/tariffs/gallery сохраняются
   через delete+createMany. Значит id вложенных записей меняются при каждом сохранении — это ОК,
   т.к. UI оперирует индексами, а не id. Но если появится логика, завязанная на стабильные id
   вложенных записей — придётся переделать на upsert-по-id.

8. **Обложка = первое фото галереи.** Меняется автоматически при сохранении галереи. Отдельно
   `Tour.image` руками не редактируется.

9. **`GradientImage`**: путь с `/` или `http` → фото; иначе градиент по ключу. Не сломать эту
   логику — от неё зависит показ и заглушек, и реальных фото.

10. **pnpm-грабли** — см. раздел 3 (абсолютный `--dir`, `approve-builds --all` после `pnpm add`).

11. **`next build` предупреждает про Turbopack/боль­шие страницы** — норм. Главное: TypeScript и
    генерация страниц проходят. `next build` ловит ошибки границ server/client, которые `tsc` НЕ ловит.

---

## 14. Как решать типовые задачи (how-to)

### Добавить новое редактируемое поле тура (например «телефон гида»)
1. `schema.prisma` → добавить поле в `Tour`. `pnpm db:push && pnpm db:generate`.
2. `tours-db.ts` → пробросить поле в `toLegacyTour`/entity (если нужно на сайте).
3. Редактор: добавить поле в `EditorTour` (launcher), в `buildEditorTour` (в `[slug]/page.tsx`),
   в нужный редактор-раздел, и в `SavePayload` (`use-autosave.ts` И серверный route) + обработку
   в `route.ts` (case).
4. Показать на публичной странице (если надо).

### Добавить новый раздел редактирования
1. Новый `type` в `SavePayload` (клиент `use-autosave.ts` + сервер `route.ts`), обработчик-`case`.
2. Новый редактор-компонент внутри `tour-edit-launcher.tsx` + пункт в `hubItems` + рендер по `open`.
3. При необходимости — новая модель/поля в БД.

### Поменять правила ролей
`src/lib/session.ts` (`canEditTour`) и проверки в `src/lib/tour-actions.ts` (`assertAdmin`).
Например, разрешить EDITOR публиковать свои — убрать `assertAdmin` из `publishTour` и добавить
проверку владения.

### Сменить/сбросить пароль, создать пользователя
`pnpm --dir <абс> create-admin <email> <пароль> [ADMIN|EDITOR]`.

### Сменить скрытый адрес входа
Поменять путь папки `src/app/alexxx-admin/` И `pages.signIn` в `src/auth.config.ts` И редиректы
`/alexxx-admin` в `session.ts`, `auth-actions.ts`, странице входа.

### Посмотреть/поправить данные напрямую
`pnpm db:studio` (Prisma Studio, GUI).

### Подключить Google-вход (задел готов)
Добавить Google-провайдер в `src/auth.ts`, `AUTH_GOOGLE_ID/SECRET` в .env, при желании —
`@auth/prisma-adapter` для хранения аккаунтов. Стратегия остаётся JWT.

---

## 15. Развёртывание на Vercel (прод)

Локальный Postgres на ПК НЕ виден Vercel. Для прода:
1. **База:** создать бесплатный облачный Postgres (Neon / Vercel Postgres), взять его строку,
   положить в переменную окружения Vercel `DATABASE_URL`. Один раз применить схему:
   `pnpm db:push` с этим URL (или через миграции). При необходимости — `pnpm db:seed`.
2. **Фото:** в проекте Vercel → Storage → создать **Blob** store. `BLOB_READ_WRITE_TOKEN`
   Vercel добавит в env автоматически. Код сам переключится с `public/uploads` на Blob.
3. **Секрет:** задать свой `AUTH_SECRET` в env Vercel (не dev-значение).
4. **Первый админ на проде:** выполнить `create-admin` против прод-БД (локально с прод
   `DATABASE_URL`) или создать через Studio.
5. Деплой — как обычно для sochifornia (push в `main` → Vercel собирает; детали — в `Start.md`
   / `UPLOAD.md` в корне проекта).

Проверка сборки локально: `pnpm --dir <абс> build`.

---

## 16. Что НЕ сделано (отложено осознанно)

По согласованию с владельцем на «потом»:
- **Zod-валидация** входных данных API (сейчас — простые клампы длины/числа).
- **Rate-limit** на вход и на запись.
- **CSRF-защита и security-заголовки** (сверх дефолтных Auth.js).
- **Оптимизация фото** (WebP, ресайз под устройства) при загрузке.
- **2FA** (второй фактор).
- **Откат к предыдущей версии** контента (поле `AuditLog.meta` — задел).
- **Google-вход** (код-задел есть, провайдер не включён).
- **Мультиязычность** (только русский).
- **Автобэкапы** БД.
- **Возврат кеша** публичной странице тура для анонимных (см. раздел 13, п.1).
- **`middleware` → `proxy`** (устранить предупреждение Next 16).

---

## 17. Траблшутинг (частые ошибки → причина/решение)

| Симптом | Причина / решение |
|---|---|
| `ERR_PNPM_IGNORED_BUILDS: sharp/prisma...` | `pnpm --dir <абс> approve-builds --all` (см. 3.2) |
| `pnpm exec: Command "prisma" not found` / нет `node_modules/.bin` | команда ушла не в ту папку → используй абсолютный `--dir`; проверь, нет ли фантомного проекта в `TOUR3d1` |
| `The datasource property 'url' is no longer supported` | Prisma 7: убрать `url` из `schema.prisma`, оставить в `prisma.config.ts` |
| `P1000 Authentication failed` | неверный `DATABASE_URL` (пароль/имя БД) в `.env` |
| `Can't reach database server` | Postgres не запущен (dev) или неверный host |
| Белая страница/500 на `/alexxx-admin` | смотреть терминал; часто — БД недоступна или `AUTH_SECRET` не задан |
| Вход не проходит с верным паролем | пароль пользователя в БД не совпадает → пересоздать `create-admin` |
| `/admin/tours` пускает без входа | проверить `src/middleware.ts` (matcher) и что он не переименован некорректно |
| Кнопки «Редактировать» нет на странице тура | не залогинен, или EDITOR смотрит чужой тур (`canEditTour`) |
| Фото не грузится на проде | не создан Blob store / нет `BLOB_READ_WRITE_TOKEN` (см. 15) |
| Фото пропали после редеплоя (dev-режим) | это `public/uploads` — эфемерно на Vercel; нужен Blob |
| `useSearchParams() should be wrapped in a suspense boundary` | обернуть клиентскую часть в `<Suspense>` (см. 13, п.4) |
| Предупреждение `middleware ... deprecated` при сборке | переименовать `middleware.ts` → `proxy.ts` (13, п.2) |
| Журнал быстро разрастается | автосейв логирует каждое сохранение — добавить коалесинг (см. 11) |

---

_Конец документа. Держи ADMIN-UP.md в актуальном состоянии при доработках: обновляй разделы
12 (карта файлов), 13 (грабли) и 16 (что отложено)._
