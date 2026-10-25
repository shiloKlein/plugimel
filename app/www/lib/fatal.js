// Show any startup error on screen instead of a dead page. Loaded first, as a classic script.
(function () {
  function show(msg) {
    var box = document.getElementById('fatal');
    if (!box) {
      box = document.createElement('div');
      box.id = 'fatal';
      box.style.cssText = 'position:fixed;top:0;inset-inline:0;z-index:99;background:#c0392b;color:#fff;padding:12px 16px;font:14px/1.5 sans-serif;white-space:pre-wrap';
      (document.body || document.documentElement).appendChild(box);
    }
    box.textContent = 'שגיאה באפליקציה – נא לצלם מסך ולשלוח:\n' + msg;
  }
  window.addEventListener('error', function (e) { show((e.message || e) + (e.filename ? '\n' + e.filename + ':' + e.lineno : '')); });
  window.addEventListener('unhandledrejection', function (e) { show(String(e.reason && (e.reason.stack || e.reason.message) || e.reason)); });
})();
