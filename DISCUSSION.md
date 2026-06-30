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

---

## Session — 2026-06-16 (Username & Access Control)

### Username feature — completed (Part 2)

The first session established the name prompt in the extension popup (`argusUserName` in `chrome.storage.local`). This session wired that name into the report page comment system:

**Files changed:**
- `extension/background.js` — appends `?created=1&author=<name>` when opening a new report tab
- `server/public/report.html` — added `commenter-row` div (label + name input above comment textarea)
- `server/public/report.js` — reads `?author=` param on load, saves to `localStorage('argusAuthor')`, includes `author` in comment POST body, renders author next to timestamp in each comment
- `server/public/report.css` — added `.commenter-row`, `.comment-meta`, `.comment-author` styles
- `server/src/routes/reports.js` — comment POST now reads `req.body.author`, stores as `comment.author` (null if empty)

### "Commenting as" field behavior

After iterating on several approaches:
- **Extension users** (opened via library or new report submission): field is **disabled and pre-filled** with their name. They can see it but can't change it on the report page.
- **Non-extension visitors** (shared link): field is **editable** — they type their name before commenting.

**How it works:**
- `?author=<name>` sets `sessionStorage('argusFromExtension')` when the page loads. `setupComments()` checks this flag: if set → disable the input; if not → leave editable and pre-fill from `localStorage('argusAuthor')` if available.
- `sessionStorage` was chosen over `localStorage` because it's scoped to the tab session (survives refresh, clears on tab close), making it a reliable signal for "this tab was opened from the extension."

### Library fix — synchronous href

The library's "Open" button was setting `openLink.href` inside an async `chrome.storage.local.get().then(...)`. If clicked before the promise resolved, the URL would have no `?author=` param. Fixed by loading `argusUserName` once at the top of `init()` alongside `GET_REPORT_HISTORY` via `Promise.all`, then passing it synchronously to `renderRow()`.

Also added `?owner=1` to all library-opened report URLs (see below).

### Description field — owner-only editing

**Decision:** The description textarea should only be editable by the report's author. Other visitors (shared link, other extension users) see it as read-only.

**How it works:**
- `?created=1` (new report submission) or `?owner=1` (opened from library) sets `sessionStorage('argusIsOwner')`.
- `setupDescription()` checks this flag: if not set → textarea is `disabled`, Save button is hidden. If set → normal editable behaviour.
- All reports in the library belong to the current user, so `?owner=1` is always appended by `library.js`.

### GitHub repo visibility

Multiple attempts were made to keep the repo private while allowing Render to deploy:
- GitHub App method failed — Project-Argus repo wasn't appearing in Render's list under the ninyolourd account.
- PAT embedded in URL — entered on Render's Public Git Repository tab, but Render still referenced the repo via GitHub API repo ID (not PAT URL), causing deploy hook failures.
- **Final decision:** Repo kept **public**. Sensitive data (B2 credentials) is in `server/.env` which is gitignored and only set as environment variables in Render. The code itself contains no secrets.

### Commits this session
- `feat: wire username into report page comments`
- `chore: update extension zip`
- `refactor: remove commenter name input, use extension name silently` (reverted direction)
- `feat: show commenter field only for non-extension visitors`
- `fix: pass author param when opening reports from library`
- `fix: load username synchronously before rendering library rows`
- `fix: use sessionStorage to reliably hide commenter field for extension users`
- `feat: disable commenter name field for extension users, editable for guests`
- `feat: description is editable for report owner only, read-only for others`

---

## Session — 2026-06-17 (Desktop Recording Bug Fixes)

### Bug 1 — Preview modal not showing after desktop recording

**Root cause:** When the user switches tabs (e.g., to the library or another web page) during recording, `DESKTOP_RECORDING_READY` is sent to the ORIGINAL recording tab (correct), but the user is now looking at a different tab and doesn't see the modal.

