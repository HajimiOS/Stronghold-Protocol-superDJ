(function () {
  if (window.__SP_FAB_SEED__) return;
  window.__SP_FAB_SEED__ = 1;

  function bootMod() {
    if (window.__SP_LITE_IMPORTING__ || (window.__SP_LITE__ && window.__SP_LITE__.anim)) return;
    window.__SP_LITE_IMPORTING__ = 1;
    import('/sp-lite/boot.js')
      .then(function () {
        window.__SP_LITE_IMPORTING__ = 0;
      })
      .catch(function (e) {
        window.__SP_LITE_IMPORTING__ = 0;
        window.__SP_LITE_ERR__ = String((e && (e.stack || e.message)) || e);
        try { console.warn('[sp-lite] import fail', e); } catch (err) {}
        setTimeout(bootMod, 2000);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(bootMod, 50);
    });
  } else {
    setTimeout(bootMod, 50);
  }
  window.addEventListener('load', function () {
    setTimeout(bootMod, 100);
  });
})();
