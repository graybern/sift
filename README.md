# Sift

A fast, focused personal task tracker. Tasks flow through a horizon pipeline — from raw capture to completion — so you can see everything across every space and focus area, then pull what matters most into active work.

## Features

- **Horizon pipeline** — Backlog → Later → Soon → Now → Done with drag-and-drop
- **5 views** — Dashboard, Kanban, Funnel, Calendar, Grid
- **Funnel view** — Multi-column layout grouped by focus area with capacity warnings
- **Spaces & focus areas** — Organize by workspace and sub-category
- **Tags** — Color-coded tags with inline creation
- **AI advisor** — Triage recommendations via Anthropic API (with rule-based fallback)
- **Import/export** — Full JSON export, per-space export, SQLite backup/restore
- **Weekly reviews** — Snapshot metrics for completed work and velocity
- **Quick capture** — Cmd+K to add items instantly
- **Dark/light/system theme**

## Quick Start

```bash
npm install
npm run dev        # Client on :5174, server on :3002
```

## Docker

```bash
docker compose up -d
# Runs on port 3002, SQLite data persisted in a volume
```

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, TailwindCSS, TanStack React Query
- **Backend:** Express, TypeScript, SQLite (better-sqlite3, WAL mode)
- **DnD:** @hello-pangea/dnd
- **AI:** Anthropic SDK (optional, add API key in Settings)

## License

MIT
