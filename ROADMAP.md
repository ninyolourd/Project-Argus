# Argus — Roadmap

Planned features and ideas beyond the current core (Chrome extension + Node/Express server).

---

## Current State (Done)

- Chrome MV3 extension — screenshot + desktop screen recording
- Console and network log capture
- Shareable report links (hosted on Render, files on Backblaze B2)
- Library page — view, copy, delete all captures
- Drafts page — local recordings pending submission
- Commenter names — extension users get their name prefilled, guests can type theirs
- Description editing — owner-only, read-only for others
- QA distribution via `Argus-Extension.zip`

---

## Near-term — Bugs & Improvements

> Issues and enhancements on the current extension before moving to the next phase.

### Bug: Save prompt sometimes doesn't appear after recording
Recording stops but the "New Bug Capture" modal never shows. Workaround is to go to the Drafts page and save from there. Root cause has been partially addressed (content script injection on tabs opened before extension install) but still occurs in some cases.

### Screenshot annotation
Before the "New Bug Capture" modal confirms a save, users should be able to mark up the screenshot — add text labels, highlight areas, draw arrows. Freehand drawing is the minimum; shapes and text on top would be ideal.

### Floating stop widget for desktop recording
The recording-controls window currently opens as a separate Chrome window and can get lost behind other windows or buried in the taskbar. Replace it with a small floating overlay injected into the current page (similar to how Loom's stop button works) so users always know where to click to stop.

---

## Phase 1 — Accounts (Olympus SSO)

> Use Olympus's existing account management — no separate sign-up or login flow in Argus.

- Argus server validates tokens issued by Olympus (need to confirm: JWT, session cookie, OAuth, or custom)
- Extension gets the Olympus token and stores it in `chrome.storage.local`
- `argusUserName` replaced by the Olympus display name from the token
- Report ownership tied to Olympus user ID, not just `?owner=1` URL param
- "Commenting as" field fully auto-filled and disabled for authenticated users

> **Pending:** confirm Olympus auth mechanism and whether a `/me` or token-validation endpoint exists.

---

## Phase 2 — Projects & Folders

> Organise captures by project so teams can separate bugs by app or client.

### Data model

```
User (Olympus account)
└── Projects  (Athena, Olympus Core, Client X…)
    └── Bug Captures  (screenshots, recordings)
```

### What to build

- **Project CRUD** — create, rename, delete projects
- **Link grouping** — library page shows captures grouped under their project; switch projects via sidebar or tab
- **Assign on capture** — extension popup shows a project dropdown before submitting; defaults to last-used project
- **Auto-tagging via SDK** — when `argus.js` is embedded in an app (e.g. Athena), it passes a `projectId` so captures are automatically filed under the right project
- **Shared projects** — invite teammates so everyone sees the same captures
- **Link expiry** — optional per-project or per-capture expiry, max 90 days; expired links return a clear "report no longer available" page

---

## Phase 3 — Web SDK & Olympus Integration

> Add Argus to Olympus as an app tile, and embed it inside Athena — no Chrome extension required.

### `argus.js` SDK

A single script tag any web app embeds to get full Argus functionality:

```html
<script src="https://project-argus-brw6.onrender.com/sdk/argus.js"
        data-project="athena">
</script>
```

**What it provides:**
- Floating capture button (or programmatic trigger)
- Screenshot via `html2canvas` + annotation layer
- Screen recording via `getDisplayMedia`
- Console log capture via `console` monkey-patching
- Network log capture via `fetch` / `XHR` interception
- Same "New Bug Capture" modal UI
- Auto-identifies user from the Olympus session
- `data-project` attribute auto-files captures under the correct project

### Olympus integration

- Argus appears as an app tile in the Olympus dashboard (alongside Athena)
- Athena embeds `argus.js` with `data-project="athena"` — capture button lives inside the Athena UI
- Standalone Argus app in Olympus shows all captures across all projects
- Both entry points share the same server and reports

---

## Phase 4 — Collaboration & Workflow

- **Request link** — send a link asking a specific user to capture and submit a bug report (similar to Jam.dev's request feature)
- **Status tags** — mark a report as Open / In Progress / Resolved
- **Assignee field** — assign a report to a team member
- **@mentions in comments** — notify teammates via email or Slack
- **Slack / Jira integration** — post report links automatically on submit
- **Bulk actions** — select multiple reports to delete, move, or change status

---

## Notes

- Greek mythology naming convention in Olympus: Athena, Argus — keep the pattern for any new tools
- Argus server is on Render free tier — upgrade if team traffic grows
- B2 free tier: 10 GB storage, no egress fees
- Accounts (Phase 1) unlocks everything else — confirm Olympus auth details before starting
