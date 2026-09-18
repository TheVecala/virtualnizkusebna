(function () {
  'use strict';
  var drawer = document.getElementById('help-drawer');
  if (!drawer || typeof drawer.showModal !== 'function') return;
  var closeButton = document.getElementById('help-drawer-close');
  var status = document.getElementById('help-drawer-status');
  var frame = null;
  var returnFocus = null;
  var scrollPosition = 0;

  function closeHelp() {
    if (frame) {
      try { scrollPosition = frame.contentWindow.scrollY; } catch (error) { /* Nedostupný obsah. */ }
    }
    drawer.classList.remove('is-open');
    drawer.close();
  }

  document.querySelectorAll('[data-help-open]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      // Zachovat otevření původního odkazu přes Ctrl/Cmd a nové karty.
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      var menu = link.closest('details');
      returnFocus = menu ? menu.querySelector('summary') : link;
      if (menu) menu.removeAttribute('open');
      if (!drawer.open) drawer.showModal();
      requestAnimationFrame(function () {
        if (drawer.open) {
          drawer.classList.add('is-open');
          if (frame) {
            try { frame.contentWindow.scrollTo({ top: scrollPosition, behavior: 'instant' }); } catch (error) { /* Nedostupný obsah. */ }
          }
        }
      });
      closeButton.focus();
      if (!frame) {
        frame = document.createElement('iframe');
        frame.title = 'Obsah nápovědy Virtuální zkušebny';
        frame.addEventListener('load', function () {
          var loaded = false;
          try {
            loaded = !!frame.contentDocument.querySelector('.help-embedded');
          } catch (error) { /* Chybová stránka může mít jiný origin. */ }
          status.hidden = loaded;
          if (!loaded) status.textContent = 'Nápovědu se nepodařilo načíst. Zkuste odkaz na samostatnou nápovědu dole.';
        });
        frame.src = 'help.php?embedded=1';
        document.getElementById('help-drawer-content').appendChild(frame);
      }
    });
  });

  closeButton.addEventListener('click', closeHelp);
  drawer.addEventListener('cancel', function (event) {
    event.preventDefault();
    closeHelp();
  });
  drawer.addEventListener('click', function (event) {
    if (event.target !== drawer) return;
    var bounds = drawer.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right
        || event.clientY < bounds.top || event.clientY > bounds.bottom) closeHelp();
  });
  drawer.addEventListener('close', function () {
    drawer.classList.remove('is-open');
    if (returnFocus && returnFocus.isConnected) returnFocus.focus();
  });
  window.addEventListener('message', function (event) {
    if (frame && event.source === frame.contentWindow && event.origin === window.location.origin
        && event.data === 'zkusebna:close-help' && drawer.open) closeHelp();
  });
}());
