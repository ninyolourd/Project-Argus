const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');

init();

async function init() {
  const recordings = await chrome.runtime.sendMessage({ type: 'GET_ALL_RECORDINGS' });

  if (!recordings || recordings.length === 0) {
    emptyEl.textContent = 'No drafts found. Recordings you record but don’t submit will show up here.';
    return;
  }

  emptyEl.remove();
  recordings
    .sort((a, b) => (b.capturedAt || '').localeCompare(a.capturedAt || ''))
    .forEach((rec) => listEl.appendChild(renderCard(rec)));
}

function renderCard(rec) {
  const card = document.createElement('div');
  card.className = 'card';

  const video = document.createElement('video');
  video.src = `data:${rec.mimeType};base64,${rec.base64}`;
  video.controls = true;

  const meta = document.createElement('div');
  meta.className = 'meta';
  const title = (rec.metadata && rec.metadata.title) || 'Untitled page';
  const url = (rec.metadata && rec.metadata.url) || '';
  const capturedAt = rec.capturedAt ? new Date(rec.capturedAt).toLocaleString() : 'Unknown time';
  meta.innerHTML = `<strong>${escapeHtml(title)}</strong><br />${escapeHtml(url)}<br />${escapeHtml(capturedAt)}`;

  const nameLabel = document.createElement('label');
  nameLabel.className = 'field-label';
  nameLabel.textContent = 'Name';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Name this report';
  nameInput.value = `Recording - ${title}`;

  const notesLabel = document.createElement('label');
  notesLabel.className = 'field-label';
  notesLabel.textContent = 'Notes';
  const notes = document.createElement('textarea');
  notes.placeholder = 'What went wrong? (optional)';

  const actions = document.createElement('div');
  actions.className = 'actions';
  const createBtn = document.createElement('button');
  createBtn.className = 'btn-primary';
  createBtn.textContent = 'Create Report';
  const discardBtn = document.createElement('button');
  discardBtn.className = 'btn-secondary';
  discardBtn.textContent = 'Discard';
  actions.appendChild(createBtn);
  actions.appendChild(discardBtn);

  const status = document.createElement('div');
  status.className = 'status';

  card.appendChild(video);
  card.appendChild(meta);
  card.appendChild(nameLabel);
  card.appendChild(nameInput);
  card.appendChild(notesLabel);
  card.appendChild(notes);
  card.appendChild(actions);
  card.appendChild(status);

  createBtn.addEventListener('click', async () => {
    createBtn.disabled = true;
    discardBtn.disabled = true;
    status.className = 'status';
    status.textContent = 'Submitting…';

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'SUBMIT_REPORT',
        tabId: rec.tabId,
        useStoredRecording: true,
        name: nameInput.value.trim(),
        notes: notes.value,
        clearRecording: true,
      });

      if (!result || !result.ok) {
        throw new Error((result && result.error) || 'Submission failed');
      }

      await copyToClipboard(result.url);
      status.className = 'status success';
      status.textContent = 'Report created — link copied to clipboard!';
      setTimeout(() => card.remove(), 1200);
    } catch (err) {
      status.className = 'status error';
      status.textContent = err.message || 'Something went wrong';
      createBtn.disabled = false;
      discardBtn.disabled = false;
    }
  });

  discardBtn.addEventListener('click', async () => {
    createBtn.disabled = true;
    discardBtn.disabled = true;
    await chrome.runtime.sendMessage({ type: 'CLEAR_RECORDING', tabId: rec.tabId });
    card.remove();
    if (!listEl.children.length) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'No drafts found.';
      listEl.appendChild(empty);
    }
  });

  return card;
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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
