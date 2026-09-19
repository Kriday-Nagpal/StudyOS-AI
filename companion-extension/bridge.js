window.addEventListener('message', (event) => {
  if (event.source !== window || event.origin !== window.location.origin) return;
  if (event.data?.type !== 'STUDYOS_COMPANION_PAIR') return;

  chrome.runtime.sendMessage({
    type: 'PAIR_SESSION',
    accessToken: event.data.accessToken,
    refreshToken: event.data.refreshToken,
    expiresAt: event.data.expiresAt
  }, (response) => {
    window.postMessage({
      type: response?.ok ? 'STUDYOS_COMPANION_CONNECTED' : 'STUDYOS_COMPANION_CONNECT_FAILED'
    }, window.location.origin);
  });
});
