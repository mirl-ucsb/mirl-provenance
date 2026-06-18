/* indexes.js: the back of the book. Alphabetical indexes of creators, tags,
   and places, each line pointing to entry numbers, with dotted leaders in
   the manner of a printed register. A pure renderer over data, so the
   static finding aid and the memorial book reuse it unchanged. */

PV.Indexes = (function () {
  const U = PV.util;

  /* gather index terms: term -> ordered unique object ids */
  function gather(rs) {
    const creators = new Map(), tags = new Map(), origins = new Map(), holders = new Map();
    const put = (map, term, id) => {
      term = String(term || '').trim();
      if (!term) return;
      if (!map.has(term)) map.set(term, []);
      const ids = map.get(term);
      if (!ids.includes(id)) ids.push(id);
    };
    rs.forEach(r => {
      put(creators, r.creator, r.id);
      (r.tags || []).forEach(t => put(tags, t, r.id));
      put(origins, r.origin, r.id);
      put(holders, (r.currentHolder || {}).name, r.id);
      (r.custody || []).forEach(c => put(holders, c.holder, r.id));
    });
    return { creators, tags, origins, holders };
  }

  function sectionHTML(title, map) {
    const terms = Array.from(map.keys()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    let h = '<div class="ix-sect"><h3>' + U.esc(title) + '</h3>';
    if (!terms.length) {
      h += '<div class="ix-none">nothing indexed yet</div>';
    } else {
      const sig = (PV.state.project.siglum || 'PRV') + '-0*';
      terms.forEach(t => {
        const refs = map.get(t).map(id =>
          '<span class="ix-ref" data-id="' + U.esc(id) + '">' + U.esc(id.replace(new RegExp('^' + sig), '')) + '</span>').join(', ');
        h += '<div class="ix-line"><span class="ix-term"' + (U.isRTL(t) ? ' dir="rtl"' : '') + '>' + U.esc(t) + '</span>' +
          '<span class="dots"></span><span class="ix-refs">' + refs + '</span></div>';
      });
    }
    return h + '</div>';
  }

  function html(data, opts) {
    opts = opts || {};
    const rs = (data.records || []).filter(r => !r.struck);
    const ix = gather(rs);
    let h = '<h2 class="head">Index</h2>' +
      '<p class="subhead">makers, tags, origins, and holders, each pointing to its object numbers</p>';
    h += sectionHTML('Makers and cultures', ix.creators);
    h += sectionHTML('Origins and communities', ix.origins);
    h += sectionHTML('Holders, past and present', ix.holders);
    h += sectionHTML('Tags', ix.tags);
    h += '<p class="stats-note">Numbers refer to object files of this project (' + U.esc(PV.state.project.siglum || 'PRV') + '-).</p>';
    return h;
  }

  function render() {
    const sect = document.getElementById('view-index');
    sect.innerHTML = '<div class="sheet narrow">' +
      html({ project: PV.state.project, records: PV.state.records }, {}) + '</div>';
    sect.querySelectorAll('.ix-ref[data-id]').forEach(el => {
      el.addEventListener('click', () => { location.hash = '#/entry/' + el.dataset.id; });
    });
  }

  return { html, render };
})();
