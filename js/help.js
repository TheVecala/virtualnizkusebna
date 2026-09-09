(function () {
  'use strict';
  var search = document.getElementById('help-search');
  var sections = Array.prototype.slice.call(document.querySelectorAll('.searchable'));
  var status = document.getElementById('search-status');
  var empty = document.getElementById('no-results');
  var links = Array.prototype.slice.call(document.querySelectorAll('.help-nav a'));

  function normalize(value) {
    return value.toLocaleLowerCase('cs').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function filterHelp() {
    var query = normalize(search.value.trim());
    var visible = 0;
    sections.forEach(function (section) {
      var match = !query || normalize(section.textContent).indexOf(query) !== -1;
      section.classList.toggle('search-hidden', !match);
      if (match) visible += 1;
    });
    empty.hidden = visible !== 0;
    status.textContent = query ? (visible ? 'Nalezené sekce: ' + visible : 'Žádná odpovídající sekce') : '';
  }

  search.addEventListener('input', filterHelp);
  document.addEventListener('keydown', function (event) {
    if (event.key === '/' && !/input|textarea/i.test(document.activeElement.tagName)) {
      event.preventDefault(); search.focus();
    }
    if (event.key === 'Escape' && document.activeElement === search) {
      search.value = ''; filterHelp(); search.blur();
    }
  });

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (link) { link.classList.toggle('active', link.hash === '#' + entry.target.id); });
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    document.querySelectorAll('.help-section[id]').forEach(function (section) { observer.observe(section); });
  }
}());