**Fix (commit `3274619`):** Added `.then()` to the `chrome.tabs.sendMessage` call. On success (original tab is a regular web page and received the message), focus/activate that tab so the modal is immediately visible. The `.catch()` fallback (for when the original tab is an extension page where content scripts don't run) was already in place from the previous session.

```js
chrome.tabs.sendMessage(tabId, { type: 'DESKTOP_RECORDING_READY', recordingTabId: tabId })
  .then(() => {
    chrome.tabs.update(tabId, { active: true }).catch(() => {});
  })
  .catch(async () => { /* fallback to most recently active http/https tab */ });
```

### Commits this session
- `fix: find most recently active web tab for desktop recording fallback` (21c249d — from previous session)
- `fix: focus original tab so preview modal is visible after desktop recording` (3274619)
- `fix: inject content scripts before sending DESKTOP_RECORDING_READY` (8412d8d)

---

## Session — 2026-06-19 (Roadmap, Rebrand & Logo)

### Roadmap created

`ROADMAP.md` created and iteratively updated to capture the full product direction:
- **Current State** — what's built and shipped
- **Tech Stack** — server, storage, languages, extension internals
- **Bug Log** — 8 fixed issues + 1 open/intermittent, each with root cause and fix
- **Near-term** — save prompt bug, screenshot annotation, floating stop widget (from QA feedback)
- **Phase 1** — Accounts via Olympus SSO (pending Olympus auth details)
- **Phase 2** — Projects & folders, link grouping, 90-day link expiry
- **Phase 3** — Web SDK (`argus.js`) + Argus as an Olympus dashboard tile; embedding in other apps (e.g. Athena) is optional
- **Phase 4** — Collaboration: request links, status tags, assignees, Slack/Jira

Key decisions:
- Accounts must come before projects, which must come before the SDK — each phase unblocks the next
- Argus in Olympus = standalone tile first; embedding in Athena is opt-in for any team once the SDK exists
- Olympus SSO replaces the current `argusUserName` / `?owner=1` ownership model

### Rebrand — Argus logo + blue theme

- **New logo**: `Argus2.jpg` — dark navy background, cyan-to-blue gradient "A" with corner brackets and eye element, no text
- **Icons**: Generated circular PNGs (16/48/128 px) from logo using Pillow; replace old green ring icons
- **Theme**: Green (`#22c55e`) replaced with logo blue (`#0099ff`); hover `#007acc`, dark `#005fa3`, soft `#e6f4ff`; cyan accent `#00d4ff`
- **Files updated**: `extension/shared/theme.css`, `server/public/report.css`, `extension/overlay.js` (hardcoded hex values), all extension HTML headers (`popup`, `library`, `drafts`), `server/public/report.html`
- **Brand mark**: Changed from CSS-only ring (`border: 5px solid var(--color-primary)`) to circular `<img>` tag using the logo
- **`.gitignore`**: Source logo files (`Argus_Logo.jpg`, `Argus2.jpg`) excluded — only processed PNGs are committed

### Commits this session
- `feat: rebrand to Argus logo — new icons and blue theme from logo colors`
- `feat: circular icon and logo brand mark across all surfaces`
- `feat: replace logo with Argus2 across all icons and report page`

---

### Root cause of the persistent drafts redirect

Tabs opened before the extension is installed or reloaded never receive the manifest-declared content scripts. `chrome.tabs.sendMessage` fails silently on those tabs, causing the fallback to open the drafts page.

**Fix:** Before sending `DESKTOP_RECORDING_READY` to any tab, use `chrome.scripting.executeScript` to inject `overlay.js` + `content.js` if they aren't already present. Guards were added to both scripts to make re-injection safe:
- `overlay.js`: `window.ArgusOverlay = window.ArgusOverlay || (() => { ... })()`
- `content.js`: early return if `window.__argusContentLoaded` is already set

---

## Session — 2026-06-19 (Roadmap Update — AI Generation, Hephaestus Rename, Mini App Direction)

### Platform rename: Olympus → Hephaestus

The internal eCloudValley platform name was finalized as **Hephaestus** (previously referred to as Olympus throughout earlier planning). All references in `ROADMAP.md` updated. Argus and Athena remain app tiles within it, keeping the Greek mythology naming convention.

### New Phase 1: AI-Powered Automated Bug Report Generation

Added ahead of Accounts because it ships independently — no auth or project infrastructure required, and it improves every report immediately.

- On submit, capture metadata + console/network logs sent to an AI API (e.g. Claude API)
- Vision-capable model analyzes the screenshot (or first/last frames of a recording) to describe what's on screen
- AI generates: title, structured description, inferred steps to reproduce, and a suggested severity (Low/Medium/High/Critical) based on error signals in the logs
- Pre-fills report fields server-side; user can edit before saving or accept as-is

### Architecture shift: Argus as a mini app, not just an extension

Decision made to evolve Argus from a pure Chrome extension into a **mini app with extension capabilities**:
- **Web app** (primary) — full Argus UI hosted on the server, login via Hephaestus SSO, manage all reports/projects without installing anything
- **Chrome extension** (companion) — adds in-page capture capabilities; submits to the same backend
- Both share the same reports, projects, and accounts

This reframing pushed the old Phase 1–4 down: Accounts is now Phase 2, Projects & Folders is Phase 3, the renamed "Mini App & Hephaestus Integration" is Phase 4, and Collaboration & Workflow is Phase 5.

### Commits this session
- `docs: add AI-powered bug report generation as Phase 1; rename Olympus to Hephaestus; reframe Argus as mini app + extension`

This covers all scenarios: user starts from a web page, switches tabs during recording, or starts from an extension page (library/drafts).

---

## Session — 2026-06-19 (Floating Stop Widget for Desktop Recording)

### Problem

Desktop recording ran `getDisplayMedia` + `MediaRecorder` inside a separate `recording-controls` popup window that shrank to a small bar after capture started. That bar could get lost behind other windows or buried in the taskbar, so users couldn't find the Stop button. (Tab recording already showed a clean in-page pill via `overlay.js`'s `showStopButton`.)

