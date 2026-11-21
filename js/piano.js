(() => {
  'use strict';
  const piano = document.getElementById('piano');
  const toggle = document.getElementById('soundBtn');
  const label = document.getElementById('soundLabel');
  let enabled = true;
  let away = false;
  let pending = false;
  let generation = 0;
  let failed = false;
  piano.volume = 0.8;

  function update() {
    const playing = enabled && !piano.paused && !piano.error;
    label.textContent = playing ? '音乐开' : failed ? '重试音乐' : enabled ? '点按播放' : '音乐关';
    toggle.setAttribute('aria-pressed', String(playing));
    toggle.setAttribute('aria-label', (playing ? '暂停' : '播放') + '李斯特《爱之梦》第三首');
  }

  function sync() {
    if (!enabled || document.hidden || away) {
      generation++;
      pending = false;
      piano.pause();
      update();
      return;
    }
    if (pending || !piano.paused) return;
    pending = true;
    const request = ++generation;
    piano.play().catch(error => {
      if (request === generation && !['NotAllowedError','AbortError'].includes(error.name)) {
        failed = true;
      }
    }).finally(() => {
      if (request !== generation) return;
      pending = false;
      update();
    });
  }

  toggle.addEventListener('click', () => {
    enabled = piano.paused && !pending;
    if (enabled && failed) {
      failed = false;
      piano.load();
    }
    sync();
  });
  // A trusted tap or keyboard activation can start playback when autoplay was denied.
  document.addEventListener('click', event => {
    if (!toggle.contains(event.target) && event.isTrusted && enabled && !failed && piano.paused) sync();
  }, true);
  piano.addEventListener('playing', () => { failed = false; update(); });
  piano.addEventListener('pause', update);
  piano.addEventListener('error', () => { failed = true; update(); });
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', () => { away = true; sync(); });
  window.addEventListener('pageshow', () => { away = false; sync(); });
  sync();
})();
