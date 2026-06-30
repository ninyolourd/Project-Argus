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
      position: fixed; border: 2px dashed #1f93d8;
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
      width: 10px; height: 10px; border-radius: 50%; background: #df2b43;
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
    .modal-card h2 { margin: 0 0 12px; font-size: 16px; font-weight: 700; color: #0f5d8f; }
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
      outline: none; border-color: #1f93d8; background: #ffffff;
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
    .btn-primary { background: #1f93d8; color: #ffffff; }
    .btn-primary:hover:not(:disabled) { background: #1576b3; }
    .btn-primary:disabled { background: #e6e6ef; color: #9a9aa8; cursor: not-allowed; }
    .btn-secondary { background: #f4f4f8; color: #16161d; border: 1px solid #e6e6ef; }
    .btn-secondary:hover:not(:disabled) { background: #e6e6ef; }
    .modal-status { font-size: 12px; margin-top: 8px; min-height: 16px; color: #6e6e7c; }
    .modal-status.error { color: #df2b43; }
    .modal-status.success { color: #1576b3; }

    .annot-toolbar {
      display: flex; flex-wrap: wrap; align-items: center; gap: 5px; margin-bottom: 8px;
    }
    .annot-tool {
      min-width: 30px; height: 28px; padding: 0 6px; border: 1px solid #e6e6ef;
      background: #f4f4f8; color: #16161d; border-radius: 6px; cursor: pointer;
      font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center;
    }
    .annot-tool:hover { background: #e6e6ef; }
    .annot-tool.active { background: #1f93d8; color: #ffffff; border-color: #1f93d8; }
    .annot-sep { width: 1px; height: 20px; background: #e6e6ef; margin: 0 3px; }
    .annot-color {
      width: 18px; height: 18px; border-radius: 50%; cursor: pointer;
      border: 2px solid transparent; padding: 0;
    }
    .annot-color.active { border-color: #16161d; }
    .annot-canvas-wrap { position: relative; line-height: 0; margin-bottom: 12px; }
    .annot-canvas {
      width: 100%; border-radius: 10px; display: block; background: #000;
      cursor: crosshair; touch-action: none;
    }
    .annot-text-input {
      position: absolute; border: 1px dashed #1f93d8; background: rgba(255,255,255,0.9);
      font-weight: 700; padding: 1px 3px; outline: none; resize: none; overflow: hidden;
      line-height: 1.2; white-space: pre; min-width: 28px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
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

  // Lightweight canvas annotator for screenshots: pen, arrow, box, and text
  // in a few colors, with undo/clear. Returns the element to mount plus a
  // toDataURL() that flattens the annotations onto the original image.
  function createImageAnnotator(src) {
    const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#1f93d8', '#16161d', '#ffffff'];
    const TOOLS = [
      { id: 'pen', label: '✏️', title: 'Pen' },
      { id: 'arrow', label: '↗', title: 'Arrow' },
      { id: 'rect', label: '▭', title: 'Box' },
      { id: 'text', label: 'T', title: 'Text' },
    ];

    let color = COLORS[0];
    let tool = 'pen';
    let ready = false;
    let current = null;
    let textInput = null;
    const shapes = [];
    const img = new Image();

    const wrap = document.createElement('div');

    const toolbar = document.createElement('div');
    toolbar.className = 'annot-toolbar';

    const toolBtns = {};
    TOOLS.forEach((t) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'annot-tool' + (t.id === tool ? ' active' : '');
      b.textContent = t.label;
      b.title = t.title;
      b.addEventListener('click', () => setTool(t.id));
      toolbar.appendChild(b);
      toolBtns[t.id] = b;
    });

    const sep1 = document.createElement('span');
    sep1.className = 'annot-sep';
    toolbar.appendChild(sep1);

    const colorBtns = {};
    COLORS.forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'annot-color' + (c === color ? ' active' : '');
      b.style.background = c;
      if (c === '#ffffff') b.style.borderColor = '#e6e6ef';
      b.title = c;
      b.addEventListener('click', () => setColor(c));
      toolbar.appendChild(b);
      colorBtns[c] = b;
    });

    const sep2 = document.createElement('span');
    sep2.className = 'annot-sep';
    toolbar.appendChild(sep2);

    const undoBtn = document.createElement('button');
    undoBtn.type = 'button';
    undoBtn.className = 'annot-tool';
    undoBtn.textContent = '↶';
    undoBtn.title = 'Undo';
    undoBtn.addEventListener('click', () => {
      commitText();
      shapes.pop();
      redraw();
    });

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'annot-tool';
    clearBtn.textContent = '🗑';
    clearBtn.title = 'Clear all';
    clearBtn.addEventListener('click', () => {
      commitText();
      shapes.length = 0;
      redraw();
    });

    toolbar.appendChild(undoBtn);
    toolbar.appendChild(clearBtn);

    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'annot-canvas-wrap';
    const canvas = document.createElement('canvas');
    canvas.className = 'annot-canvas';
    const ctx = canvas.getContext('2d');
    canvasWrap.appendChild(canvas);

    wrap.appendChild(toolbar);
    wrap.appendChild(canvasWrap);

    function setTool(id) {
      commitText();
      tool = id;
      Object.entries(toolBtns).forEach(([k, b]) => b.classList.toggle('active', k === id));
    }

    function setColor(c) {
      color = c;
      Object.entries(colorBtns).forEach(([k, b]) => b.classList.toggle('active', k === c));
    }

    function lineWidth() {
      return Math.max(2, Math.round(canvas.width / 350));
    }

    function fontSize() {
      return Math.max(14, Math.round(canvas.width / 38));
    }

    function pos(e) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height),
      };
    }

    function drawArrow(g, x0, y0, x1, y1, w) {
      const head = Math.max(8, w * 4);
      const ang = Math.atan2(y1 - y0, x1 - x0);
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x1 - head * Math.cos(ang - Math.PI / 6), y1 - head * Math.sin(ang - Math.PI / 6));
      g.lineTo(x1 - head * Math.cos(ang + Math.PI / 6), y1 - head * Math.sin(ang + Math.PI / 6));
      g.closePath();
      g.fill();
    }

    function drawShape(g, s) {
      g.strokeStyle = s.color;
      g.fillStyle = s.color;
      g.lineWidth = s.width;
      g.lineJoin = 'round';
      g.lineCap = 'round';
      if (s.type === 'pen') {
        g.beginPath();
        s.points.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
        g.stroke();
      } else if (s.type === 'rect') {
        g.strokeRect(s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0);
      } else if (s.type === 'arrow') {
        drawArrow(g, s.x0, s.y0, s.x1, s.y1, s.width);
      } else if (s.type === 'text') {
        g.font = `700 ${s.size}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
        g.textBaseline = 'top';
        g.lineWidth = Math.max(2, s.size / 8);
        g.strokeStyle = 'rgba(0,0,0,0.55)';
        s.text.split('\n').forEach((line, i) => {
          const y = s.y + i * s.size * 1.2;
          g.strokeText(line, s.x, y);
          g.fillText(line, s.x, y);
        });
      }
    }

    function redraw() {
      if (!ready) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      shapes.forEach((s) => drawShape(ctx, s));
      if (current) drawShape(ctx, current);
    }

    function startText(e) {
      commitText();
      const p = pos(e);
      const rect = canvas.getBoundingClientRect();
      const displayScale = rect.width / canvas.width;
      textInput = document.createElement('textarea');
      textInput.className = 'annot-text-input';
      textInput.rows = 1;
      textInput.style.left = `${e.clientX - rect.left}px`;
      textInput.style.top = `${e.clientY - rect.top}px`;
      textInput.style.color = color;
      textInput.style.fontSize = `${Math.max(12, fontSize() * displayScale)}px`;
      textInput._cx = p.x;
      textInput._cy = p.y;
      canvasWrap.appendChild(textInput);
      setTimeout(() => textInput.focus(), 0);
      textInput.addEventListener('keydown', (ev) => {
        ev.stopPropagation();
        if (ev.key === 'Enter' && !ev.shiftKey) {
          ev.preventDefault();
          commitText();
        } else if (ev.key === 'Escape') {
          const t = textInput;
          textInput = null;
          t.remove();
        }
      });
      textInput.addEventListener('blur', commitText);
    }

    function commitText() {
      if (!textInput) return;
      const val = textInput.value.replace(/\s+$/, '');
      const cx = textInput._cx;
      const cy = textInput._cy;
      const col = textInput.style.color || color;
      const t = textInput;
      textInput = null;
      t.remove();
      if (val.trim()) {
        shapes.push({ type: 'text', color: col, x: cx, y: cy, size: fontSize(), text: val });
        redraw();
      }
    }

    canvas.addEventListener('pointerdown', (e) => {
      if (!ready) return;
      if (tool === 'text') {
        startText(e);
        return;
      }
      const p = pos(e);
      canvas.setPointerCapture(e.pointerId);
      if (tool === 'pen') {
        current = { type: 'pen', color, width: lineWidth(), points: [p] };
      } else {
        current = { type: tool, color, width: lineWidth(), x0: p.x, y0: p.y, x1: p.x, y1: p.y };
      }
      redraw();
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!current) return;
      const p = pos(e);
      if (current.type === 'pen') current.points.push(p);
      else {
        current.x1 = p.x;
        current.y1 = p.y;
      }
      redraw();
    });

    function finishStroke() {
      if (!current) return;
      const keep =
        current.type === 'pen'
          ? current.points.length > 1
          : Math.hypot(current.x1 - current.x0, current.y1 - current.y0) > 4;
      if (keep) shapes.push(current);
      current = null;
      redraw();
    }

    canvas.addEventListener('pointerup', finishStroke);
    canvas.addEventListener('pointercancel', finishStroke);

    img.onload = () => {
      ready = true;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      redraw();
    };
    img.src = src;

    return {
      element: wrap,
      toDataURL() {
        commitText();
        return ready ? canvas.toDataURL('image/png') : src;
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
    let annotator = null;
    if (kind === 'video') {
      preview.innerHTML = `<video src="${src}" controls></video>`;
    } else {
      annotator = createImageAnnotator(src);
      preview.appendChild(annotator.element);
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
        const result = await onCreate({
          name: nameInput.value.trim(),
          notes: notes.value,
          image: annotator ? annotator.toDataURL() : undefined,
        });
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
