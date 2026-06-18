/* stats.js: the reckoning. Counts by status, certainty, and consent, set as
   a ledger summary with tally strokes. A pure renderer over data, so the
   static finding aid can reuse it unchanged. */

PV.Stats = (function () {
  const U = PV.util;

  /* tally strokes in groups of five: four uprights and a cross-stroke */
  function tallySVG(n) {
    if (!n) return '';
    const capped = Math.min(n, 75);
    const groups = Math.ceil(capped / 5);
    const W = groups * 27, H = 22;
    let s = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">';
    let left = capped;
    for (let g = 0; g < groups; g++) {
      const x0 = g * 27;
      const inGroup = Math.min(left, 5);
      for (let i = 0; i < Math.min(inGroup, 4); i++) {
        const x = x0 + 2 + i * 5;
        s += '<line x1="' + x + '" y1="3" x2="' + x + '" y2="19" stroke="currentColor" stroke-width="1.4"/>';
      }
      if (inGroup === 5) {
        s += '<line x1="' + (x0 - 1) + '" y1="17" x2="' + (x0 + 20) + '" y2="4" stroke="currentColor" stroke-width="1.4"/>';
      }
      left -= inGroup;
    }
    s += '</svg>';
    return s + (n > 75 ? '<span style="font-family:var(--mono);font-size:12px"> +' + (n - 75) + '</span>' : '');
  }

  function html(data, opts) {
    opts = opts || {};
    const all = data.records || [];
    const rs = all.filter(r => !r.struck);     /* struck files are cancelled lines, not counts */
    const struckN = all.length - rs.length;
    const evidence = rs.flatMap(r => r.evidence || []);
    const claims = rs.flatMap(r => r.claims || []);
    const located = rs.filter(r => r.location && (r.location.place || (typeof r.location.lat === 'number' && typeof r.location.lon === 'number')));
    const publishable = located.filter(r => r.location.publish !== 'withheld');
    const published = rs.filter(r => r.publish).length;
    /* extents let collection-level files answer in objects, not files */
    const sumExt = rows => rows.reduce((a, r) =>
      a + ((r.extent && typeof r.extent.amount === 'number') ? r.extent.amount : 0), 0);
    const objTotal = sumExt(rs);
    const objSub = rows => {
      const n = sumExt(rows);
      return n > 0 ? '<div class="n-sub">' + n.toLocaleString('en-US') + ' objects</div>' : '';
    };

    let h = '<h2 class="head">Statistics</h2>' +
      '<p class="subhead">what the file holds, counted</p>';

    h += '<div class="stats-grid">' +
      cell(rs.length, rs.length === 1 ? 'object file' : 'object files') +
      (objTotal > 0 ? cell(objTotal.toLocaleString('en-US'), 'objects, where counted') : '') +
      (opts.publicOnly ? '' : cell(published, 'marked publish')) +
      cell(evidence.length, 'items of evidence') +
      cell(claims.length, claims.length === 1 ? 'claim for return' : 'claims for return') +
      cell(located.length, 'locations recorded') +
      '</div>';

    const events = (data.project && data.project.events) || [];
    if (events.length) {
      h += '<h3 class="head" style="font-size:19px;margin-top:40px">By dispersal event</h3>';
      h += '<table class="tally">';
      events.forEach(ev => {
        const group = rs.filter(r => r.eventId === ev.id);
        h += '<tr><td class="k" style="width:300px"><span style="font-weight:500">' + U.esc(ev.name || 'unnamed event') + '</span>' +
          (ev.date ? ' <span class="cert" style="font-size:14.5px">' + U.esc(ev.date) + '</span>' : '') + '</td>' +
          '<td class="bar" style="color:var(--stamp)">' + tallySVG(group.length) + '</td>' +
          '<td class="n">' + group.length + objSub(group) + '</td></tr>';
      });
      const unassigned = rs.filter(r => !r.eventId).length;
      if (unassigned) {
        h += '<tr><td class="k" style="width:300px"><span style="font-style:italic;color:var(--ink-3)">no event recorded</span></td>' +
          '<td class="bar" style="color:var(--ink-3)">' + tallySVG(unassigned) + '</td>' +
          '<td class="n">' + unassigned + '</td></tr>';
      }
      h += '</table>';
    }

    h += '<h3 class="head" style="font-size:19px;margin-top:40px">By status</h3>';
    h += '<table class="tally">';
    PV.vocab.STATUS.forEach(st => {
      const group = rs.filter(r => r.status === st.key);
      h += '<tr><td class="k"><span class="mark ' + st.cls + '">' + U.esc(st.label) + '</span></td>' +
        '<td class="bar ' + st.cls + '">' + tallySVG(group.length) + '</td>' +
        '<td class="n">' + group.length + objSub(group) + '</td></tr>';
    });
    h += '</table>';

    h += '<h3 class="head" style="font-size:19px;margin-top:40px">By certainty</h3>';
    h += '<table class="tally">';
    PV.vocab.CERTAINTY.forEach(c => {
      const n = rs.filter(r => r.certainty === c.key).length;
      h += '<tr><td class="k"><span class="cert"><span class="pt">' + c.pt + '</span>' + c.label + '</span></td>' +
        '<td class="bar" style="color:var(--ink-2)">' + tallySVG(n) + '</td>' +
        '<td class="n">' + n + '</td></tr>';
    });
    h += '</table>';

    if (!opts.publicOnly) {
      const byConsent = k => evidence.filter(e => e.consent === k).length;
      h += '<h3 class="head" style="font-size:19px;margin-top:40px">Evidence by consent</h3>';
      h += '<table class="tally">';
      PV.vocab.CONSENT.forEach(c => {
        const n = byConsent(c.key);
        h += '<tr><td class="k"><span class="consent ' + c.key + '">' + c.label + '</span></td>' +
          '<td class="bar" style="color:var(--ink-2)">' + tallySVG(n) + '</td>' +
          '<td class="n">' + n + '</td></tr>';
      });
      h += '</table>';
      const held = rs.length - published;
      const lapsed = PV.Model.lapsedEmbargoes().length;
      h += '<p class="stats-note">Restricted and embargoed evidence is counted here but never exported. ' +
        (held ? held + (held === 1 ? ' object file is' : ' object files are') + ' held back from publication. ' : '') +
        'Of the ' + located.length + ' recorded ' + (located.length === 1 ? 'location' : 'locations') + ', ' +
        publishable.length + (publishable.length === 1 ? ' is' : ' are') + ' marked to publish, exactly or approximately.' +
        (lapsed ? ' ' + lapsed + ' embargo ' + (lapsed === 1 ? 'date has' : 'dates have') + ' passed and would welcome review.' : '') +
        (struckN ? ' ' + struckN + ' struck ' + (struckN === 1 ? 'file remains' : 'files remain') +
          ' in the docket as cancelled lines, outside these counts and every export.' : '') + '</p>';
    } else {
      h += '<p class="stats-note">Counts cover the published files. Evidence held under restriction, and locations not marked safe to publish, are reflected in the working file only.</p>';
    }
    return h;

    function cell(big, what) {
      return '<div class="stat-cell"><div class="big">' + big + '</div><div class="what">' + U.esc(what) + '</div></div>';
    }
  }

  function render() {
    const sect = document.getElementById('view-statistics');
    sect.innerHTML = '<div class="sheet narrow">' + html({ project: PV.state.project, records: PV.state.records }, {}) + '</div>';
  }

  return { html, render };
})();
