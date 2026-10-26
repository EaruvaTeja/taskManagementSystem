# Task Management System

A full-stack Task Management System built with **FastAPI** (Python), **React** (Vite), **SQLAlchemy**, and **SQLite**. Users can create, view, update, delete, search, and filter tasks through a responsive web interface backed by a documented REST API.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Backend Setup](#backend-setup)
- [Frontend Setup](#frontend-setup)
- [Running the Application](#running-the-application)
- [API Reference](#api-reference)
- [Data Model](#data-model)
- [Validation Rules](#validation-rules)
- [Error Handling](#error-handling)
- [Verification Checklist](#verification-checklist)
- [Troubleshooting](#troubleshooting)

---

## Features

### Task Management
- ✅ Create tasks with title, description, status, priority, and due date
- ✅ View all tasks in a card layout
- ✅ View individual task details in a modal
- ✅ Edit tasks (full update via PUT, partial update via PATCH)
- ✅ Delete tasks with confirmation
- ✅ Search tasks by title (case-insensitive, debounced)
- ✅ Filter tasks by status (`Pending`, `In Progress`, `Completed`)
- ✅ Filter tasks by priority (`Low`, `Medium`, `High`)
- ✅ Combine search + status + priority filters simultaneously

### User Experience
- 📊 Global task statistics (total, pending, in-progress, completed)
- 🔔 Auto-dismissing success notifications
- ⚠️ Inline validation messages and error banners with retry
- ⏳ Loading spinners and empty states
- 🎨 Priority-colored card accents and status badges
- 📱 Fully responsive (desktop, tablet, mobile)
- ♿ Respects `prefers-reduced-motion` accessibility setting

### Backend
- 🔒 Input validation via Pydantic v2
- 🗄️ Persistent storage with SQLAlchemy + SQLite
- 🚨 Centralized error handling with proper HTTP status codes
- 📖 Auto-generated API docs (Swagger UI + ReDoc)
- 🌐 CORS support for the React dev server

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Python 3.13, FastAPI 0.162, SQLAlchemy 2.1, Pydantic 2.14 |
| Server | Uvicorn 0.54 (ASGI) |
| Database | SQLite |
| Frontend | React 18+ (Vite), plain CSS |
| Testing | Manual verification via Swagger UI at `/docs` |

---

## Project Structure

```text
taskManagementSystem/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app + lifespan + CORS
│   │   ├── database.py          # Engine, session, Base, get_db
│   │   ├── models.py            # SQLAlchemy Task model
│   │   ├── schemas.py           # Pydantic schemas
│   │   └── routers/
│   │       ├── __init__.py
│   │       └── tasks.py         # CRUD routes
│   ├── requirements.txt
│   └── tasks.db                 # SQLite DB (auto-created on first run)
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── vite.config.js           # Proxy to backend
│   ├── package.json
│   └── index.html
├── .gitignore
└── README.md
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.11 or newer (3.13 tested) |
| Node.js | 18 or newer |
| npm | 9 or newer |

Verify:
```bash
python --version
node --version
npm --version
```

---

## Backend Setup

```bash
# From project root
cd backend

# Create and activate a virtual environment
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

The SQLite database (`tasks.db`) and the `tasks` table are **created automatically** on the first server start — no manual migration needed.

Start the backend:
```bash
uvicorn app.main:app --reload --port 8000
```

- API root: <http://127.0.0.1:8000>
- Swagger UI: <http://127.0.0.1:8000/docs>
- ReDoc: <http://127.0.0.1:8000/redoc>
- Health check: <http://127.0.0.1:8000/health>

---

## Frontend Setup

```bash
# From project root
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

The React app runs at <http://localhost:5173>.

The Vite dev server proxies requests to `/tasks` and `/health` to `http://127.0.0.1:8000`, so both must be running simultaneously.

To build for production:
```bash
npm run build
npm run preview
```

---

## Running the Application

You need **two terminals** open simultaneously:

**Terminal 1 — Backend**
```bash
cd backend
.venv\Scripts\activate          # Windows
uvicorn app.main:app --reload
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm run dev
```

Then open <http://localhost:5173> in your browser.

---

## API Reference

Base URL: `http://127.0.0.1:8000`

| Method | Endpoint | Description | Success |
|--------|----------|-------------|---------|
| `GET` | `/` | API welcome message | 200 |
| `GET` | `/health` | Health check | 200 |
| `POST` | `/tasks/` | Create a task | 201 |
| `GET` | `/tasks/` | List tasks (with optional filters) | 200 |
| `GET` | `/tasks/{id}` | Retrieve a single task | 200 |
| `PUT` | `/tasks/{id}` | Replace all editable fields | 200 |
| `PATCH` | `/tasks/{id}` | Update only supplied fields | 200 |
| `DELETE` | `/tasks/{id}` | Delete a task | 204 |

### Query parameters for `GET /tasks/`

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string (≤200) | Case-insensitive title search |
| `status` | enum | `Pending` \| `In Progress` \| `Completed` |
| `priority` | enum | `Low` \| `Medium` \| `High` |

### Example — Create a task

```bash
curl -X POST http://127.0.0.1:8000/tasks/ \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Prepare project documentation",
    "description": "Write README and API docs",
    "status": "Pending",
    "priority": "High",
    "due_date": "2025-01-31"
  }'
```

Response (`201 Created`):
```json
{
  "title": "Prepare project documentation",
  "description": "Write README and API docs",
  "status": "Pending",
  "priority": "High",
  "due_date": "2025-01-31",
  "id": 1,
  "created_at": "2025-01-15T10:30:00+00:00"
}
```

### Example — List with filters

```bash
curl "http://127.0.0.1:8000/tasks/?status=Pending&priority=High&search=project"
```

### Example — Partial update

```bash
curl -X PATCH http://127.0.0.1:8000/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{"status": "Completed"}'
```

### Example — Delete

```bash
curl -X DELETE http://127.0.0.1:8000/tasks/1
```

**Full interactive docs** are available at `/docs` (Swagger UI) with request/response schemas and "Try it out" functionality.

---

## Data Model

### `Task`

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | integer | primary key, auto-increment |
| `title` | string(200) | required, non-empty |
| `description` | text | nullable |
| `status` | string(20) | `Pending` \| `In Progress` \| `Completed` (default: `Pending`) |
| `priority` | string(10) | `Low` \| `Medium` \| `High` (default: `Medium`) |
| `due_date` | date | nullable |
| `created_at` | datetime (UTC) | auto-set on creation |

Database-level CHECK constraints enforce valid status and priority values.

---

## Validation Rules

| Field | Rule | HTTP Status if violated |
|-------|------|-------------------------|
| `title` | Required, 1–200 chars, non-blank | 422 |
| `status` | Must be one of the three literals | 422 |
| `priority` | Must be one of the three literals | 422 |
| `status` (PATCH) | Cannot be `null` | 422 |
| `priority` (PATCH) | Cannot be `null` | 422 |
| `due_date` | Must be a valid ISO date | 422 |
| PATCH body | At least one field required | 400 |

---

## Error Handling

All errors return JSON in the following shape:

```json
{ "detail": "Human-readable error message" }
```

| Status | Meaning |
|--------|---------|
| `400` | Bad request (e.g., empty PATCH body) |
| `404` | Task with requested ID not found |
| `422` | Request payload validation failed |
| `500` | Unexpected database error (rolled back) |

The frontend displays these messages inline:
- **Form errors** → shown inside the form panel
- **List errors** → shown above the task list with a retry button
- **Status/delete errors** → shown as an error banner

---

## Verification Checklist

After both servers are running:

1. **Create** a task via the form → appears at top of the list → success toast shows.
2. **View** button on a card → detail modal opens with all fields → Esc closes it.
3. **Edit** a task → form pre-fills → save → card updates.
4. **Status dropdown** on a card → change → card + stats update.
5. **Delete** a task → confirmation dialog → card disappears.
6. **Search** for a partial title → list filters live (debounced).
7. **Filter** by status and priority → filters combine.
8. **Active filters** bar shows chips when filters are set → "Clear all" resets.
9. **Stat cards** show global totals (not filter-scoped).
10. **Validation**: submit with empty title → 422 → inline error.
11. **Invalid ID**: `curl http://127.0.0.1:8000/tasks/9999` → 404.
12. **Swagger docs**: <http://127.0.0.1:8000/docs> → all routes documented with summaries.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `no such table: tasks` | DB created but table missing | Restart the backend — the lifespan hook auto-creates tables |
| Frontend requests return HTML 404 | Vite proxy not active | Confirm `vite.config.js` has the `/tasks` proxy; restart Vite |
| CORS error in browser console | Backend not running or wrong port | Ensure Uvicorn is on port 8000 |
| `ModuleNotFoundError: fastapi` | Dependencies not installed or venv not active | Run `pip install -r requirements.txt` inside the activated venv |
| Timestamps display wrong | Browser interpreting UTC as local | Already fixed via Pydantic `field_serializer` — verify response ends with `+00:00` |
| `tasks.db` corrupted | Manual edits or git commit of the DB | Delete `tasks.db`, restart the backend (table recreated) |

---

## License

This project is developed for educational/demonstration purposes as part of a full-stack development assignment.