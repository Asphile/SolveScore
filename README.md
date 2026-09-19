# SolveScore

**AI-Powered Live Evaluation Hub for Samsung Solve for Tomorrow**

SolveScore is a competition-management and judging platform that takes a Solve for
Tomorrow competition from creation through school registration, application review,
AI-assisted content screening, independent blind judging, score consolidation, and
final reporting.

## Features

- **Role-based access control** — three roles (Admin, School, Judge), enforced at the
  API layer, not just in the UI.
- **Competition lifecycle** — Draft → Published → Applications Open/Closed → Under
  Review → Judging Open/Closed → Results Finalized → Archived, enforced server-side.
- **Hard 20-school capacity limit** — enforced in the database transaction that
  processes a "join competition" request, not just displayed in the UI.
- **Multi-step application wizard** — project info, team, required documents, video,
  review & submit, with draft autosave.
- **Document/video upload** with extension + MIME-type + file-signature validation.
- **AI content-detection pipeline** — extracts text from uploaded documents/
  presentations and produces a probabilistic indicator for admin review. It never
  automatically rejects, disqualifies, or re-scores a school.
- **Configurable weighted judging rubric**, validated to sum to exactly 100%.
- **Independent, blind judging** — a judge can never see another judge's scores,
  comments, or draft state, enforced by the API (verified by an explicit test suite).
- **Offline-aware evaluation drafts** — judge scoring is cached to `localStorage` and
  auto-syncs when connectivity returns.
- **Evaluation locking** — submitted evaluations are locked; only an admin can reopen
  one, and only with a recorded reason.
- **Live admin monitoring dashboard**, official leaderboard (drafts excluded), and
  CSV/PDF report export.
- **Full audit log** of every significant action in the system.

## Architecture

```
frontend/   React + TypeScript + Vite SPA
backend/    FastAPI (Python) REST API, SQLAlchemy ORM, SQLite (dev)
```

The frontend talks to the backend exclusively over the REST API defined in
`backend/app/routers/`. There is no server-rendered coupling between the two — either
can be redeployed independently.

### Backend layout

```
backend/app/
  models/       SQLAlchemy models (one file per entity)
  schemas/      Pydantic request/response schemas
  routers/      FastAPI route modules (one per resource area)
  services/     Business logic: competition capacity, scoring, AI detection,
                file storage, text extraction, audit logging
  core/         Auth (JWT + bcrypt), DB session, RBAC dependencies
  seed.py       Development seed data script
backend/tests/  pytest suite covering the business-critical rules (see below)
```

### Why these business rules live in `services/`, not the router

- `services/competition_service.py` — the 20-school cap and duplicate-join
  prevention, using a locked read + a unique DB constraint as a backstop against race
  conditions.
- `services/evaluation_service.py` — the only place the official weighted score is
  computed. The frontend renders a live preview, but it is never trusted; the score
  saved to the database is always recalculated server-side on submit.
- `services/ai_detection.py` — a provider interface with a transparent, local `stub`
  implementation (no external calls) and an `ExternalAIDetectionProvider` integration
  point that intentionally raises rather than faking a real vendor call. See
  **AI detection configuration** below.

## Technology stack

- **Frontend:** React 19, TypeScript, Vite, React Router, Axios
- **Backend:** FastAPI, SQLAlchemy 2.0, Pydantic v2, python-jose (JWT), bcrypt
- **Database:** SQLite for development (swap `DATABASE_URL` for PostgreSQL in
  production — the SQLAlchemy models are engine-agnostic)
- **Data processing:** Pandas (report generation)
- **Reports:** `reportlab` (PDF), built-in `csv` (CSV)
- **Testing:** pytest + FastAPI's `TestClient`

## Installation

### Prerequisites

- Python 3.11+ (developed against 3.14)
- Node.js 18+

### Backend

```bash
cd backend
python -m venv venv
./venv/Scripts/activate        # Windows; use `source venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
cp .env.example .env
python -m app.seed             # creates dev admin/judge/school accounts + sample data
uvicorn app.main:app --reload --port 8000
```

The API is now at `http://localhost:8000` (interactive docs at `/docs`).

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

The app is now at `http://localhost:5173`.

## Environment variables

### Backend (`backend/.env`, see `backend/.env.example`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLAlchemy connection string (SQLite by default; use a PostgreSQL URL in production) |
| `SECRET_KEY` | JWT signing secret — set a long random value in production |
| `JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES` | Token config |
| `AI_PROVIDER` | `stub` (default, local heuristic, no external calls) or the name of a real vendor once implemented |
| `AI_API_KEY` | Credential for a real AI-detection vendor — never hard-code this |
| `FILE_STORAGE_PATH` | Local directory for uploaded files |
| `MAX_DOCUMENT_SIZE_MB`, `MAX_VIDEO_SIZE_MB` | Upload size limits |
| `FRONTEND_ORIGIN` | Allowed CORS origin |

### Frontend (`frontend/.env`, see `frontend/.env.example`)

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Base URL of the backend API |

Never commit a populated `.env` file.

## Database setup & migrations

Schema changes are managed with Alembic (`backend/alembic/`), not
`create_all`/`drop_all`. `app/database.py: init_db()` still calls
`Base.metadata.create_all()` on startup as a convenience for a completely fresh dev
database, but any database that already has data in it should be brought up to date
with Alembic instead:

```bash
cd backend
alembic upgrade head          # apply any migrations that haven't run yet
```

After changing a model, generate a migration rather than relying on `create_all` to
pick up the change silently:

