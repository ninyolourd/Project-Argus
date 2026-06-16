const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');

init();

async function init() {
  const history = await chrome.runtime.sendMessage({ type: 'GET_REPORT_HISTORY' });

  if (!history || history.length === 0) {
    emptyEl.textContent = 'No reports yet. Reports you create will show up here.';
    return;
  }

  emptyEl.remove();
  history.forEach((entry) => listEl.appendChild(renderRow(entry)));
}

function renderRow(entry) {
  const row = document.createElement('div');
  row.className = 'row';

  const icon = document.createElement('div');
  icon.className = 'icon';
  icon.textContent = entry.captureType === 'video' ? '🎥' : '🖼️';

  const info = document.createElement('div');
  info.className = 'info';

  const title = document.createElement('input');
  title.type = 'text';
  title.className = 'title';
  title.value = entry.name || entry.pageTitle || entry.pageUrl || 'Untitled';

  const meta = document.createElement('div');
  meta.className = 'meta';
  const createdAt = entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '';
  meta.textContent = [entry.pageUrl, createdAt].filter(Boolean).join(' · ');

  title.addEventListener('change', async () => {
    const newName = title.value.trim();
    if (newName === (entry.name || '')) return;

    title.disabled = true;
    const result = await chrome.runtime.sendMessage({ type: 'UPDATE_REPORT_NAME', id: entry.id, name: newName });
    title.disabled = false;

    if (result && result.ok) {
      entry.name = newName;
      title.value = newName || entry.pageTitle || entry.pageUrl || 'Untitled';
    } else {
      title.value = entry.name || entry.pageTitle || entry.pageUrl || 'Untitled';
    }
  });

  info.appendChild(title);
  info.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'actions';

  const openLink = document.createElement('a');
  openLink.className = 'btn-primary';
  openLink.href = entry.url;
  openLink.target = '_blank';
  openLink.textContent = 'Open';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn-secondary';
  copyBtn.textContent = 'Copy Link';
  copyBtn.addEventListener('click', async () => {
    await copyToClipboard(entry.url);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => (copyBtn.textContent = 'Copy Link'), 1500);
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-danger';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', async () => {
    if (!confirm('Delete this Argus capture? This cannot be undone.')) return;

    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Deleting…';
    const result = await chrome.runtime.sendMessage({ type: 'DELETE_REPORT', id: entry.id });

    if (result && result.ok) {
      row.remove();
      if (!listEl.querySelector('.row')) {
        const empty = document.createElement('p');
        empty.className = 'empty';
        empty.textContent = 'No reports yet. Reports you create will show up here.';
        listEl.appendChild(empty);
      }
    } else {
      deleteBtn.disabled = false;
      deleteBtn.textContent = 'Delete';
    }
  });

  actions.appendChild(openLink);
  actions.appendChild(copyBtn);
  actions.appendChild(deleteBtn);

  row.appendChild(icon);
  row.appendChild(info);
  row.appendChild(actions);

  return row;
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
