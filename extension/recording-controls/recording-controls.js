const params = new URLSearchParams(location.search);
const tabId = Number(params.get('tabId'));

const widget = document.getElementById('widget');
const dot = document.getElementById('dot');
const label = document.getElementById('label');
const actionBtn = document.getElementById('action-btn');
const hint = document.getElementById('hint');

const MIN_RECORDING_MS = 3000;

let mediaRecorder = null;
let chunks = [];
let activeStream = null;
let recordingStartedAt = null;
let discardRecording = false;

actionBtn.onclick = startRecording;

// Once capture is running the user controls it from the in-page floating
// "Stop Recording" pill, so tuck this window out of the way.
function minimizeWindow(win) {
  hint.style.display = 'none';
  chrome.windows.update(win.id, { state: 'minimized' }).catch(() => {});
}

async function startRecording() {
  actionBtn.disabled = true;
  label.textContent = 'Choose what to share…';

  const win = await chrome.windows.getCurrent();
  await chrome.windows.update(win.id, { width: 480, height: 400 }).catch(() => {});

  let stream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      window.close();
      return;
    }
    showError(err.message);
    return;
  }

  activeStream = stream;
  chunks = [];

  minimizeWindow(win);

  stream.getVideoTracks()[0].addEventListener('ended', stopRecording);

  mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  mediaRecorder.onerror = (event) => {
    chrome.runtime.sendMessage({
      type: 'RECORDING_ERROR',
      tabId,
      error: event.error?.message || 'Recording failed unexpectedly.',
    });
  };

  mediaRecorder.onstop = async () => {
    activeStream.getTracks().forEach((track) => track.stop());
    activeStream = null;

    if (discardRecording) {
      chrome.runtime.sendMessage({ type: 'RECORDING_ERROR', tabId, error: 'Recording must be at least 3 seconds long.' });
      return;
    }

    const blob = new Blob(chunks, { type: 'video/webm' });
    const base64 = await blobToBase64(blob);

    chrome.runtime.sendMessage({
      type: 'RECORDING_DATA',
      tabId,
      base64,
      mimeType: 'video/webm',
      source: 'desktop',
    });
    window.close();
  };

  mediaRecorder.start();
  recordingStartedAt = Date.now();
  chrome.runtime.sendMessage({ type: 'RECORDING_STARTED', tabId });

  dot.classList.add('recording');
  label.textContent = 'Recording screen…';
  actionBtn.textContent = 'Stop';
  actionBtn.disabled = false;
  actionBtn.onclick = stopRecording;
}

function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return;

  if (Date.now() - recordingStartedAt < MIN_RECORDING_MS) {
    discardRecording = true;
  }

  actionBtn.disabled = true;
  actionBtn.textContent = 'Stopping…';
  label.textContent = 'Saving recording…';
  mediaRecorder.stop();
}

function showError(message) {
  dot.classList.remove('recording');
  widget.classList.add('error');
  label.textContent = `Recording failed: ${message}`;
  label.title = message;
  actionBtn.textContent = 'Close';
  actionBtn.disabled = false;
  actionBtn.onclick = () => window.close();
  chrome.windows.getCurrent().then((win) => {
    chrome.windows.update(win.id, { state: 'normal', focused: true, width: 420, height: 110 }).catch(() => {});
  });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.tabId !== tabId) return;
  if (msg.type === 'RECORDING_ERROR') {
    showError(msg.error);
  } else if (msg.type === 'STOP_DESKTOP_RECORDING') {
    stopRecording();
  }
});

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
