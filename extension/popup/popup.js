const els = {
  pageUrl: document.getElementById('page-url'),
  modeButtons: document.querySelectorAll('.mode-btn'),
  sourceToggle: document.getElementById('source-toggle'),
  sourceButtons: document.querySelectorAll('.source-btn'),
  consoleCount: document.getElementById('console-count'),
  networkCount: document.getElementById('network-count'),
  actionBtn: document.getElementById('action-btn'),
  hint: document.getElementById('hint'),
  draftsLink: document.getElementById('drafts-link'),
  libraryLink: document.getElementById('library-link'),
  serverUrl: document.getElementById('server-url'),
};

const state = {
  mode: 'screenshot',
  recordingSource: 'tab',
  tab: null,
  isRecording: false,
};

init();

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state.tab = tab;
  els.pageUrl.textContent = tab.url || '';

  await refreshLogCounts();
  await loadServerUrl();
  await restoreRecordingState();

  els.modeButtons.forEach((btn) => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
  els.sourceButtons.forEach((btn) => btn.addEventListener('click', () => setRecordingSource(btn.dataset.source)));
  els.actionBtn.addEventListener('click', onActionClick);
  els.draftsLink.addEventListener('click', onOpenDrafts);
  els.libraryLink.addEventListener('click', onOpenLibrary);
  els.serverUrl.addEventListener('change', saveServerUrl);
}

function setMode(mode) {
  if (state.isRecording) return;
  state.mode = mode;
  els.modeButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.mode === mode));
  els.sourceToggle.classList.toggle('hidden', mode !== 'recording');
  updateActionLabel();
  els.hint.textContent =
    mode === 'screenshot'
      ? 'Drag to select the area you want to capture.'
      : 'A stop button will appear on the page while recording.';
}

function setRecordingSource(source) {
  if (state.isRecording) return;
  state.recordingSource = source;
  els.sourceButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.source === source));
  updateActionLabel();
}

function updateActionLabel() {
  if (state.mode === 'screenshot') {
    els.actionBtn.textContent = 'Select Area to Capture';
    return;
  }
  els.actionBtn.textContent = state.recordingSource === 'desktop' ? 'Start Desktop Recording' : 'Start Tab Recording';
}

async function refreshLogCounts() {
  const counts = await chrome.runtime.sendMessage({ type: 'GET_LOG_COUNTS', tabId: state.tab.id });
  els.consoleCount.textContent = counts.console;
  els.networkCount.textContent = counts.network;
}

async function restoreRecordingState() {
  const { isRecording, source } = await chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATE', tabId: state.tab.id });
  if (!isRecording) {
    setMode(state.mode);
    return;
  }

  state.mode = 'recording';
  state.isRecording = true;
  state.activeSource = source;
  els.modeButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.mode === 'recording'));
  els.sourceToggle.classList.add('hidden');
  els.actionBtn.textContent = 'Stop Recording';
  els.hint.textContent = 'Click to stop and save your recording.';
}

async function onActionClick() {
  els.actionBtn.disabled = true;
  try {
    if (state.mode === 'screenshot') {
      await chrome.tabs.sendMessage(state.tab.id, { type: 'START_SCREENSHOT_SELECTION' });
      window.close();
      return;
    }

    if (state.isRecording) {
      if (state.activeSource === 'desktop') {
        chrome.runtime.sendMessage({ type: 'STOP_DESKTOP_RECORDING', tabId: state.tab.id }).catch(() => {});
      } else {
        await chrome.tabs.sendMessage(state.tab.id, { type: 'STOP_RECORDING_REQUEST' });
      }
      window.close();
      return;
    }

    // Desktop recording is handled entirely by the floating "Argus Recording"
    // window (it calls getDisplayMedia itself, which needs a user gesture in
    // that window), so no streamId is needed here for the desktop source.
    const streamId =
      state.recordingSource === 'desktop' ? null : await chrome.tabCapture.getMediaStreamId({ targetTabId: state.tab.id });

    chrome.runtime.sendMessage({
      type: 'START_RECORDING',
      tabId: state.tab.id,
      streamId,
      source: state.recordingSource,
    });
    window.close();
  } catch (err) {
    els.actionBtn.disabled = false;
    els.hint.textContent = `Failed: ${err.message}`;
  }
}

function onOpenDrafts(e) {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL('drafts/drafts.html') });
  window.close();
}

function onOpenLibrary(e) {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL('library/library.html') });
  window.close();
}

async function loadServerUrl() {
  const { serverUrl } = await chrome.storage.local.get('serverUrl');
  if (serverUrl) els.serverUrl.value = serverUrl;
}

function saveServerUrl() {
  chrome.storage.local.set({ serverUrl: els.serverUrl.value });
}
