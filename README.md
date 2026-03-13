## Calendar Tasks (Test Task)

Calendar grid with:

- inline task create/edit inside day cells
- drag and drop between days
- drag and drop reorder inside a day
- task filtering by text
- public holidays per day (Nager.Date API)
- task persistence in MongoDB via Node.js CRUD (Next.js API routes)

### Tech

- TypeScript
- React + Hooks (Next.js App Router)
- CSS-in-JS: styled-components
- MongoDB (official driver)
- DnD: @dnd-kit

## Local Setup

1. Install deps:

```bash
npm install
```

2. Start local MongoDB (Docker):

```bash
docker compose up -d
```

MongoDB will be available on `mongodb://127.0.0.1:27017`.

3. Configure env:

- copy `.env.example` to `.env.local`
- set `MONGODB_URI` (required)
- optionally set `MONGODB_DB`

4. Run:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Scripts

- `npm run dev` - dev server
- `npm run lint` - ESLint
- `npm run typecheck` - `tsc --noEmit`
- `npm run build` - typecheck + production build

Note: if `next build` fails on Windows with `spawn EPERM` inside a non-ASCII path, move the project to an ASCII-only path or build on Linux/WSL. Vercel builds in Linux by default.

## Deploy to Vercel

Important: MongoDB running locally in Docker is only for local development. Vercel runs in the cloud and cannot connect to your `127.0.0.1` / local Docker network.

1. Push the project to GitHub (repo must be accessible from Vercel).
2. In Vercel: `Add New` → `Project` → import the GitHub repo.
3. In Vercel project settings → `Environment Variables`, add:
   - `MONGODB_URI` (required) — use a cloud MongoDB (e.g. Atlas) connection string
   - `MONGODB_DB` (optional)
   Note: after changing env vars in Vercel, trigger a new deployment (Redeploy) for them to take effect.
4. If using MongoDB Atlas, ensure Network Access allows inbound connections from Vercel (commonly by temporarily allowing `0.0.0.0/0` or by using a proper allowlist strategy).
5. Deploy. Vercel should auto-detect Next.js and use `npm run build`.

## API Endpoints

- `POST /api/auth/register` body: `{ email, password }`
- `POST /api/auth/login` body: `{ email, password }`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/tasks?from=YYYY-MM-DD&to=YYYY-MM-DD&q=...`
- `POST /api/tasks` body: `{ date, title, description?, order? }`
- `PATCH /api/tasks/:id` body: `{ date?, title?, description?, order? }`
- `DELETE /api/tasks/:id`
- `POST /api/tasks/reorder` body: `{ updates: [{ id, date, order }] }`
- `GET /api/countries`
- `GET /api/holidays?year=YYYY&countryCode=AA`
