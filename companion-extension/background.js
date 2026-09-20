const STUDYOS_ORIGIN = 'https://studyos-web-production.up.railway.app';
const STUDYOS_CAPTURE = STUDYOS_ORIGIN + '/capture';
const STUDYOS_CONNECT = STUDYOS_ORIGIN + '/companion/connect';
const STUDYOS_LEARNING = STUDYOS_ORIGIN + '/app?view=Learning';
const STUDYOS_PRIVACY = STUDYOS_ORIGIN + '/privacy/companion';
const SUPABASE_URL = 'https://kgqhmphvkwqerkbbqjkl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-f3CkV58oZ5IdAmugAWAAw_5O4xvCFB';

const DEFAULT_SETTINGS = {
  autoSync: true,
  syncIntervalSeconds: 30,
  syncOnPause: true,
  syncOnEnd: true,
  showBadge: true,
  captureSelectionPreview: true
};

function platformFor(url = '') {
  const value = String(url).toLowerCase();
  if (value.includes('youtube.com') || value.includes('youtu.be')) return 'YouTube';
  if (value.includes('pw.live') || value.includes('physicswallah') || value.includes('pwskills')) return 'Physics Wallah';
  if (value.includes('diksha.gov.in')) return 'DIKSHA';
  if (value.includes('khanacademy.org')) return 'Khan Academy';
  return 'Learning site';
}

async function getSettings() {
  const result = await chrome.storage.local.get('studyosSettings');
  return { ...DEFAULT_SETTINGS, ...(result.studyosSettings || {}) };
}

async function saveSettings(patch = {}) {
  const current = await getSettings();
  const next = {
    ...current,
    ...patch,
    syncIntervalSeconds: Math.max(30, Math.min(300, Number(patch.syncIntervalSeconds ?? current.syncIntervalSeconds)))
  };
  await chrome.storage.local.set({ studyosSettings: next });
  await updateBadge();
  return next;
}

async function updateBadge(status) {
  const settings = await getSettings();
  if (!settings.showBadge) {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }

  let state = status;
  if (!state) {
    const session = await storedSession();
    state = !session ? 'PAIR' : settings.autoSync ? 'ON' : 'OFF';
  }

  const config = {
    ON: { text: 'ON', color: '#6C5CE7' },
    OFF: { text: 'OFF', color: '#8B8794' },
    PAIR: { text: '!', color: '#C48738' },
    ERR: { text: 'ERR', color: '#C65762' },
    SYNC: { text: '…', color: '#4D8FE5' }
  }[state] || { text: '', color: '#6C5CE7' };

  await chrome.action.setBadgeBackgroundColor({ color: config.color });
  await chrome.action.setBadgeText({ text: config.text });
}

async function setupExtension() {
  const result = await chrome.storage.local.get('studyosSettings');
  if (!result.studyosSettings) {
    await chrome.storage.local.set({ studyosSettings: DEFAULT_SETTINGS });
  }

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'studyos-capture-selection',
      title: 'Capture selection to StudyOS',
      contexts: ['selection', 'page', 'video']
    });
    chrome.contextMenus.create({
      id: 'studyos-open-learning',
      title: 'Open StudyOS Learning Tracker',
      contexts: ['action']
    });
  });

  await updateBadge();
}

chrome.runtime.onInstalled.addListener(setupExtension);
chrome.runtime.onStartup.addListener(() => updateBadge());

function captureUrl(tab, selectedText = '') {
  const params = new URLSearchParams({
    url: tab?.url || '',
    title: tab?.title || '',
    text: String(selectedText || '').slice(0, 12000)
  });
  return STUDYOS_CAPTURE + '?' + params.toString();
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'studyos-capture-selection') {
    chrome.tabs.create({ url: captureUrl(tab, info.selectionText || '') });
  }
  if (info.menuItemId === 'studyos-open-learning') {
    chrome.tabs.create({ url: STUDYOS_LEARNING });
  }
});

async function storedSession() {
  const result = await chrome.storage.local.get('studyosSession');
  return result.studyosSession || null;
}

async function refreshSession(session) {
  if (!session?.refreshToken) return null;

  try {
    const response = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refresh_token: session.refreshToken })
    });

    if (!response.ok) {
      await chrome.storage.local.set({ studyosLastError: {
        message: 'StudyOS session refresh failed. Reconnect the Companion.',
        at: Date.now()
      }});
      await updateBadge('ERR');
      return null;
    }

    const data = await response.json();
    const next = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || session.refreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600)
    };

    await chrome.storage.local.set({ studyosSession: next, studyosLastError: null });
    return next;
  } catch {
    await chrome.storage.local.set({ studyosLastError: {
      message: 'Could not reach StudyOS authentication.',
      at: Date.now()
    }});
    await updateBadge('ERR');
    return null;
  }
}

async function validSession() {
  let session = await storedSession();
  if (!session) return null;

  const now = Math.floor(Date.now() / 1000);
  if (!session.expiresAt || session.expiresAt <= now + 90) {
    session = await refreshSession(session);
  }

  return session;
}

