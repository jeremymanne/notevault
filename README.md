# NoteVault

A personal note-taking web app with rich-text editing, notebooks, tags, task checklists, and a global task view.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | SQLite via Prisma 7 + better-sqlite3 |
| Styling | Tailwind CSS 4 |
| Editor | TipTap (rich text + task lists) |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |

---

## Local Setup

### Prerequisites

- Node.js 18+ (install via [Homebrew](https://brew.sh): `brew install node`)
- Git

### Steps

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd notevault

# 2. Install dependencies
npm install

# 3. Copy the environment file
cp .env.example .env

# 4. Run the database migration (creates dev.db at project root)
npm run db:migrate

# 5. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Other commands

```bash
npm run db:studio   # Prisma Studio — browse/edit the database
npm run build       # Production build
npm start           # Start production server
npm run lint        # ESLint
```

---

## Render Deployment

The project includes a `render.yaml` for deployment to [Render](https://render.com).

### Steps

1. Push the repo to GitHub.
2. In Render, click **New → Blueprint** and connect your repo.
3. Render detects `render.yaml` and configures the web service automatically.
4. The build command runs migrations and generates the Prisma client before starting.

### Persistent Storage on Render

> **Note:** Render's free tier uses **ephemeral storage** — the SQLite file is lost on each deploy or restart.

**Option A — Render Disk (paid plan)**

Add a persistent disk to the service in the Render dashboard and update `DATABASE_URL` to point to the disk mount path (e.g. `file:/var/data/prod.db`).

**Option B — Hosted Postgres (recommended for production)**

1. Create a Postgres instance on Render, Neon, Supabase, or similar.
2. Set `DATABASE_URL` to the Postgres connection string in the Render environment.
3. In `prisma/schema.prisma`, change `provider = "sqlite"` → `provider = "postgresql"`.
4. Swap the adapter: remove `@prisma/adapter-better-sqlite3` + `better-sqlite3`, install `@prisma/adapter-pg` + `pg`.
5. Update `lib/prisma.ts` to use the Postgres adapter.

---

## Features

- **Three-panel layout** — Sidebar (240px) → Note List (320px) → Editor (flex)
- **Rich text editor** — Bold, italic, underline, H1/H2, bullet/numbered/task lists, code blocks, blockquotes, horizontal rules
- **Auto-save** — 1s debounce with "Saving…" / "Saved" indicator
- **Notebooks** — Create with color picker, rename, delete (notes become uncategorized); drag to reorder
- **Tags** — Inline tag input in the editor; click in sidebar to filter
- **Pinning** — Pinned notes float to the top of any list; immediate optimistic toggle
- **Search** — Full-text search across title + content (300ms debounce)
- **Global Task View** — All checklist items across every note, grouped by note; filter Incomplete / All; drag to reorder within a note group; drag to copy between note groups (with toast confirmation)
- **Dark / Light mode** — Toggle in the sidebar header; choice persisted to `localStorage`
- **Drag & drop** — Optimistic reorder for notes (pinned and unpinned as separate groups) and notebooks
