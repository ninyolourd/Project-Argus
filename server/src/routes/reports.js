const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const { createReport, getReportMeta, getCaptureStream, updateReportMeta, deleteReport } = require('../storage');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024, fieldSize: 50 * 1024 * 1024 } });

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

router.post('/reports', upload.single('capture'), async (req, res) => {
  const { captureType, notes, name } = req.body;

  if (!req.file || (captureType !== 'image' && captureType !== 'video')) {
    return res.status(400).json({ error: 'Missing or invalid capture' });
  }

  const id = crypto.randomUUID();
  const captureExt = captureType === 'image' ? 'png' : 'webm';

  try {
    const meta = await createReport(id, {
      captureType,
      captureBuffer: req.file.buffer,
      captureExt,
      metadata: parseJson(req.body.metadata, {}),
      consoleLogs: parseJson(req.body.consoleLogs, []),
      networkLogs: parseJson(req.body.networkLogs, []),
      notes: notes || '',
      name: name || '',
    });
    res.json({ id: meta.id, url: `/report/${meta.id}` });
  } catch (err) {
    console.error('createReport failed:', err);
    res.status(500).json({ error: 'Failed to save report' });
  }
});

router.get('/reports/:id', async (req, res) => {
  try {
    const meta = await getReportMeta(req.params.id);
    if (!meta) return res.status(404).json({ error: 'Report not found' });
    res.json(meta);
  } catch (err) {
    console.error('getReportMeta failed:', err);
    res.status(500).json({ error: 'Failed to load report' });
  }
});

router.patch('/reports/:id', async (req, res) => {
  try {
    const meta = await getReportMeta(req.params.id);
    if (!meta) return res.status(404).json({ error: 'Report not found' });

    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.notes !== undefined) updates.notes = req.body.notes;

    const updated = await updateReportMeta(req.params.id, updates);
    res.json(updated);
  } catch (err) {
    console.error('updateReportMeta failed:', err);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

router.post('/reports/:id/comments', async (req, res) => {
  try {
    const meta = await getReportMeta(req.params.id);
    if (!meta) return res.status(404).json({ error: 'Report not found' });

    const text = (req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Comment text is required' });

    const comment = { text, createdAt: new Date().toISOString() };
    const comments = [...(meta.comments || []), comment];
    const updated = await updateReportMeta(req.params.id, { comments });
    res.json(updated);
  } catch (err) {
    console.error('addComment failed:', err);
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

router.delete('/reports/:id', async (req, res) => {
  try {
    const meta = await getReportMeta(req.params.id);
    if (!meta) return res.json({ ok: true });
    await deleteReport(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('deleteReport failed:', err);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

router.get('/reports/:id/capture', async (req, res) => {
  try {
    const capture = await getCaptureStream(req.params.id);
    if (!capture) return res.status(404).json({ error: 'Report not found' });
    res.setHeader('Content-Type', capture.contentType);
    capture.stream.pipe(res);
  } catch (err) {
    console.error('getCaptureStream failed:', err);
    res.status(500).json({ error: 'Failed to load capture' });
  }
});

module.exports = router;
