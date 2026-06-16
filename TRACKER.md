# Argus — Project Tracker

A jam.dev-style bug capture tool: a Chrome (MV3) extension that captures screenshots/recordings plus console & network logs, paired with a Node/Express server that stores and renders shareable bug reports.

## Project Structure

```
extension/
  background.js            service worker
  content.js / injected.js / overlay.js   content scripts (selection, stop widget, modals)
  popup/                    action popup (capture UI)
  recording-controls/       floating recording-controls window
  drafts/                   local drafts & recordings page
  library/                   "All Argus" library page
  shared/theme.css          shared design tokens & base components
  icons/                    extension icons (16/48/128)
  offscreen.html/js         offscreen document (recording pipeline)
  manifest.json             MV3 manifest

server/
  src/index.js              Express app / routes
  src/storage.js            flat-file storage (server/data/reports/<uuid>/...)
  public/report.html|css|js  server-rendered report page
```

Server runs on `localhost:4000` by default (`cd server && npm install && npm start`). Extension is loaded unpacked via `chrome://extensions` (dev mode) — not published to the Chrome Web Store.

## Status

Actively in development. Core capture flow (screenshot + recording, console/network log collection, draft → report creation, shareable report page) is working end-to-end. Recent work has focused on visual polish/branding.

## Revision Log

### 2026-06-16 — Color rebrand: green primary, icon refresh
- Repointed `--color-primary` / `--color-primary-hover` / `--color-primary-dark` / `--color-primary-soft` from coral (`#ff6b6b` family) to green (`#22c55e` / `#16a34a` / `#15803d` / `#ecfdf5`) in `extension/shared/theme.css` and the mirrored tokens in `server/public/report.css`.
  - Makes all "positive" actions green: "Select Area to Capture", "Open" (library), "Create Report" (drafts), "Save" / "Post Comment" (report page), "Create" (in-page capture modal), brand marks, active tabs/pills, "All Argus" link, copy-link toast.
- Kept `--color-danger: #dc2626` (Delete buttons, error states) unchanged — red.
- `recording-controls.css`: recording indicator dot (`.dot.recording`) switched from primary-dark to `--color-danger`, so "recording in progress" stays red under the new green theme.
- `overlay.js`: updated hardcoded shadow-DOM style hex values (selection rectangle border, modal heading, focus borders, Create button → green; floating "Stop Recording" dot stays red `#dc2626`).
- Regenerated extension icons (`icons/icon16.png`, `icon48.png`, `icon128.png`) as a green ring (`#22c55e`), same ring/donut shape as before, via Python + Pillow.

### 2026-06-15/16 — Full UI redesign
- Introduced a shared design-token system: `extension/shared/theme.css` (linked into popup, drafts, library, recording-controls) with mirrored `:root` tokens in `server/public/report.css` (separate app, can't share the file directly).
- Tokens cover color palette, radii (`--radius-sm/md/lg/pill`), shadows (`--shadow-sm/md/lg`), and font stack.
- Shared component classes: `.brand` / `.brand-mark`, `.btn-primary` / `.btn-secondary` / `.btn-danger`, form field styles, `.field-label`, `.empty`.
- Redesigned surfaces:
  - **Popup** (`popup/`): brand header, segmented mode toggle (📷/🎥), source toggle, log counters, primary action button, link cards to Drafts/Library.
  - **Recording-controls window** (`recording-controls/`): widget layout with status dot, label, stop button, hint text.
  - **In-page overlay** (`overlay.js`): selection rectangle/hint, floating "Stop Recording" widget, "New Bug Capture" preview modal.
  - **Drafts page** (`drafts/`): card grid for local drafts/recordings.
  - **Library page** (`library/`): row list of saved reports with Open/Copy Link/Delete actions.
  - **Server report page** (`server/public/report.html` + `report.css`): topbar with brand + "All Argus" link, capture/description/comments cards, environment/console/network tabs.

### 2026-06-15 — Recording error message cutoff fix
- `recording-controls.html/css/js`: added `id="widget"` + `.widget.error` class that grows the box and wraps text, and resized the recording-controls window to 420×110 in `showError()`, fixing the previously truncated "Recording failed: Recording must b... [Close]" message.

## Open / Deferred Items

- **Deployment & storage research** — tabled by request. `server/data/reports/` is currently flat-file storage (~14MB across 14 reports, no database). Revisit free-hosting/storage options when asked.
- **Project rename** — still deciding on a Greek-mythology-themed name. Candidates discussed (gods only): Hermes, Iris, Mnemosyne, Helios, Pheme, Apollo, Hephaestus. Current name "Argus" remains until a decision is made.

## QA / Sharing Notes

- QA colleagues load `extension/` unpacked via `chrome://extensions` (dev mode) — no Web Store listing.
- Server: either run locally (`cd server && npm install && npm start`, default `localhost:4000`) or point the popup's "Server URL" field at a shared server's LAN IP.
- Reports are viewable at `http://<server>/report/<id>`.