### Fix

Capture stays in the controls window (it needs the user gesture + a persistent context for the stream), but the UX moved into the page:

- **`recording-controls.js`** — once capture starts the window minimizes itself (`minimizeWindow`) instead of shrinking to a bar; removed the now-dead `shrinkWindow`. On error it restores to a normal, focused window to show the message.
- **`background.js`** —
  - New helpers: `ensureScripts` (factored out of `RECORDING_DATA`), `showDesktopControlsOnTab`, `broadcastDesktopRecordingEnded`.
  - `chrome.tabs.onActivated` listener re-shows the pill on whatever web tab the user switches to during an active desktop recording (the pill "follows" them).
  - `RECORDING_STARTED` now surfaces the pill on the recording tab.
  - New `STOP_DESKTOP_RECORDING_REQUEST` case relays `STOP_DESKTOP_RECORDING` to the minimized controls window (which already owned that handler).
  - Broadcasts `DESKTOP_RECORDING_ENDED` to clear stale pills on `RECORDING_DATA` and `RECORDING_ERROR`.
- **`content.js`** — `showDesktopRecordingControls` (reuses `showStopButton`), `removeStopWidget`, and handlers for `SHOW_DESKTOP_RECORDING_CONTROLS` / `DESKTOP_RECORDING_ENDED`; `DESKTOP_RECORDING_READY` now removes the pill before showing the preview.

Chrome's native "Stop sharing" bar remains as an always-present fallback. `Argus-Extension.zip` rebuilt. Tested in Chrome.

### Commits this session
- (see git log)

---

## Session — 2026-06-19 (Save-Prompt Bug, Screenshot Annotation, Popup Injection Fix)

### Save-prompt bug — root cause & fix

**Root cause:** Tab recordings sent `RECORDING_DATA` from the offscreen document with no `source` field, so the background's notification logic (which was gated on `msg.source === 'desktop'`) was skipped entirely. The "New Bug Capture" modal was therefore shown *only* by the content script's in-tab `waitForRecording` poll started in `performStop`. If the user navigated the recording tab while the (possibly large) video was still encoding/storing, that content script was destroyed mid-poll — modal lost, draft saved. That was the "go to Drafts and save from there" workaround.

**Fix:** Both tab and desktop recordings now flow through a single `notifyRecordingReady(tabId)` in `background.js`, called after the recording is stored:
- Re-injects `overlay.js` + `content.js` and sends `RECORDING_READY` to the recording tab.
- Falls back to the most recently active `http(s)` tab if the recording tab is gone or un-injectable.
- Opens the Drafts page only as a last resort.

`performStop` no longer shows the modal itself on success (it still handles the too-short / no-active-recording error inline) — the background drives the preview so it survives tab navigation. `DESKTOP_RECORDING_READY` was unified to `RECORDING_READY`; `showDesktopRecordingPreview` → `showStoredRecordingPreview`.

