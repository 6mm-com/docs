(function () {
  if (window.__sixmmHomeMotionController) return;
  window.__sixmmHomeMotionController = true;

  var playTimer = null;
  var fallbackTimer = null;
  var lastPathname = window.location.pathname;
  var playedPathname = '';

  function isHomePage() {
    var path = window.location.pathname.replace(/\/+$/, '');
    return path === '/home' || path === '/zh/home';
  }

  function homeElement() {
    return document.querySelector('.sixmm-home');
  }

  function setBooting(enabled) {
    document.documentElement.classList.toggle('sixmm-home-motion-booting', enabled);
  }

  function revealWithoutAnimation() {
    setBooting(false);
    var home = homeElement();
    if (!home) return;
    home.classList.remove('sixmm-home-motion-play');
    home.classList.add('sixmm-home-motion-done');
  }

  function playOnceWhenStable() {
    window.clearTimeout(playTimer);
    window.clearTimeout(fallbackTimer);
    fallbackTimer = null;

    if (!isHomePage()) {
      revealWithoutAnimation();
      return;
    }

    if (playedPathname === window.location.pathname) {
      revealWithoutAnimation();
      return;
    }

    setBooting(true);

    fallbackTimer = window.setTimeout(function () {
      fallbackTimer = null;
      revealWithoutAnimation();
    }, 2500);

    playTimer = window.setTimeout(function () {
      var home = homeElement();
      if (!home) {
        revealWithoutAnimation();
        return;
      }

      if (playedPathname === window.location.pathname) {
        revealWithoutAnimation();
        return;
      }

      playedPathname = window.location.pathname;
      window.clearTimeout(fallbackTimer);
      fallbackTimer = null;
      setBooting(false);
      home.classList.remove('sixmm-home-motion-done');
      home.classList.add('sixmm-home-motion-play');

      window.setTimeout(function () {
        home.classList.remove('sixmm-home-motion-play');
        home.classList.add('sixmm-home-motion-done');
      }, 1800);
    }, 650);
  }

  if (isHomePage()) {
    setBooting(true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', playOnceWhenStable);
  } else {
    playOnceWhenStable();
  }

  window.setInterval(function () {
    if (window.location.pathname === lastPathname) return;
    lastPathname = window.location.pathname;
    playedPathname = '';
    playOnceWhenStable();
  }, 400);
})();
