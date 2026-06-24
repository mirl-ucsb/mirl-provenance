/* gaps.js: provenance gap analysis. The chain of custody is only as strong as
   what it leaves uncovered. This reads the dated links, charts what is covered
   and what is not, and raises red flags where a gap falls across a sensitive
   window: the 1933 to 1945 (Nazi-era) period, a dispersal event recorded on
   the file, or a chain too short to stand. A pure renderer over data, so the
   static public file and the restitution dossier reuse it unchanged. */

PV.Gaps = (function () {
  const U = PV.util;
  const NOW_YEAR = new Date().getFullYear();

  /* a free-text custody date to a { s, e } year span, or null if no year.
     "1899 to 1961" -> 1899..1961; "1898" -> a point; "to 1990" -> open start;
     "after 1898" -> open end; "about 1820" -> a point. */
  function parseRange(str) {
    const s = String(str || '');
    const years = (s.match(/\d{3,4}/g) || []).map(Number).filter(y => y >= 100 && y <= NOW_YEAR + 1);
    if (!years.length) return null;
    if (years.length >= 2) return { s: Math.min.apply(null, years), e: Math.max.apply(null, years) };
    const y = years[0];
    const openStart = /\b(before|by|until|to)\b/i.test(s) && !/\b(from|after|since)\b/i.test(s);
    const openEnd = /\b(after|from|since)\b/i.test(s);
    if (openStart) return { s: null, e: y };
    if (openEnd) return { s: y, e: null };
    return { s: y, e: y };
  }

  function holderYear(r) {
    const m = String((r.currentHolder || {}).since || '').match(/\d{3,4}/);
    return m ? Number(m[0]) : null;
  }

  /* the sensitive windows a gap is checked against */
  function windows(r) {
    const out = [{ from: 1933, to: 1945, label: 'the 1933 to 1945 (Nazi-era) window' }];
    (PV.state.project.events || []).forEach(e => {
      if (r.eventId !== e.id) return;
      const m = String(e.date || '').match(/\d{3,4}/);
      if (m) out.push({ from: +m[0] - 1, to: +m[0] + 1, label: 'the dispersal event (' + (e.name || e.date) + ')' });
    });
    return out;
  }

  function analyze(r) {
    const links = r.custody || [];
    const dated = links.map(x => ({ x, r: parseRange(x.date) })).filter(l => l.r);
    const undated = links.length - dated.length;

    const ivs = dated.map(l => {
      let a = l.r.s, b = l.r.e;
      if (a == null) a = b;
      if (b == null) b = a;
      return { a, b };
    }).sort((p, q) => p.a - q.a || p.b - q.b);

    const chYear = holderYear(r);
    const flags = [];

    let min = null, max = null, covered = [], gaps = [];
    if (ivs.length) {
      min = ivs[0].a;
      let chainEnd = Math.max.apply(null, ivs.map(i => i.b));
      max = chYear && chYear > chainEnd ? chYear : chainEnd;

      ivs.forEach(i => {
        const last = covered[covered.length - 1];
        if (last && i.a <= last.b + 1) last.b = Math.max(last.b, i.b);
        else covered.push({ a: i.a, b: i.b });
      });
      for (let k = 1; k < covered.length; k++) {
        const from = covered[k - 1].b, to = covered[k].a;
        if (to - from > 1) gaps.push({ from, to });
      }
      if (chYear && chYear - chainEnd > 1) gaps.push({ from: chainEnd, to: chYear });
    }

    /* red flags */
    const wins = windows(r);
    let spanned = false;
    gaps.forEach(g => wins.forEach(w => {
      if (g.from < w.to && g.to > w.from) {
        flags.push('A gap in custody (' + g.from + ' to ' + g.to + ') spans ' + w.label + '.');
        spanned = true;
      }
    }));
    if (links.length < 2) {
      flags.push('The chain of custody has fewer than two links; provenance is not yet established.');
    }
    if (undated) {
      flags.push(undated + (undated === 1 ? ' custody link is' : ' custody links are') +
        ' undated and cannot be placed in the chain.');
    }
    if (gaps.length && !spanned) {
      flags.push(gaps.length + (gaps.length === 1 ? ' gap' : ' gaps') + ' in custody remain to be filled.');
    }

    return { links: links.length, undated, min, max, covered, gaps, chYear, flags, charted: ivs.length > 0 };
  }

  /* a coverage bar: covered spans in ink, gaps hatched in oxide red. The bar
     stretches to fit (preserveAspectRatio none); year labels are set in HTML
     beside it so they are not distorted. */
  function barSVG(a) {
    const W = 1000, H = 24;
    const span = Math.max(1, a.max - a.min);
    const x = y => (y - a.min) / span * W;
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" role="img" aria-label="Provenance coverage from ' + a.min + ' to ' + a.max + '">';
    s += '<defs><pattern id="gaphatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">' +
      '<rect width="8" height="8" class="gap-void-bg"/><line x1="0" y1="0" x2="0" y2="8" class="gap-void-line"/></pattern></defs>';
    s += '<rect class="gap-track" x="0" y="0" width="' + W + '" height="' + H + '"/>';
    a.covered.forEach(c => {
      const x1 = x(c.a), x2 = x(c.b);
      s += '<rect class="gap-cov" x="' + x1.toFixed(1) + '" y="0" width="' + Math.max(3, x2 - x1).toFixed(1) + '" height="' + H + '"/>';
    });
    a.gaps.forEach(g => {
      const x1 = x(g.from), x2 = x(g.to);
      s += '<rect x="' + x1.toFixed(1) + '" y="0" width="' + Math.max(3, x2 - x1).toFixed(1) + '" height="' + H + '" fill="url(#gaphatch)"/>';
    });
    s += '</svg>';
    return s;
  }

  function html(r) {
    if (!(r.custody || []).length) return '';
    const a = analyze(r);
    let h = '<div class="of-sect"><h3>Provenance gaps</h3>';
    if (a.charted) {
      h += '<div class="gapbar">' + barSVG(a) +
        '<div class="gap-scale"><span>' + a.min + '</span><span>' + a.max + '</span></div></div>';
    } else h += '<div class="none">The custody links are undated; the chain cannot be charted.</div>';
    if (a.flags.length) {
      h += '<ul class="gap-flags">' + a.flags.map(f => '<li>' + U.esc(f) + '</li>').join('') + '</ul>';
    } else if (a.charted) {
      h += '<div class="gap-clear">No gaps detected between the recorded links.</div>';
    }
    return h + '</div>';
  }

  return { analyze, html };
})();
