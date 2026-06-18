/* timeline.js: the chronology. The atlas covers space; this folio covers
   time: every link in every chain of custody, and every sighting, set in
   order, with the dispersal events among them as notices. Dispersal events
   themselves are kept here too. The chronicle renderer is a pure function over
   data so the static public file can reuse it unchanged. */

PV.Timeline = (function () {
  const S = PV.state;
  const U = PV.util;
  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'];

  /* read a year (and month, when named) out of a free-text date */
  function parseWhen(s) {
    s = String(s || '');
    const y = /(\d{4})/.exec(s);
    if (!y) return null;
    let month = 0;
    MONTHS.forEach((m, i) => { if (s.toLowerCase().includes(m)) month = i + 1; });
    return { year: +y[1], month, key: +y[1] * 100 + month };
  }

  function custodyLine(r, x) {
    const st = PV.vocab.statusOf(r.status);
    const transfer = x.transfer && x.transfer !== 'unknown' ? ' · ' + U.esc(x.transfer) : '';
    return '<div class="tl-item" data-id="' + U.esc(r.id) + '">' +
      '<span class="when">' + U.esc(x.date || '') + '</span>' +
      '<span class="no">' + U.esc(r.id) + '</span>' +
      '<span class="what">' + U.esc(x.holder || 'unknown holder') +
      '<span class="by">' + U.esc(PV.Model.title(r)) + transfer + '</span></span>' +
      '<span class="mark ' + st.cls + '">' + U.esc(st.label) + '</span></div>';
  }

  function sightingLine(r, x) {
    return '<div class="tl-item" data-id="' + U.esc(r.id) + '">' +
      '<span class="when">' + U.esc(x.date || '') + '</span>' +
      '<span class="no">' + U.esc(r.id) + '</span>' +
      '<span class="what">' + U.esc(x.kind) + (x.place ? ' · ' + U.esc(x.place) : '') +
      '<span class="by">' + U.esc(PV.Model.title(r)) + '</span></span>' +
      '<span class="bearing ' + U.esc(x.bearing) + '">' + U.esc(x.bearing) + '</span></div>';
  }

  function eventBlock(ev, count) {
    let h = '<div class="tl-event"><div class="ev-tag">Dispersal event' + (ev.date ? ' · ' + U.esc(ev.date) : '') + '</div>';
    h += '<div class="ev-name">' + U.esc(ev.name || 'Unnamed event') + '</div>';
    if (ev.place) h += '<div class="ev-place">' + U.esc(ev.place) + '</div>';
    if (ev.note) h += '<div class="ev-note">' + U.esc(ev.note) + '</div>';
    if (count) h += '<div class="ev-count">' + count + (count === 1 ? ' object' : ' objects') + ' in this file</div>';
    return h + '</div>';
  }

  function yearHead(label) {
    return '<div class="tl-yearhead"><span class="y">' + U.esc(label) + '</span><span class="rule"></span></div>';
  }

  function html(data, opts) {
    opts = opts || {};
    const rs = (data.records || []).filter(r => !r.struck);
    const events = (data.project && data.project.events) || [];

    const items = [];
    rs.forEach(r => {
      (r.custody || []).forEach(x => items.push({ kind: 'custody', when: parseWhen(x.date), r, x }));
      (r.sightings || []).forEach(x => items.push({ kind: 'sighting', when: parseWhen(x.date), r, x }));
    });
    events.forEach(ev => items.push({
      kind: 'event', when: parseWhen(ev.date), ev,
      count: rs.filter(r => r.eventId === ev.id).length,
    }));

    const dated = items.filter(i => i.when).sort((a, b) =>
      a.when.key - b.when.key ||
      (a.kind === 'event' ? -1 : b.kind === 'event' ? 1 : 0) ||
      String(a.r ? a.r.id : a.ev.id).localeCompare(String(b.r ? b.r.id : b.ev.id)));
    const undated = items.filter(i => !i.when);

    let h = '<h2 class="head">Chronology</h2>' +
      '<p class="subhead">the chains of custody and the sightings, set in time, with the dispersal events among them</p>';

    if (!dated.length && !undated.length) {
      h += '<p class="hint" style="font-style:italic">Nothing is dated yet. The chronology draws on each object\'s chain of custody and sightings, and on the dispersal events kept on this folio.</p>';
      return h;
    }

    const line = i => i.kind === 'event' ? eventBlock(i.ev, i.count)
      : i.kind === 'sighting' ? sightingLine(i.r, i.x)
      : custodyLine(i.r, i.x);

    let year = null;
    dated.forEach(i => {
      if (i.when.year !== year) { year = i.when.year; h += yearHead(String(year)); }
      h += line(i);
    });

    if (undated.length) {
      h += yearHead('Undated');
      undated.filter(i => i.kind === 'event').forEach(i => { h += line(i); });
      undated.filter(i => i.kind !== 'event').forEach(i => { h += line(i); });
    }
    return h;
  }

  /* ----- the working view: the chronology plus the keeping of events ----- */

  function evField(ev, key, label, ph, redrawChronicle) {
    const input = U.h('input', { type: 'text', value: ev[key] || '', placeholder: ph || '' });
    input.addEventListener('input', () => {
      ev[key] = input.value;
      S.project.modified = U.nowISO();
      PV.Store.save();
      redrawChronicle();
    });
    return U.h('div', { class: 'field' }, U.h('label', null, label), input);
  }

  function manager(redrawChronicle) {
    const det = U.h('details', null, U.h('summary', null, 'Dispersal events'));
    const box = U.h('div', { class: 'fm-form' });
    const redraw = () => {
      box.innerHTML = '';
      (S.project.events || []).forEach(ev => {
        const item = U.h('div', { class: 'item' },
          U.h('div', { class: 'item-head' },
            U.h('span', { class: 'n' }, ev.id),
            U.h('span', { class: 'sp' }),
            U.h('button', {
              class: 'act', onclick: () => {
                const cleared = PV.Model.removeEvent(ev.id);
                PV.Store.save();
                U.toast('Event removed' + (cleared ? '; cleared from ' + cleared + (cleared === 1 ? ' object' : ' objects') : ''));
                redraw(); redrawChronicle();
              },
            }, 'Remove')),
          evField(ev, 'name', 'Name of the event', 'e.g. The 1897 punitive expedition', redrawChronicle),
          U.h('div', { class: 'row2' },
            evField(ev, 'date', 'When', 'e.g. February 1897', redrawChronicle),
            evField(ev, 'place', 'Where', 'place', redrawChronicle)),
          evField(ev, 'note', 'Note', 'what happened, in a sentence or two', redrawChronicle));
        box.append(item);
      });
      box.append(U.h('div', { class: 'add-line' }, U.h('button', {
        class: 'act', onclick: () => {
          PV.Model.addEvent();
          PV.Store.save();
          redraw();
        },
      }, '+ Add a dispersal event')));
    };
    redraw();
    det.append(box);
    return U.h('div', { class: 'frontmatter', style: { margin: '30px 0 0' } },
      det,
      U.h('div', { class: 'fm-line', style: { marginTop: '10px' } },
        'Assign objects to an event from the registrar\'s desk; the statistics folio counts what each event scattered.'));
  }

  function render() {
    const sect = document.getElementById('view-timeline');
    sect.innerHTML = '';
    const sheet = U.h('div', { class: 'sheet narrow' });
    const chronicle = U.h('div', { id: 'tl-chronicle' });
    let timer = null;
    const redrawChronicle = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        chronicle.innerHTML = html({ project: S.project, records: S.records }, {});
        wire(chronicle);
      }, 300);
    };
    chronicle.innerHTML = html({ project: S.project, records: S.records }, {});
    sheet.append(manager(redrawChronicle), chronicle);
    sect.append(sheet);
    wire(chronicle);
  }

  function wire(root) {
    root.querySelectorAll('.tl-item[data-id]').forEach(el => {
      el.addEventListener('click', () => { location.hash = '#/entry/' + el.dataset.id; });
    });
  }

  return { html, render };
})();
