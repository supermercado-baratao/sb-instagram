<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project Conventions

### Scope

An open-source, non-profit tool for supermarkets to create Instagram offer posts. The UI side uses **shadcn/ui** as the component library, with its theme and Tailwind's default palette kept as they come (see Styling & UI).

- **Self-hosted, one instance per store.** The app ships as a Docker image that each store runs itself. There is no hosted service and no multi-tenancy: never design for several stores sharing one instance, and never send store data anywhere outside the instance.
- **Storage:** SQLite, in a file inside the instance's data volume. Photos uploaded by the store live in the same volume, never in git.
- **No login in v1.** The instance runs on the store's network; whoever reaches the URL can use it.
- **Store branding is data, not code.** Logo, colors, slogan and Instagram handle are configured per instance in the app, so nothing store-specific (including Supermercado Baratão, where the project started) is hardcoded.
- **Products are keyed by code:** the barcode (EAN) when the product has one, otherwise the store's internal code (the one used by its POS or scale). Barcodes are read from a USB scanner or typed; camera scanning is out of v1.
- **Community catalog.** The only content versioned in git and open to contributions is the product catalog, in two folders: products with an EAN (an image plus a data file with name, brand and unit, both named after the EAN) and products without an EAN (images only, named after the product description, e.g. `picanha-bovina.png`). Internal codes differ from store to store, so a product without an EAN never enters the catalog by its code: the store assigns a catalog image to its own internal code. See Catalog below.
- **Out of v1:** publishing to Instagram, scheduling, AI-generated captions and a visual template editor. Don't add them without an issue.

### Language

- **Portuguese:** `README.md`, `CONTRIBUTING.md`, the store-facing guides in `guias/` (installation, update, backup), GitHub issues (titles and bodies), the issue template and all user-facing text in the app.
- **English:** code (identifiers and comments), commit messages, branch names, pull requests (title and body), `AGENTS.md`, `docs/` and the AI workflow under `.claude/`.

### Docker & data directory

