# TotalOps — Window Tinting CRM

A complete operating system for automotive, residential and commercial window-tinting businesses.
Built from scratch with **Next.js 15** for both apps and **MongoDB**.

```
TotalOps/
├── backend/    Next.js API only (route handlers) · Mongoose · JWT  → http://localhost:4000/api
├── frontend/   Next.js App Router · Tailwind · Framer Motion · three.js · Recharts → http://localhost:3000
├── start.bat   install + production build + start both + open browser
└── dev.bat     hot-reload development mode
```

## Quick start (Windows)

1. Make sure MongoDB is running locally (`mongodb://127.0.0.1:27017`) or put an Atlas URI in `backend/.env.local`.
2. Double-click **`start.bat`** (or `dev.bat` for development).
3. Open http://localhost:3000 and sign in with **admin@totalops.app / Admin@123**, then change the password in *Settings → Account*.

The first time the backend connects to an empty database it seeds a full demo workspace: 4 stores, 14 team members,
18 film products, inventory rolls, a service catalogue, packages, templates, dealers, automations, lead forms and ~70 projects across every stage.

Manual start:

```bash
cd backend  && npm install && npm run build && npm start   # :4000
cd frontend && npm install && npm run build && npm start   # :3000
```

## Configuration

`backend/.env.local` (copy from `.env.example`)

| Key | Purpose |
|---|---|
| `MONGODB_URI` | Mongo connection string |
| `JWT_SECRET` | Long random secret for admin sessions |
| `FRONTEND_URL` / `PUBLIC_APP_URL` | CORS origin and base URL for customer/dealer/form links |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seeded admin (only used when the DB has no admin) |
| `ANTHROPIC_API_KEY` | *Optional* — AI photo analysis (make/model/body/paint/windows) in the 3D Visualizer |
| `MESHY_API_KEY` | *Optional* — photo → real 3D mesh (GLB) |

`frontend/.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:4000`

## Features

**Everything from TintOps, rebuilt with a real backend** — dashboard, projects & pipeline (stage rules enforced server-side), customers (CSV import/export),
calendar (month/week/day), planning board with capacity & drag-to-reschedule, My Day installer run sheet, Auto Shop Day with one-tap bay status,
live **dealer portal**, team workload & dispatch map, measurement sheets with **voice measuring**, proposal builder with alternative/additive options,
public **customer review & approval link**, invoices, deposits & payments, film inventory with allocations/reorders, notes & tasks, files & photos,
reviews, lead forms with public pages, automations (SMS/task rules, timed follow-ups), reports & CSV/JSON exports, notifications, settings
(business, stores, team, catalogue, packages, templates, dealers, measurement profiles, roles, account, backup).

**New in TotalOps**

- **3D Tint Visualizer** — procedural 3D car for 8 body types; paint/finish/wheels; film + shade per window zone; live legal check per region; inside-the-car view; day/sunset/night/studio; snapshots; saved designs linked to projects.
- **Photo → 3D** — upload a photo: body colour is extracted in the browser and applied; with `ANTHROPIC_API_KEY` Claude identifies make/model/body/paint/windows and auto-configures the car, and the tint can be previewed directly on the photo. With `MESHY_API_KEY` a real 3D mesh can be generated.
- **Smart Film Advisor** — ranks every film for the job (heat, privacy, UV, glare, security, clarity, budget), picks the darkest *legal* shade per window (film × factory glass vs. state law), checks glass compatibility & thermal-stress risk, chooses the roll width per pane, shelf-packs the cut plan (linear metres, waste %), prices material/labour/margin, checks stock and estimates energy savings.
- Server-side automation engine, booking conflict detection (installer and bay), audit/activity feed, global Ctrl+K search, dark mode, animations throughout.

## Security notes

Admin-only login (bcrypt + JWT, login rate limiting). All `/api/*` routes require a token except `/api/public/*` (customer review link, dealer portal, lead forms, logo) and `/api/health`.
SMS / email / payments are **simulated** (logged, not sent) until a provider is connected.
