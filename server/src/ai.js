// AI-powered bug report generation (Roadmap Phase 1).
//
// Given a capture plus the page metadata and console/network logs, asks Claude
// to produce a structured bug report: title, description, steps to reproduce,
// and a suggested severity. Screenshots are analysed with vision; recordings
// fall back to metadata + logs (no server-side frame extraction).
//
// This is best-effort: if ANTHROPIC_API_KEY is unset or the call fails, the
// caller stores the report without AI content — generation never blocks or
// fails a submission.

const AnthropicModule = require('@anthropic-ai/sdk');
const Anthropic = AnthropicModule.default || AnthropicModule;
const { extractVideoFrames } = require('./video');

function imageBlock(buffer) {
  return {
    type: 'image',
    source: { type: 'base64', media_type: 'image/png', data: buffer.toString('base64') },
  };
}

const MODEL = 'claude-opus-4-8';
const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];

const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    stepsToReproduce: { type: 'array', items: { type: 'string' } },
    severity: { type: 'string', enum: SEVERITIES },
  },
  required: ['title', 'description', 'stepsToReproduce', 'severity'],
  additionalProperties: false,
};

const SYSTEM_PROMPT = [
  'You are a senior QA engineer helping triage a captured software bug.',
  'You are given a screenshot (or a screen-recording description), the page metadata,',
  'and the browser console and network logs collected at capture time.',
  'Write a clear, professional bug report that a developer can act on.',
  '',
  'Guidance:',
  '- title: a concise one-line summary of what is wrong (no "Bug:" prefix).',
  '- description: 2-4 sentences covering what appears to have happened, the likely',
  '  expected behaviour, and any notable signal from the logs.',
  '- stepsToReproduce: a short ordered list inferred from the page and the log/network',
  '  sequence. If the steps cannot be reliably inferred, give a best-effort minimal guess.',
  '- severity: choose exactly one of Low, Medium, High, Critical.',
  '    Critical = crash, data loss, security issue, or app entirely unusable;',
  '    High = a major feature broken with no workaround;',
  '    Medium = a feature partially broken or a clear error with a workaround;',
  '    Low = cosmetic or minor issue.',
  'Base severity on real error signals in the logs (e.g. uncaught exceptions, 4xx/5xx',
  'responses) rather than guessing. Do not invent details that are not supported by the',
  'capture, metadata, or logs.',
].join('\n');

function truncate(str, max) {
  if (typeof str !== 'string') return str;
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

// Build a compact, token-bounded text summary of the captured context.
function buildContextText({ captureType, metadata = {}, consoleLogs = [], networkLogs = [], notes, hasFrames }) {
  const lines = [];

  lines.push('## Capture');
  if (captureType === 'video') {
    lines.push(hasFrames
      ? 'A screen recording was captured. The attached images are the first and last frames of the recording (its start and end state).'
      : 'A screen recording was captured (frames not available — rely on the logs and metadata).');
  } else {
    lines.push('A screenshot was captured (see the attached image).');
  }

  lines.push('\n## Page');
  if (metadata.url) lines.push(`URL: ${metadata.url}`);
  if (metadata.title) lines.push(`Title: ${metadata.title}`);
  if (metadata.viewportWidth && metadata.viewportHeight) {
    lines.push(`Viewport: ${metadata.viewportWidth}x${metadata.viewportHeight}`);
  }
  if (metadata.userAgent) lines.push(`User agent: ${truncate(metadata.userAgent, 300)}`);

  const reporterNote = (notes || '').trim();
  if (reporterNote) {
    lines.push('\n## Reporter note');
    lines.push(truncate(reporterNote, 1000));
  }

  // Console: prioritise errors and warnings.
  const consoleSorted = [...consoleLogs].sort((a, b) => {
    const rank = (l) => (l === 'error' ? 0 : l === 'warn' ? 1 : 2);
    return rank(a.level) - rank(b.level);
  });
  const consoleShown = consoleSorted.slice(0, 30);
  lines.push(`\n## Console logs (${consoleLogs.length} total, showing ${consoleShown.length})`);
  if (consoleShown.length === 0) {
    lines.push('(none)');
  } else {
    for (const c of consoleShown) {
      lines.push(`[${(c.level || 'log').toUpperCase()}] ${truncate(String(c.message ?? ''), 400)}`);
    }
  }

  // Network: prioritise failures (errors or status >= 400).
  const isFailure = (n) => n.error || (typeof n.status === 'number' && n.status >= 400);
  const netFailures = networkLogs.filter(isFailure);
  const netShown = (netFailures.length ? netFailures : networkLogs).slice(0, 30);
  lines.push(`\n## Network requests (${networkLogs.length} total, ${netFailures.length} failed, showing ${netShown.length})`);
  if (netShown.length === 0) {
    lines.push('(none)');
  } else {
    for (const n of netShown) {
      const status = n.error ? `ERR ${n.error}` : (n.status ?? '-');
      lines.push(`${n.method || 'GET'} ${status} ${truncate(String(n.url || ''), 200)}`);
    }
  }

  lines.push('\nProduce the structured bug report now.');
  return lines.join('\n');
}

async function generateBugReport({ captureType, captureBuffer, metadata, consoleLogs, networkLogs, notes }) {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 45000,
    maxRetries: 1,
  });

  const content = [];
  let hasFrames = false;

  if (captureType === 'image' && captureBuffer) {
    content.push(imageBlock(captureBuffer));
  } else if (captureType === 'video' && captureBuffer) {
    const { first, last } = await extractVideoFrames(captureBuffer);
    if (first) {
      content.push({ type: 'text', text: 'First frame of the recording:' }, imageBlock(first));
      hasFrames = true;
    }
    if (last) {
      content.push({ type: 'text', text: 'Last frame of the recording:' }, imageBlock(last));
    }
  }

  content.push({
    type: 'text',
    text: buildContextText({ captureType, metadata, consoleLogs, networkLogs, notes, hasFrames }),
  });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: 'json_schema', schema: RESULT_SCHEMA } },
    messages: [{ role: 'user', content }],
  });

  if (response.stop_reason === 'refusal') return null;

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) return null;

  const parsed = JSON.parse(textBlock.text);
  const severity = SEVERITIES.includes(parsed.severity) ? parsed.severity : 'Medium';

  return {
    title: String(parsed.title || '').trim(),
    description: String(parsed.description || '').trim(),
    stepsToReproduce: Array.isArray(parsed.stepsToReproduce)
      ? parsed.stepsToReproduce.map((s) => String(s).trim()).filter(Boolean)
      : [],
    severity,
    model: MODEL,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { generateBugReport };