- The app is built with `output: 'standalone'` (`next.config.ts`) and shipped by the multi-stage `Dockerfile` (`node:24-slim`, pnpm from `packageManager` via corepack). The runtime stage has no pnpm, runs `node server.js` as the unprivileged `node` user and only holds the standalone output, `.next/static`, `public`, the migrations folder and `catalog/` (both read from disk at runtime, so output file tracing doesn't copy them), plus the Chromium headless shell used to render the poster PNG (see Poster PNG).
- `compose.yaml` runs one instance of the published image (`ghcr.io/supermercado-baratao/sb-instagram:latest`) with the named volume `data` mounted at `/data`, with `docker compose up -d`. `compose.dev.yaml` is the same service built from the source (`docker compose -f compose.dev.yaml up -d --build`); both share the `data` volume. Keep the two in sync apart from `image`/`build`. The store guides in `guias/` (`instalacao.md`, `atualizacao.md`, `backup.md`) quote `compose.yaml` (service `app`, volume `data`, port, image tags) and the data directory layout, so update them when either changes. The backup runs `tar` through `docker compose run` on the `app` service, so it doesn't depend on the volume name the project prefix gives.
- `.github/workflows/release.yml` publishes the image to GHCR when a `vX.Y.Z` tag is pushed, tagged `X.Y.Z`, `X.Y` and `latest`. Each architecture (`linux/amd64`, `linux/arm64`) builds on its own native runner (no QEMU) and must pass a smoke test (start the container and fetch a PNG from `/preview/poster.png`) before it is pushed by digest; a final job merges the digests into one multi-arch manifest and then creates the GitHub Release (which is why only that job has `contents: write`), with Portuguese notes for the stores (the `docker pull` command and links to `guias/` at the tag) followed by the notes GitHub generates from the merged pull requests. That step skips a release that already exists, so rerunning a failed job or a release made by hand doesn't fail it. On pull requests that touch the `Dockerfile`, `.dockerignore`, `pnpm-lock.yaml` or the workflow, it runs the build and smoke test only.
- The tag must match `version` in `package.json`, or the workflow fails. To release, bump it in a pull request (`pnpm version --no-git-tag-version X.Y.Z`), merge, then tag `main` with `vX.Y.Z` and push the tag. Versions follow semver.
- Everything the instance persists (SQLite database, product photos in `photos/`) lives under the data directory, read from `dataDirectory` in `src/infra/data-directory.ts`: `DATA_DIR` when set (`/data` in the image), otherwise `data/` at the project root (git-ignored). Never write instance data anywhere else, or it is lost when the container is replaced.
- Keep the base image on Debian (`-slim`), not Alpine: native modules (SQLite driver, `sharp`) ship glibc prebuilds.

### Database

- SQLite through **Drizzle ORM** 1.0 (`drizzle-orm` and `drizzle-kit` on the `1.0.0-rc` line, matching the current Drizzle docs) and the `better-sqlite3` driver. The database file is `database.sqlite` in the data directory, opened in WAL mode with foreign keys on.
- Everything lives in `src/infra/database`: `client.ts` exports the `database` Drizzle client (one connection reused across `next dev` hot reloads), `file.ts` holds the database path (shared with `drizzle.config.ts`, so `pnpm db:studio` opens the same file), `schema.ts` holds every table, `relations.ts` the relations (`defineRelations`) and the `Database` type that infra functions take, and `migrations/` the SQL migrations generated by `drizzle-kit` (`drizzle.config.ts`).
- Server code only: import `database` from Server Components, Server Actions or Route Handlers, never from a Client Component.
- Pending migrations are applied on startup by `register()` in `src/instrumentation.ts`, both with `pnpm dev`/`pnpm start` and in the container. There is no separate migrate command.
- To change the schema, edit `schema.ts` and run `pnpm db:generate --name <change>` (a short kebab-case name, e.g. `create-products`), then commit the schema and the new migration folder (`migration.sql` and `snapshot.json`) together. Never edit or delete a migration that was already merged: instances in the field already applied it, so write a new one instead. When a change must carry existing data, edit the generated `migration.sql` before it is merged, and test it against data in the old format (`src/infra/database/migrations.test.ts`). The migrator runs every migration inside one transaction, where `PRAGMA foreign_keys` is a no-op, so a rebuilt table that others reference is created under a temporary name, with the new tables pointing to that name, and renamed after the old tables are dropped (`RENAME TO` updates the references). `pnpm db:studio` opens Drizzle Studio on the local database.
- A `text` primary key is declared at table level (`primaryKey({ columns: [...] })` on a `.notNull()` column), not with a column-level `.primaryKey()`: drizzle-kit then omits `NOT NULL`, and SQLite lets a non-integer primary key hold `NULL`.
- Each feature's issue adds its own tables and columns.
- Relational queries use the 1.0 API: relations are declared with `defineRelations` and passed to `drizzle()` as `relations`, not `schema`. When following Drizzle examples, check they are for 1.0 and not 0.x.
- `better-sqlite3` ships N-API prebuilds inside the package, so its install script stays blocked (`allowBuilds` in `pnpm-workspace.yaml`): allowing it would compile from source, which fails in the slim image (no Python or compiler).

### Poster PNG

- The PNG is a screenshot of the `Poster` component taken by headless Chromium through `playwright-core` (`renderPosterPng` in `src/infra/poster-renderer.ts`), so it matches the on-screen preview pixel for pixel. Don't switch to `ImageResponse` (Satori): it supports neither CSS grid, CSS variables nor relative colors, nor the SVG `textLength` the price tag relies on, so the poster would need a second, diverging implementation.
- The renderer opens a page of the same server (`localhost:$PORT`), so it captures a route that renders only the poster at its real size (`POSTER_SIZE`), with no zoom or controls. One browser is launched lazily and shared by every request; each request gets its own page.
- The poster fonts come from `next/font`, which serves them from the instance, so rendering needs no internet access. The renderer waits for `document.fonts.ready` before the screenshot.
- `playwright-core` stays on the same version as `@playwright/test`, so `pnpm dev`, the e2e tests and the image all use the same Chromium revision. Locally the browser comes from `pnpm exec playwright install chromium`; the `Dockerfile` installs `chromium-headless-shell` with its system dependencies into `PLAYWRIGHT_BROWSERS_PATH` (`/ms-playwright`), which is what makes the image about 1.3 GB.
- Output file tracing misses `playwright-core/browsers.json`, read at runtime, so `next.config.ts` adds it through `outputFileTracingIncludes`.

### Products

- A row of `products` (`src/infra/database/schema.ts`) has `id` (a random UUID from `crypto.randomUUID`, checked by `isValidProductId`), `name`, and the optional `brand`, `unit` and `photo` (a file name inside `photos/` in the data directory). A product has no main code (#55): its codes are rows of `product_codes` (`productId`, `code`, cascading on delete), at least one, and the `Product` type carries them sorted in `codes`. A code's type (`ean` or `internal`) is derived by `getCodeType` in `src/domain/product.ts` from `isValidEan` when needed, never chosen by the user or stored. Codes go through `normalizeCode` (strips whitespace) before any lookup or write, and a list of them through `normalizeCodes` (also drops blanks and repeats and sorts).
- One code may be in several products, so a single variation (one fragrance) and the groups that contain it (all fragrances under one photo) can each be placed in offers without changing the others. What may not repeat is the set of codes: `findProductWithCodes` (`isSameCodeSet`) finds the product with exactly the given codes, and `saveProduct` refuses a duplicate set (`DuplicateCodesError`), checking again inside its transaction.
- `findProductsByCode` (`src/infra/product.ts`) returns every instance product with the code, the one with fewest codes first (a single product before its groups), then by name; only when none has it and the code is an EAN does it fall back to the community catalog (`readCatalogProduct` in `src/infra/catalog/product.ts`, which ignores a file that breaks the schema). The result says where it came from (`source`: `instance` or `catalog`, a `CatalogMatch` the store hasn't saved). When there is more than one product, `/produtos` and the offer slots ask which one through `ProductChoiceDialog` (`blocks/product/product-choice-dialog.tsx`).
- `saveProduct` creates a product (no `id`, a new UUID) or updates one by `id` (`MissingProductError` when it is gone) and replaces its codes. The photo comes from a `PhotoSource` (an upload, a `catalog/no-ean/` image or the catalog image of an EAN, copied so a later catalog update never changes a product the store already uses), or the current one stays. Failing to write it throws `PhotoSourceError`.
- The photo file name is derived by `getPhotoFileName`: `<code>.png` for a product with one code, `<id>.png` for a group, so the photos folder stays readable and a group never takes a name a single product needs. `saveProduct` renames the file when the codes change it, and removes the old file when a new photo lands under another name. Products saved before #55 kept the photo under their old main code, so `renameOutdatedPhotos` moves a group's photo to its id on startup (`runMigrations`, called by `register()`).
- These functions take the Drizzle database as their first argument, and the catalog and photos folders as options, so the unit tests run against an in-memory SQLite with the migrations applied (`migrationsFolder` in `src/infra/database/file.ts`) and temporary folders.
- A code may name the product photo file, so it must pass `isValidCode` (letters, digits, `.`, `-` and `_`) before it reaches the disk, and photo helpers (`src/infra/photo.ts`) refuse a file name with a path separator. Server code checks codes on every lookup and save, and ids with `isValidProductId`.
- The form edits the codes in `CodesField` (`blocks/product/codes-field.tsx`), sent as repeated `code` fields, whose input adds on Enter (a scanner's) instead of submitting and checks the format on the client; the inline form keeps at least one code. The catalog export reads only products with one code, until the catalog format has groups (#51).
- The page is `/produtos` (`src/app/(pages)/produtos`): the code field submits on Enter, which is what a USB scanner sends after the code, so a scan looks the product up with no extra click. The product form, the catalog image picker and their Server Actions (`lookupProduct`, `saveProductForm`) live in `src/app/components/blocks/product/`, shared with the offer editor; `saveProductForm` takes the current product and photo from the server (by the hidden `id`), never from the form. The "Cadastrar produto" button opens `CreateProductDialog` (same folder), which shows the whole form at once with an editable code field. Its `CodesField` lists the other codes. Leaving that field, or the Enter a scanner sends (which moves to the name instead of submitting), looks the code up: a catalog product refills the form, while a new code or one the instance already has keeps what was typed. The dialog always registers a new product, unless its codes are exactly those of an instance product: the form sends `replace=ask`, so `saveProductForm` then returns `unchanged` when the data match (the page says nothing changed) or `confirm` with the changes (`getProductChanges` in `src/domain/product.ts`, plus whether a new photo comes in), which `ReplaceProductDialog` lists in an `AlertDialog` before resending with `replace=confirmed`. Without `replace`, a duplicate set is an error. Editing from the page's own form saves without asking. The form's ids come from `useId`, since the dialog can open over the inline form. Deleting stays in the page's own `actions.ts`.
- Below the code field, `/produtos` lists the instance products (`listProducts` in `src/infra/product.ts`), searched by name or code and paged on the server (`PRODUCTS_PAGE_SIZE`, 50), with the state in the URL (`?q=`, `?pagina=`). The search is a `next/form` GET, apart from the code field, which keeps the focus for the scanner. Clicking a product opens it in the same form as the code field, from the list's own data, and `saveProductForm` revalidates `/produtos` so the list shows the change. The name search and the order ignore case, accents and cedilla: both sides go through `normalizeSearchText` (`src/domain/product.ts`), registered on each connection as the SQLite function `search_text` (`registerSearchText` in `src/infra/database/search-text.ts`), since SQLite's `LIKE` and `NOCASE` fold case only for ASCII. It runs at query time, so there is no normalized column to keep in sync; an in-memory database in a test that lists products registers it too.
- Each row of the list has a delete button, confirmed in an `AlertDialog` (`delete-product-button.tsx`). `deleteProduct` (`src/infra/product.ts`) refuses a product used in any offer and returns the names of those offers (`findOffersUsingProduct`), without touching them: whoever deletes takes the product out of the offers first. Otherwise it deletes the row (and its codes) and its photo file; the catalog image stays.
- Photos live in `src/infra/photo.ts`. `savePhoto` rotates by EXIF, shrinks to fit `PHOTO_MAX_SIDE` (the catalog limit) without enlarging and writes the given file name. It doesn't trim or require a transparent background, since a photo taken in the store has one. `copyNoEanImage` copies a `catalog/no-ean/` image, offered only for a product without an EAN code, and `copyEanImage` a `catalog/ean/` one.
- `/fotos/<id>` serves the product's photo (`getPhotoUrl` in `src/app/helpers/product-photo.ts`); `/catalogo/ean/<ean>` serves a catalog image while the form shows a product the store hasn't saved, and `/catalogo/sem-ean/<name>` the `catalog/no-ean/` images for the picker. They send `Cache-Control: no-cache`, because a new upload keeps the same URL.
- Uploads go through a Server Action, so `serverActions.bodySizeLimit` in `next.config.ts` (11 MB) stays above `PHOTO_MAX_MEGABYTES` (10 MB). Raise both together.

### Offers

- An offer (`offers`) holds the texts shared by all its pages: name, validity (`validUntil`, an ISO date formatted only for the poster) and the highlight title and message. Each page (`offer_pages`, ordered by `position`) has its template id and layout, and each filled slot is a row of `offer_page_items` (`position` 0 to 8, `productId` and `priceInCents`). An empty slot has no row, and the item points to the product by id, so fixing a product also fixes every offer that uses it.
- Slogan and Instagram handle belong to the brand, not the offer, and a page keeps only the template id (see Brand).
- `src/domain/offer.ts` holds the editing model (`OfferContent`, pages with `PAGE_PRODUCT_COUNT` positional slots) and its pure rules. `src/infra/offer.ts` lists, finds, creates, saves, duplicates and deletes offers; it is synchronous, like the `better-sqlite3` driver (`.sync()` on relational queries, synchronous transactions). `saveOffer` rewrites all the pages in one transaction, so reordering never trips over the unique position per offer.
- The list is `/ofertas` (`src/app/(pages)/ofertas`), with create (which opens the editor), duplicate and delete (confirmed in an `AlertDialog`) as Server Actions.
- The editor is `/ofertas/<id>` (`src/app/(pages)/ofertas/[id]`). It keeps the whole `OfferContent` in client state and saves it with an explicit "Salvar" (`saveOfferAction`), which checks it again with `isOfferContent`, since a Server Action is a public endpoint. The page and slot rules (`addPage`, `movePage`, `removePage`, `setSlot`, `parsePrice`, `findPageWithoutPrice`) live in `src/domain/offer.ts`. Pages get client-only keys that follow them when they move, so a reordered page never inherits another page's field state. Removing a page is confirmed in an `AlertDialog` (`remove-page-button.tsx`), like deleting an offer.
- Unsaved changes are guarded by `useUnsavedChangesWarning(dirty)` (`src/app/hooks/use-unsaved-changes-warning.ts`), used by the offer editor and the brand settings form: it warns on closing or reloading the tab (`beforeunload`) and, under the `NavigationGuardProvider` (`src/app/components/providers/navigation-guard.tsx`) that `AppLayout` renders, makes every `GuardedLink` (`src/app/components/ui/custom/guarded-link.tsx`) ask in an `AlertDialog` before leaving. Links that can leave a page with unsaved changes (the header and the editor's back link) use `GuardedLink` instead of `Link`, since a client-side navigation never fires `beforeunload`. The browser's back button isn't guarded.
- A slot's code field submits on Enter, like `/produtos`. `lookupSlotProduct` saves a catalog product into the instance before placing it, because an item references `products` by id (foreign key), and answers `choose` when the code is in more than one product. An unknown code offers "Cadastrar produto", which opens `CreateProductDialog` with that code (each empty slot also has the button, with the code left blank); saving places the product in the slot and moves the focus to its price. Typing in the code field also suggests instance products (never the catalog, which is looked up by code only): `searchProducts` (`src/infra/product.ts`) needs every word of the query in the name, brand, unit or code, through the same `search_text` as the `/produtos` list, and returns at most `PRODUCT_SUGGESTION_LIMIT` (8). The field is a Base UI `Autocomplete` (`src/app/components/ui/custom/autocomplete.tsx`, styled after shadcn's Combobox, since shadcn has none) without `autoHighlight`, and the fetch waits `SUGGESTION_DELAY_MS`: a scanner's Enter, with no suggestion highlighted, submits the exact code. Picking a suggestion places the product like a scan. The editor page passes the `catalog/no-ean/` images down for the dialog's picker.
- `src/app/helpers/offer-poster.ts` maps an offer to the `Poster` props (`getPosterOffer`, `getPosterProducts`), shared by the side preview and `/ofertas/<id>/render/<page>` (1-based), the poster-only page the renderer captures.
- `/ofertas/<id>/paginas.zip` renders the saved pages one at a time and sends them as `pagina-<n>.png` in a ZIP stored without compression (`fflate`), since browsers block several downloads at once. It exports what is saved, so the editor disables the download while there are unsaved changes.

### Brand

- The brand is one row of `brand` (`id` is always 1, enforced by a check constraint): `name`, `slogan`, `instagram` (normalized to `@handle` by `normalizeInstagram`, empty when the store has none), `logo` (a file name in the data directory, or `null`) and `updatedAt` (milliseconds, it versions the logo URL). Templates are rows of `templates` (`id`, `name`, `primaryColor`, `accentColor`, `position`).
- `src/domain/brand.ts` holds the settings model (`BrandContent`, `TemplateDraft`) and its pure rules (`getBrandContentError`, `assignTemplateIds`, `INITIAL_TEMPLATES`). `src/infra/brand.ts` finds and saves them (`findBrandSettings`, `saveBrandSettings`, which rewrites the templates in one transaction) and `src/infra/logo.ts` writes `logo.png` in the data directory (shrunk to `LOGO_MAX_SIDE`, keeping its proportions and transparency).
- A template id is a slug of its name, assigned on the server only when the template is created (`assignTemplateIds`), so renaming keeps the id and the offer pages that use it. `offer_pages.templateId` has no foreign key: a page whose template was removed falls back to the first one (`getPageTemplate`). The settings form keeps at least one template.
- `findBrandSettings` returns `undefined` until the first save. Pages that need the brand call `requireBrandSettings` (`src/app/helpers/brand-settings.ts`), which redirects to the settings page `/configuracoes` (`src/app/(pages)/configuracoes`); the first save there starts with `INITIAL_TEMPLATES` and goes on to `/ofertas`. The poster-only render page answers 404 instead, since only the renderer opens it.
- `getPosterBrand` (`src/app/helpers/brand-poster.ts`) maps the saved brand to the `Poster` props, with the logo at `/marca/logo?v=<updatedAt>` (served with `Cache-Control: no-cache`). `/preview` keeps its own sample brand in its fixtures.
- The logo goes through the same Server Action body limit as product photos, so it shares `PHOTO_MAX_MEGABYTES`.

### Catalog

- Lives in `catalog/` at the project root: `catalog/ean/` holds `<ean>.png` + `<ean>.json` pairs and `catalog/no-ean/` holds `<description>.png` images (lowercase kebab-case, no accents, at least one letter). Each folder keeps a `.gitkeep`, which the validation ignores. The contributor-facing rules are in `CONTRIBUTING.md` (Portuguese); keep it in sync with the code.
- An EAN is 8, 12 (UPC-A) or 13 digits with a valid check digit (`isValidEan` in `src/domain/ean.ts`, also the way to tell an EAN from an internal code).
- The JSON has exactly `name`, `brand` and `unit`, all non-empty strings, validated by hand in `src/domain/catalog.ts` (no schema library for three fields). Images are lossless PNG, square, 600 to 800 px per side, at most 1 MB, with the four corners fully transparent (the poster card has a colored background). The poster shows a photo at about 340 px at most (the 4-product layout), so 800 px is a 2x margin; revisit the limit if a layout shows the photo larger. The limits are `CATALOG_IMAGE_RULES` in the same file.
- `src/domain/catalog.ts` holds the pure rules (file names, image/JSON pairs, JSON schema, image limits); `src/infra/catalog/` reads the disk and the image metadata with `sharp` (`image.ts`) and returns the list of errors (`check.ts`). `pnpm catalog:check` runs `src/infra/catalog/check-cli.ts` through `tsx` and exits non-zero when there is an error.
- Contributors may add large PNGs: `pnpm catalog:optimize` (`src/infra/catalog/optimize-cli.ts`, also run by `lint-staged` on staged `catalog/**/*.png`) rewrites every image that breaks a rule. `optimizeCatalogImage` (`src/infra/catalog/optimize.ts`) trims the transparent border, shrinks without ever enlarging, centers the product in a square with a 5% transparent margin (`getCatalogImageLayout` in `src/domain/catalog.ts`) and encodes a lossless PNG (no palette quantization, which bands gradients and blurs label text). Images that already pass are left untouched, so the hook doesn't re-encode them on every commit.
- The framing margin makes the corners transparent, so the transparent background rule is checked on the original before optimizing (`hasTransparentBackground`), and a photo with a background is rejected without being rewritten. After optimization the corner check can no longer tell a cut-out from a photo with a background; that's a known limit of the CI check.
- "Exportar para o catálogo", in the product list section of `/produtos` (`catalog-export-button.tsx`, which gives the focus back to the code field for the scanner), fetches `/produtos/catalogo.zip`, which `buildCatalogExport` (`src/infra/catalog/export.ts`) fills with `ean/` and `no-ean/` in the catalog format plus `relatorio.txt`, the products left out and why. The pure rules are in `src/domain/catalog-export.ts` (`checkCatalogExport`): a product with more than one code is left out (#51); an EAN product needs brand, unit and photo and must not be in the catalog yet; an internal code product needs a photo and goes under its name in kebab-case (`toCatalogDescriptionName`), the first one in name order keeping a repeated name. Photos go through `prepareCatalogImage` (`src/infra/catalog/optimize.ts`, shared with `pnpm catalog:optimize`), so the ZIP already passes `pnpm catalog:check`. A no-EAN photo identical to a `catalog/no-ean/` image (picked in the store, not taken there) is left out by its hash.
- `sharp` is a direct dependency pinned to the same version Next.js resolves, so the project keeps a single copy. Its install script stays blocked (`allowBuilds`): it ships prebuilt binaries in `@img/sharp-*`.

### Package manager

- Use **pnpm** only (not npm/yarn).
- Versions are pinned exact (no `^`/`~`) only for `dependencies` and `devDependencies` in `package.json`, no exceptions there. Install new deps with `pnpm add -E <pkg>` (or `pnpm add -D -E <pkg>` for dev deps) — never hand-edit version strings.
- `-E` only takes effect when no version is given. `pnpm add -E <pkg>@<version>` (or `@latest`) and packages already in `package.json` still get a `^`. In those cases, remove the carets right after (`sed -i -E 's/"\^([0-9])/"\1/' package.json`) and run `pnpm install`.
- The exact-version rule does not apply to MCP servers (`.mcp.json`) or `package.json` scripts, which may use `@latest` (e.g. `pnpm dlx shadcn@latest`, `pnpm dlx @playwright/mcp@latest`). They must still run through pnpm, never `npx`.
- Node version is pinned in `.nvmrc` (`lts/krypton`) for local use and in `engines.node` (`24.x`) in `package.json` for tools that ignore `.nvmrc`. Keep both on the same major.
- `@/*` resolves to `src/*` (`tsconfig.json`).

### Project structure

- `src/app` holds frontend-exclusive content only — there's no top-level `src/components` or `src/helpers`, that shared code lives under `src/app` instead.
- Anything that isn't frontend-exclusive (e.g. `src/tests`, `src/infra` for server-side infrastructure such as the data directory and the database, `src/domain` for framework-free domain types and rules shared by the UI and the server, and any future non-frontend folder) lives directly under `src`, as a sibling of `app`, not nested inside it.
- Routes are grouped under `src/app/(pages)` (a route group, so it doesn't affect the URL).
- Shared frontend code lives in `src/app/components`, React hooks in `src/app/hooks` and other helpers in `src/app/helpers` (create them when the first one is needed). The `lib` alias in `components.json` points to `src/app/lib`, which doesn't exist: if the shadcn CLI ever creates something there, keep it in `lib` or move it to `helpers` case by case.
- There are no `index.ts` barrels: import each module directly from its file through the `@/` alias (e.g. `@/app/components/ui/shadcn/button`). Barrels cause circular imports, give two import paths for the same module and make Vite/Vitest load every re-exported module.
- `src/app/components` groups components by role: `ui/` for visual building blocks (shadcn ones under `ui/shadcn/`, our own under `ui/custom/`), `blocks/` for composed pieces reused across pages, grouped by domain (e.g. `blocks/post/`; a block that belongs to no domain stays directly in `blocks/`), `providers/` for context providers without UI of their own and `layouts/` for page shells.
- A layout lives in its own folder (`layouts/<name>/index.tsx`), with the parts only it uses in a private `_components/` folder next to it. Code outside the layout imports only `layouts/<name>`, never its `_components/`. The same goes for a route: parts used by a single page live in a `_components/` folder next to it.
- `favicon.ico` stays directly in `src/app/`, not nested in a route group.
- Pages with the header (logo or store name and the Ofertas, Produtos and Marca menu) wrap their content in `AppLayout` (`src/app/components/layouts/app`), passing the brand they already got from `requireBrandSettings`. It is a component, not a route `layout.tsx`, because the poster-only render page lives under `/ofertas` and must stay bare; the first setup and `/preview` also go without it. `/` only redirects to `/ofertas`, and page titles fill the `%s · SB Instagram` template of the root layout.
- `public/` keeps a `.gitkeep` while it has no files, because the `Dockerfile` copies it.
- React Compiler is enabled (`reactCompiler: true` in `next.config.ts`, `babel-plugin-react-compiler` devDependency).

### Linting & formatting

- ESLint uses native flat config (`eslint.config.mjs`), extending the `core-web-vitals`/`typescript` configs from `eslint-config-next`, plus `eslint-plugin-unicorn`, `eslint-plugin-simple-import-sort`, `eslint-plugin-tailwindcss`, `eslint-plugin-promise`, `eslint-plugin-prefer-arrow-functions`, `eslint-config-prettier`, and `@eslint/json`/`@eslint/markdown` for JSON/Markdown files. Markdown files use the `gfm` language with `frontmatter: 'yaml'`, so the frontmatter of issue templates (or any Markdown content) isn't parsed as Markdown. `eslint-plugin-tailwindcss` rule docs are in `node_modules/eslint-plugin-tailwindcss/docs/rules/` — check there before overriding a Tailwind lint rule.
- `eslint-plugin-unicorn@74` declares a peer of `eslint >=10.4`, but the project stays on ESLint 9 (`9.39.5`). The peer is unmet (`pnpm peers check` reports it, and depending on the pnpm version install warns `Issues with peer dependencies found`), but `pnpm eslint:check` passes. Don't bump one without validating the other.
- `next lint` no longer exists (removed in Next.js 16). Use `pnpm eslint:check` / `pnpm eslint:fix` and `pnpm prettier:check` / `pnpm prettier:fix`.
- `pnpm type-check` runs `next typegen` first: globals such as `LayoutProps` are generated into `.next/types`, so a clean checkout (CI, fresh clone) fails `tsc --noEmit` without it.
- Prettier style: single quotes, no semicolons, no trailing commas (`.prettierrc`).
- Base indentation/whitespace rules (2 spaces, LF, trim trailing whitespace, final newline) are enforced editor-side via `.editorconfig`.

### Code comments

- Comments only record **why** a decision was made, ideally with a reference (docs link, issue number, upstream bug). Never write comments that explain what the code does or how it works.
- Default to no comment. Add one only for a non-obvious choice that someone might "fix" by mistake.
- Write comments in English.

### Git hooks (husky)

- `pre-commit`: runs `lint-staged` (`lint-staged.config.js`) — prettier + eslint + `vitest related --passWithNoTests` scoped per staged file type, plus the catalog optimizer on staged `catalog/**/*.png`, invoked directly via `pnpm exec` rather than through `package.json` scripts.
- `commit-msg`: auto-prepends the emoji prefix from the Commit Rules below based on the leading word (e.g. `feat: ...` → `✨ feat: ...`), then runs `commitlint` (`commitlint-config-emoji-convention`). You can type the plain word and let the hook add the emoji.
- `pre-push`: runs `pnpm type-check` and `pnpm test:e2e` (full Playwright suite).

### Testing

- Unit tests: **Vitest** (`vitest.config.mts`), `jsdom` environment, native Vite `resolve.tsconfigPaths` (no `vite-tsconfig-paths` plugin needed). Only picks up `src/**/*.test.{ts,tsx}`. Component tests use `@testing-library/react` / `@testing-library/dom`. `vitest.setup.ts` (`setupFiles`) runs Testing Library's `cleanup` after every test, so test files don't repeat `afterEach(cleanup)`.
- E2E tests: **Playwright** (`playwright.config.ts`), tests live in `src/tests/e2e`, Chromium only, `webServer` auto-starts its own `pnpm dev` on `http://localhost:3100`, with `NEXT_DIST_DIR=.next/e2e` and `DATA_DIR=.next/e2e/data`, so the tests never touch the developer's `data/` and run next to a `pnpm dev` on port 3000. `next dev` locks its `distDir`, which is why `next.config.ts` reads `distDir` from `NEXT_DIST_DIR`. The e2e data is wiped each time that server starts, but a reused server keeps it, so a test that saves data uses codes unique to the run. `tsconfig.json` lists the `.next/e2e` type folders so `next dev` doesn't rewrite it. A `setup` project (`*.setup.ts`) configures the brand before the `chromium` project, which depends on it, because every page that uses the brand redirects a new instance to the first setup. Failure artifacts go to `test-results/` (git- and ESLint-ignored). `next dev` compiles each route on its first visit, so the `expect` timeout is 15 s (`playwright.config.ts`) and a test that crosses many routes or renders a PNG on a cold server is marked `test.slow()`; give a slow step time this way instead of retrying it. There are no global retries: a known flaky test gets `test.describe.configure({ retries })` in its own `describe`, with a comment linking the issue that tracks it.
- Only test logic we wrote (filtering, lookups, mappings, transforms). Don't test library or framework behavior (e.g. a component that only passes props or HTML through, schema defaults, `Link` routing), and drop a test whose main cost is a mock needed only to render. Prefer a unit test; add an e2e test only for what a unit test can't cover.
- Scripts: `pnpm test` (unit, run once) / `pnpm test:watch` (unit, watch mode) / `pnpm test:e2e` (e2e) / `pnpm test:e2e:ui` (e2e, Playwright UI mode).
- CI (`.github/workflows/ci.yml`, triggered on `pull_request`) runs, in order: `commitlint` over the PR's commit range, `pnpm type-check`, `pnpm eslint:check`, `pnpm prettier:check`, `pnpm test`, `pnpm catalog:check`, then installs Chromium (`pnpm exec playwright install --with-deps chromium`) and runs `pnpm test:e2e`.

### Styling & UI

- Tailwind CSS v4 (`@tailwindcss/postcss` only — no `autoprefixer`/`postcss`, v4 uses Lightning CSS internally). Global styles live in `src/app/styles/globals.css`, which also imports `tw-animate-css` and the shadcn base stylesheet (`shadcn/tailwind.css`).
- Dark mode follows the system preference: the `dark:` variant is bound to `prefers-color-scheme` (`@custom-variant dark (@media (prefers-color-scheme: dark))`) and the dark tokens are redefined on `:root` inside the same media query, instead of shadcn's `.dark` class. A project that needs a manual theme toggle switches both to a class (e.g. with `next-themes`).
- Don't retint the default colors: keep the shadcn tokens in `globals.css` (`neutral` base color) and Tailwind's palette as they come, and pick an existing palette color instead of a custom shade (e.g. `teal-500`, not a tinted `oklch(...)`). Prefer the shadcn tokens (`bg-background`, `text-muted-foreground`, `border-border`, ...) for surfaces and text, so both themes stay consistent. Where CSS variables can't be read (a canvas, `ImageResponse`), copy the palette value and name it in a comment.
- **shadcn/ui** (`components.json`, style `base-nova`, base color `neutral`, icon library `lucide`) is the component library: reach for a shadcn component before writing one from scratch. `AlertDialog`, `Button`, `Card`, `Dialog`, `Field`, `Input`, `Label`, `Pagination`, `Select`, `Separator`, `Tabs`, `Toggle` and `ToggleGroup` are in place so far (`src/app/components/ui/shadcn/`). Base UI primitives shadcn doesn't ship get a wrapper in `ui/custom/` styled like the nearest shadcn component (e.g. `Autocomplete`, after `Combobox`). Add components with `pnpm shadcn:add <name>` (wraps `pnpm dlx shadcn@latest add`) — aliases and target paths are in `components.json`. Components from other shadcn registries are added the same way (`pnpm shadcn:add @<registry>/<name> --path src/app/components/ui/<registry>`), after declaring the registry in `components.json`; pin any dependency the CLI installs with `^`.
- Links that need to look like a `Button` (e.g. external CTAs) must stay plain `<a>`/`Link` elements styled with the exported `buttonVariants(...)` helper, not `Button` itself — Base UI's `Button` enforces button semantics (`role="button"`, keyboard handling) and its own docs say not to render links through it.
- Supporting libs: `@base-ui/react` (headless primitives), `class-variance-authority` for variant styling, `cn` for the `cn()` class-merging helper (imported directly from the `cn` package, as the shadcn components do; there is no `lib/utils.ts` re-export, see https://ui.shadcn.com/docs/changelog/2026-09-cn), `lucide-react` for icons. Before wiring up a Base UI primitive, check its docs in `node_modules/@base-ui/react/docs/react/` (`components/`, `utils/`, `handbook/`) for its semantics/keyboard behavior — component APIs there may differ from other headless UI kits.

## Development Workflow

The end-to-end flow (planning, issues, branches, commits, pull requests and closing) is described in [`docs/development-workflow.md`](./docs/development-workflow.md). Follow it for any issue.

## Branch Rules

Work for an issue is committed on a new branch, never directly on `main`. Branch names follow `<scope>/<title>#<issue>`, or `<scope>(<target>)/<title>#<issue>` when the work is very specific:

- `<scope>` is one of the semantic prefixes from the Commit Rules below, without the emoji (`feat`, `fix`, `docs`, `chore`, ...).
- `(<target>)` is optional: the page, component or other specific area the work touches (e.g. `home`, `card`).
- `<title>` is a short, lowercase, hyphen-separated summary in English.
- `#<issue>` is the number of the associated issue.

Examples: `feat/home-page#3`, `fix(card)/focus-ring#7`. Parentheses and `#` are special characters in shells, so quote the branch name in commands (e.g. `git switch -c 'fix(card)/focus-ring#7'`).

## Issue Rules

Before closing an issue, tick every completed checklist item (`- [x]`) in its body, e.g. with `gh issue edit <number> --body-file <file>`. Don't close an issue that still has unchecked items unless they were dropped or moved, and say so in the closing comment.

## Documentation Rules

`AGENTS.md` and `README.md` record only project conventions: what to do, where things live and how to handle a given case. Answers to the user's one-off questions (e.g. "why don't we use X?") stay in the conversation and are not written into them. Keep a "why" only when it prevents a likely mistaken "fix". If a change touches a convention, update both files in the same branch.

## Task Rules

Never start working on a task on your own, even when asked to move on to the next one or in auto/agentic mode. First present a summary of the plan (the issue, branch name, steps, files touched and any open decisions) and wait for explicit approval before creating the branch, installing dependencies or editing code. Read-only investigation (issues, docs, code) needs no approval.

## Commit Rules

Never run `git commit` on your own, even in auto/agentic mode. Only propose a commit message when the user asks for one, and create the commit only after explicit approval of that message.

Commit messages must be in English and follow this format:

- Use the following semantic prefixes: `🎉 init, ✨ feat, 🐛 fix, 📚 docs, 💎 style, 📦 refactor, 🚀 perf, 🚨 test, 🛠 build, ⚙️ ci, ♻️ chore, 🗑 revert`
- The message must be in the imperative mood and in lowercase.
- Write the commit body.
- Reference an associated issue by number, if it exists, using the format `Issue: #<number>`.

Example:

```text
✨ feat: add product page

Add the new product page for the product listing with the following features:
- Create a new product
- Update a product
- Delete a product

Issue: #1
```
