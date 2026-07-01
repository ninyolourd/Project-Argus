// Extract still frames from a screen recording so the AI vision model can
// "see" the recording (the Claude API accepts images, not video).
//
// MediaRecorder .webm files often lack a duration/seek index, which makes
// seeking to the exact end unreliable. Instead we decode at 1 fps into a temp
// dir and take the first and last frames produced — the recording's start and
// end state, which is what the report needs. Best-effort: any failure returns
// nulls and the caller falls back to logs + metadata.

const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');

const execFileP = promisify(execFile);

async function extractVideoFrames(buffer, { maxWidth = 1280, timeoutMs = 30000 } = {}) {
  if (!ffmpegPath || !buffer || !buffer.length) return { first: null, last: null };

  let dir;
  try {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'argus-frames-'));
    const input = path.join(dir, 'input.webm');
    await fs.writeFile(input, buffer);

    await execFileP(
      ffmpegPath,
      [
        '-loglevel', 'error',
        '-i', input,
        '-vf', `fps=1,scale='min(${maxWidth},iw)':-1`,
        '-frames:v', '600', // safety cap (~10 min at 1 fps)
        '-y', path.join(dir, 'frame-%04d.png'),
      ],
      { timeout: timeoutMs, maxBuffer: 1024 * 1024 }
    );

    const files = (await fs.readdir(dir))
      .filter((f) => f.startsWith('frame-') && f.endsWith('.png'))
      .sort();
    if (files.length === 0) return { first: null, last: null };

    const first = await fs.readFile(path.join(dir, files[0]));
    const last = files.length > 1 ? await fs.readFile(path.join(dir, files[files.length - 1])) : null;
    return { first, last };
  } catch {
    return { first: null, last: null };
  } finally {
    if (dir) fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = { extractVideoFrames };