### Screenshot annotation

Added a canvas annotator to the screenshot preview modal (`overlay.js`, `createImageAnnotator`):
- Tools: pen (freehand), arrow, box, text — six colors, undo (↶), clear-all (🗑).
- Text via an inline textarea placed where the user clicks (Enter commits, Esc cancels, Shift+Enter newline).
- Annotations are kept as a shape list (cheap undo) and flattened onto the original image at full resolution; arrows/text get a dark outline for legibility.
- `showPreviewModal` passes the annotated PNG to `onCreate({ name, notes, image })`; `content.js` submits `image || cropped`. Video previews unchanged.

### Popup content-script injection fix

While testing, the popup threw `Could not establish connection. Receiving end does not exist.` Cause: reloading an unpacked extension does not re-inject manifest content scripts into already-open tabs, so `chrome.tabs.sendMessage` had no listener. Added `ensureContentScripts(tabId)` in `popup/popup.js` — injects the scripts on demand (idempotent) before screenshot selection, tab-recording start, and tab-recording stop. Restricted pages (`chrome://`, Web Store) now show a friendly message instead of the raw error.

### Commits this session
- (see git log)

---

## Session — 2026-06-23 (ECV-Branded User Manual)

Generated an ECV-branded **User Manual** for Argus via the `ecv-create-user-manual` skill (docx-js + `ecv-docx-brand` standards).

- **Output:** `docs/User-Manual-eCloudValley.docx` — Calibri, ECV palette (`1D50A2`/`409AD6`/`F39800`), embedded ECV logo, running header, cover footer (Document ID `PRJ-ARGUS-001` / Version 1.0 / Date) and confidential footer, ToC field, sign-off block. Validated: valid OOXML, no Arial, no forbidden `#00B0F0`.
- **Metadata:** User Manual · Argus · eCloudValley Technology (Philippines), Inc. · `PRJ-ARGUS-001` · v1.0 · Nino Barot, Developer · no sprint.
- **Content** sourced from `ROADMAP.md` / `QA-GUIDE.md`: Introduction, Getting Started, System Overview, Features (screenshot capture incl. new annotation tools, tab/desktop recording with floating stop pill, log capture, report creation/sharing, library, drafts, comments, owner-only description), Troubleshooting, FAQs, Glossary, Sign-off.
- **Standing decision:** keep this manual updated whenever a new Argus feature ships (bump version + add a Revision History row).
- **Confidentiality:** Project-Argus repo is public, so `docs/*.docx` is gitignored — the confidential deliverable stays local. Only `.gitignore` + this log entry are committed.

---

## Session — 2026-06-30 (New Eye Logo + Theme Match)

Rebranded to a new **Argus eye logo** (`argus logo.png`, 1024×1024) — a navy eye with circuit-trace iris and a red bug pupil.

- **Icons:** regenerated `extension/icons/icon{16,48,128}.png` + `server/public/argus-logo.png` as circular PNGs using **4× supersampling** (crop the circle at high res, then a single bicubic downscale) for a crisp, smooth result instead of the earlier pixelated single-pass mask. Generated with `jimp` (no native deps).
- **Theme matched to logo colors** across `extension/shared/theme.css`, `server/public/report.css`, and hardcoded hex in `extension/overlay.js`:
  - primary `#0099ff → #1f93d8` (eye-outline blue), hover `#1576b3`, dark `#0f5d8f`
  - accent `#00d4ff → #1cd4f5` (cyan eye-glow)
  - danger `#dc2626 → #df2b43` (the red bug)
  - new `--color-navy #07132b`; brand titles (`.brand h1`, `.brand-name`) now navy
- Source `argus logo.png` gitignored (same pattern as `Argus2.jpg`); only processed PNGs committed. `Argus-Extension.zip` rebuilt.

### User Manual refreshed to v1.1

Regenerated `docs/User-Manual-eCloudValley.docx` (kept local / gitignored) with the new branding: added the Argus eye logo as a circular product emblem on the cover (ECV corporate logo stays in the header per brand spec), bumped the version 1.0 → 1.1, and added a Revision History row. Content otherwise unchanged.
