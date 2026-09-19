const STUDYOS_CAPTURE = 'https://studyos-web-production.up.railway.app/capture';

function runtimeMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => resolve(response || null));
  });
}

function tabMessage(tabId, message) {
  return new Promise((resolve) => {
    if (!tabId) return resolve(null);
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) return resolve(null);
      resolve(response || null);
    });
  });
}

async function currentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function selectedText(tabId) {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => String(window.getSelection?.()?.toString?.() || '').slice(0, 12000)
    });
    return result?.[0]?.result || '';
  } catch {
    return '';
  }
}

function platformFor(url = '') {
  const value = String(url).toLowerCase();
  if (value.includes('youtube.com') || value.includes('youtu.be')) return { name: 'YouTube', icon: '▶', supported: true };
  if (value.includes('pw.live') || value.includes('physicswallah') || value.includes('pwskills')) return { name: 'Physics Wallah', icon: 'PW', supported: true };
  if (value.includes('diksha.gov.in')) return { name: 'DIKSHA', icon: 'DI', supported: true };
  if (value.includes('khanacademy.org')) return { name: 'Khan Academy', icon: 'KA', supported: true };
  return { name: 'Current tab', icon: '↗', supported: false };
}

function formatTime(seconds = 0) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const rest = String(total % 60).padStart(2, '0');
  return minutes + ':' + rest;
}

function relativeTime(value) {
  if (!value) return 'Not synced yet';
  const diff = Date.now() - Number(value);
  if (diff < 10000) return 'Just now';
  if (diff < 60000) return Math.max(1, Math.round(diff / 1000)) + ' sec ago';
  if (diff < 3600000) return Math.round(diff / 60000) + ' min ago';
  return Math.round(diff / 3600000) + ' hr ago';
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function paintState(state, tab, tracker) {
  const paired = Boolean(state?.paired);
  const auto = Boolean(state?.settings?.autoSync);
  const platform = platformFor(tab?.url || '');

  const badge = document.getElementById('pair-badge');
  badge.textContent = paired ? (auto ? 'AUTO ON' : 'PAUSED') : 'NOT PAIRED';
  badge.className = 'status-pill ' + (paired ? (auto ? 'on' : 'paused') : 'warning');

  setText('hero-title', paired ? (auto ? 'Learning sync is active' : 'Automation is paused') : 'Connect your StudyOS');
  setText('hero-copy', paired
    ? (auto ? 'Supported lesson progress saves automatically while you study.' : 'Your account is paired. Turn Auto sync back on anytime.')
    : 'Pair this browser once to automatically save supported lesson progress.');

  const primary = document.getElementById('primary-action');
  primary.textContent = paired ? 'Reconnect account' : 'Connect Companion';

  const toggle = document.getElementById('auto-sync');
  toggle.checked = auto;
  toggle.disabled = !paired;
  setText('auto-copy', 'Every ' + Number(state?.settings?.syncIntervalSeconds || 30) + ' seconds');

  setText('platform', platform.name);
  setText('platform-icon', platform.icon);

  const supportBadge = document.getElementById('support-badge');
  supportBadge.textContent = platform.supported ? (tracker?.detected ? 'TRACKING' : 'SUPPORTED') : 'NOT SUPPORTED';
  supportBadge.className = 'mini-pill ' + (platform.supported ? (tracker?.detected ? 'live' : 'supported') : 'neutral');

  if (tracker?.detected) {
    const completion = Math.max(0, Math.min(100, Number(tracker.completion || 0)));
    setText('lesson-title', tracker.title || tab?.title || 'Learning lesson');
    setText('support-copy', tracker.paused ? 'Video detected · currently paused' : 'Video detected · learning in progress');
    setText('progress-label', tracker.paused ? 'Saved position available' : 'Live lesson progress');
    setText('progress-percent', Math.round(completion) + '%');
    setText('position', formatTime(tracker.currentTime));
    setText('duration', formatTime(tracker.duration));
    document.getElementById('progress-bar').style.width = completion + '%';
  } else {
    setText('lesson-title', tab?.title || 'Open a supported lesson');
    setText('support-copy', platform.supported ? 'Supported site · start a lesson video to track progress' : 'Open YouTube, PW, DIKSHA or Khan Academy');
    setText('progress-label', 'No active lesson detected');
    setText('progress-percent', '0%');
    setText('position', '0:00');
    setText('duration', '0:00');
    document.getElementById('progress-bar').style.width = '0%';
  }

  const last = state?.lastSync;
  const lastElement = document.getElementById('last-sync');
  if (last) {
    lastElement.classList.remove('empty');
    lastElement.innerHTML =
      '<span class="last-icon">✓</span><div><b>' +
      String(last.title || 'Learning lesson').replace(/[<>]/g, '') +
      '</b><small>' +
      String(last.platform || 'StudyOS') + ' · ' + Math.round(Number(last.completion || 0)) + '% · ' + relativeTime(last.at) +
      '</small></div>';
  }

  const error = state?.lastError;
  const errorElement = document.getElementById('error-row');
  if (error) {
    errorElement.classList.remove('hidden');
    errorElement.textContent = error.message || 'Last automatic sync failed.';
    document.getElementById('health-dot').classList.add('error');
  } else {
    errorElement.classList.add('hidden');
    document.getElementById('health-dot').classList.remove('error');
  }

  document.getElementById('sync-now').disabled = !paired || !platform.supported || !tracker?.detected;
}

async function refreshPopup() {
  const [state, tab] = await Promise.all([
    runtimeMessage({ type: 'GET_COMPANION_STATE' }),
    currentTab()
  ]);

  const tracker = tab?.id ? await tabMessage(tab.id, { type: 'GET_TRACKER_STATE' }) : null;
  paintState(state, tab, tracker);
  return { state, tab, tracker };
}

async function init() {
  let context = await refreshPopup();

  document.getElementById('primary-action').addEventListener('click', async () => {
    await runtimeMessage({ type: 'OPEN_CONNECT' });
    window.close();
  });

  document.getElementById('auto-sync').addEventListener('change', async (event) => {
    await runtimeMessage({ type: 'UPDATE_SETTINGS', patch: { autoSync: event.target.checked } });
    context = await refreshPopup();
  });

  document.getElementById('sync-now').addEventListener('click', async () => {
    const button = document.getElementById('sync-now');
    button.classList.add('busy');
    setText('progress-label', 'Syncing current position…');
    const response = await tabMessage(context.tab?.id, { type: 'FORCE_SYNC' });
    button.classList.remove('busy');

    if (response?.ok) {
      context = await refreshPopup();
    } else {
      setText('progress-label', response?.noVideo ? 'No lesson video detected' : 'Could not sync this tab');
    }
  });

  document.getElementById('capture').addEventListener('click', async () => {
    const tab = context.tab || await currentTab();
    const text = tab?.id ? await selectedText(tab.id) : '';
    const params = new URLSearchParams({
      url: tab?.url || '',
      title: tab?.title || '',
      text
    });
    await chrome.tabs.create({ url: STUDYOS_CAPTURE + '?' + params.toString() });
    window.close();
  });

  document.getElementById('open-learning').addEventListener('click', async () => {
    await runtimeMessage({ type: 'OPEN_LEARNING' });
    window.close();
  });

  document.getElementById('settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
  document.getElementById('open-settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
  document.getElementById('privacy').addEventListener('click', async () => {
    await runtimeMessage({ type: 'OPEN_PRIVACY' });
    window.close();
  });
}

init();
