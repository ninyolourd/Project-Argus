# Argus — Full Development Discussion Summary

A complete log of decisions, changes, and setup steps made during this development session.

---

## 1. UI Redesign

### What was done
- Introduced a shared design-token system via `extension/shared/theme.css` linked into all extension HTML pages (popup, drafts, library, recording-controls)
- Mirrored the same `:root` CSS tokens in `server/public/report.css` (separate app, can't share the file)
- Tokens cover: color palette, border radii (`--radius-sm/md/lg/pill`), shadows (`--shadow-sm/md/lg`), font stack
- Shared component classes: `.brand` / `.brand-mark`, `.btn-primary` / `.btn-secondary` / `.btn-danger`, form field styles, `.field-label`, `.empty`

### Surfaces redesigned
- **Popup** (`popup/`) — brand header, segmented mode toggle (📷/🎥), source toggle, log counters, primary action button, link cards to Drafts/Library
- **Recording-controls window** (`recording-controls/`) — status dot, label, stop button, hint text
- **In-page overlay** (`overlay.js`) — selection rectangle/hint, floating "Stop Recording" widget, "New Bug Capture" preview modal
- **Drafts page** (`drafts/`) — card grid for local drafts/recordings
- **Library page** (`library/`) — row list with Open/Copy Link/Delete actions
- **Server report page** (`server/public/report.html` + `report.css`) — topbar, capture/description/comments cards, environment/console/network tabs

---

## 2. Color Rebrand (Coral → Green)

### Decision
User requested positive/action buttons to be green, delete buttons to stay red.

### Changes made
- `extension/shared/theme.css` and `server/public/report.css`:
  - `--color-primary: #ff6b6b` → `#22c55e`
  - `--color-primary-hover: #f25c5c` → `#16a34a`
  - `--color-primary-dark: #e5484d` → `#15803d`
  - `--color-primary-soft: #fff1f0` → `#ecfdf5`
- `recording-controls.css` — recording indicator dot (`.dot.recording`) changed to `--color-danger` so "recording in progress" stays red
- `overlay.js` — hardcoded shadow-DOM hex values updated to green; "Stop Recording" dot stays red (`#dc2626`)
- `--color-danger: #dc2626` (Delete buttons) left untouched

### Icon regeneration
- Old icon: coral/red ring on transparent background
- New icon: same ring/donut shape, recolored to `#22c55e` (new primary green)
- Generated via Python + Pillow (`ImageDraw`) at 16×16, 48×48, 128×128 — no SVG tooling available on the system

---

## 3. Recording Error Message Fix

### Problem
Error message in the recording-controls window was cut off: `"Recording failed: Recording must b... [Close]"`

### Fix
- Added `id="widget"` + `.widget.error` CSS class that grows the box and wraps text
- Resized the recording-controls window to 420×110 in `showError()`

---

## 4. Project Documents Created

| File | Description |
|---|---|
| `TRACKER.md` | Project tracker — structure, status, revision log, open items |
| `Argus-Project-Tracker.docx` | Word version of the tracker |
| `Argus-Project-Overview.pptx` | 11-slide PowerPoint deck covering the full project |
| `QA-GUIDE.md` | QA setup and usage instructions |
| `DISCUSSION.md` | This file — full session summary |

---

## 5. Extension Distribution

### Options evaluated
| Option | Verdict |
|---|---|
| Chrome Web Store (public) | Requires $5 dev account, review takes days–weeks, `debugger` permission flagged |
| Chrome Web Store (private/unlisted) | Same review process, just restricted access |
| Load unpacked (dev mode) | **Chosen** — instant, no review, no cost |

### How QAs install
1. Unzip `Argus-Extension.zip`
2. `chrome://extensions` → Developer mode → Load unpacked → select `extension/` folder

---

## 6. Storage Research & Decision

### Options evaluated

| Service | Free Storage | Credit Card | Notes |
|---|---|---|---|
| Amazon S3 | 5GB (12 months only) | Yes | Original, most expensive egress |
| Cloudflare R2 | 10GB forever | **Yes (required)** | No egress fees but card needed |
| Backblaze B2 | 10GB forever | **No** | S3-compatible, no card needed |
| Supabase Storage | 1GB only | No | Pauses after 7 days inactivity — unsuitable |

### Decision: Backblaze B2
- No credit card required
- 10GB free storage (permanent)
- S3-compatible API — same `@aws-sdk/client-s3` SDK, just a different endpoint
- Lifecycle rule set to **"Keep only the last version"** so deletes are permanent and immediate
- Originally discussed 60-day auto-cleanup; superseded by "Keep only last version" to fix delete behavior

### B2 Bucket details
- **Bucket name:** Argus-Bucket
- **Region:** us-east-005
- **Endpoint:** `https://s3.us-east-005.backblazeb2.com`
- **App Key:** Argus-App-Key-v2 (keyID: `005edadc0bd50f80000000002`)
- **Files stored as:** `reports/<uuid>/capture.png|webm` and `reports/<uuid>/meta.json`

---

## 7. Storage Migration (storage.js rewrite)

### What changed
- `server/src/storage.js` — fully rewritten from `fs` (local disk) to `@aws-sdk/client-s3` (B2). All functions now async.
- `server/src/routes/reports.js` — all route handlers updated to `async/await`. Capture route streams directly from B2.
- `server/src/index.js` — added `require('dotenv').config()` for local `.env` loading
- `server/.env.example` — credential template
- `server/.gitignore` — excludes `.env`, `node_modules/`, `data/`
- Installed: `@aws-sdk/client-s3`, `dotenv`

### Delete fix (post-migration)
Old reports (created before B2 migration) had no files in B2. The delete route was returning 404, causing the library UI to block deletion. Fixed by returning `{ ok: true }` when the report isn't found in B2 — lets Chrome clean up its local history regardless.

---

## 8. Server Deployment (Render)

### Platform decision
| Platform | Verdict |
|---|---|
| Vercel | Not suitable — 10s function timeout, no persistent Express support |
| Railway | No free tier since 2024 — starts at $5/month |
| Render | **Chosen** — free tier, full Express support, ~30–60s cold start after 15min inactivity |

### Deployment setup
- GitHub repo: `https://github.com/ninyolourd/Project-Argus` (private)
- Connected to Render via **public Git URL** (GitHub App method had repo visibility issues)
- Render service name: `argus-server`
- Root directory: `server/`
- Build command: `npm install`
- Start command: `node src/index.js`
- Instance type: Free

### Environment variables set in Render
```
B2_REGION        us-east-005
B2_ENDPOINT      https://s3.us-east-005.backblazeb2.com
B2_KEY_ID        005edadc0bd50f80000000002
B2_APP_KEY       (Argus-App-Key-v2 secret)
B2_BUCKET        Argus-Bucket
```

### Live URL
`https://project-argus-brw6.onrender.com`

### Deploy hook
Since the repo was connected via public Git URL (not GitHub App), Render cannot auto-detect pushes. Deploys are triggered via:
```
curl -X POST "https://api.render.com/deploy/srv-d8obkmbsq97s73fehfjg?key=PayY1lWXssk"
```
This is called automatically after every code push.

---

## 9. Extension Default URL Update

After Render deployment, updated the extension to point to the live server by default:
- `extension/popup/popup.html` — input default value changed from `http://localhost:4000` to `https://project-argus-brw6.onrender.com`
- `extension/background.js` — fallback URL in all 3 `serverUrl` references updated to match

---

## 10. Open Items

- **Project rename** — still deciding on a Greek mythology name. Candidates (gods only): Hermes, Iris, Mnemosyne, Helios, Pheme, Apollo, Hephaestus. Current name "Argus" remains.
- **60-day auto-cleanup** — discussed but superseded by "Keep only last version" lifecycle setting. Can revisit with B2 custom lifecycle rules if needed.

---

## Session — 2026-06-16 (Continued)

### Additional setup completed this session

- **Project documents** — created `TRACKER.md`, `Argus-Project-Tracker.docx`, `Argus-Project-Overview.pptx` (11 slides), `QA-GUIDE.md`, `DISCUSSION.md`
- **GitHub repo** — initialized git, created private repo `ninyolourd/Project-Argus`, pushed all files. Made public temporarily to connect Render (repo visibility issues with GitHub App), then set back to private after deployment
- **Render deployment** — server deployed at `https://project-argus-brw6.onrender.com`. Connected via public Git URL (not GitHub App). Auto-deploy via deploy hook: `curl -X POST "https://api.render.com/deploy/srv-d8obkmbsq97s73fehfjg?key=PayY1lWXssk"`
- **B2 App Key rotation** — old `Argus-App-Key` (keyID ending `...0001`) replaced with `Argus-App-Key-v2` (keyID ending `...0002`) after original key was shared in chat. New credentials updated in `server/.env` and Render environment variables
- **B2 lifecycle fix** — bucket was set to "Keep prior versions for 60 days" which caused deletes to not remove files. Changed to "Keep only the last version" — deletes are now permanent and immediate
- **Delete fix (pre-migration reports)** — reports created before B2 migration had no files in B2. Delete route was returning 404, blocking UI removal. Fixed by returning `{ ok: true }` when report not found in B2, allowing Chrome to clean up local history
- **Extension zip** — `Argus-Extension.zip` created and added to repo for QA distribution
- **Standing instruction saved** — `DISCUSSION.md` to be updated and pushed at the end of every future session
