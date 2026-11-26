/* Brand accessibility for the bank's existing React navigation links.
   Visual wordmarks live in CSS. Preserve href, handlers and React children. */
(function () {
  'use strict';

  const LINK_SELECTOR =
    '.home-tools-header a.home-brand, ' +
    '.search-tools:not(.home-tools-header) a.workspace-home-link';
  const LINK_LABEL = '领世文学 · 题库首页';
  const OBSERVER_KEY = Symbol.for('lingshi.brand-interface.observer');

  function labelSubtree(element) {
    if (element.matches(LINK_SELECTOR)) labelLink(element);
    element.querySelectorAll(LINK_SELECTOR).forEach(labelLink);
  }

  function labelLink(link) {
    if (link.getAttribute('aria-label') !== LINK_LABEL) {
      link.setAttribute('aria-label', LINK_LABEL);
    }
  }

  function init() {
    const app = document.getElementById('app');
    if (!app || app[OBSERVER_KEY]) return;

    const observer = new MutationObserver(function (records) {
      const added = new Set();
      for (const record of records) {
        // A route change may reuse an anchor and only replace its text child.
        const owner = record.target.nodeType === 1
          ? record.target.closest(LINK_SELECTOR)
          : record.target.parentElement?.closest(LINK_SELECTOR);
        if (owner && app.contains(owner)) labelLink(owner);
        for (const node of record.addedNodes) {
          if (node.nodeType === 1 && node.isConnected && app.contains(node)) {
            added.add(node);
          }
        }
      }

      // Scan each newly mounted subtree once, never the entire app per mutation.
      for (const element of added) {
        let ancestor = element.parentElement;
        while (ancestor && ancestor !== app && !added.has(ancestor)) {
          ancestor = ancestor.parentElement;
        }
        if (!ancestor || ancestor === app) labelSubtree(element);
      }
    });

    app[OBSERVER_KEY] = observer;
    observer.observe(app, { childList: true, subtree: true });
    labelSubtree(app);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
