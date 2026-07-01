const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const client = new S3Client({
  region: process.env.B2_REGION,
  endpoint: process.env.B2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APP_KEY,
  },
});

const BUCKET = process.env.B2_BUCKET;

const captureKey = (id, ext) => `reports/${id}/capture.${ext}`;
const metaKey = (id) => `reports/${id}/meta.json`;

async function createReport(id, { captureType, captureBuffer, captureExt, metadata, consoleLogs, networkLogs, notes, name, ai }) {
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: captureKey(id, captureExt),
    Body: captureBuffer,
    ContentType: captureType === 'image' ? 'image/png' : 'video/webm',
  }));

  const meta = {
    id,
    name: name || '',
    captureType,
    captureExt,
    metadata,
    consoleLogs,
    networkLogs,
    notes,
    ai: ai || null,
    comments: [],
    createdAt: new Date().toISOString(),
  };

  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: metaKey(id),
    Body: JSON.stringify(meta, null, 2),
    ContentType: 'application/json',
  }));

  return meta;
}

async function getReportMeta(id) {
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: metaKey(id) }));
    const chunks = [];
    for await (const chunk of res.Body) chunks.push(chunk);
    return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

async function updateReportMeta(id, updates) {
  const meta = await getReportMeta(id);
  if (!meta) return null;
  const updated = { ...meta, ...updates };
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: metaKey(id),
    Body: JSON.stringify(updated, null, 2),
    ContentType: 'application/json',
  }));
  return updated;
}

async function getCaptureStream(id) {
  const meta = await getReportMeta(id);
  if (!meta) return null;
  try {
    const res = await client.send(new GetObjectCommand({
      Bucket: BUCKET,
      Key: captureKey(id, meta.captureExt),
    }));
    const contentType = meta.captureType === 'image' ? 'image/png' : 'video/webm';
    return { stream: res.Body, contentType };
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

async function deleteReport(id) {
  const meta = await getReportMeta(id);
  if (!meta) return false;
  await Promise.all([
    client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: captureKey(id, meta.captureExt) })),
    client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: metaKey(id) })),
  ]);
  return true;
}

module.exports = { createReport, getReportMeta, updateReportMeta, getCaptureStream, deleteReport };
