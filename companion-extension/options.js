function runtimeMessage(message) {
  return new Promise((resolve) => chrome.runtime.sendMessage(message, (response) => resolve(response || null)));
}

function setChecked(id, value) {
  document.getElementById(id).checked = Boolean(value);
}

function formatAgo(at) {
  const diff = Date.now() - Number(at || 0);
  if (!at) return 'Never';
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.round(diff / 60000) + ' min ago';
  if (diff < 86400000) return Math.round(diff / 3600000) + ' hr ago';
  return Math.round(diff / 86400000) + ' day ago';
}

function renderRecent(items = []) {
  const root = document.getElementById('recent-list');
  if (!items.length) {
    root.innerHTML = '<p class="empty">No Companion syncs yet.</p>';
    return;
  }

  root.innerHTML = items.map((item) => {
    const title = String(item.title || 'Learning lesson').replace(/[<>]/g, '');
    const platform = String(item.platform || 'StudyOS').replace(/[<>]/g, '');
    const completion = Math.round(Number(item.completion || 0));
    return '<article><span class="recent-icon">✓</span><div><b>' + title +
      '</b><small>' + platform + ' · ' + completion + '% · ' + formatAgo(item.at) +
      '</small></div><em>' + completion + '%</em></article>';
  }).join('');
}

async function load() {
  const state = await runtimeMessage({ type: 'GET_COMPANION_STATE' });
  const settings = state?.settings || {};

  const pair = document.getElementById('pair-status');
  pair.textContent = state?.paired ? 'CONNECTED' : 'NOT PAIRED';
  pair.className = 'pill ' + (state?.paired ? 'on' : 'warning');
  document.getElementById('pair-copy').textContent = state?.paired
    ? 'This browser is connected to your StudyOS account. Automatic sync can run on supported learning sites.'
    : 'Pair once with StudyOS before automatic learning progress can sync.';

  setChecked('auto-sync', settings.autoSync);
  setChecked('sync-pause', settings.syncOnPause);
  setChecked('sync-end', settings.syncOnEnd);
  setChecked('show-badge', settings.showBadge);
  setChecked('selection-preview', settings.captureSelectionPreview);
  document.getElementById('sync-interval').value = String(settings.syncIntervalSeconds || 30);

  renderRecent(state?.recentSyncs || []);
}

async function save() {
  const patch = {
    autoSync: document.getElementById('auto-sync').checked,
    syncIntervalSeconds: Number(document.getElementById('sync-interval').value),
    syncOnPause: document.getElementById('sync-pause').checked,
    syncOnEnd: document.getElementById('sync-end').checked,
    showBadge: document.getElementById('show-badge').checked,
    captureSelectionPreview: document.getElementById('selection-preview').checked
  };

  const state = document.getElementById('save-state');
  state.textContent = 'Saving…';
  await runtimeMessage({ type: 'UPDATE_SETTINGS', patch });
  state.textContent = 'Saved.';
  setTimeout(() => { state.textContent = 'Changes save automatically.'; }, 1200);
}

document.getElementById('save').addEventListener('click', save);
['auto-sync','sync-pause','sync-end','show-badge','selection-preview','sync-interval'].forEach((id) => {
  document.getElementById(id).addEventListener('change', save);
});

document.getElementById('pair').addEventListener('click', async () => {
  await runtimeMessage({ type: 'OPEN_CONNECT' });
});

document.getElementById('disconnect').addEventListener('click', async () => {
  const confirmed = confirm('Disconnect this browser from StudyOS? Automatic progress sync will stop until you pair again.');
  if (!confirmed) return;
  await runtimeMessage({ type: 'UNPAIR_SESSION' });
  await load();
});

document.getElementById('clear-history').addEventListener('click', async () => {
  await runtimeMessage({ type: 'CLEAR_RECENT_SYNCS' });
  await load();
});

document.getElementById('privacy').addEventListener('click', () => runtimeMessage({ type: 'OPEN_PRIVACY' }));
document.getElementById('learning').addEventListener('click', () => runtimeMessage({ type: 'OPEN_LEARNING' }));
document.getElementById('open-studyos').addEventListener('click', () => runtimeMessage({ type: 'OPEN_LEARNING' }));

load();