async function recordSync(payload, response) {
  const entry = {
    at: Date.now(),
    title: String(payload.title || 'Learning lesson').slice(0, 180),
    url: String(payload.url || '').slice(0, 2000),
    platform: platformFor(payload.url),
    currentTime: Number(payload.currentTime || 0),
    duration: Number(payload.duration || 0),
    completion: Number(response?.verified_completion ?? response?.completion ?? 0),
    verifiedCompletion: Number(response?.verified_completion || 0),
    engagedSeconds: Number(response?.engaged_seconds || 0),
    contentSeconds: Number(response?.content_seconds || 0),
    trackingConfidence: Number(response?.tracking_confidence || 0),
    mapped: response?.mapped || null
  };

  const result = await chrome.storage.local.get('studyosRecentSyncs');
  const recent = Array.isArray(result.studyosRecentSyncs) ? result.studyosRecentSyncs : [];
  const next = [entry, ...recent.filter(item => item.url !== entry.url)].slice(0, 8);

  await chrome.storage.local.set({
    studyosLastSync: entry,
    studyosRecentSyncs: next,
    studyosLastError: null
  });

  return entry;
}

async function syncProgress(payload) {
  const settings = await getSettings();
  const manual = Boolean(payload?.manual);

  if (!manual && !settings.autoSync) {
    return { ok: false, paused: true };
  }

  let session = await validSession();
  if (!session) {
    await updateBadge('PAIR');
    return { ok: false, needsPairing: true };
  }

  await updateBadge('SYNC');

  async function request(token) {
    return fetch(STUDYOS_ORIGIN + '/api/learning/auto-progress', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  }

  try {
    let response = await request(session.accessToken);

    if (response.status === 401) {
      session = await refreshSession(session);
      if (!session) return { ok: false, needsPairing: true };
      response = await request(session.accessToken);
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      await chrome.storage.local.set({
        studyosLastError: {
          message: data.error || 'Progress sync failed.',
          at: Date.now(),
          title: String(payload.title || '')
        }
      });
      await updateBadge('ERR');
      return { ok: false, error: data.error || 'Progress sync failed' };
    }

    await recordSync(payload, data);
    await updateBadge(settings.autoSync ? 'ON' : 'OFF');
    return data;
  } catch {
    await chrome.storage.local.set({
      studyosLastError: {
        message: 'StudyOS could not be reached. Progress will sync again when the service is available.',
        at: Date.now(),
        title: String(payload.title || '')
      }
    });
    await updateBadge('ERR');
    return { ok: false, error: 'StudyOS could not be reached.' };
  }
}

async function companionState() {
  const [session, settings, storage] = await Promise.all([
    validSession(),
    getSettings(),
    chrome.storage.local.get(['studyosLastSync', 'studyosRecentSyncs', 'studyosLastError'])
  ]);

  return {
    paired: Boolean(session),
    settings,
    lastSync: storage.studyosLastSync || null,
    recentSyncs: storage.studyosRecentSyncs || [],
    lastError: storage.studyosLastError || null
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'PAIR_SESSION') {
    const session = {
      accessToken: String(message.accessToken || ''),
      refreshToken: String(message.refreshToken || ''),
      expiresAt: Number(message.expiresAt || 0)
    };

    if (!session.accessToken || !session.refreshToken) {
      sendResponse({ ok: false });
      return;
    }

    chrome.storage.local.set({
      studyosSession: session,
      studyosLastError: null
    }).then(async () => {
      await updateBadge('ON');
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message?.type === 'UNPAIR_SESSION') {
    chrome.storage.local.remove(['studyosSession', 'studyosLastError']).then(async () => {
      await updateBadge('PAIR');
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message?.type === 'GET_PAIR_STATUS') {
    validSession().then((session) => sendResponse({ paired: Boolean(session) }));
    return true;
  }

  if (message?.type === 'GET_SETTINGS') {
    getSettings().then(sendResponse);
    return true;
  }

  if (message?.type === 'UPDATE_SETTINGS') {
    saveSettings(message.patch || {}).then(sendResponse);
    return true;
  }

  if (message?.type === 'GET_COMPANION_STATE') {
    companionState().then(sendResponse);
    return true;
  }

  if (message?.type === 'LEARNING_PROGRESS') {
    syncProgress(message.payload || {}).then(sendResponse);
    return true;
  }

  if (message?.type === 'CLEAR_RECENT_SYNCS') {
    chrome.storage.local.remove(['studyosLastSync', 'studyosRecentSyncs', 'studyosLastError']).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === 'OPEN_CONNECT') {
    chrome.tabs.create({ url: STUDYOS_CONNECT });
    sendResponse({ ok: true });
  }

  if (message?.type === 'OPEN_LEARNING') {
    chrome.tabs.create({ url: STUDYOS_LEARNING });
    sendResponse({ ok: true });
  }

  if (message?.type === 'OPEN_PRIVACY') {
    chrome.tabs.create({ url: STUDYOS_PRIVACY });
    sendResponse({ ok: true });
  }
});

setupExtension();
