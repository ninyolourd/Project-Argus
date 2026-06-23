# Argus

Argus is a bug-capture tool that lets anyone report a software defect in seconds. From any web page you can grab a **screenshot** or a **screen recording** together with the browser's **console and network logs**, then generate a single **shareable link** that developers can open to see exactly what went wrong.

## What it does

- **Screenshot capture** with built-in annotation (pen, arrow, box, text)
- **Screen recording** — tab or full desktop, with a floating stop control
- **Console & network log capture** attached automatically to every report
- **Shareable report links** — no login required to view
- **Library & drafts** — manage your captures and finish pending recordings
- **Comments** on each report for in-context discussion

## How it's built

| Layer | Technology |
|---|---|
| Extension | Chrome MV3 (JavaScript) — background worker, content scripts, popup, offscreen document |
| Server | Node.js + Express (REST API) |
| Storage | Backblaze B2 (capture files + metadata as objects; no database) |
| Hosting | Render |

Argus is a mini app with Chrome extension capabilities, planned for integration into **Hephaestus**, eCloudValley's internal platform, as a standalone app tile.

## Getting started

See [QA-GUIDE.md](QA-GUIDE.md) for installation and usage. The product roadmap and current state live in [ROADMAP.md](ROADMAP.md).
