const STUDYOS_CAPTURE = 'https://studyos-web-production.up.railway.app/capture';
const STUDYOS_CONNECT = 'https://studyos-web-production.up.railway.app/companion/connect';

async function currentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
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

function pairStatus() {
  return new Promise((resolve) => chrome.runtime.sendMessage({ type: 'GET_PAIR_STATUS' }, resolve));
}

async function init() {
  const status = await pairStatus();
  const badge = document.getElementById('status');
  const copy = document.getElementById('status-copy');
  const connect = document.getElementById('connect');

  if (status?.paired) {
    badge.textContent = 'AUTO ON';
    badge.classList.add('on');
    copy.textContent = 'Video progress can sync automatically on YouTube, PW, DIKSHA and Khan Academy.';
    connect.textContent = 'Reconnect account';
  } else {
    badge.textContent = 'NOT PAIRED';
    copy.textContent = 'Pair once with StudyOS, then supported video progress can sync automatically.';
  }

  connect.addEventListener('click', async () => {
    await chrome.tabs.create({ url: STUDYOS_CONNECT });
    window.close();
  });

  const tab = await currentTab();
  const text = tab?.id ? await selectedText(tab.id) : '';
  const preview = document.getElementById('selection');
  if (text) preview.textContent = 'Selected: ' + text.slice(0, 180) + (text.length > 180 ? '…' : '');

  document.getElementById('capture').addEventListener('click', async () => {
    const params = new URLSearchParams({
      url: tab?.url || '',
      title: tab?.title || '',
      text
    });
    await chrome.tabs.create({ url: STUDYOS_CAPTURE + '?' + params.toString() });
    window.close();
  });
}

init();
