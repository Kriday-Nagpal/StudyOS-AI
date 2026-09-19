const STUDYOS_CAPTURE = 'https://studyos-web-production.up.railway.app/capture';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'studyos-capture-selection',
    title: 'Capture selection to StudyOS',
    contexts: ['selection', 'page', 'video']
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
