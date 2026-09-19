const STUDYOS_CAPTURE = 'https://studyos-web-production.up.railway.app/capture';

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

async function init() {
  const tab = await currentTab();
  const text = tab?.id ? await selectedText(tab.id) : '';
  const preview = document.getElementById('selection');
  preview.textContent = text
    ? 'Selected: ' + text.slice(0, 160) + (text.length > 160 ? '…' : '')
    : 'No text selected — you can still capture the page and add notes in StudyOS.';

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
