(function () {
  'use strict';
  var links = Array.from(document.querySelectorAll('.help-nav a'));
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) links.forEach(function (link) {
          link.classList.toggle('active', link.hash === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    document.querySelectorAll('.help-section[id]').forEach(function (section) { observer.observe(section); });
  }
}());
