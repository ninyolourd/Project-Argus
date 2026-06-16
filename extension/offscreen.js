const MIN_RECORDING_MS = 3000;

let mediaRecorder = null;
let chunks = [];
let activeStream = null;
let recordingTabId = null;
let recordingStartedAt = null;
let discardRecording = false;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'OFFSCREEN_START') {
    startCapture(msg.streamId, msg.tabId).catch((err) => {
      chrome.runtime.sendMessage({ type: 'RECORDING_ERROR', tabId: msg.tabId, error: err.message });
    });
  } else if (msg.type === 'OFFSCREEN_STOP') {
    sendResponse(requestStop());
  }
});

function getUserMediaWithTimeout(constraints, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timed out waiting for screen capture to start.'));
    }, timeoutMs);

    navigator.mediaDevices.getUserMedia(constraints).then(
      (stream) => {
        clearTimeout(timer);
        resolve(stream);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function startCapture(streamId, tabId) {
  recordingTabId = tabId;
  chunks = [];

  activeStream = await getUserMediaWithTimeout({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
      },
    },
  });

  activeStream.getVideoTracks()[0].addEventListener('ended', handleStreamEnded);

  mediaRecorder = new MediaRecorder(activeStream, { mimeType: 'video/webm' });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  mediaRecorder.onerror = (event) => {
    chrome.runtime.sendMessage({
      type: 'RECORDING_ERROR',
      tabId: recordingTabId,
      error: event.error?.message || 'Recording failed unexpectedly.',
    });
  };

  mediaRecorder.onstop = async () => {
    activeStream.getTracks().forEach((track) => track.stop());
    activeStream = null;

    if (discardRecording) {
      discardRecording = false;
      return;
    }

    const blob = new Blob(chunks, { type: 'video/webm' });
    const base64 = await blobToBase64(blob);

    chrome.runtime.sendMessage({
      type: 'RECORDING_DATA',
      tabId: recordingTabId,
      base64,
      mimeType: 'video/webm',
    });
  };

  mediaRecorder.start();
  recordingStartedAt = Date.now();
}

function requestStop() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    return { ok: false, error: 'No active recording to stop.' };
  }
  if (Date.now() - recordingStartedAt < MIN_RECORDING_MS) {
    discardRecording = true;
    mediaRecorder.stop();
    return { ok: false, error: 'Recording must be at least 3 seconds long.' };
  }
  mediaRecorder.stop();
  return { ok: true };
}

function handleStreamEnded() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
  if (Date.now() - recordingStartedAt < MIN_RECORDING_MS) {
    discardRecording = true;
    mediaRecorder.stop();
    chrome.runtime.sendMessage({
      type: 'RECORDING_ERROR',
      tabId: recordingTabId,
      error: 'Recording must be at least 3 seconds long.',
    });
    return;
  }
  mediaRecorder.stop();
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
