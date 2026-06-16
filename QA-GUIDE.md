# Argus — QA Setup & Usage Guide

## Installation

1. Download and unzip `Argus-Extension.zip`
2. Open Chrome → go to `chrome://extensions`
3. Enable **Developer mode** (toggle, top right)
4. Click **Load unpacked** → select the `extension/` folder
5. The Argus icon will appear in the Chrome toolbar

---

## Capturing a Bug

1. Click the **Argus icon** in the Chrome toolbar
2. Choose **Screenshot** (📷) or **Recording** (🎥)
3. Click **Select Area to Capture** / **Start Recording**
4. Fill in the name and notes → click **Create**
5. A shareable link is automatically copied to your clipboard — paste it anywhere (Slack, Jira, email) for devs to open

---

## Viewing Your Captures

- Click the Argus icon → **All Argus** to see every report you've created
- Click **Open** to view the full report (capture + console/network logs)
- Click **Copy Link** to reshare
- Click **Delete** to remove

---

## Sharing Reports

Report links are in the format:

```
https://project-argus-brw6.onrender.com/report/<id>
```

Anyone on the team can open these links — no login required.

---

## Notes

- The first time someone opens a report link after a period of inactivity, the server may take **30–60 seconds to wake up** (Render free tier). After that it's fast.
- Captures are stored in the cloud and **auto-deleted after 60 days**.
- Screenshots and recordings are kept private — links are only shared when you copy and send them.
