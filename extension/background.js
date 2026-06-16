const MAX_LOG_ENTRIES = 200;

const RECORDINGS_DB_NAME = 'argus-recordings';
const RECORDINGS_STORE = 'recordings';

const REPORT_HISTORY_KEY = 'reportHistory';
const MAX_REPORT_HISTORY = 200;

const tabLogs = new Map();
const activeRecordings = new Map();
const attachedDebuggers = new Set();
const recordingControlWindows = new Map();
const RESPONSE_BODY_LIMIT = 100000;

function closeRecordingControls(tabId) {
  const windowId = recordingControlWindows.get(tabId);
  if (windowId == null) return;
  recordingControlWindows.delete(tabId);
  chrome.windows.remove(windowId).catch(() => {});
}

chrome.windows.onRemoved.addListener((windowId) => {
  for (const [tabId, winId] of recordingControlWindows) {
    if (winId === windowId) {
      recordingControlWindows.delete(tabId);
      activeRecordings.delete(tabId);
    }
  }
});

function openRecordingsDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(RECORDINGS_DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(RECORDINGS_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putRecording(tabId, value) {
  const db = await openRecordingsDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECORDINGS_STORE, 'readwrite');
    tx.objectStore(RECORDINGS_STORE).put(value, tabId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getRecording(tabId) {
  const db = await openRecordingsDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECORDINGS_STORE, 'readonly');
    const req = tx.objectStore(RECORDINGS_STORE).get(tabId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function deleteRecording(tabId) {
  const db = await openRecordingsDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECORDINGS_STORE, 'readwrite');
    tx.objectStore(RECORDINGS_STORE).delete(tabId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllRecordings() {
  const db = await openRecordingsDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECORDINGS_STORE, 'readonly');
    const store = tx.objectStore(RECORDINGS_STORE);
    const results = [];
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve(results);
        return;
      }
      results.push({ tabId: cursor.key, ...cursor.value });
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

function base64ToBlob(base64, mimeType) {
  const byteChars = atob(base64);
  const byteNumbers = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  return new Blob([byteNumbers], { type: mimeType });
}

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

async function addToReportHistory(entry) {
  const { [REPORT_HISTORY_KEY]: history = [] } = await chrome.storage.local.get(REPORT_HISTORY_KEY);
  history.unshift(entry);
  if (history.length > MAX_REPORT_HISTORY) history.length = MAX_REPORT_HISTORY;
  await chrome.storage.local.set({ [REPORT_HISTORY_KEY]: history });
}

function getTabState(tabId) {
  if (!tabLogs.has(tabId)) {
    tabLogs.set(tabId, { console: [], network: [] });
  }
  return tabLogs.get(tabId);
}

function pushBounded(arr, entry) {
  arr.push(entry);
  if (arr.length > MAX_LOG_ENTRIES) arr.shift();
}

function serializeRequestBody(requestBody) {
  if (!requestBody) return null;
  if (requestBody.error) return { error: requestBody.error };
  if (requestBody.formData) return { formData: requestBody.formData };
  if (requestBody.raw) {
    try {
      const decoder = new TextDecoder('utf-8');
      const text = requestBody.raw
        .filter((part) => part.bytes)
        .map((part) => decoder.decode(part.bytes))
        .join('');
      return { raw: text };
    } catch {
      return { raw: '[binary data]' };
    }
  }
  return null;
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId < 0) return;
    pushBounded(getTabState(details.tabId).network, {
      requestId: details.requestId,
      url: details.url,
      method: details.method,
      type: details.type,
      timeStamp: details.timeStamp,
      status: null,
      duration: null,
      requestBody: serializeRequestBody(details.requestBody),
    });
  },
  { urls: ['<all_urls>'] },
  ['requestBody']
);

chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    if (details.tabId < 0) return;
    const entry = getTabState(details.tabId).network.find((e) => e.requestId === details.requestId);
    if (entry) entry.requestHeaders = details.requestHeaders || [];
  },
  { urls: ['<all_urls>'] },
  ['requestHeaders']
);

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.tabId < 0) return;
    const entry = getTabState(details.tabId).network.find((e) => e.requestId === details.requestId);
    if (entry) entry.responseHeaders = details.responseHeaders || [];
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.tabId < 0) return;
    const entry = getTabState(details.tabId).network.find((e) => e.requestId === details.requestId);
    if (entry) {
      entry.status = details.statusCode;
      entry.duration = Math.round(details.timeStamp - entry.timeStamp);
    }
  },
  { urls: ['<all_urls>'] }
);

chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    if (details.tabId < 0) return;
    const entry = getTabState(details.tabId).network.find((e) => e.requestId === details.requestId);
    if (entry) {
      entry.error = details.error;
      entry.duration = Math.round(details.timeStamp - entry.timeStamp);
    }
  },
  { urls: ['<all_urls>'] }
);

async function attachDebugger(tabId) {
  if (attachedDebuggers.has(tabId)) return;
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!/^https?:/.test(tab.url || '')) return;
    await chrome.debugger.attach({ tabId }, '1.3');
    attachedDebuggers.add(tabId);
    await chrome.debugger.sendCommand({ tabId }, 'Network.enable');
  } catch {
    // Response body capture is best-effort; some tabs (e.g. other
    // extensions' pages) can't be debugged and that's fine.
  }
}

async function detachDebugger(tabId) {
  if (!attachedDebuggers.has(tabId)) return;
  attachedDebuggers.delete(tabId);
  try {
    await chrome.debugger.detach({ tabId });
  } catch {
    // already detached
  }
}

chrome.debugger.onEvent.addListener((source, method, params) => {
  if (method !== 'Network.loadingFinished') return;
  const tabId = source.tabId;
  if (tabId == null || !attachedDebuggers.has(tabId)) return;

  chrome.debugger.sendCommand({ tabId }, 'Network.getResponseBody', { requestId: params.requestId }, (result) => {
    if (chrome.runtime.lastError || !result) return;
    const entry = getTabState(tabId).network.find((e) => e.requestId === params.requestId);
    if (!entry) return;

    let body = result.body || '';
    if (body.length > RESPONSE_BODY_LIMIT) {
      body = body.slice(0, RESPONSE_BODY_LIMIT);
      entry.responseBodyTruncated = true;
    }
    entry.responseBody = body;
    entry.responseBodyBase64 = result.base64Encoded;
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabLogs.delete(tabId);
  activeRecordings.delete(tabId);
  detachDebugger(tabId);
  closeRecordingControls(tabId);
  deleteRecording(tabId).catch(console.error);
});

async function ensureOffscreenDocument() {
  const existing = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (existing.length > 0) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'Recording the active tab for a bug report',
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'CONSOLE_LOG': {
      const tabId = sender.tab?.id;
      if (tabId != null) {
        pushBounded(getTabState(tabId).console, msg.entry);
      }
      return false;
    }

    case 'GET_LOG_COUNTS': {
      const tabId = msg.tabId ?? sender.tab?.id;
      const state = getTabState(tabId);
      sendResponse({ console: state.console.length, network: state.network.length });
      return false;
    }

    case 'GET_LOGS': {
      const tabId = msg.tabId ?? sender.tab?.id;
      const state = getTabState(tabId);
      sendResponse({ console: state.console, network: state.network });
      return false;
    }

    case 'CAPTURE_SCREENSHOT': {
      chrome.tabs.captureVisibleTab(sender.tab?.windowId, { format: 'png' }, (dataUrl) => {
        sendResponse({ dataUrl });
      });
      return true;
    }

    case 'START_RECORDING': {
      const tabId = msg.tabId ?? sender.tab?.id;
      const source = msg.source || 'tab';

      if (source === 'desktop') {
        (async () => {
          try {
            if (recordingControlWindows.has(tabId)) {
              sendResponse({ ok: true });
              return;
            }
            await deleteRecording(tabId);
            // Starts as a small bar; recording-controls.js temporarily grows
            // the window to fit the "Choose what to share" picker, then
            // shrinks it back down once capture starts.
            const win = await chrome.windows.create({
              url: chrome.runtime.getURL(`recording-controls/recording-controls.html?tabId=${tabId}`),
              type: 'popup',
              focused: true,
              width: 360,
              height: 96,
            });
            recordingControlWindows.set(tabId, win.id);
            sendResponse({ ok: true });
          } catch (err) {
            sendResponse({ ok: false, error: err.message });
          }
        })();
        return true;
      }

      activeRecordings.set(tabId, source);
      (async () => {
        try {
          const streamId = msg.streamId;
          await deleteRecording(tabId);
          await ensureOffscreenDocument();
          await chrome.runtime.sendMessage({ type: 'OFFSCREEN_START', streamId, tabId });
          attachDebugger(tabId);
          chrome.tabs.sendMessage(tabId, { type: 'SHOW_RECORDING_CONTROLS' }).catch(() => {});
          sendResponse({ ok: true });
        } catch (err) {
          activeRecordings.delete(tabId);
          sendResponse({ ok: false, error: err.message });
        }
      })();
      return true;
    }

    case 'RECORDING_STARTED': {
      const tabId = msg.tabId;
      activeRecordings.set(tabId, 'desktop');
      attachDebugger(tabId);
      return false;
    }

    case 'STOP_RECORDING': {
      const tabId = msg.tabId ?? sender.tab?.id;
      chrome.runtime.sendMessage({ type: 'OFFSCREEN_STOP', tabId }).then((result) => {
        if (!result || result.ok === false) activeRecordings.delete(tabId);
        sendResponse(result || { ok: true });
      });
      return true;
    }

    case 'RECORDING_ERROR': {
      const tabId = msg.tabId;
      activeRecordings.delete(tabId);
      recordingControlWindows.delete(tabId);
      chrome.runtime.sendMessage({ type: 'RECORDING_ERROR', tabId, error: msg.error }).catch(() => {});
      chrome.tabs.sendMessage(tabId, { type: 'RECORDING_ERROR', error: msg.error }).catch(() => {});
      return false;
    }

    case 'RECORDING_DATA': {
      const tabId = msg.tabId;
      activeRecordings.delete(tabId);
      closeRecordingControls(tabId);
      (async () => {
        let metadata = null;
        try {
          metadata = await chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_INFO' });
        } catch {
          const tab = await chrome.tabs.get(tabId).catch(() => null);
          if (tab) metadata = { url: tab.url, title: tab.title };
        }
        const state = getTabState(tabId);
        await putRecording(tabId, {
          base64: msg.base64,
          mimeType: msg.mimeType,
          metadata: metadata || {},
          consoleLogs: state.console.slice(),
          networkLogs: state.network.slice(),
          capturedAt: new Date().toISOString(),
        });
        setTimeout(() => detachDebugger(tabId), 1000);
        if (msg.source === 'desktop') {
          chrome.tabs.sendMessage(tabId, { type: 'DESKTOP_RECORDING_READY' }).catch(() => {});
        }
      })().catch(console.error);
      return false;
    }

    case 'GET_RECORDING': {
      const tabId = msg.tabId ?? sender.tab?.id;
      getRecording(tabId)
        .then(sendResponse)
        .catch(() => sendResponse(null));
      return true;
    }

    case 'GET_RECORDING_STATE': {
      const tabId = msg.tabId ?? sender.tab?.id;
      sendResponse({ isRecording: activeRecordings.has(tabId), source: activeRecordings.get(tabId) });
      return false;
    }

    case 'CLEAR_RECORDING': {
      const tabId = msg.tabId ?? sender.tab?.id;
      deleteRecording(tabId).catch(console.error);
      return false;
    }

    case 'OPEN_LIBRARY': {
      chrome.tabs.create({ url: chrome.runtime.getURL('library/library.html') });
      return false;
    }

    case 'GET_ALL_RECORDINGS': {
      getAllRecordings()
        .then(sendResponse)
        .catch(() => sendResponse([]));
      return true;
    }

    case 'GET_REPORT_HISTORY': {
      chrome.storage.local
        .get(REPORT_HISTORY_KEY)
        .then((res) => sendResponse(res[REPORT_HISTORY_KEY] || []))
        .catch(() => sendResponse([]));
      return true;
    }

    case 'UPDATE_REPORT_NAME': {
      (async () => {
        try {
          const { serverUrl } = await chrome.storage.local.get('serverUrl');
          const base = (serverUrl || 'https://project-argus-brw6.onrender.com').replace(/\/+$/, '');

          const res = await fetch(`${base}/api/reports/${msg.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: msg.name }),
          });
          if (!res.ok) throw new Error(`Server responded with ${res.status}`);

          const { [REPORT_HISTORY_KEY]: history = [] } = await chrome.storage.local.get(REPORT_HISTORY_KEY);
          const entry = history.find((h) => h.id === msg.id);
          if (entry) entry.name = msg.name;
          await chrome.storage.local.set({ [REPORT_HISTORY_KEY]: history });

          sendResponse({ ok: true });
        } catch (err) {
          sendResponse({ ok: false, error: err.message });
        }
      })();
      return true;
    }

    case 'DELETE_REPORT': {
      (async () => {
        try {
          const { serverUrl } = await chrome.storage.local.get('serverUrl');
          const base = (serverUrl || 'https://project-argus-brw6.onrender.com').replace(/\/+$/, '');

          const res = await fetch(`${base}/api/reports/${msg.id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error(`Server responded with ${res.status}`);

          const { [REPORT_HISTORY_KEY]: history = [] } = await chrome.storage.local.get(REPORT_HISTORY_KEY);
          const filtered = history.filter((h) => h.id !== msg.id);
          await chrome.storage.local.set({ [REPORT_HISTORY_KEY]: filtered });

          sendResponse({ ok: true });
        } catch (err) {
          sendResponse({ ok: false, error: err.message });
        }
      })();
      return true;
    }

    case 'SUBMIT_REPORT': {
      (async () => {
        try {
          const tabId = sender.tab?.id ?? msg.tabId;
          let captureType = msg.captureType;
          let dataUrl = msg.dataUrl;
          let base64 = msg.base64;
          let mimeType = msg.mimeType;
          let metadata = msg.metadata;
          let consoleLogs;
          let networkLogs;

          if (msg.useStoredRecording) {
            const rec = await getRecording(tabId);
            if (!rec) throw new Error('Recording not found');
            captureType = 'video';
            base64 = rec.base64;
            mimeType = rec.mimeType;
            metadata = rec.metadata || metadata;
            consoleLogs = rec.consoleLogs || [];
            networkLogs = rec.networkLogs || [];
          } else {
            const state = getTabState(tabId);
            consoleLogs = state.console;
            networkLogs = state.network;
          }

          const { serverUrl } = await chrome.storage.local.get('serverUrl');
          const base = (serverUrl || 'https://project-argus-brw6.onrender.com').replace(/\/+$/, '');

          const formData = new FormData();
          formData.append('name', msg.name || '');
          formData.append('notes', msg.notes || '');
          formData.append('metadata', JSON.stringify(metadata || {}));
          formData.append('consoleLogs', JSON.stringify(consoleLogs || []));
          formData.append('networkLogs', JSON.stringify(networkLogs || []));

          if (captureType === 'image') {
            formData.append('captureType', 'image');
            formData.append('capture', await dataUrlToBlob(dataUrl), 'capture.png');
          } else {
            formData.append('captureType', 'video');
            formData.append('capture', base64ToBlob(base64, mimeType), 'capture.webm');
          }

          const res = await fetch(`${base}/api/reports`, { method: 'POST', body: formData });
          if (!res.ok) throw new Error(`Server responded with ${res.status}`);
          const data = await res.json();
          const fullUrl = `${base}${data.url}`;

          if (msg.clearRecording && tabId != null) {
            await deleteRecording(tabId);
            activeRecordings.delete(tabId);
          }

          await addToReportHistory({
            id: data.id,
            url: fullUrl,
            name: msg.name || (metadata && metadata.title) || (metadata && metadata.url) || 'Untitled',
            pageTitle: (metadata && metadata.title) || '',
            pageUrl: (metadata && metadata.url) || '',
            captureType,
            createdAt: new Date().toISOString(),
          });

          chrome.tabs.create({ url: `${fullUrl}?created=1` });
          sendResponse({ ok: true, url: fullUrl });
        } catch (err) {
          sendResponse({ ok: false, error: err.message });
        }
      })();
      return true;
    }

    default:
      return false;
  }
});
