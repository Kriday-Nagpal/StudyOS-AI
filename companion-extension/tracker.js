(() => {
  const MIN_DURATION = 30;
  let lastKnownVideo = null;
  let lastUrl = location.href;
  let lastSync = 0;
  let lastSample = { wall: performance.now(), position: 0, playing: false, rate: 1 };
  let metrics = createMetrics();

  function createMetrics() {
    return {
      clientSessionId: crypto.randomUUID ? crypto.randomUUID() : 'ext-' + Date.now() + '-' + Math.random().toString(36).slice(2),
      startedAt: new Date().toISOString(),
      engagedSeconds: 0,
      contentSeconds: 0,
      coverageRanges: [],
      seekCount: 0,
      pauseCount: 0,
      bufferSeconds: 0,
      ended: false
    };
  }

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

  function mergeRanges(input, duration = 86400) {
    const clean = input
      .map((range) => [Math.max(0, Math.min(duration, Number(range[0] || 0))), Math.max(0, Math.min(duration, Number(range[1] || 0)))])
      .map(([a,b]) => [Math.min(a,b), Math.max(a,b)])
      .filter(([a,b]) => Number.isFinite(a) && Number.isFinite(b) && b - a >= 0.15)
      .sort((a,b) => a[0] - b[0]);
    const merged = [];
    for (const range of clean) {
      const last = merged[merged.length - 1];
      if (!last || range[0] > last[1] + 1.25) merged.push([range[0], range[1]]);
      else last[1] = Math.max(last[1], range[1]);
    }
    return merged.slice(0, 180);
  }

  function coverageSeconds(ranges) {
    return ranges.reduce((sum,[a,b]) => sum + Math.max(0,b-a), 0);
  }

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
    const lessonTitle = document.querySelector('[data-testid*="title"], [class*="lecture-title"], [class*="lesson-title"]')?.textContent?.trim();
    const heading = document.querySelector('h1')?.textContent?.trim();
    return youtubeTitle || lessonTitle || heading || document.title || 'Learning lesson';
  }

  function snapshot(video) {
    if (!video) return {
      detected: false, url: pageUrl(), title: pageTitle(), currentTime: 0, duration: 0,
      completion: 0, positionCompletion: 0, engagedSeconds: metrics.engagedSeconds,
      contentSeconds: metrics.contentSeconds, seekCount: metrics.seekCount, paused: true, ended: false
    };
    const currentTime = Number(video.currentTime || 0);
    const duration = Number(video.duration || 0);
    const verified = duration > 0 ? Math.min(100, coverageSeconds(metrics.coverageRanges) / duration * 100) : 0;
    return {
      detected: true,
      url: pageUrl(),
      title: pageTitle(),
      currentTime,
      duration,
      completion: verified,
      positionCompletion: duration > 0 ? Math.max(0, Math.min(100, currentTime / duration * 100)) : 0,
      engagedSeconds: metrics.engagedSeconds,
      contentSeconds: metrics.contentSeconds,
      seekCount: metrics.seekCount,
      paused: Boolean(video.paused),
      ended: Boolean(video.ended)
    };
  }

  function sample() {
    const video = bestVideo();
    lastKnownVideo = video || lastKnownVideo;
    if (!video) return;

    const now = performance.now();
    const position = Number(video.currentTime || 0);
    const duration = Number(video.duration || 0);
    const rate = Math.max(.25, Math.min(4, Number(video.playbackRate || 1)));
    const playing = !video.paused && !video.ended && video.readyState >= 2;
    const buffering = !video.paused && !video.ended && video.readyState < 3;
    const wall = Math.max(0, Math.min(3, (now - lastSample.wall) / 1000));
    const posDelta = position - lastSample.position;
    const visible = document.visibilityState === 'visible';

    if (visible && wall > .15) {
      if (lastSample.playing && playing) {
        const expected = Math.max(.1, wall * ((lastSample.rate + rate) / 2));
        const plausible = posDelta >= -.35 && posDelta <= expected * 1.85 + 1.35;
        if (plausible) {
          metrics.engagedSeconds += wall;
          if (posDelta > .03) {
            metrics.contentSeconds += posDelta;
            metrics.coverageRanges = mergeRanges([...metrics.coverageRanges, [lastSample.position, position]], duration || 86400);
          }
        } else if (Math.abs(posDelta) > 2) {
          metrics.seekCount += 1;
        }
      }
      if (buffering) metrics.bufferSeconds += wall;
    }

    lastSample = { wall: now, position, playing, rate };
  }

  async function sync(force = false, ended = false, manual = false, event = 'progress') {
    const config = await settings();
    if (!manual && !config.autoSync) return { ok: false, paused: true };

    const video = bestVideo();
    lastKnownVideo = video || lastKnownVideo;
    if (!video) return { ok: false, noVideo: true };

    const state = snapshot(video);
    if (!state.duration || state.currentTime < 1) return { ok: false, noProgress: true };

    const now = Date.now();
    const interval = Math.max(30, Number(config.syncIntervalSeconds || 30)) * 1000;
    if (!force && now - lastSync < interval) return { ok: false, throttled: true };
    lastSync = now;

    return runtimeMessage({
      type: 'LEARNING_PROGRESS',
      payload: {
        url: state.url,
        title: state.title,
        currentTime: state.currentTime,
        duration: state.duration,
        ended: ended || state.ended,
        source: 'extension',
        clientSessionId: metrics.clientSessionId,
        sessionStartedAt: metrics.startedAt,
        sessionEngagedSeconds: Number(metrics.engagedSeconds.toFixed(2)),
        sessionContentSeconds: Number(metrics.contentSeconds.toFixed(2)),
        coverageRanges: metrics.coverageRanges.map(([a,b]) => [Number(a.toFixed(2)), Number(b.toFixed(2))]),
        seekCount: metrics.seekCount,
        pauseCount: metrics.pauseCount,
        bufferSeconds: Number(metrics.bufferSeconds.toFixed(2)),
        playbackRate: Number(video.playbackRate || 1),
        visible: document.visibilityState === 'visible',
        event,
        manual,
        force
      }
    });
  }

  async function bindVideoEvents() {
    const video = bestVideo();
    if (!video || video.dataset.studyosBound === '2') return;
    video.dataset.studyosBound = '2';
    lastKnownVideo = video;

    video.addEventListener('play', () => {
      if (metrics.ended) metrics = createMetrics();
      lastSample = { wall: performance.now(), position: Number(video.currentTime || 0), playing: true, rate: Number(video.playbackRate || 1) };
    }, { passive: true });

    video.addEventListener('pause', async () => {
      metrics.pauseCount += 1;
      const config = await settings();
      if (config.syncOnPause !== false) sync(true, false, false, 'pause');
    }, { passive: true });

    video.addEventListener('ended', async () => {
      metrics.ended = true;
      const config = await settings();
      if (config.syncOnEnd !== false) sync(true, true, false, 'ended');
    }, { passive: true });

    video.addEventListener('seeking', () => {
      metrics.seekCount += 1;
    }, { passive: true });
  }

  document.addEventListener('play', () => bindVideoEvents(), true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sync(true, false, false, 'hidden');
  });
  window.addEventListener('pagehide', () => sync(true, false, false, 'pagehide'));

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'GET_TRACKER_STATE') {
      sendResponse(snapshot(bestVideo() || lastKnownVideo));
      return;
    }
    if (message?.type === 'FORCE_SYNC') {
      sync(true, false, true, 'manual').then((response) => sendResponse(response || { ok: false }));
      return true;
    }
  });

  setInterval(sample, 1000);
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      metrics = createMetrics();
      lastSample = { wall: performance.now(), position: 0, playing: false, rate: 1 };
      bindVideoEvents();
    }
    bindVideoEvents();
    sync(false, false, false, 'interval');
  }, 5000);

  bindVideoEvents();
})();