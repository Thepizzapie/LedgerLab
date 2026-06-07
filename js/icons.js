/* =============================================================================
   Ledger Lab — icon set
   -----------------------------------------------------------------------------
   Inline SVG, SF Symbols style: 24x24, stroked, round caps, currentColor so they
   inherit text color. Use LL.icon(name, extraClass). Keeps the app dependency
   free and crisp at any size.
   ============================================================================= */
(function (LL) {
  "use strict";
  const I = {
    table: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 10h18M9.5 10v9"/>',
    sql: '<path d="M9 8l-3.5 4L9 16M15 8l3.5 4L15 16"/>',
    pq: '<path d="M4 8h8M4 16h2M16 8h4M12 16h8"/><circle cx="14" cy="8" r="2.3"/><circle cx="9" cy="16" r="2.3"/>',
    inspect: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>',
    play: '<path fill="currentColor" stroke="none" d="M8 6.3c0-.6.6-.9 1.1-.6l8 5.6c.5.3.5 1 0 1.4l-8 5.6c-.5.3-1.1 0-1.1-.6z"/>',
    download: '<path d="M12 4v10M8.5 11L12 14.5 15.5 11"/><path d="M5 19h14"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V5.5A1.5 1.5 0 0 1 6.5 4H15"/>',
    load: '<path d="M3 12h11M10 7.5l4.5 4.5L10 16.5"/><path d="M20 4v16"/>',
    sortAsc: '<path d="M12 19V6M7 11l5-5 5 5"/>',
    sortDesc: '<path d="M12 5v13M7 13l5 5 5-5"/>',
    trash: '<path d="M5 7h14M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7M6.7 7l.8 11.6A1.5 1.5 0 0 0 9 20h6a1.5 1.5 0 0 0 1.5-1.4L17.3 7"/>',
    removeOther: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M9 5v14"/><path d="M13.5 12h4.5"/>',
    dedupe: '<rect x="4" y="4" width="11" height="11" rx="2.5"/><rect x="9" y="9" width="11" height="11" rx="2.5"/>',
    filter: '<path d="M4 5.5h16l-6.2 7.2V19l-3.6-2v-4.3z"/>',
    replace: '<path d="M4 8h12M13 5l3 3-3 3M20 16H8M11 13l-3 3 3 3"/>',
    split: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path stroke-dasharray="2.4 2.4" d="M12 5v14"/>',
    group: '<path d="M17.5 5H7l5 6.8L7 19h10.5"/>',
    merge: '<path d="M7 5v4.5c0 2.2 1.8 4 4 4h6M14 11l3.5 2.5L14 16"/>',
    hash: '<path d="M9 5L7 19M17 5l-2 14M5.5 9.5h13M4.5 14.5h13"/>',
    textformat: '<path d="M4 18l4.5-12L13 18M5.6 14h5.8M15.5 18l3-8 3 8M16.4 15.2h4.2"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3v4M15.5 3v4"/>',
    fillDown: '<path d="M12 4v11M8 11.5l4 4 4-4"/><path d="M6 20h12"/>',
    fillUp: '<path d="M12 20V9M8 12.5l4-4 4 4"/><path d="M6 4h12"/>',
    unpivot: '<path d="M4 6h7M4 11h7M4 16h7"/><path d="M16 5v14M16 5l-2.2 2.4M16 5l2.2 2.4"/>',
    branch: '<path d="M7 4v5.5A3.5 3.5 0 0 0 10.5 13H17M7 20v-7"/><path d="M14 10l3 3-3 3"/>',
    chevron: '<path d="M9.5 6l6 6-6 6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    lightbulb: '<path d="M9.2 17.5h5.6M10 20.5h4M12 3.5a5.5 5.5 0 0 0-3.4 9.8c.6.5.9 1.1 1 1.9h4.8c.1-.8.4-1.4 1-1.9A5.5 5.5 0 0 0 12 3.5z"/>',
    question: '<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5a2.6 2.6 0 0 1 5 .9c0 1.7-2.4 2.1-2.4 3.8"/><path stroke-width="2" d="M12 17.3v.2"/>',
    reset: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4v4h-4"/>',
    warning: '<path d="M12 4.5l8.5 15H3.5z"/><path d="M12 10v4.2"/><path stroke-width="2" d="M12 17.4v.2"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><path stroke-width="2" d="M12 8v.2"/>',
    wand: '<path d="M5 19l8.4-8.4M16 4l.9 2.4 2.4.9-2.4.9L16 10.6l-.9-2.4L12.7 7.3l2.4-.9z"/>',
    plus: '<path d="M12 6v12M6 12h12"/>',
    book: '<path d="M5 4.5h11A2.5 2.5 0 0 1 18.5 7v12.5H7A2 2 0 0 1 5 17.5z"/><path d="M5 17.5A2 2 0 0 1 7 16h11.5"/>',
  };
  LL.icon = function (name, cls) {
    const p = I[name];
    if (!p) return "";
    return `<svg class="icn${cls ? " " + cls : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  };
})(window.LL = window.LL || {});
