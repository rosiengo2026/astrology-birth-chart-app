# Astrology Birth Chart App

Full-stack natal chart application with:

- `frontend`: Next.js + TailwindCSS UI
- `backend`: Express + MongoDB API + CMS + auth
- Swiss Ephemeris integration support (with fallback engine)
- AI interpretation generation
- JSON export/import for CMS meanings
- PM2 deployment config for VPS

## Features

### Frontend

- Birth chart form: date, time, city/country autocomplete
- Calls backend `POST /api/generate-chart`
- Displays:
  - chart wheel (SVG)
  - Sun / Moon / Rising
  - 12 houses
  - AI-generated interpretation
- Minimal, modern, mobile-responsive UI
- Admin panel at `/admin` for CMS management

### Backend

- `POST /api/generate-chart` for natal chart generation
- JWT admin login (`POST /api/auth/login`)
- CMS CRUD for:
  - `planet_sign`
  - `planet_house`
  - `aspect`
- JSON export/import:
  - `GET /api/cms/export`
  - `POST /api/cms/import`

### AI Interpretation

- Uses OpenAI API when `OPENAI_API_KEY` is set
- Graceful fallback interpretation when no key is configured

## Tech Stack

- Frontend: Next.js (App Router), TypeScript, TailwindCSS
- Backend: Node.js, Express, TypeScript, MongoDB (Mongoose), JWT
- Astrology calc: `swisseph` (optional native integration) + `astronomy-engine` fallback

## Local Setup

## 1) Backend

```bash
cd backend
cp .env.example .env
npm install
npm run seed-admin
npm run dev
```

## 2) Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Open:

- Frontend: `http://localhost:3000`
- Admin CMS: `http://localhost:3000/admin`
- Backend API: `http://localhost:4000/api`

## Docker Compose (one command)

From project root:

```bash
docker compose up --build -d
```

Then seed the admin user once:

```bash
docker compose run --rm backend npm run seed-admin
```

Open:

- Frontend: `http://localhost:3000`
- Admin CMS: `http://localhost:3000/admin`
- Backend API: `http://localhost:4000/api`

Stop everything:

```bash
docker compose down
```

If you also want to remove MongoDB data volume:

```bash
docker compose down -v
```

## Swiss Ephemeris Note

`swisseph` is wired in code as an optional native dependency. On machines without C/C++ build tools and Python for `node-gyp`, the backend automatically uses `astronomy-engine` fallback.

To force native Swiss Ephemeris usage, install Python + build tools and run:

```bash
cd backend
npm install swisseph
```

## Deployment (VPS + PM2)

Build apps:

```bash
cd backend && npm install && npm run build
cd ../frontend && npm install && npm run build
```

Install PM2 and run:

```bash
npm i -g pm2
cd ..
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## API Quick Reference

- `POST /api/auth/login`
- `POST /api/generate-chart`
- `GET /api/cms/meanings`
- `POST /api/cms/meanings`
- `PUT /api/cms/meanings/:id`
- `DELETE /api/cms/meanings/:id`
- `GET /api/cms/export`
- `POST /api/cms/import`

All `/api/cms/*` endpoints require `Authorization: Bearer <token>`.

## Optional Enhancements

Not yet implemented:

- User accounts to save generated charts
- PDF download for chart reports
