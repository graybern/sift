# Sift

A personal pipeline-style project/task tracker.

## What this is and why

Tasks and todos flow through a **horizon pipeline** — from raw capture through prioritization to completion. The key insight: see all items **across every space and focus area** in one unified pipeline, so you can plan focus time (weeknight, weekend morning, etc.) by looking at the full picture and pulling what matters most into active work.

This tool should feel fast, focused, and simple. Every design decision reduces cognitive load.

## Architecture

```
sift/
├── client/src/              # React 18 + TypeScript + Vite + TailwindCSS
│   ├── components/
│   │   ├── dashboard/       # Analytics (funnel, velocity, energy, weekly review, AI advisor)
│   │   ├── pipeline/        # Kanban pipeline (horizons, drag-and-drop)
│   │   ├── funnel/          # Funnel view
│   │   ├── calendar/        # Calendar view
│   │   ├── grid/            # Grid view
│   │   ├── items/           # Item cards, modals, quick capture, sub-tasks
│   │   ├── layout/          # Header, space tabs, main layout
│   │   ├── spaces/          # Space management
│   │   ├── settings/        # Settings modal, import preview
│   │   ├── ai/              # AI advisor components
│   │   └── ui/              # Shared components (Modal, Badge, ThemeToggle, FunnelIcon)
│   ├── hooks/               # useItems, useSpaces, useFocusAreas, useReviews, useTheme, useSettings, useQuickCapture
│   ├── lib/                 # API client, constants (horizons, priorities, efforts, energies)
│   └── types/               # TypeScript type definitions
├── server/src/              # Express.js + TypeScript
│   ├── db/                  # SQLite setup (database.ts) + migrations (migrations.ts)
│   ├── middleware/           # Auth (single-user stub)
│   └── routes/              # items, spaces, focusAreas, settings, stats, reviews, export, import, ai (501 stubs)
└── server/data/             # SQLite database files (tracker.db)
```

**Data flow:** Client (React Query) → Express REST API → SQLite (better-sqlite3, WAL mode)

**State management:** TanStack React Query for server state, no client-side store.

**Drag & drop:** @hello-pangea/dnd for pipeline horizon reordering.

**Views:** dashboard | kanban | funnel | calendar | grid (type `View` in types)

## Commands

```bash
npm install          # Install all workspaces (npm workspaces monorepo)
npm run dev          # Start both client (:5173) and server (:3002)
npm run build        # Production build (tsc + vite)
npm start            # Run production server
```

No test suite or linter configured yet.

## Database Schema

- **users** — single default user (stub auth), settings stored as JSON
- **spaces** — workspaces with name, color, icon, position ordering
- **focus_areas** — sub-categories within a space (name, icon, position, FK to spaces)
- **items** — tasks/notes/links/projects with title, description, url, url_meta, priority (0-4), effort (S/M/L/XL), energy (deep_focus/light/routine), horizon, position, due_date, completed_at, parent_id (sub-tasks), focus_area_id
- **tags** / **item_tags** — tagging system (schema exists, UI not yet built)
- **review_snapshots** — weekly review metrics (period, snapshot_type, metrics JSON)

Horizons (the pipeline columns) are: **backlog → later → soon → now → done**, defined in `client/src/lib/constants.ts`.

## API Routes

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/spaces` | List / create spaces |
| PUT/DELETE | `/api/spaces/:id` | Update / delete space |
| PATCH | `/api/spaces/reorder` | Reorder spaces |
| GET/POST | `/api/focus-areas` | List / create focus areas |
| PUT/DELETE | `/api/focus-areas/:id` | Update / delete focus area |
| PATCH | `/api/focus-areas/reorder` | Reorder focus areas |
| GET/POST | `/api/items` | List (with filters) / create items |
| GET/PUT/DELETE | `/api/items/:id` | Read / update / delete item |
| GET | `/api/items/:id/children` | Get sub-tasks |
| PATCH | `/api/items/:id/horizon` | Move item between horizons |
| PATCH | `/api/items/reorder` | Bulk reorder items |
| POST | `/api/items/url-meta` | Extract URL metadata |
| GET | `/api/stats` | Dashboard analytics |
| GET/PUT | `/api/settings` | User settings (theme, inFocusLimit, autoArchiveDays, anthropicApiKey, anthropicModel) |
| GET | `/api/export/json` | Export all data as JSON (also `/json/:spaceId` for single space) |
| GET | `/api/export/db` | Download raw SQLite database |
| POST | `/api/import/preview` | Preview import (dry run with conflict detection) |
| POST | `/api/import/execute` | Execute JSON import |
| POST | `/api/import/db` | Restore from database backup |
| GET | `/api/reviews` | List review snapshots |
| GET | `/api/reviews/current` | Get current period review |
| POST | `/api/reviews/generate` | Generate a new review snapshot |
| POST | `/api/ai/triage` | AI triage (stub, returns 501) |
| POST | `/api/ai/focus` | AI focus recommendations (stub, returns 501) |
| POST | `/api/ai/summarize` | AI summarization (stub, returns 501) |

## Conventions

- **No stubs in UI** — if a feature isn't built, hide the button/element entirely
- **Self-explanatory UI** — every icon, toggle, and element should be immediately obvious without labels
- **Theme: light/dark/system** — all three options supported
- **Item types need clear visual differentiation** in cards (task, note, link, project)
- **Desktop-first, mobile-responsive** layout
- Speed and clarity over feature density — if it slows you down or adds confusion, cut it

## Current Priorities

- Claude AI integration for triage, focus recommendations, summarization (API stubs at `/api/ai/*` return 501)
- Docker containerization for homelab/cloud deployment
- Tags UI (schema exists, no frontend)
