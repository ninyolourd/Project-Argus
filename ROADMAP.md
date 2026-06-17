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

## Phase 1 — Accounts

> Without user accounts, projects have no owner and captures can't be scoped. Everything else builds on this.

### What to build

- **Sign up / log in** — email + password or SSO (Olympus session)
- **User profiles** — name, email, role (reporter / admin)
- **Session tokens** — replace the current stateless approach; auth token sent with every report submission
- **Extension auth** — the extension popup gets a "Sign in" step; token stored in `chrome.storage.local`
- **Server auth middleware** — protect report creation and deletion endpoints

### Impact on existing features

- `argusUserName` in the extension is replaced by the logged-in user's display name
- The "Commenting as" field is auto-filled from the account and fully disabled
- Report ownership is tied to the account, not just the `?owner=1` URL param

---

## Phase 2 — Projects & Folders

> Organise captures by project so teams can separate bugs by app or client.

### Data model

```
User (account)
└── Projects  (Athena, Olympus Core, Client X…)
    └── Bug Captures  (screenshots, recordings)
```

### What to build

- **Project CRUD** — create, rename, delete projects
- **Assign on capture** — extension popup shows a project dropdown before submitting; default to last-used project
- **Project library** — the library page filters by project; switch projects via a sidebar or tab
- **Auto-tagging via SDK** — when `argus.js` is embedded in an app (e.g. Athena), it passes a `projectId` config so captures are automatically filed under the right project
- **Shared projects** — invite teammates to a project so everyone sees the same captures

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
- Screenshot via `html2canvas`
- Screen recording via `getDisplayMedia` (same API the extension uses)
- Console log capture via `console` monkey-patching
- Network log capture via `fetch` / `XHR` interception
- Same "New Bug Capture" modal UI (`overlay.js` reused)
- Submits to the same server, produces the same shareable report link
- Auto-identifies user from the Olympus session (no manual name entry)
- `data-project` attribute auto-files captures under the correct project

**Differences from extension:**
- Screenshots use `html2canvas` — less accurate on cross-origin iframes
- Website owner must embed the script (doesn't auto-run on every site)

### Olympus integration

- Argus appears as an app tile in the Olympus dashboard (alongside Athena)
- Athena embeds `argus.js` with `data-project="athena"` — capture button lives inside Athena's UI
- Standalone Argus app in Olympus shows all captures across all projects in one place
- Both entry points share the same server and reports

---

## Phase 4 — Collaboration & Workflow

- **Status tags** — mark a report as Open / In Progress / Resolved
- **Assignee field** — assign a report to a team member
- **@mentions in comments** — notify teammates via email or Slack
- **Slack / Jira integration** — post report links automatically on submit
- **Capture annotations** — draw arrows or highlight areas on a screenshot before submitting
- **Bulk actions** — select multiple reports to delete, move, or change status

---

## Notes

- Greek mythology naming convention in Olympus: Athena, Argus — keep the pattern for any new tools
- Argus server is on Render free tier — upgrade if team traffic grows
- B2 free tier: 10 GB storage, no egress fees
- Accounts (Phase 1) unlocks everything else — start there
