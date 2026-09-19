const STUDYOS_ORIGIN = 'https://studyos-web-production.up.railway.app';
const STUDYOS_CAPTURE = STUDYOS_ORIGIN + '/capture';
const STUDYOS_CONNECT = STUDYOS_ORIGIN + '/companion/connect';
const SUPABASE_URL = 'https://kgqhmphvkwqerkbbqjkl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-f3CkV58oZ5IdAmugAWAAw_5O4xvCFB';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'studyos-capture-selection',
      title: 'Capture selection to StudyOS',
      contexts: ['selection', 'page', 'video']
    });
  });
});

function captureUrl(tab, selectedText = '') {
  const params = new URLSearchParams({
    url: tab?.url || '',
    title: tab?.title || '',
    text: String(selectedText || '').slice(0, 12000)
  });
  return STUDYOS_CAPTURE + '?' + params.toString();
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'studyos-capture-selection') return;
  chrome.tabs.create({ url: captureUrl(tab, info.selectionText || '') });
});

async function storedSession() {
  const result = await chrome.storage.local.get('studyosSession');
  return result.studyosSession || null;
}

async function refreshSession(session) {
  if (!session?.refreshToken) return null;
  const response = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refresh_token: session.refreshToken })
  });
  if (!response.ok) return null;
  const data = await response.json();
  const next = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || session.refreshToken,
    expiresAt: Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600)
  };
  await chrome.storage.local.set({ studyosSession: next });
  return next;
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

async function syncProgress(payload) {
  let session = await validSession();
  if (!session) return { ok: false, needsPairing: true };

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

  let response = await request(session.accessToken);
  if (response.status === 401) {
    session = await refreshSession(session);
    if (!session) return { ok: false, needsPairing: true };
    response = await request(session.accessToken);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { ok: false, error: data.error || 'Progress sync failed' };
  return data;
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
    chrome.storage.local.set({ studyosSession: session }).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === 'UNPAIR_SESSION') {
    chrome.storage.local.remove('studyosSession').then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === 'GET_PAIR_STATUS') {
    validSession().then((session) => sendResponse({ paired: Boolean(session) }));
    return true;
  }

  if (message?.type === 'LEARNING_PROGRESS') {
    syncProgress(message.payload || {}).then(sendResponse);
    return true;
  }

  if (message?.type === 'OPEN_CONNECT') {
    chrome.tabs.create({ url: STUDYOS_CONNECT });
    sendResponse({ ok: true });
  }
});
