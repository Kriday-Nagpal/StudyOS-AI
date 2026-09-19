(() => {
  const MIN_DURATION = 30;
  const SYNC_EVERY_MS = 30000;
  let lastSync = 0;
  let lastSnapshot = '';

  function bestVideo() {
    const videos = [...document.querySelectorAll('video')];
    if (!videos.length) return null;
    return videos
      .filter((video) => Number.isFinite(video.duration) && video.duration >= MIN_DURATION)
      .sort((a, b) => {
        const aScore = (!a.paused ? 1000000 : 0) + a.clientWidth * a.clientHeight;
        const bScore = (!b.paused ? 1000000 : 0) + b.clientWidth * b.clientHeight;
        return bScore - aScore;
      })[0] || null;
  }

  function pageUrl() {
    if (window.top === window) return location.href;
    return document.referrer || location.href;
  }

  function pageTitle() {
    const youtubeTitle = document.querySelector('h1 yt-formatted-string')?.textContent?.trim();
    const heading = document.querySelector('h1')?.textContent?.trim();
    return youtubeTitle || heading || document.title || 'Learning lesson';
  }

  async function sync(force = false, ended = false) {
    const video = bestVideo();
    if (!video) return;
    const currentTime = Number(video.currentTime || 0);
    const duration = Number(video.duration || 0);
    if (!duration || currentTime < 1) return;

    const now = Date.now();
    const snapshot = [Math.round(currentTime), Math.round(duration), location.href].join('|');
    if (!force && now - lastSync < SYNC_EVERY_MS) return;
    if (!force && snapshot === lastSnapshot) return;

    lastSync = now;
    lastSnapshot = snapshot;

    chrome.runtime.sendMessage({
      type: 'LEARNING_PROGRESS',
      payload: {
        url: pageUrl(),
        title: pageTitle(),
        currentTime,
        duration,
        ended: ended || video.ended
      }
    });
  }

  document.addEventListener('play', () => sync(true, false), true);
  document.addEventListener('pause', () => sync(true, false), true);
  document.addEventListener('ended', () => sync(true, true), true);
  document.addEventListener('seeking', () => sync(true, false), true);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sync(true, false);
  });

  window.addEventListener('pagehide', () => sync(true, false));
  setInterval(() => sync(false, false), 5000);
})();
