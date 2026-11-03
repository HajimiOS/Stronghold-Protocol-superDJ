(function () {
  if (window.__SP_FAB_SEED__) return;
  window.__SP_FAB_SEED__ = 1;

  try {
    var UI_KEY = 'sp.pref.ui-plugins';
    var SEED_KEY = 'sp.pref.hajimi-ui-seeded';
    var DEFAULT_IDS = ['coollayout', 'spdj'];
    if (!localStorage.getItem(SEED_KEY)) {
      var ids = [];
      var raw = localStorage.getItem(UI_KEY);
      if (raw) {
        try { ids = JSON.parse(raw); } catch (e) {}
        if (!Array.isArray(ids)) ids = [];
      }
      for (var i = 0; i < DEFAULT_IDS.length; i++) {
        if (ids.indexOf(DEFAULT_IDS[i]) < 0) ids.push(DEFAULT_IDS[i]);
      }
      ids.sort();
      localStorage.setItem(UI_KEY, JSON.stringify(ids));
      localStorage.setItem(SEED_KEY, '1');
    }
  } catch (e) {}

  function bootMod() {
    if (window.__SP_LITE_IMPORTING__ || (window.__SP_LITE__ && window.__SP_LITE__.anim)) return;
    window.__SP_LITE_IMPORTING__ = 1;
    import('/sp-plugins/spdj/boot.js')
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
