window.ArgusOverlay = window.ArgusOverlay || (() => {
  const Z_INDEX = 2147483647;

  const STYLES = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }

    .selection-overlay {
      position: fixed; inset: 0; z-index: ${Z_INDEX};
      cursor: crosshair; background: transparent;
    }
    .selection-hint {
      position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
      background: #ffffff; color: #16161d; border: 1px solid #e6e6ef;
      border-radius: 10px; padding: 8px 14px; font-size: 13px; font-weight: 500;
      box-shadow: 0 4px 16px rgba(20,20,30,0.14);
    }
    .selection-rect {
      position: fixed; border: 2px dashed #22c55e;
      box-shadow: 0 0 0 9999px rgba(15, 16, 20, 0.45);
      pointer-events: none;
    }

    .stop-widget {
      position: fixed; bottom: 20px; right: 20px; z-index: ${Z_INDEX};
      display: flex; align-items: center; gap: 10px;
      background: #ffffff; color: #16161d; border: 1px solid #e6e6ef;
      border-radius: 999px; padding: 10px 18px 10px 14px; font-size: 13px; font-weight: 600;
      box-shadow: 0 4px 16px rgba(20,20,30,0.14); cursor: pointer; user-select: none;
      transition: box-shadow 0.15s ease, transform 0.05s ease;
    }
    .stop-widget:hover { box-shadow: 0 6px 20px rgba(20,20,30,0.18); }
    .stop-widget:active { transform: translateY(1px); }
    .stop-widget.processing { cursor: default; opacity: 0.8; }
    .stop-dot {
      width: 10px; height: 10px; border-radius: 50%; background: #dc2626;
      animation: argus-pulse 1.2s infinite; flex-shrink: 0;
    }
    @keyframes argus-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

    .modal-backdrop {
      position: fixed; inset: 0; z-index: ${Z_INDEX};
      background: rgba(20, 20, 24, 0.45);
      display: flex; align-items: center; justify-content: center;
    }
    .modal-card {
      background: #ffffff; color: #16161d; border: 1px solid #e6e6ef;
      border-radius: 14px; padding: 18px; width: min(480px, 92vw);
      max-height: 88vh; overflow: auto; box-shadow: 0 12px 32px rgba(20,20,30,0.18);
    }
    .modal-card h2 { margin: 0 0 12px; font-size: 16px; font-weight: 700; color: #15803d; }
    .modal-preview img, .modal-preview video {
      width: 100%; border-radius: 10px; display: block; margin-bottom: 12px;
      background: #000;
    }
    .modal-card textarea,
    .modal-card input[type="text"] {
      width: 100%; min-height: 60px; border-radius: 6px; border: 1px solid #e6e6ef;
      background: #f4f4f8; color: #16161d; padding: 7px 9px; resize: vertical;
      font-size: 13px; margin-bottom: 10px; transition: border-color 0.15s ease, background 0.15s ease;
    }
    .modal-card textarea:focus,
    .modal-card input[type="text"]:focus {
      outline: none; border-color: #22c55e; background: #ffffff;
    }
    .modal-card input[type="text"] {
      min-height: 0; height: 36px;
    }
    .modal-card label {
      display: block; font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.04em; color: #9a9aa8; margin-bottom: 4px;
    }
    .modal-actions { display: flex; gap: 8px; }
    .modal-actions button {
      flex: 1; padding: 10px; border: none; border-radius: 6px;
      font-weight: 600; font-size: 13px; cursor: pointer;
      transition: background 0.15s ease, transform 0.05s ease;
    }
    .modal-actions button:active:not(:disabled) { transform: translateY(1px); }
    .btn-primary { background: #22c55e; color: #ffffff; }
    .btn-primary:hover:not(:disabled) { background: #16a34a; }
    .btn-primary:disabled { background: #e6e6ef; color: #9a9aa8; cursor: not-allowed; }
    .btn-secondary { background: #f4f4f8; color: #16161d; border: 1px solid #e6e6ef; }
    .btn-secondary:hover:not(:disabled) { background: #e6e6ef; }
    .modal-status { font-size: 12px; margin-top: 8px; min-height: 16px; color: #6e6e7c; }
    .modal-status.error { color: #dc2626; }
    .modal-status.success { color: #16a34a; }
  `;

  function createHost(id) {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const host = document.createElement('div');
    host.id = id;
    document.documentElement.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLES;
    shadow.appendChild(style);
    return { host, shadow };
  }

  function startSelection(onSelect, onCancel) {
    const { host, shadow } = createHost('argus-selection-host');

    const overlay = document.createElement('div');
    overlay.className = 'selection-overlay';
    const hint = document.createElement('div');
    hint.className = 'selection-hint';
    hint.textContent = 'Drag to select an area to capture · Esc to cancel';
    const rect = document.createElement('div');
    rect.className = 'selection-rect';
    rect.style.display = 'none';

    shadow.appendChild(overlay);
    shadow.appendChild(hint);
    shadow.appendChild(rect);

    let startX = 0;
    let startY = 0;
    let dragging = false;

    function cleanup() {
      document.removeEventListener('keydown', onKeyDown);
      host.remove();
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        cleanup();
        if (onCancel) onCancel();
      }
    }

    function updateRect(x1, y1, x2, y2) {
      const left = Math.min(x1, x2);
      const top = Math.min(y1, y2);
      const width = Math.abs(x2 - x1);
      const height = Math.abs(y2 - y1);
      rect.style.display = 'block';
      rect.style.left = `${left}px`;
      rect.style.top = `${top}px`;
      rect.style.width = `${width}px`;
      rect.style.height = `${height}px`;
      return { left, top, width, height };
    }

    overlay.addEventListener('mousedown', (e) => {
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      updateRect(startX, startY, startX, startY);
    });

    overlay.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      updateRect(startX, startY, e.clientX, e.clientY);
    });

    overlay.addEventListener('mouseup', (e) => {
      if (!dragging) return;
      dragging = false;
      const selection = updateRect(startX, startY, e.clientX, e.clientY);
      if (selection.width < 10 || selection.height < 10) {
        rect.style.display = 'none';
        return;
      }
      cleanup();
      onSelect(selection);
    });

    document.addEventListener('keydown', onKeyDown);
  }

  function showStopButton(onStop) {
    const { host, shadow } = createHost('argus-stop-host');

    const widget = document.createElement('div');
    widget.className = 'stop-widget';
    widget.innerHTML = '<span class="stop-dot"></span><span class="stop-label">Stop Recording</span>';
    shadow.appendChild(widget);

    widget.addEventListener('click', () => {
      if (widget.classList.contains('processing')) return;
      onStop();
    });

    return {
      setProcessing() {
        widget.classList.add('processing');
        widget.querySelector('.stop-label').textContent = 'Processing…';
      },
      showMessage(text) {
        widget.classList.remove('processing');
        const labelEl = widget.querySelector('.stop-label');
        labelEl.textContent = text;
        setTimeout(() => {
          labelEl.textContent = 'Stop Recording';
        }, 2000);
      },
      remove() {
        host.remove();
      },
    };
  }

  function showPreviewModal({ kind, src, defaultName, onCreate }) {
    const { host, shadow } = createHost('argus-modal-host');

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const card = document.createElement('div');
    card.className = 'modal-card';

    const title = document.createElement('h2');
    title.textContent = '🐞 New Bug Capture';

    const preview = document.createElement('div');
    preview.className = 'modal-preview';
    if (kind === 'video') {
      preview.innerHTML = `<video src="${src}" controls></video>`;
    } else {
      preview.innerHTML = `<img src="${src}" alt="Screenshot preview" />`;
    }

    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Name';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Name this report';
    nameInput.value = defaultName || '';

    const notesLabel = document.createElement('label');
    notesLabel.textContent = 'Notes';
    const notes = document.createElement('textarea');
    notes.placeholder = 'What went wrong? (optional)';

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const createBtn = document.createElement('button');
    createBtn.className = 'btn-primary';
    createBtn.textContent = 'Create';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-secondary';
    cancelBtn.textContent = 'Cancel';
    actions.appendChild(createBtn);
    actions.appendChild(cancelBtn);

    const status = document.createElement('div');
    status.className = 'modal-status';

    card.appendChild(title);
    card.appendChild(preview);
    card.appendChild(nameLabel);
    card.appendChild(nameInput);
    card.appendChild(notesLabel);
    card.appendChild(notes);
    card.appendChild(actions);
    card.appendChild(status);
    backdrop.appendChild(card);
    shadow.appendChild(backdrop);

    function close() {
      host.remove();
    }

    cancelBtn.addEventListener('click', close);

    createBtn.addEventListener('click', async () => {
      createBtn.disabled = true;
      cancelBtn.disabled = true;
      status.className = 'modal-status';
      status.textContent = 'Submitting…';

      try {
        const result = await onCreate({ name: nameInput.value.trim(), notes: notes.value });
        if (!result || !result.ok) {
          throw new Error((result && result.error) || 'Submission failed');
        }
        status.className = 'modal-status success';
        status.textContent = 'Report created — link copied to clipboard!';
        setTimeout(close, 1200);
      } catch (err) {
        status.className = 'modal-status error';
        status.textContent = err.message || 'Something went wrong';
        createBtn.disabled = false;
        cancelBtn.disabled = false;
      }
    });

    return { close };
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // fall through to legacy fallback
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  return { startSelection, showStopButton, showPreviewModal, copyToClipboard };
})();
