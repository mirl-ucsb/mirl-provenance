/* register.js: the docket, a ruled table of every object file in the project,
   with the front matter above it and a filter line for working files. The
   table renderer is a pure function over data so the static public file can
   reuse it unchanged. */

PV.Register = (function () {
  const S = PV.state;
  const U = PV.util;
  const selected = new Set();   /* object ids picked for batch work; session only */

  /* ---------- pure renderers (shared with the export) ---------- */

  function certHTML(r) {
    const c = PV.vocab.certaintyOf(r.certainty);
    return '<span class="cert"><span class="pt">' + c.pt + '</span>' + c.label + '</span>';
  }

  function holderText(r) {
    const ch = r.currentHolder || {};
    return [ch.name, ch.since ? '(since ' + ch.since + ')' : ''].filter(s => s && s.trim()).join(' ');
  }

  function rowHTML(r, opts) {
    const st = PV.vocab.statusOf(r.status);
    const t = PV.Model.title(r);
    const alts = PV.Model.altTitles(r);
    const dirAttr = s => U.isRTL(s) ? ' dir="rtl"' : '';
    let titleCell = '<span class="t"' + dirAttr(t) + '>' + U.esc(t) + '</span>';
    alts.forEach(a => { titleCell += '<span class="t2"' + dirAttr(a.text) + (a.lang ? ' lang="' + U.esc(a.lang) + '"' : '') + '>' + U.esc(a.text) + '</span>'; });
    if (r.creator) titleCell += '<span class="by">' + U.esc(r.creator) + '</span>';
    const claimN = (r.claims || []).length;
    const flag = r.struck ? '<span class="struck-flag">struck</span>'
      : (!r.publish && !opts.static ? '<span class="held-flag">held back</span>' : '');
    const selCell = opts.selectable
      ? '<td class="sel"><input type="checkbox" data-sel="' + U.esc(r.id) + '"' + (selected.has(r.id) ? ' checked' : '') + '></td>'
      : '';
    return '<tr class="entry' + (r.struck ? ' struck' : '') + '" data-id="' + U.esc(r.id) + '">' +
      selCell +
      '<td class="no">' + U.esc(r.id) + flag + '</td>' +
      '<td class="title">' + titleCell + '</td>' +
      '<td class="mono">' + U.esc(r.date) + '</td>' +
      '<td>' + U.esc(r.objectType) + '</td>' +
      '<td>' + U.esc(r.origin) + '</td>' +
      '<td><span class="mark ' + st.cls + '">' + U.esc(st.label) + '</span>' +
        (claimN ? '<span class="claim-flag" title="' + claimN + ' claim' + (claimN === 1 ? '' : 's') + ' for return">▲ ' + claimN + '</span>' : '') + '</td>' +
      '<td>' + certHTML(r) + '</td>' +
      '<td>' + U.esc(holderText(r)) + '</td>' +
      '</tr>';
  }

  function tableHTML(records, opts) {
    opts = opts || {};
    const sortable = !opts.static;
    const cols = [
      ['no', 'No.'], ['title', 'Object'], ['date', 'Date'], [null, 'Type'],
      [null, 'Origin / community'], ['status', 'Status'], [null, 'Provenance'], [null, 'Current holder'],
    ];
    let h = '<table class="register"><thead><tr>';
    if (opts.selectable) h += '<th class="sel" style="cursor:default"><input type="checkbox" id="sel-all" title="Select every object shown"></th>';
    cols.forEach(([key, label]) => {
      const isSorted = sortable && key && S.sort.by === key;
      h += '<th' + (sortable && key ? ' data-sort="' + key + '"' : ' style="cursor:default"') + '>' +
        U.esc(label) + (isSorted ? '<span class="dir">' + (S.sort.dir > 0 ? '▾' : '▴') + '</span>' : '') + '</th>';
    });
    h += '</tr></thead><tbody>';
    if (!records.length) {
      h += '<tr><td colspan="' + (opts.selectable ? 9 : 8) + '" class="register-empty" id="register-empty-cell"></td></tr>';
    } else {
      records.forEach(r => { h += rowHTML(r, opts); });
    }
    h += '</tbody></table>';
    return h;
  }

  /* ---------- filtering and sorting ---------- */

  function matches(r, q) {
    if (!q) return true;
    const hay = [
      r.id, r.creator, r.date, r.objectType, r.medium, r.origin, r.note,
      (r.titles || []).map(t => t.text).join(' '),
      (r.identifiers || []).map(x => x.value).join(' '),
      (r.tags || []).join(' '),
      (r.currentHolder || {}).name,
      (r.custody || []).map(c => c.holder).join(' '),
      (r.claims || []).map(c => c.claimant).join(' '),
      (r.location || {}).place,
    ].join(' ').toLowerCase();
    return q.toLowerCase().split(/\s+/).every(w => hay.includes(w));
  }

  function visible() {
    let rs = S.records.filter(r => matches(r, S.filters.q));
    if (S.filters.statuses.length) rs = rs.filter(r => S.filters.statuses.includes(r.status));
    const dir = S.sort.dir, by = S.sort.by;
    const key = r => by === 'title' ? PV.Model.title(r).toLowerCase()
      : by === 'date' ? (r.date || '￿')
      : by === 'status' ? PV.vocab.STATUS.findIndex(s => s.key === r.status)
      : r.id;
    rs = rs.slice().sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) * dir);
    return rs;
  }

  /* ---------- the working view ---------- */

  function fmField(key, label, ph) {
    const input = U.h('input', { type: 'text', value: S.project[key] || '', placeholder: ph || '' });
    input.addEventListener('input', () => { S.project[key] = input.value; PV.App.projectChanged(); });
    return U.h('div', { class: 'field' }, U.h('label', null, label), input);
  }

  function frontmatter() {
    const p = S.project;
    const kept = [p.compiler, p.institution].filter(Boolean).join(', ');
    const fm = U.h('div', { class: 'frontmatter' },
      U.h('h2', { class: 'fm-title' }, p.title || 'Untitled object file'),
      p.subtitle ? U.h('p', { class: 'fm-sub' }, p.subtitle) : null,
      U.h('div', { class: 'fm-line' }, 'A file of contested and dispersed objects' + (kept ? ' · kept by ' + kept : '')),
      p.note ? U.h('p', { class: 'hint', style: { maxWidth: '760px', marginTop: '14px' } }, p.note) : null);
    const det = U.h('details', null, U.h('summary', null, 'Front matter'));
    const form = U.h('div', { class: 'fm-form' });
    form.append(
      fmField('title', 'Title of the file', 'e.g. The dispersed objects of the Qasr al-Bahr'),
      fmField('subtitle', 'Subtitle', 'optional'),
      U.h('div', { class: 'row2' },
        fmField('compiler', 'Compiled by', 'your name'),
        fmField('institution', 'Institution or community', 'optional')),
      fmField('contact', 'Contact', 'optional; appears in the public file and the dossier'));
    const sig = U.h('input', { type: 'text', value: p.siglum || 'PRV', style: { width: '110px', fontFamily: 'var(--mono)', textTransform: 'uppercase' } });
    sig.addEventListener('input', () => {
      S.project.siglum = sig.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'PRV';
      PV.App.projectChanged();
    });
    form.append(U.h('div', { class: 'field' },
      U.h('label', null, 'File mark (siglum)'), sig,
      U.h('div', { class: 'note' },
        'Used in new object numbers, like an accession prefix, so files can cite one another without colliding. Existing objects keep their numbers.')));
    const noteArea = U.h('textarea', { rows: '3', placeholder: 'A short note on the scope of this file: what it covers, on whose behalf, with what sources.' });
    noteArea.value = p.note || '';
    noteArea.addEventListener('input', () => { p.note = noteArea.value; PV.App.projectChanged(); });
    form.append(U.h('div', { class: 'field' }, U.h('label', null, 'Scope note'), noteArea));
    det.append(form);
    fm.append(det);
    return fm;
  }

  function filterline() {
    const wrap = U.h('div', { class: 'filterline' });
    const q = U.h('input', { type: 'text', value: S.filters.q, placeholder: 'Search the docket…' });
    q.addEventListener('input', () => { S.filters.q = q.value; renderTable(); });
    wrap.append(q);

    const marks = U.h('div', { class: 'marks' });
    PV.vocab.STATUS.forEach(st => {
      const n = S.records.filter(r => r.status === st.key && !r.struck).length;
      const b = U.h('button', {
        class: 'mark ' + st.cls + (S.filters.statuses.includes(st.key) ? ' on' : ''),
        title: 'Show only ' + st.label.toLowerCase() + ' objects',
        onclick: () => {
          const i = S.filters.statuses.indexOf(st.key);
          if (i >= 0) S.filters.statuses.splice(i, 1); else S.filters.statuses.push(st.key);
          render();
        },
      }, st.label + (n ? '  ' + n : ''));
      marks.append(b);
    });
    wrap.append(marks);

    if (S.filters.q || S.filters.statuses.length) {
      wrap.append(U.h('button', { class: 'act', onclick: () => { S.filters.q = ''; S.filters.statuses = []; render(); } }, 'Clear'));
    }
    return wrap;
  }

  /* ----- batch work: event, tag, status for many objects at once.
     Publication stays deliberate, one object at a time. ----- */
  function applyBatch(fn, what) {
    let n = 0;
    selected.forEach(id => {
      const r = PV.Model.get(id);
      if (r && fn(r) !== false) { PV.Model.touch(r); n++; }
    });
    PV.Store.save();
    renderTable();
    U.toast(what + ' on ' + n + (n === 1 ? ' object' : ' objects'));
  }

  function batchline() {
    const bar = document.getElementById('register-batch');
    bar.innerHTML = '';
    if (!selected.size) return;
    const wrap = U.h('div', { class: 'batchline' });
    wrap.append(U.h('span', { class: 'nsel' }, selected.size + ' selected'));

    const stSel = U.h('select', null, U.h('option', { value: '' }, 'status…'),
      ...PV.vocab.STATUS.map(st => U.h('option', { value: st.key }, st.label)));
    stSel.addEventListener('change', () => {
      if (!stSel.value) return;
      const key = stSel.value;
      applyBatch(r => { PV.Model.setStatus(r, key); }, 'Status set');
    });
    wrap.append(U.h('span', { class: 'grp' }, U.h('span', { class: 'label' }, 'Set'), stSel));

    if ((S.project.events || []).length) {
      const evSel = U.h('select', null, U.h('option', { value: '' }, 'event…'),
        U.h('option', { value: '-' }, 'no event'),
        ...S.project.events.map(ev => U.h('option', { value: ev.id }, ev.name || 'unnamed event')));
      evSel.addEventListener('change', () => {
        if (!evSel.value) return;
        const id = evSel.value === '-' ? null : evSel.value;
        applyBatch(r => { r.eventId = id; }, 'Event assigned');
      });
      wrap.append(U.h('span', { class: 'grp' }, U.h('span', { class: 'label' }, 'Assign'), evSel));
    } else {
      /* no events yet: name one here and assign it in the same stroke, the
         many-objects-from-one-expedition moment after an import */
      const evName = U.h('input', { type: 'text', placeholder: 'name a dispersal event…', style: { width: '180px' } });
      const evGo = () => {
        const name = evName.value.trim();
        if (!name) return;
        const ev = PV.Model.addEvent();
        ev.name = name;
        applyBatch(r => { r.eventId = ev.id; }, 'Event "' + name + '" assigned');
      };
      evName.addEventListener('keydown', e => { if (e.key === 'Enter') evGo(); });
      wrap.append(U.h('span', { class: 'grp' }, evName, U.h('button', { class: 'act', onclick: evGo }, 'Add event')));
    }

    const tagIn = U.h('input', { type: 'text', placeholder: 'a tag to add…', style: { width: '150px' } });
    const tagGo = () => {
      const t = tagIn.value.trim();
      if (!t) return;
      applyBatch(r => { if (!r.tags.includes(t)) r.tags.push(t); }, 'Tag added');
    };
    tagIn.addEventListener('keydown', e => { if (e.key === 'Enter') tagGo(); });
    wrap.append(U.h('span', { class: 'grp' }, tagIn, U.h('button', { class: 'act', onclick: tagGo }, 'Add tag')));

    wrap.append(U.h('span', { style: { flex: '1' } }),
      U.h('button', { class: 'act', onclick: () => { selected.clear(); renderTable(); } }, 'Clear selection'));
    bar.append(wrap);
  }

  function renderTable() {
    const host = document.getElementById('register-table');
    const rs = visible();
    host.innerHTML = tableHTML(rs, { selectable: true });
    const count = document.getElementById('register-count');
    const live = S.records.filter(r => !r.struck).length;
    const shownLive = rs.filter(r => !r.struck).length;
    const shownStruck = rs.length - shownLive;
    let txt = shownLive === live
      ? live + (live === 1 ? ' object file' : ' object files')
      : shownLive + ' of ' + live + ' object files shown';
    const held = PV.Model.heldBackCount();
    if (held) txt += ' · ' + held + ' held back';
    if (shownStruck) txt += ' · ' + shownStruck + ' struck ' + (shownStruck === 1 ? 'line' : 'lines');
    count.textContent = txt;

    const emptyCell = document.getElementById('register-empty-cell');
    if (emptyCell) {
      if (!S.records.length) {
        emptyCell.append(
          'The docket is empty. Each object file is the biography of a single contested or dispersed thing.',
          U.h('div', { class: 'actions' },
            U.h('button', { class: 'btn', onclick: () => PV.App.newEntry() }, 'Begin the first object file'),
            PV.SAMPLE ? U.h('button', { class: 'btn', onclick: () => PV.App.loadSample() }, 'Open the sample file') : null));
      } else {
        emptyCell.textContent = 'Nothing in the docket matches. Clear the search or the status marks above.';
      }
    }

    host.querySelectorAll('tr.entry').forEach(tr => {
      tr.addEventListener('click', e => {
        if (e.target.closest('.sel')) return;
        location.hash = '#/entry/' + tr.dataset.id;
      });
    });
    host.querySelectorAll('input[data-sel]').forEach(box => {
      box.addEventListener('change', () => {
        if (box.checked) selected.add(box.dataset.sel); else selected.delete(box.dataset.sel);
        batchline();
        const all = document.getElementById('sel-all');
        if (all) all.checked = rs.length > 0 && rs.every(r => selected.has(r.id));
      });
    });
    const all = document.getElementById('sel-all');
    if (all) {
      all.checked = rs.length > 0 && rs.every(r => selected.has(r.id));
      all.addEventListener('change', () => {
        if (all.checked) rs.forEach(r => selected.add(r.id)); else rs.forEach(r => selected.delete(r.id));
        renderTable();
      });
    }
    /* forget selections that no longer exist (struck outright, merged away) */
    Array.from(selected).forEach(id => { if (!PV.Model.get(id)) selected.delete(id); });
    batchline();

    host.querySelectorAll('th[data-sort]').forEach(th => {
      const by = th.dataset.sort;
      th.setAttribute('tabindex', '0');
      if (S.sort.by === by) th.setAttribute('aria-sort', S.sort.dir > 0 ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
      const doSort = () => {
        if (S.sort.by === by) S.sort.dir = -S.sort.dir; else { S.sort.by = by; S.sort.dir = 1; }
        renderTable();
      };
      th.addEventListener('click', doSort);
      th.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doSort(); } });
    });
  }

  function render() {
    const sect = document.getElementById('view-register');
    sect.innerHTML = '';
    const sheet = U.h('div', { class: 'sheet' });
    sheet.append(frontmatter(), filterline(),
      U.h('div', { class: 'countline', id: 'register-count' }),
      U.h('div', { id: 'register-batch' }),
      U.h('div', { id: 'register-table' }));
    sect.append(sheet);
    renderTable();
  }

  return { render, tableHTML, visible };
})();
