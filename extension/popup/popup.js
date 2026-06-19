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
  namePrompt: document.getElementById('name-prompt'),
  nameInput: document.getElementById('name-input'),
  nameSaveBtn: document.getElementById('name-save-btn'),
  userBadge: document.getElementById('user-badge'),
  userNameDisplay: document.getElementById('user-name-display'),
  editNameBtn: document.getElementById('edit-name-btn'),
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

  await loadUserName();
  await refreshLogCounts();
  await loadServerUrl();
  await restoreRecordingState();

  els.modeButtons.forEach((btn) => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
  els.sourceButtons.forEach((btn) => btn.addEventListener('click', () => setRecordingSource(btn.dataset.source)));
  els.actionBtn.addEventListener('click', onActionClick);
  els.draftsLink.addEventListener('click', onOpenDrafts);
  els.libraryLink.addEventListener('click', onOpenLibrary);
  els.serverUrl.addEventListener('change', saveServerUrl);

  els.nameInput.addEventListener('input', () => {
    els.nameSaveBtn.disabled = !els.nameInput.value.trim();
  });
  els.nameSaveBtn.addEventListener('click', saveUserName);
  els.nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && els.nameInput.value.trim()) saveUserName();
  });
  els.editNameBtn.addEventListener('click', () => {
    els.nameInput.value = els.userNameDisplay.textContent;
    els.nameSaveBtn.disabled = false;
    els.namePrompt.classList.remove('hidden');
  });
}

async function loadUserName() {
  const { argusUserName } = await chrome.storage.local.get('argusUserName');
  if (!argusUserName) {
    els.namePrompt.classList.remove('hidden');
    setTimeout(() => els.nameInput.focus(), 50);
  } else {
    els.userNameDisplay.textContent = argusUserName;
  }
}

async function saveUserName() {
  const name = els.nameInput.value.trim();
  if (!name) return;
  await chrome.storage.local.set({ argusUserName: name });
  els.userNameDisplay.textContent = name;
  els.namePrompt.classList.add('hidden');
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

// Manifest content scripts are only injected on page load, so tabs that were
// already open when the extension was installed/reloaded have no listener.
// Inject the scripts on demand (idempotent) before messaging the tab.
async function ensureContentScripts(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ['overlay.js', 'content.js'],
    });
  } catch {
    throw new Error('Argus can’t run on this page. Open a normal website tab and try again.');
  }
}

async function onActionClick() {
  els.actionBtn.disabled = true;
  try {
    if (state.mode === 'screenshot') {
      await ensureContentScripts(state.tab.id);
      await chrome.tabs.sendMessage(state.tab.id, { type: 'START_SCREENSHOT_SELECTION' });
      window.close();
      return;
    }

    if (state.isRecording) {
      if (state.activeSource === 'desktop') {
        chrome.runtime.sendMessage({ type: 'STOP_DESKTOP_RECORDING', tabId: state.tab.id }).catch(() => {});
      } else {
        await ensureContentScripts(state.tab.id);
        await chrome.tabs.sendMessage(state.tab.id, { type: 'STOP_RECORDING_REQUEST' });
      }
      window.close();
      return;
    }

    // Desktop recording is handled entirely by the floating "Argus Recording"
    // window (it calls getDisplayMedia itself, which needs a user gesture in
    // that window), so no streamId is needed here for the desktop source.
    if (state.recordingSource === 'tab') {
      await ensureContentScripts(state.tab.id);
    }
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
