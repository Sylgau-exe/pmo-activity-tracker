# ⚡ PMO Activity Tracker

A Kanban board for project portfolio management - the **Sylvain × Claude Collaboration Hub**.

## Features

- 📋 **Kanban Board** with drag-and-drop
- 🎯 **Portfolio Taxonomy** - PMO Ecosystem, Consulting, Tools, Speaking
- ⚡ **WIP Limits** with visual alerts
- 🔍 **Filtering** by portfolio, project, and stale items
- 📦 **Archive** for completed work
- 🗓️ **Session Context** - track where we left off
- 💾 **Persistent Storage** via Neon PostgreSQL

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Neon PostgreSQL
- **Deployment**: Vercel
- **Styling**: CSS-in-JS

## Quick Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/pmo-activity-tracker.git
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **Add New → Project**
3. Import your GitHub repository
4. Click **Deploy**

### 3. Connect Neon Database

1. In Vercel dashboard, go to **Storage**
2. Click **Connect Database → Neon**
3. Select your existing database (`green-forest-39154336`) or create new
4. Vercel auto-injects `DATABASE_URL` ✅

### 4. Initialize Database

After connecting Neon, run the setup script:

```bash
# Option A: Via Vercel CLI
vercel env pull .env.local
npm run db:setup

# Option B: Manually in Neon Console
# Copy and run the SQL from scripts/setup-db.js
```

## Local Development

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your Neon connection string

# Initialize database
npm run db:setup

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
├── app/
│   ├── api/tasks/          # API routes for CRUD
│   ├── layout.js           # Root layout
│   ├── page.js             # Home page
│   └── globals.css         # Global styles
├── components/
│   └── KanbanBoard.jsx     # Main Kanban component
├── lib/
│   └── db.js               # Neon connection
├── scripts/
│   └── setup-db.js         # Database initialization
└── package.json
```

## Portfolio Structure

| Tag | Label | Projects |
|-----|-------|----------|
| 🎯 pmo-eco | PMO Ecosystem | BizSimHub, ProjectManagerTool, PMO Advisor, Education Hub |
| 💼 consulting | Consulting | BL Camions, Capacity Planner |
| 📊 tools | Tools | Financial Dashboard, Invoice Tracker, Activity Tracker |
| 🚢 speaking | Speaking | Cruise Content, Presentations, Destination Talks |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | Get all active tasks |
| GET | `/api/tasks?archived=true` | Get archived tasks |
| POST | `/api/tasks` | Create new task |
| PUT | `/api/tasks` | Update task |
| DELETE | `/api/tasks?id=xxx` | Delete task |
| POST | `/api/tasks/archive` | Archive task |
| DELETE | `/api/tasks/archive?id=xxx` | Restore task |

## Roadmap

- [x] Phase 1: Kanban board with localStorage
- [x] Phase 2: Neon database integration
- [ ] Phase 3: Analytics dashboard (CFD, Cycle Time)
- [ ] Phase 4: Gantt view toggle
- [ ] Phase 5: Recurring tasks automation

---

Built for the PMO Ecosystem 🚀
