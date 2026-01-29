# 👁 ARGUS

**Nothing slips through.**

ARGUS is an all-seeing project tracker built for the Sylvain × Claude collaboration. Named after the hundred-eyed giant of Greek mythology, ARGUS watches your commitments, spots stale tasks, and keeps you honest.

## Features

### Core Kanban
- 📋 **Drag-and-drop Kanban board** with 6 columns
- ⚡ **WIP Limits** with visual alerts when exceeded
- 🎯 **Portfolio taxonomy** - PMO Ecosystem, Consulting, Tools, Speaking
- 🔍 **Filtering** by portfolio, project, stale items
- 📦 **Archive** for completed work
- 💾 **Persistent storage** via Neon PostgreSQL

### ARGUS Intelligence
- 👁 **Stale task detection** - highlights items untouched for 14+ days
- 🚫 **Blocker tracking** - surfaces blocked items
- 💬 **Contextual insights** - personalized nudges based on board state
- 📊 **Session context** - tracks where you left off

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Database | Neon PostgreSQL |
| Deployment | Vercel |
| Styling | CSS-in-JS |

## Quick Deploy

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "ARGUS is watching"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/argus.git
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Deploy

### 3. Connect Neon Database

1. In Vercel dashboard → **Storage**
2. Click **Connect Database → Neon**
3. Select or create your database
4. Vercel auto-injects `DATABASE_URL` ✅

### 4. Initialize Database

Run in Neon SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'backlog',
  portfolio TEXT NOT NULL,
  project TEXT,
  effort TEXT,
  impact TEXT,
  blocked BOOLEAN DEFAULT FALSE,
  blocker_reason TEXT,
  due_date DATE,
  start_date DATE,
  completed_date DATE,
  last_session_date DATE,
  session_notes TEXT,
  next_action TEXT,
  repo_url TEXT,
  tech_stack TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  archived_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_portfolio ON tasks(portfolio);
CREATE INDEX IF NOT EXISTS idx_tasks_archived ON tasks(archived_at);
```

## Project Structure

```
├── app/
│   ├── api/tasks/          # CRUD API routes
│   ├── layout.js           # Root layout
│   ├── page.js             # Home page
│   └── globals.css         # ARGUS theme
├── components/
│   └── KanbanBoard.jsx     # Main component with ARGUS intelligence
├── lib/
│   └── db.js               # Neon connection
└── package.json
```

## Portfolio Structure

| Tag | Label | Projects |
|-----|-------|----------|
| 🎯 pmo-eco | PMO Ecosystem | BizSimHub, ProjectManagerTool, PMO Advisor, Education Hub |
| 💼 consulting | Consulting | BL Camions, Capacity Planner |
| 📊 tools | Tools | Financial Dashboard, Invoice Tracker, Activity Tracker |
| 🚢 speaking | Speaking | Cruise Content, Presentations, Destination Talks |

## ARGUS Personality

ARGUS provides contextual insights based on your board state:

**When stale tasks exist:**
> "I've spotted 3 tasks gathering dust. Shall we revisit them?"

**When blockers exist:**
> "2 tasks are blocked. Every blocker is a decision waiting to be made."

**When WIP exceeded:**
> "WIP limits exceeded in In Progress. Focus beats multitasking."

**When all clear:**
> "All systems nominal. Your flow looks healthy today."

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
- [x] Phase 2.5: ARGUS personality & intelligence
- [ ] Phase 3: Analytics dashboard (CFD, Cycle Time)
- [ ] Phase 4: Gantt view toggle
- [ ] Phase 5: Recurring tasks automation

---

**ARGUS is watching. Nothing slips through.** 👁
