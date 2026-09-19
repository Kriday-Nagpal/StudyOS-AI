(() => {
  const MIN_DURATION = 30;
  let lastSync = 0;
  let lastSnapshot = '';
  let lastKnownVideo = null;
  let lastUrl = location.href;

  function runtimeMessage(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (response) => resolve(response || null));
      } catch {
        resolve(null);
      }
    });
  }

  async function settings() {
    return (await runtimeMessage({ type: 'GET_SETTINGS' })) || {
      autoSync: true,
      syncIntervalSeconds: 30,
      syncOnPause: true,
      syncOnEnd: true
    };
  }

  function bestVideo() {
    const videos = [...document.querySelectorAll('video')];
    if (!videos.length) return null;

    const candidates = videos
      .filter((video) => Number.isFinite(video.duration) && video.duration >= MIN_DURATION)
      .sort((a, b) => {
        const aScore = (!a.paused ? 1000000 : 0) + a.clientWidth * a.clientHeight;
        const bScore = (!b.paused ? 1000000 : 0) + b.clientWidth * b.clientHeight;
        return bScore - aScore;
      });

    return candidates[0] || null;
  }

  function pageUrl() {
    if (window.top === window) return location.href;
    return document.referrer || location.href;
  }

  function pageTitle() {
    const youtubeTitle = document.querySelector('h1 yt-formatted-string')?.textContent?.trim();
    const lessonTitle = document.querySelector('[data-testid*="title"], [class*="lecture-title"], [class*="lesson-title"]')?.textContent?.trim();
    const heading = document.querySelector('h1')?.textContent?.trim();
    return youtubeTitle || lessonTitle || heading || document.title || 'Learning lesson';
  }

  function snapshot(video) {
    if (!video) return {
      detected: false,
      url: pageUrl(),
      title: pageTitle(),
      currentTime: 0,
      duration: 0,
      completion: 0,
      paused: true,
      ended: false
    };

    const currentTime = Number(video.currentTime || 0);
    const duration = Number(video.duration || 0);

    return {
      detected: true,
      url: pageUrl(),
      title: pageTitle(),
      currentTime,
      duration,
      completion: duration > 0 ? Math.max(0, Math.min(100, currentTime / duration * 100)) : 0,
      paused: Boolean(video.paused),
      ended: Boolean(video.ended)
    };
  }

  async function sync(force = false, ended = false, manual = false) {
    const config = await settings();
    if (!manual && !config.autoSync) return { ok: false, paused: true };

    const video = bestVideo();
    lastKnownVideo = video || lastKnownVideo;
    if (!video) return { ok: false, noVideo: true };

    const state = snapshot(video);
    if (!state.duration || state.currentTime < 1) return { ok: false, noProgress: true };

    const now = Date.now();
    const interval = Math.max(30, Number(config.syncIntervalSeconds || 30)) * 1000;
    const fingerprint = [Math.round(state.currentTime), Math.round(state.duration), state.url].join('|');

    if (!force && now - lastSync < interval) return { ok: false, throttled: true };
    if (!force && fingerprint === lastSnapshot) return { ok: false, unchanged: true };

    lastSync = now;
    lastSnapshot = fingerprint;

    return runtimeMessage({
      type: 'LEARNING_PROGRESS',
      payload: {
        url: state.url,
        title: state.title,
        currentTime: state.currentTime,
        duration: state.duration,
        ended: ended || state.ended,
        manual,
        force
      }
    });
  }

  async function bindVideoEvents() {
    const video = bestVideo();
    if (!video || video.dataset.studyosBound === '1') return;

    video.dataset.studyosBound = '1';
    lastKnownVideo = video;

    video.addEventListener('play', () => sync(true, false, false), { passive: true });
    video.addEventListener('pause', async () => {
      const config = await settings();
      if (config.syncOnPause !== false) sync(true, false, false);
    }, { passive: true });
    video.addEventListener('ended', async () => {
      const config = await settings();
      if (config.syncOnEnd !== false) sync(true, true, false);
    }, { passive: true });
    video.addEventListener('seeking', () => sync(true, false, false), { passive: true });
  }

  document.addEventListener('play', () => bindVideoEvents(), true);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sync(true, false, false);
  });

  window.addEventListener('pagehide', () => sync(true, false, false));

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'GET_TRACKER_STATE') {
      sendResponse(snapshot(bestVideo() || lastKnownVideo));
      return;
    }

    if (message?.type === 'FORCE_SYNC') {
      sync(true, false, true).then((response) => sendResponse(response || { ok: false }));
      return true;
    }
  });

  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      lastSnapshot = '';
      bindVideoEvents();
    }

    bindVideoEvents();
    sync(false, false, false);
  }, 5000);

  bindVideoEvents();
})();