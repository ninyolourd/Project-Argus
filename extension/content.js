(() => {
  if (window.__argusContentLoaded) return;
  window.__argusContentLoaded = true;

  const isTopFrame = window.top === window.self;

  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('injected.js');
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || !data.source) return;

    if (data.source === 'argus-injected') {
      chrome.runtime.sendMessage({
        type: 'CONSOLE_LOG',
        entry: {
          level: data.level,
          message: data.message,
          timestamp: data.timestamp,
        },
      });
      return;
    }

    if (data.source === 'argus-report' && data.type === 'OPEN_LIBRARY') {
      chrome.runtime.sendMessage({ type: 'OPEN_LIBRARY' });
    }
  });

  function getPageInfo() {
    return {
      url: location.href,
      title: document.title,
      userAgent: navigator.userAgent,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  }

  function cropImage(dataUrl, selection) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = img.width / window.innerWidth;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(selection.width * scale);
        canvas.height = Math.round(selection.height * scale);

        const ctx = canvas.getContext('2d');
        ctx.drawImage(
          img,
          selection.left * scale,
          selection.top * scale,
          selection.width * scale,
          selection.height * scale,
          0,
          0,
          canvas.width,
          canvas.height
        );
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  function submitReport(payload) {
    return chrome.runtime.sendMessage({ type: 'SUBMIT_REPORT', ...payload });
  }

  function waitForNextPaint() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }

  async function waitForRecording(attempts = 30, tabId = null) {
    for (let i = 0; i < attempts; i++) {
      const rec = await chrome.runtime.sendMessage({ type: 'GET_RECORDING', tabId });
      if (rec) return rec;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return null;
  }

  async function handleScreenshotFlow() {
    window.ArgusOverlay.startSelection(async (selection) => {
      await waitForNextPaint();
      const { dataUrl: fullDataUrl } = await chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' });
      const cropped = await cropImage(fullDataUrl, selection);

      window.ArgusOverlay.showPreviewModal({
        kind: 'image',
        src: cropped,
        defaultName: `Screenshot - ${document.title}`,
        onCreate: async ({ name, notes }) => {
          const result = await submitReport({
            captureType: 'image',
            dataUrl: cropped,
            name,
            notes,
            metadata: getPageInfo(),
          });
          if (result.ok) await window.ArgusOverlay.copyToClipboard(result.url);
          return result;
        },
      });
    });
  }

  let stopWidget = null;

  function showRecordingPreview(rec) {
    window.ArgusOverlay.showPreviewModal({
      kind: 'video',
      src: `data:${rec.mimeType};base64,${rec.base64}`,
      defaultName: `Recording - ${document.title}`,
      onCreate: async ({ name, notes }) => {
        const result = await submitReport({
          captureType: 'video',
          base64: rec.base64,
          mimeType: rec.mimeType,
          name,
          notes,
          metadata: getPageInfo(),
          clearRecording: true,
        });
        if (result.ok) await window.ArgusOverlay.copyToClipboard(result.url);
        return result;
      },
    });
  }

  async function performStop() {
    if (stopWidget) stopWidget.setProcessing();
    const result = await chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
    if (result && result.ok === false) {
      if (stopWidget) {
        stopWidget.showMessage(result.error);
        const widget = stopWidget;
        stopWidget = null;
        setTimeout(() => widget.remove(), 2000);
      }
      return;
    }

    const rec = await waitForRecording();
    if (stopWidget) {
      stopWidget.remove();
      stopWidget = null;
    }

    if (!rec) return;
    showRecordingPreview(rec);
  }

  async function showDesktopRecordingPreview(recordingTabId = null) {
    const rec = await waitForRecording(30, recordingTabId);
    if (rec) showRecordingPreview(rec);
  }

  function showRecordingControls() {
    if (stopWidget) return;
    stopWidget = window.ArgusOverlay.showStopButton(performStop);
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GET_PAGE_INFO') {
      sendResponse(getPageInfo());
      return false;
    }
    if (msg.type === 'START_SCREENSHOT_SELECTION') {
      if (isTopFrame) handleScreenshotFlow();
      return false;
    }
    if (msg.type === 'SHOW_RECORDING_CONTROLS') {
      if (isTopFrame) showRecordingControls();
      return false;
    }
    if (msg.type === 'STOP_RECORDING_REQUEST') {
      if (isTopFrame) performStop();
      return false;
    }
    if (msg.type === 'DESKTOP_RECORDING_READY') {
      if (isTopFrame) showDesktopRecordingPreview(msg.recordingTabId ?? null);
      return false;
    }
    if (msg.type === 'RECORDING_ERROR') {
      if (isTopFrame && stopWidget) {
        stopWidget.remove();
        stopWidget = null;
      }
      return false;
    }
    return false;
  });

  if (isTopFrame) {
    chrome.runtime
      .sendMessage({ type: 'GET_RECORDING_STATE' })
      .then(({ isRecording, source }) => {
        if (isRecording && source !== 'desktop') showRecordingControls();
      })
      .catch(() => {});
  }
})();