```bash
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```

Always read the autogenerated migration before applying it — autogenerate detects
table/column changes reliably but not every data transformation (e.g. backfilling a
new non-nullable column).

SQLite runs in WAL mode with foreign-key enforcement turned on (`app/database.py`),
which lets reads and writes happen concurrently instead of locking the whole file,
and makes SQLite actually reject orphaned foreign keys instead of silently allowing
them (SQLite does not enforce FKs by default).

## Seed data

```bash
cd backend
python -m app.seed
```

Creates, if not already present:

- 1 admin — `admin@solvescore.dev`
- 20 judges — `judge01@solvescore.dev` … `judge20@solvescore.dev`
- 20 schools — `school01@solvescore.dev` … `school20@solvescore.dev`
- 1 competition ("Samsung Solve for Tomorrow 2026") with an active 40/30/30 rubric,
  20 approved applications, and every judge scoring every school, so the results
  leaderboard is populated immediately.

All seed accounts use the password `DevPass123`. **These are development
credentials only — never use them in a production deployment.**

## Running the tests

```bash
cd backend
./venv/Scripts/python.exe -m pytest -v
```

32 tests cover, among other things:

- Registration, login, password hashing, invalid-credential rejection
- The 20-school hard cap, the 21st-school rejection, duplicate-join rejection
- Server-side weighted score calculation (matches the spec's worked example exactly)
- **The critical isolation tests:** a judge cannot read another judge's evaluation
  via the API, and a school cannot read another school's application via the API
- Application submission validation (required fields, required documents)
- The full review cycle (submit → request changes → resubmit → approve)
- Draft evaluations are excluded from results; only submitted ones count
- Evaluation locking, and admin-initiated reopening

## File upload configuration

Accepted document types: PDF, DOC, DOCX, PPT, PPTX, JPG, JPEG, PNG.
Accepted video types: MP4, MOV, WEBM.

Uploads are validated three ways before being accepted: file extension, the
client-supplied MIME type, and (for known formats) the file's actual byte signature
— so a renamed `.exe` cannot masquerade as a `.pdf`. Size limits are configurable via
`MAX_DOCUMENT_SIZE_MB` / `MAX_VIDEO_SIZE_MB`.

## AI detection configuration

`AI_PROVIDER=stub` (the default) uses a transparent, local, clearly-labeled heuristic
so the full review workflow — statuses, the admin review queue, the audit trail — is
exercisable without any external dependency or cost. **It is not a real AI-content
detector.**

To connect a real vendor, implement `ExternalAIDetectionProvider.analyze_text` in
`backend/app/services/ai_detection.py` and set `AI_PROVIDER`/`AI_API_KEY`. Until that
is done, requests to a non-`stub` provider fail loudly (`AIDetectionNotConfiguredError`)
rather than silently returning a fake result.

Whatever the provider, detection results are always framed as indicators requiring
human review (`REVIEW_REQUIRED`, `LOW_INDICATION`, confidence percentage) — the system
has no code path that lets an AI result automatically reject, disqualify, or change a
score for a school.

Video transcription (for AI-analyzing video content) is a documented, unimplemented
integration point — see `extract_text_from_video` in
`backend/app/services/text_extraction.py`.

## Deployment notes

- **Single VPS with a persistent disk** (the supported path for the SQLite setup
  as shipped):
  - Generate a fresh, unique `SECRET_KEY` directly on the server — never reuse a
    value that has ever appeared in a `.env` file on a dev machine or in this repo's
    history. `python -c "import secrets; print(secrets.token_urlsafe(64))"` generates
    one.
  - Set `FRONTEND_ORIGIN` to the real deployed frontend origin.
  - Run `alembic upgrade head` before starting the app on a database that already
    has data (a brand-new empty database can also just start the app, which still
    runs `create_all` as a convenience).
  - Put `backend/solvescore.db` and `backend/uploads/` on the same persistent volume,
    and schedule `backend/scripts/backup.sh` via cron (it snapshots the database with
    SQLite's `.backup` — safe to run against a live WAL-mode database — and archives
    `uploads/`, pruning backups older than `RETENTION_DAYS`, default 14).
  - Run the backend behind a production ASGI setup (e.g. `uvicorn` with multiple
    workers behind a reverse proxy, or `gunicorn -k uvicorn.workers.UvicornWorker`)
    and serve the frontend's `npm run build` output (`frontend/dist/`) from the same
    reverse proxy or a static host/CDN, pointed at the backend via
    `VITE_API_BASE_URL`.
- **Multi-instance / PaaS with an ephemeral filesystem** (Render, Railway, Heroku,
  etc.): the SQLite-on-local-disk setup above does not survive redeploys or scale
  past one instance. Swap `DATABASE_URL` for a PostgreSQL connection string (the
  SQLAlchemy models are portable — the SQLite-only WAL/FK pragmas in
  `app/database.py` are skipped automatically for non-SQLite URLs) and move
  `backend/uploads/` to object storage (e.g. S3) instead of local disk.

## Known limitations

- The AI content-detection provider is a local heuristic stub, not a connected
  real-world detector (see **AI detection configuration**).
- Video transcription for AI analysis is not implemented — video resources are
  stored and viewable, and are still run through the AI-analysis pipeline, but are
  recorded as `NOT_CHECKED` with an explanation rather than actually text-analyzed.
- Rate limiting is not yet implemented at the API layer.
- The application wizard is a single-page stepper rather than persisting each step
  to the backend independently — draft saves persist the whole application object.
