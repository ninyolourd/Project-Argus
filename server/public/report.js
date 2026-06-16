(async () => {
  const id = location.pathname.split('/').pop();

  const res = await fetch(`/api/reports/${id}`);
  if (!res.ok) {
    document.querySelector('.container').innerHTML = '<h1>Report not found</h1>';
    return;
  }
  const report = await res.json();

  const displayName = report.name || 'Bug Report';
  document.title = displayName;
  document.getElementById('report-name').textContent = `🐞 ${displayName}`;

  document.getElementById('created-at').textContent = `Captured ${new Date(report.createdAt).toLocaleString()}`;

  document.getElementById('open-library').addEventListener('click', (e) => {
    e.preventDefault();
    window.postMessage({ source: 'argus-report', type: 'OPEN_LIBRARY' }, '*');
  });

  if (new URLSearchParams(location.search).get('created') === '1') {
    showToast('Link copied to clipboard!');
    history.replaceState(null, '', location.pathname);
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 200);
    }, 2500);
  }

  let networkLogs = [];
  const networkFilter = { search: '', type: 'all', errorsOnly: false };

  renderCapture(report);
  renderMetadata(report.metadata || {});
  renderConsoleLogs(report.consoleLogs || []);
  renderNetworkLogs(report.networkLogs || []);
  setupTabs();
  setupNetworkDetail();
  setupDescription(report);
  setupComments(report);

  function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        tabBtns.forEach((b) => b.classList.toggle('active', b === btn));
        tabPanels.forEach((panel) => panel.classList.toggle('active', panel.dataset.tab === btn.dataset.tab));
      });
    });
  }

  function renderCapture(report) {
    const container = document.getElementById('capture-container');
    const src = `/api/reports/${id}/capture`;
    if (report.captureType === 'video') {
      container.innerHTML = `<video src="${src}" controls></video>`;
    } else {
      container.innerHTML = `<img src="${src}" alt="Screenshot" />`;
    }
  }

  function renderMetadata(metadata) {
    const table = document.getElementById('metadata-table');
    const rows = [
      ['URL', metadata.url],
      ['Title', metadata.title],
      ['User Agent', metadata.userAgent],
      ['Viewport', metadata.viewportWidth && metadata.viewportHeight ? `${metadata.viewportWidth} x ${metadata.viewportHeight}` : null],
      ['Captured At', metadata.capturedAt],
    ];
    table.innerHTML = rows
      .filter(([, value]) => value)
      .map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(String(value))}</td></tr>`)
      .join('');
  }

  function renderConsoleLogs(logs) {
    document.getElementById('console-count').textContent = logs.length;
    const tbody = document.querySelector('#console-table tbody');
    tbody.innerHTML = logs
      .map(
        (entry) => `
        <tr class="level-${escapeHtml(entry.level)}">
          <td>${escapeHtml(entry.level)}</td>
          <td class="message">${escapeHtml(entry.message)}</td>
          <td>${formatTime(entry.timestamp)}</td>
        </tr>`
      )
      .join('');
  }

  function renderNetworkLogs(logs) {
    networkLogs = logs;
    document.getElementById('network-count').textContent = logs.length;
    setupNetworkFilters();
    applyNetworkFilters();
  }

  function networkCategory(entry) {
    switch (entry.type) {
      case 'xmlhttprequest':
        return 'fetch';
      case 'websocket':
        return 'ws';
      case 'script':
        return 'js';
      case 'stylesheet':
        return 'css';
      case 'media':
        return 'media';
      case 'font':
        return 'font';
      case 'main_frame':
      case 'sub_frame':
        return 'doc';
      default:
        return 'other';
    }
  }

  function setupNetworkFilters() {
    const searchInput = document.getElementById('network-search');
    const errorsOnly = document.getElementById('network-errors-only');
    const pills = document.querySelectorAll('.filter-pill');

    searchInput.addEventListener('input', () => {
      networkFilter.search = searchInput.value.trim().toLowerCase();
      applyNetworkFilters();
    });

    errorsOnly.addEventListener('change', () => {
      networkFilter.errorsOnly = errorsOnly.checked;
      applyNetworkFilters();
    });

    pills.forEach((pill) => {
      pill.addEventListener('click', () => {
        pills.forEach((p) => p.classList.toggle('active', p === pill));
        networkFilter.type = pill.dataset.type;
        applyNetworkFilters();
      });
    });
  }

  function applyNetworkFilters() {
    const filtered = networkLogs.filter((entry) => {
      if (networkFilter.search && !entry.url.toLowerCase().includes(networkFilter.search)) return false;
      if (networkFilter.errorsOnly) {
        const isError = entry.error || (entry.status && entry.status >= 400);
        if (!isError) return false;
      }
      if (networkFilter.type !== 'all' && networkCategory(entry) !== networkFilter.type) return false;
      return true;
    });

    const tbody = document.querySelector('#network-table tbody');
    tbody.innerHTML = filtered.length
      ? filtered
          .map((entry) => {
            const isError = entry.error || (entry.status && entry.status >= 400);
            return `
            <tr class="${isError ? 'status-error' : ''}">
              <td>${escapeHtml(entry.method)}</td>
              <td>${escapeHtml(entry.url)}</td>
              <td>${escapeHtml(entry.type)}</td>
              <td>${entry.error ? escapeHtml(entry.error) : entry.status ?? '-'}</td>
              <td>${entry.duration ?? '-'}</td>
            </tr>`;
          })
          .join('')
      : '<tr><td colspan="5" class="muted">No requests match the current filters</td></tr>';

    if (filtered.length) {
      tbody.querySelectorAll('tr').forEach((row, i) => {
        row.addEventListener('click', () => showNetworkDetail(filtered[i]));
      });
    }
  }

  function setupNetworkDetail() {
    const overlay = document.getElementById('network-detail-overlay');
    const closeBtn = document.getElementById('detail-close');
    const tabBtns = overlay.querySelectorAll('.detail-tab-btn');
    const tabPanels = overlay.querySelectorAll('.detail-tab-panel');

    closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });

    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        tabBtns.forEach((b) => b.classList.toggle('active', b === btn));
        tabPanels.forEach((panel) => panel.classList.toggle('active', panel.dataset.detailTab === btn.dataset.detailTab));
      });
    });
  }

  function showNetworkDetail(entry) {
    const overlay = document.getElementById('network-detail-overlay');

    document.getElementById('detail-title').textContent = `${entry.method} ${entry.url}`;

    const generalRows = [
      ['URL', entry.url],
      ['Method', entry.method],
      ['Type', entry.type],
      ['Status', entry.error || entry.status || '-'],
      ['Duration', entry.duration != null ? `${entry.duration} ms` : '-'],
      ['Time', formatTime(entry.timeStamp)],
    ];
    document.getElementById('detail-general').innerHTML = generalRows
      .map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(String(value))}</td></tr>`)
      .join('');

    document.getElementById('detail-request-headers').innerHTML = renderHeaderRows(entry.requestHeaders);
    document.getElementById('detail-response-headers').innerHTML = renderHeaderRows(entry.responseHeaders);
    document.getElementById('detail-payload').textContent = formatPayload(entry.requestBody);
    document.getElementById('detail-response').textContent = formatResponseBody(entry);

    const tabBtns = overlay.querySelectorAll('.detail-tab-btn');
    const tabPanels = overlay.querySelectorAll('.detail-tab-panel');
    tabBtns.forEach((b, i) => b.classList.toggle('active', i === 0));
    tabPanels.forEach((p, i) => p.classList.toggle('active', i === 0));

    overlay.classList.remove('hidden');
  }

  function renderHeaderRows(headers) {
    if (!headers || !headers.length) return '<tr><td colspan="2" class="muted">No headers captured</td></tr>';
    return headers.map((h) => `<tr><td>${escapeHtml(h.name)}</td><td>${escapeHtml(h.value || '')}</td></tr>`).join('');
  }

  function formatResponseBody(entry) {
    if (entry.responseBody === undefined) {
      return 'No response body captured. Response bodies are only captured during a screen recording.';
    }
    if (entry.responseBodyBase64) {
      return '[Binary response body not displayed]';
    }
    let body = entry.responseBody;
    try {
      body = JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      // not JSON, leave as-is
    }
    if (entry.responseBodyTruncated) {
      body += '\n\n[Response truncated]';
    }
    return body || '(empty response)';
  }

  function formatPayload(requestBody) {
    if (!requestBody) return 'No payload';
    if (requestBody.error) return `Error reading payload: ${requestBody.error}`;
    if (requestBody.formData) {
      return Object.entries(requestBody.formData)
        .map(([key, values]) => `${key}: ${values.join(', ')}`)
        .join('\n');
    }
    if (requestBody.raw) {
      try {
        return JSON.stringify(JSON.parse(requestBody.raw), null, 2);
      } catch {
        return requestBody.raw;
      }
    }
    return 'No payload';
  }

  function setupDescription(report) {
    const input = document.getElementById('description-input');
    const saveBtn = document.getElementById('save-description');
    const status = document.getElementById('description-status');

    input.value = report.notes || '';
    saveBtn.disabled = true;

    input.addEventListener('input', () => {
      saveBtn.disabled = !input.value.trim();
    });

    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      status.textContent = 'Saving…';

      try {
        const res = await fetch(`/api/reports/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: input.value }),
        });
        if (!res.ok) throw new Error('Save failed');
        status.textContent = 'Saved';
      } catch {
        status.textContent = 'Failed to save';
        saveBtn.disabled = !input.value.trim();
      } finally {
        setTimeout(() => (status.textContent = ''), 2000);
      }
    });
  }

  function setupComments(report) {
    const list = document.getElementById('comments-list');
    const input = document.getElementById('comment-input');
    const postBtn = document.getElementById('post-comment');

    let comments = report.comments || [];
    renderComments();

    postBtn.addEventListener('click', async () => {
      const text = input.value.trim();
      if (!text) return;

      postBtn.disabled = true;
      try {
        const res = await fetch(`/api/reports/${id}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) throw new Error('Post failed');
        const updated = await res.json();
        comments = updated.comments || [];
        input.value = '';
        renderComments();
      } catch {
        // leave the input as-is so the user can retry
      } finally {
        postBtn.disabled = false;
      }
    });

    function renderComments() {
      list.innerHTML = comments
        .map(
          (comment) => `
        <div class="comment">
          <p>${escapeHtml(comment.text)}</p>
          <time>${new Date(comment.createdAt).toLocaleString()}</time>
        </div>`
        )
        .join('');
    }
  }

  function formatTime(timestamp) {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleTimeString();
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
})();
