/* record.js: one object file, in two registers of its own. Above, the object
   file as it will be published: an accession card turned toward the claim,
   the biography of a single contested thing. Below, the registrar's desk: the
   working form whose every keystroke updates the card above it. The card
   renderer is a pure function over data so the static public file can reuse it
   unchanged. */

/* ---------- the object file card ---------- */
PV.Card = (function () {
  const U = PV.util;

  function dirAttr(s) { return U.isRTL(s) ? ' dir="rtl"' : ''; }

  /* the public handle of a source; identities stay in the working file */
  function aliasOf(sourceId, p) {
    if (!sourceId) return '';
    const s = ((p && p.sources) || []).find(x => x.id === sourceId);
    return s ? (s.alias || 'a source') : '';
  }

  function fileMeta(e) {
    const bits = [];
    if (e.file && e.file.name) {
      let s = e.file.name;
      if (e.file.size) s += ' (' + Math.max(1, Math.round(e.file.size / 1024)) + ' KB)';
      bits.push(U.esc(s));
    }
    if (e.url) bits.push('<a href="' + U.esc(e.url) + '" target="_blank" rel="noopener">' + U.esc(e.url) + '</a>');
    if (e.archived) bits.push('<a href="' + U.esc(e.archived) + '" target="_blank" rel="noopener">archived copy</a>');
    if (e.sha256) bits.push('<span title="sha-256 ' + U.esc(e.sha256) + '">sha-256 ' + U.esc(e.sha256.slice(0, 16)) + '…</span>');
    if (e.rights) bits.push(U.esc(e.rights));
    return bits.join(' · ');
  }

  /* the chain of custody: a dated ledger of who held the object, oldest first.
     Free-text dates are ordered by their leading year where one is given;
     undated links keep their entered order at the end. */
  function custodyYear(s) {
    const m = /(\d{3,4})/.exec(String(s || ''));
    return m ? +m[1] : Infinity;
  }
  function custodyHTML(r) {
    const xs = (r.custody || []).map((x, i) => ({ x, i }))
      .sort((a, b) => (custodyYear(a.x.date) - custodyYear(b.x.date)) || (a.i - b.i))
      .map(o => o.x);
    let h = '<div class="of-sect"><h3>Chain of custody</h3>';
    if (!xs.length) return h + '<div class="none">No chain of custody is recorded yet.</div></div>';
    h += '<table class="ev-table chain">';
    xs.forEach(x => {
      const cert = PV.vocab.certaintyOf(x.certainty);
      h += '<tr><td class="kind" style="width:128px;padding-top:13px">' + U.esc(x.date || 'undated') + '</td><td>';
      h += '<div class="ev-label"' + dirAttr(x.holder) + '>' + U.esc(x.holder || 'unknown holder') + '</div>';
      const meta = [x.transfer && x.transfer !== 'unknown' ? U.esc(x.transfer) : '',
        '<span class="cert"><span class="pt">' + cert.pt + '</span>' + cert.label + '</span>'].filter(Boolean).join(' · ');
      if (meta) h += '<div class="ev-meta">' + meta + '</div>';
      if (x.note) h += '<div class="ev-note"' + dirAttr(x.note) + '>' + U.esc(x.note) + '</div>';
      h += '</td></tr>';
    });
    return h + '</table></div>';
  }

  /* the claims pressed for the object's return */
  function claimsHTML(r) {
    const xs = r.claims || [];
    if (!xs.length) return '';
    let h = '<div class="of-sect"><h3>Claims for return</h3><table class="ev-table">';
    xs.forEach(x => {
      const cs = PV.vocab.claimStatusOf(x.status);
      const resolved = x.status === 'returned';
      h += '<tr><td><div class="ev-label"' + dirAttr(x.claimant) + '>' + U.esc(x.claimant || 'a claimant') + '</div>';
      const bases = (x.bases || []).map(k => PV.vocab.claimBasisOf(k)).filter(Boolean);
      if (bases.length) h += '<div class="basis-band">' + bases.map(b =>
        '<span class="basis" title="' + U.esc(b.gloss) + '">' + U.esc(b.label) + '</span>').join('') + '</div>';
      if (x.basis) h += '<div class="ev-note"' + dirAttr(x.basis) + '>' + U.esc(x.basis) + '</div>';
      if (x.note) h += '<div class="ev-meta">' + U.esc(x.note) + '</div>';
      h += '</td><td style="width:170px;text-align:right">' +
        '<span class="claim-status ' + (resolved ? 'resolved' : x.status === 'denied' ? 'denied' : 'open') + '">' + U.esc(cs.label) + '</span>' +
        (x.date ? '<div class="ev-meta">' + U.esc(x.date) + '</div>' : '') + '</td></tr>';
    });
    return h + '</table></div>';
  }

  /* CARE notes, set as a ruled block of the four principles */
  function careHTML(r) {
    const c = r.careNotes || {};
    const has = PV.vocab.CARE.some(k => (c[k.key] || '').trim());
    if (!has) return '';
    let h = '<div class="of-sect"><h3>CARE notes</h3><dl class="care-list">';
    PV.vocab.CARE.forEach(k => {
      const v = (c[k.key] || '').trim();
      if (!v) return;
      h += '<div class="care-row"><dt>' + U.esc(k.label) + '</dt><dd' + dirAttr(v) + '>' +
        v.split(/\n\s*\n|\n/).map(p => U.esc(p)).join('<br>') + '</dd></div>';
    });
    return h + '</dl></div>';
  }

  /* Traditional Knowledge / Biocultural Labels as a band of stamped marks */
  function labelsHTML(r, opts) {
    opts = opts || {};
    const ls = r.tkLabels || [];
    if (!ls.length) return '';
    let h = '<div class="of-sect"><h3>Traditional Knowledge &amp; Biocultural Labels</h3><div class="tk-band">';
    ls.forEach(l => {
      const def = PV.Model.resolveLabel(l.code);
      h += '<div class="tk-label"><div class="tk-head"><span class="tk-code">' + U.esc(def.code) + '</span>' +
        '<span class="tk-name">' + U.esc(def.name) + '</span></div>';
      const gloss = (l.note && l.note.trim()) ? l.note.trim() : def.gloss;
      if (gloss) h += '<div class="tk-gloss"' + dirAttr(gloss) + '>' + U.esc(gloss) + '</div>';
      if (l.community) h += '<div class="tk-comm">' + U.esc(l.community) + '</div>';
      const link = (l.uri && l.uri.trim()) ? l.uri.trim() : (def.kind === 'community' ? '' : PV.vocab.LOCAL_CONTEXTS);
      if (link) h += '<div class="tk-link"><a href="' + U.esc(link) + '" target="_blank" rel="noopener">' +
        (l.uri && l.uri.trim() ? 'Local Contexts Hub record' : 'Local Contexts') + ' ↗</a></div>';
      h += '</div>';
    });
    h += '</div>';
    const lc = ((opts && opts.project ? opts.project.localContexts : PV.state.project.localContexts) || '').trim();
    if (lc) h += '<div class="tk-project"><a href="' + U.esc(lc) + '" target="_blank" rel="noopener">This project on the Local Contexts Hub ↗</a></div>';
    return h + '</div>';
  }

  function imagesHTML(r, opts) {
    const cs = r.images || [];
    let h = '<div class="of-sect"><h3>Images and holdings</h3>';
    if (!cs.length) return h + '<div class="none">No image or holding is recorded.</div></div>';
    h += '<table class="ev-table">';
    cs.forEach((c, i) => {
      h += '<tr><td class="n">' + (i + 1) + '</td><td>';
      const inst = [c.institution, c.identifier].filter(Boolean);
      if (inst.length) h += '<div class="ev-label">' + U.esc(inst[0]) + (inst[1] ? ' <span style="font-family:var(--mono);font-size:13px;color:var(--ink-2)">' + U.esc(inst[1]) + '</span>' : '') + '</div>';
      const links = [];
      if (c.iiif) links.push('<a href="' + U.esc(c.iiif) + '" target="_blank" rel="noopener">IIIF</a>');
      if (c.url) links.push('<a href="' + U.esc(c.url) + '" target="_blank" rel="noopener">' + U.esc(c.url) + '</a>');
      if (links.length) h += '<div class="ev-meta">' + links.join(' · ') + '</div>';
      if (c.note) h += '<div class="ev-note"' + dirAttr(c.note) + '>' + U.esc(c.note) + '</div>';
      h += '</td><td style="text-align:right">';
      if (!opts.static && (c.iiif || c.url)) {
        h += '<button class="act" data-look="' + U.esc(c.id) + '">Look</button>';
      }
      h += '</td></tr><tr class="copy-viewer-row" data-viewer-for="' + U.esc(c.id) + '" style="display:none"><td colspan="3"></td></tr>';
    });
    return h + '</table></div>';
  }

  /* dated reports placing the object in the record: the dossier of sightings */
  function sightingsHTML(r, opts) {
    const p = opts.project || PV.state.project;
    const all = r.sightings || [];
    const xs = opts.publicOnly ? all.filter(x => x.consent === 'public') : all;
    if (!xs.length) return '';
    let h = '<div class="of-sect"><h3>Sightings in the record</h3><table class="ev-table">';
    xs.forEach((x) => {
      const alias = aliasOf(x.sourceId, p);
      h += '<tr><td class="kind" style="width:128px;padding-top:13px">' + U.esc(x.date || 'undated') + '</td><td>';
      h += '<div class="ev-label">' + U.esc(x.kind) + (x.place ? ' · ' + U.esc(x.place) : '') + '</div>';
      const meta = [alias ? 'reported by ' + U.esc(alias) : '',
        (!opts.publicOnly && x.consent !== 'public') ? 'withheld from exports' : ''].filter(Boolean).join(' · ');
      if (meta) h += '<div class="ev-meta">' + meta + '</div>';
      if (x.note) h += '<div class="ev-note"' + dirAttr(x.note) + '>' + U.esc(x.note) + '</div>';
      h += '</td><td><span class="bearing ' + U.esc(x.bearing) + '">' + U.esc(x.bearing) + '</span></td></tr>';
    });
    return h + '</table></div>';
  }

  function evidenceHTML(r, opts) {
    const p = opts.project || PV.state.project;
    const all = r.evidence || [];
    const shown = opts.publicOnly ? all.filter(e => e.consent === 'public') : all;
    const withheld = all.length - all.filter(e => e.consent === 'public').length;
    let h = '<div class="of-sect"><h3>Evidence</h3>';
    if (!shown.length) {
      h += '<div class="none">' + (opts.publicOnly
        ? (all.length ? 'The evidence for this object is held under restriction.' : 'No public evidence accompanies this object file.')
        : 'No evidence is recorded yet.') + '</div>';
    } else {
      h += '<table class="ev-table">';
      shown.forEach((e, i) => {
        h += '<tr><td class="n">' + (i + 1) + '</td><td class="kind">' + U.esc(e.type) + '</td><td>';
        if (e.label) h += '<div class="ev-label"' + dirAttr(e.label) + '>' + U.esc(e.label) + '</div>';
        const meta = fileMeta(e);
        if (meta) h += '<div class="ev-meta">' + meta + '</div>';
        const alias = aliasOf(e.sourceId, p);
        if (alias) h += '<div class="ev-meta">on the word of ' + U.esc(alias) + '</div>';
        if (e.note) h += '<div class="ev-note"' + dirAttr(e.note) + '>' + U.esc(e.note) + '</div>';
        if (e.thumb && (!opts.publicOnly || e.consent === 'public')) h += '<img class="ev-thumb" src="' + e.thumb + '" alt="">';
        const lapsed = e.consent === 'embargoed' && e.until && e.until <= new Date().toISOString().slice(0, 10);
        h += '</td><td><span class="consent ' + U.esc(e.consent) + '">' + U.esc(e.consent) +
          (e.consent === 'embargoed' && e.until ? ' until ' + U.esc(e.until) : '') + '</span>' +
          (!opts.publicOnly && lapsed ? '<div class="ev-meta" style="color:var(--stamp)">embargo date has passed: review</div>' : '') +
          (!opts.publicOnly && e.consent !== 'public' ? '<div class="ev-meta">withheld from exports</div>' : '') +
          '</td></tr>';
      });
      h += '</table>';
      if (opts.publicOnly && withheld > 0) {
        h += '<div class="none">' + withheld + (withheld === 1 ? ' further item of evidence is' : ' further items of evidence are') + ' held under restriction.</div>';
      }
    }
    return h + '</div>';
  }

  /* relations on this file, plus computed inverses of relations pointing
     at it from elsewhere */
  function relationLines(r, opts) {
    const all = opts.records || PV.state.records;
    const lines = [];
    (r.relations || []).forEach(x => {
      const t = all.find(o => o.id === x.target);
      if (t) lines.push({ label: PV.vocab.relationOf(x.type).label, rec: t });
    });
    all.forEach(o => {
      if (o.id === r.id) return;
      (o.relations || []).forEach(x => {
        if (x.target === r.id) {
          const inv = PV.vocab.relationOf(PV.vocab.relationOf(x.type).inverse);
          lines.push({ label: inv.label, rec: o });
        }
      });
    });
    return lines;
  }

  function relationsHTML(r, opts) {
    const lines = relationLines(r, opts);
    if (!lines.length) return '';
    let h = '<div class="of-sect"><h3>In relation</h3><table class="ev-table">';
    lines.forEach(l => {
      h += '<tr><td class="kind" style="width:110px;padding-top:13px">' + U.esc(l.label) + '</td>' +
        '<td><a class="rel-link" href="#/entry/' + U.esc(l.rec.id) + '">' +
        '<span style="font-family:var(--mono);font-size:12.5px;color:var(--stamp)">' + U.esc(l.rec.id) + '</span>  ' +
        U.esc(PV.Model.title(l.rec)) + '</a>' +
        (l.rec.struck ? ' <span class="consent restricted">struck</span>' : '') + '</td></tr>';
    });
    return h + '</table></div>';
  }

  function html(r, opts) {
    opts = opts || {};
    const p = opts.project || PV.state.project;
    const st = PV.vocab.statusOf(r.status);
    const cert = PV.vocab.certaintyOf(r.certainty);
    const title = PV.Model.title(r);
    const alts = PV.Model.altTitles(r);

    let h = '<div class="objfile"><div class="inner">';
    h += '<div class="of-top"><div class="of-no">Object ' + U.esc(r.id) + '</div>' +
      '<div class="of-stamp"><span class="mark ' + st.cls + '">' + U.esc(st.label) + '</span>' +
      (r.struck ? '<span class="mark st-struck">Struck from the file</span>' : '') +
      (!opts.static && !r.struck && !r.publish ? '<span class="mark st-struck">Held back from publication</span>' : '') +
      '</div></div>';
    h += '<h2 class="of-title"' + dirAttr(title) + '>' + U.esc(title) + '</h2>';
    alts.forEach(a => {
      h += '<div class="of-title-alt"' + dirAttr(a.text) + (a.lang ? ' lang="' + U.esc(a.lang) + '"' : '') + '>' + U.esc(a.text) + '</div>';
    });
    const vital = [r.creator, r.objectType, r.medium, r.date].filter(s => s && s.trim()).join(' · ');
    if (vital) h += '<div class="of-vital">' + U.esc(vital) + '</div>';
    h += '<hr class="of-rule">';

    h += '<dl class="of-fields">';
    const row = (dt, dd) => dd ? '<div class="of-row"><dt>' + dt + '</dt><dd>' + dd + '</dd></div>' : '';
    h += row('Origin / community', U.esc(r.origin));
    h += row('Dimensions', U.esc(r.dimensions));
    if ((r.identifiers || []).length) {
      const ids = r.identifiers.filter(x => (x.value || '').trim()).map(x =>
        (x.scheme ? '<span style="font-family:var(--mono);font-size:12.5px;color:var(--ink-3)">' + U.esc(x.scheme) + '</span> ' : '') +
        '<span style="font-family:var(--mono);font-size:13.5px">' + U.esc(x.value) + '</span>').join('<br>');
      h += row('Identifiers', ids);
    }
    if (r.extent && typeof r.extent.amount === 'number') {
      h += row('Extent', r.extent.amount.toLocaleString('en-US') + (r.extent.unit ? ' ' + U.esc(r.extent.unit) : ''));
    }
    h += row('Provenance', '<span class="cert"><span class="pt">' + cert.pt + '</span>' + cert.label + '</span> · ' + U.esc(st.label.toLowerCase()));
    if ((r.statusHistory || []).length) {
      const past = r.statusHistory.map(x =>
        U.esc(PV.vocab.statusOf(x.status).label.toLowerCase()) +
        (x.until ? ', to ' + U.esc(x.until) : '') +
        (x.reason ? ' <span style="font-style:italic">(' + U.esc(x.reason) + ')</span>' : '')).join(' · ');
      h += row('Formerly', '<span class="cert" style="font-style:normal">' + past + '</span>');
    }
    const ev = r.eventId && (p.events || []).find(x => x.id === r.eventId);
    if (ev && (ev.name || ev.date)) {
      h += row('Dispersal event', U.esc(ev.name || 'unnamed event') + (ev.date ? ' <span style="font-style:italic">(' + U.esc(ev.date) + ')</span>' : ''));
    }
    const ch = r.currentHolder || {};
    if ((ch.name || '').trim()) {
      let v = U.esc(ch.name);
      if (ch.since) v += ' <span style="font-style:italic">(since ' + U.esc(ch.since) + ')</span>';
      if (ch.basis) v += '<div class="ev-meta">' + U.esc(ch.basis) + '</div>';
      if (ch.note && !opts.publicOnly) v += '<div class="ev-note">' + U.esc(ch.note) + '</div>';
      h += row('Current holder', v);
    }
    const loc = r.location || {};
    const hasCoords = typeof loc.lat === 'number' && typeof loc.lon === 'number';
    if (loc.place || hasCoords) {
      const fmt = (lat, lon) => '<span style="font-family:var(--mono);font-size:13.5px">' +
        Math.abs(lat).toFixed(3) + (lat >= 0 ? ' N' : ' S') + ', ' +
        Math.abs(lon).toFixed(3) + (lon >= 0 ? ' E' : ' W') + '</span>';
      if (opts.publicOnly && loc.publish === 'withheld') {
        /* withheld in public documents */
      } else {
        let v = U.esc(loc.place || '');
        if (hasCoords) v += (v ? ' · ' : '') + fmt(loc.lat, loc.lon);
        if (loc.publish === 'approximate') v += ' <span style="font-style:italic">(approximate)</span>';
        if (!opts.publicOnly && loc.publish === 'withheld') v += ' <span class="consent restricted">not for publication</span>';
        h += row('Current location', v);
      }
    }
    h += '</dl>';

    h += labelsHTML(r, opts);

    if (r.note && r.note.trim()) {
      h += '<div class="of-note"' + dirAttr(r.note) + '>' +
        r.note.trim().split(/\n\s*\n|\n/).map(par => '<p>' + U.esc(par) + '</p>').join('') + '</div>';
    }
    if (r.tags && r.tags.length) {
      h += '<div class="of-tags">' + r.tags.map(U.esc).join(' · ') + '</div>';
    }

    h += custodyHTML(r);
    h += PV.Gaps.html(r);
    h += sightingsHTML(r, opts);
    h += claimsHTML(r);
    h += careHTML(r);
    h += evidenceHTML(r, opts);
    h += imagesHTML(r, opts);
    h += relationsHTML(r, opts);

    /* the footnote: how to cite this object file */
    if (opts.static) {
      h += '<div class="of-sect cite-block"><h3>Cite this object file</h3>' +
        '<div class="cite-out">' + PV.Citation.build(r, p, 'chicago').html + '</div></div>';
    } else {
      h += '<div class="of-sect cite-block"><h3>Cite this object file</h3>' +
        '<div class="cite-row"><select id="cite-style">' +
        '<option value="chicago">Chicago (note)</option><option value="mla">MLA</option>' +
        '<option value="apa">APA</option><option value="bibtex">BibTeX</option></select>' +
        '<button class="act" id="cite-copy">Copy</button></div>' +
        '<div class="cite-out" id="cite-out"></div></div>';
    }

    h += '</div></div>';
    return h;
  }

  return { html };
})();

/* ---------- the working object-file page ---------- */
PV.Record = (function () {
  const S = PV.state;
  const U = PV.util;
  let current = null;       /* the record being shown */
  let citeStyle = 'chicago';
  let viewers = [];         /* open OpenSeadragon instances */

  /* ----- IIIF: find a deep-zoomable source at an address ----- */
  async function tileSourceFor(c) {
    const u = (c.iiif || c.url || '').trim();
    if (!u) throw new Error('No address to look at.');
    if (/\.(jpe?g|png|gif|webp|bmp)(\?|#|$)/i.test(u)) return { type: 'image', url: u };
    if (/info\.json(\?|#|$)/i.test(u)) return u;
    const res = await fetch(u, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('The address did not answer (' + res.status + ').');
    const j = await res.json();
    const ctx = JSON.stringify(j['@context'] || '');
    if (j.protocol === 'http://iiif.io/api/image' || /api\/image/.test(ctx) ||
        (j.width && j.height && (j['@id'] || j.id))) return j;
    let svc = null;
    try { svc = j.sequences[0].canvases[0].images[0].resource.service; } catch (e) {}
    if (!svc) try {
      const body = j.items[0].items[0].items[0].body;
      svc = (body.service && body.service[0]) || null;
    } catch (e) {}
    if (svc) {
      const id = svc['@id'] || svc.id;
      if (id) return id.replace(/\/info\.json$/, '') + '/info.json';
    }
    throw new Error('No IIIF image was found at that address.');
  }

  function closeViewers() {
    viewers.forEach(v => { try { v.destroy(); } catch (e) {} });
    viewers = [];
  }

  async function toggleLook(copy) {
    const row = document.querySelector('tr[data-viewer-for="' + copy.id + '"]');
    if (!row) return;
    if (row.style.display !== 'none') { row.style.display = 'none'; row.firstElementChild.innerHTML = ''; return; }
    row.style.display = '';
    const cell = row.firstElementChild;
    cell.innerHTML = '';
    const host = U.h('div', { class: 'copy-viewer' });
    const osd = U.h('div', { class: 'osd' });
    const closer = U.h('button', { class: 'btn closer', onclick: () => { row.style.display = 'none'; cell.innerHTML = ''; } }, 'Close');
    host.append(osd, closer);
    cell.append(host);
    try {
      const ts = await tileSourceFor(copy);
      const v = OpenSeadragon({
        element: osd, tileSources: ts, prefixUrl: '',
        showNavigationControl: false, crossOriginPolicy: 'Anonymous',
        gestureSettingsMouse: { scrollToZoom: true, clickToZoom: false },
      });
      viewers.push(v);
    } catch (e) {
      cell.innerHTML = '';
      cell.append(U.h('div', { class: 'hint', style: { padding: '12px 0', fontStyle: 'italic' } },
        'Could not open it: ' + (e.message || e) + ' The source may not allow cross-origin viewing; try the link itself.'));
    }
  }

  /* ----- wire the interactive parts of a freshly rendered card ----- */
  function wireCard(r) {
    const host = document.getElementById('card-host');
    const sel = host.querySelector('#cite-style');
    const out = host.querySelector('#cite-out');
    const copy = host.querySelector('#cite-copy');
    const renderCite = () => { out.innerHTML = PV.Citation.build(r, S.project, citeStyle).html; };
    if (sel) {
      sel.value = citeStyle;
      sel.addEventListener('change', () => { citeStyle = sel.value; renderCite(); });
      renderCite();
    }
    if (copy) copy.addEventListener('click', () => {
      const text = PV.Citation.build(r, S.project, citeStyle).text;
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
        .then(() => U.toast('Citation copied'))
        .catch(() => {
          const ta = U.h('textarea', null, text);
          document.body.append(ta); ta.select();
          try { document.execCommand('copy'); U.toast('Citation copied'); } catch (e) { U.toast('Select and copy it by hand'); }
          ta.remove();
        });
    });
    host.querySelectorAll('button[data-look]').forEach(b => {
      const c = (r.images || []).find(x => x.id === b.dataset.look);
      if (c) b.addEventListener('click', () => toggleLook(c));
    });
  }

  let refreshTimer = null;
  function refreshTombstone(r, soon) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      const host = document.getElementById('card-host');
      if (!host || current !== r) return;
      closeViewers();
      host.innerHTML = PV.Card.html(r, {});
      wireCard(r);
    }, soon ? 0 : 300);
  }

  /* ----- the page ----- */
  function render(id) {
    const sect = document.getElementById('view-entry');
    sect.innerHTML = '';
    closeViewers();
    const r = PV.Model.get(id);
    current = r;

    const sheet = U.h('div', { class: 'sheet narrow' });
    if (!r) {
      sheet.append(
        U.h('h2', { class: 'head' }, 'No object file is open'),
        U.h('p', { class: 'subhead' }, 'Choose an object from the docket, or begin a new file.'),
        U.h('button', { class: 'btn', onclick: () => { location.hash = '#/register'; } }, 'To the docket'));
      sect.append(sheet);
      return;
    }

    /* ledger navigation: previous and next files in the visible order */
    const order = PV.Register.visible();
    const idx = order.findIndex(x => x.id === r.id);
    const navLine = U.h('div', { style: { display: 'flex', gap: '20px', alignItems: 'baseline', margin: '36px 0 0' } },
      U.h('button', { class: 'act', onclick: () => { location.hash = '#/register'; } }, '‹ Docket'),
      U.h('span', { style: { flex: '1' } }),
      idx > 0 ? U.h('button', { class: 'act', onclick: () => { location.hash = '#/entry/' + order[idx - 1].id; } }, '‹ Previous') : null,
      idx >= 0 && idx < order.length - 1 ? U.h('button', { class: 'act', onclick: () => { location.hash = '#/entry/' + order[idx + 1].id; } }, 'Next ›') : null);

    const cardHost = U.h('div', { class: 'objfile-wrap', id: 'card-host' });
    sheet.append(navLine, cardHost);
    sect.append(sheet);

    cardHost.innerHTML = PV.Card.html(r, {});
    wireCard(r);

    sect.append(PV.Desk.build(r));
  }

  return { render, refreshTombstone, get current() { return current; } };
})();

/* ---------- the registrar's desk ---------- */
PV.Desk = (function () {
  const S = PV.state;
  const U = PV.util;

  /* a labelled underline input bound to a record field */
  function field(r, label, get, set, opts) {
    opts = opts || {};
    const input = opts.textarea
      ? U.h('textarea', { rows: opts.rows || '5', placeholder: opts.ph || '' })
      : U.h('input', { type: opts.type || 'text', value: get() == null ? '' : get(), placeholder: opts.ph || '', dir: 'auto' });
    if (opts.textarea) input.value = get() || '';
    input.addEventListener('input', () => { set(input.value); PV.App.entryChanged(r); });
    const f = U.h('div', { class: 'field' }, U.h('label', null, label), input);
    if (opts.note) f.append(U.h('div', { class: 'note' }, opts.note));
    return f;
  }

  function sect(title, small, ...kids) {
    const h4 = U.h('h4', null, title);
    if (small) h4.append(U.h('small', null, small));
    return U.h('div', { class: 'desk-sect' }, h4, ...kids);
  }

  /* ----- titles ----- */
  function titlesSect(r) {
    const box = U.h('div');
    const redraw = () => {
      box.innerHTML = '';
      r.titles.forEach((t, i) => {
        const text = U.h('input', { type: 'text', value: t.text, dir: 'auto', style: { flex: '1' }, placeholder: i ? 'Parallel title' : 'Title or name of the object' });
        text.addEventListener('input', () => { t.text = text.value; PV.App.entryChanged(r); });
        const lang = U.h('input', { type: 'text', value: t.lang, placeholder: 'lang', title: 'Language code, e.g. en, ar', style: { width: '64px', fontFamily: 'var(--mono)', fontSize: '13px' } });
        lang.addEventListener('input', () => { t.lang = lang.value.trim(); PV.App.entryChanged(r); });
        const row = U.h('div', { style: { display: 'flex', gap: '14px', alignItems: 'baseline', marginBottom: '12px' } }, text, lang);
        if (r.titles.length > 1) row.append(U.h('button', { class: 'act', onclick: () => { r.titles.splice(i, 1); PV.App.entryChanged(r, true); redraw(); } }, 'Remove'));
        box.append(row);
      });
    };
    redraw();
    const add = U.h('div', { class: 'add-line' },
      U.h('button', { class: 'act', onclick: () => { r.titles.push({ text: '', lang: '' }); redraw(); } }, '+ Add a parallel title'));
    return sect('Titles', 'in any language; right-to-left scripts set themselves', box, add);
  }

  /* ----- identifiers ----- */
  function identifiersSect(r) {
    const box = U.h('div');
    const redraw = () => {
      box.innerHTML = '';
      r.identifiers.forEach((x, i) => {
        const scheme = U.h('input', { type: 'text', value: x.scheme, placeholder: 'scheme', style: { width: '200px' } });
        scheme.addEventListener('input', () => { x.scheme = scheme.value; PV.App.entryChanged(r); });
        const value = U.h('input', { type: 'text', value: x.value, placeholder: 'identifier', style: { flex: '1', fontFamily: 'var(--mono)' }, dir: 'auto' });
        value.addEventListener('input', () => { x.value = value.value; PV.App.entryChanged(r); });
        box.append(U.h('div', { style: { display: 'flex', gap: '14px', alignItems: 'baseline', marginBottom: '12px', flexWrap: 'wrap' } },
          scheme, value,
          U.h('button', { class: 'act', onclick: () => { r.identifiers.splice(i, 1); PV.App.entryChanged(r, true); redraw(); } }, 'Remove')));
      });
    };
    redraw();
    return sect('Identifiers', 'accession numbers, inventory numbers, lot numbers, catalogue raisonné',
      box,
      U.h('div', { class: 'add-line' }, U.h('button', {
        class: 'act', onclick: () => {
          r.identifiers.push({ id: U.uid(), scheme: '', value: '' });
          PV.App.entryChanged(r, true); redraw();
        },
      }, '+ Add an identifier')));
  }

  /* ----- status and certainty; a change of standing is kept, not overwritten ----- */
  function statusSect(r) {
    const histBox = U.h('div');
    const drawHistory = () => {
      histBox.innerHTML = '';
      if (!(r.statusHistory || []).length) return;
      const wrap = U.h('div', { class: 'field' }, U.h('label', null, 'Formerly'));
      r.statusHistory.forEach((x, i) => {
        const reason = U.h('input', { type: 'text', value: x.reason || '', placeholder: 'why it changed', style: { flex: '1' } });
        reason.addEventListener('input', () => { x.reason = reason.value; PV.App.entryChanged(r); });
        wrap.append(U.h('div', { style: { display: 'flex', gap: '14px', alignItems: 'baseline', marginBottom: '10px' } },
          U.h('span', { style: { fontFamily: 'var(--mono)', fontSize: '12.5px', color: 'var(--ink-2)', whiteSpace: 'nowrap' } },
            PV.vocab.statusOf(x.status).label + (x.until ? ' · to ' + x.until : '')),
          reason,
          U.h('button', { class: 'act', onclick: () => { r.statusHistory.splice(i, 1); PV.App.entryChanged(r, true); drawHistory(); } }, 'Remove')));
      });
      wrap.append(U.h('div', { class: 'note' }, 'Former standings stay on the record; give each a line on why it changed.'));
      histBox.append(wrap);
    };

    const statusPick = U.h('div', { class: 'marks-pick' });
    PV.vocab.STATUS.forEach(st => {
      const b = U.h('button', { class: 'mark ' + st.cls + (r.status === st.key ? ' on' : '') }, st.label);
      b.addEventListener('click', () => {
        if (r.status !== st.key) PV.Model.setStatus(r, st.key);
        statusPick.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        drawHistory();
        PV.App.entryChanged(r, true);
      });
      statusPick.append(b);
    });
    const certPick = U.h('div', { class: 'marks-pick', style: { marginTop: '14px' } });
    PV.vocab.CERTAINTY.forEach(c => {
      const b = U.h('button', { class: 'mark st-unlocated' + (r.certainty === c.key ? ' on' : '') }, c.pt + ' ' + c.label);
      b.addEventListener('click', () => {
        r.certainty = c.key;
        certPick.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        PV.App.entryChanged(r, true);
      });
      certPick.append(b);
    });
    const evBox = U.h('div', { class: 'field' });
    const drawEvent = () => {
      evBox.innerHTML = '';
      evBox.append(U.h('label', null, 'Dispersal event'));
      const evSel = U.h('select', null,
        U.h('option', { value: '' }, 'no event'),
        ...(S.project.events || []).map(ev =>
          U.h('option', { value: ev.id, selected: r.eventId === ev.id ? '' : null },
            (ev.name || 'unnamed event') + (ev.date ? ' (' + ev.date + ')' : ''))));
      evSel.addEventListener('change', () => { r.eventId = evSel.value || null; PV.App.entryChanged(r); });
      const newName = U.h('input', { type: 'text', placeholder: 'or name a new event…', style: { flex: '1' }, dir: 'auto' });
      const add = U.h('button', {
        class: 'act', onclick: () => {
          const name = newName.value.trim();
          if (!name) return U.toast('Give the event a name first');
          const ev = PV.Model.addEvent();
          ev.name = name;
          r.eventId = ev.id;
          PV.App.entryChanged(r, true);
          drawEvent();
          U.toast('Event added and assigned; its date and note live on the Chronology folio');
        },
      }, '+ Add');
      newName.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add.click(); } });
      evBox.append(evSel,
        U.h('div', { style: { display: 'flex', gap: '14px', alignItems: 'baseline', marginTop: '10px' } }, newName, add),
        U.h('div', { class: 'note' }, 'Dispersal events (a punitive expedition, a war, a market sale) gather objects scattered together; their dates, places, and notes are kept on the Chronology folio.'));
    };
    drawEvent();
    drawHistory();
    return sect('Standing of the case', 'where the object and its claim stand, and how firmly the provenance is known',
      U.h('div', { class: 'field' }, U.h('label', null, 'Status'), statusPick),
      histBox,
      U.h('div', { class: 'field' }, U.h('label', null, 'Provenance certainty'), certPick),
      evBox);
  }

  /* a source picker; identities show here, only aliases publish */
  function sourceSelect(value, onchange) {
    const sel = U.h('select', null,
      U.h('option', { value: '' }, 'no source'),
      ...(S.project.sources || []).map(s =>
        U.h('option', { value: s.id, selected: value === s.id ? '' : null },
          (s.alias || '(no alias yet)') + (s.name ? ' · ' + s.name : ''))));
    sel.addEventListener('change', () => onchange(sel.value || null));
    return sel;
  }

  /* ----- the current holder ----- */
  function holderSect(r) {
    const ch = r.currentHolder;
    return sect('Current holder', 'who holds the object now',
      field(r, 'Holder', () => ch.name, v => { ch.name = v; }, { ph: 'museum, dealer, private collection' }),
      U.h('div', { class: 'row2' },
        field(r, 'Held since', () => ch.since, v => { ch.since = v; }, { ph: 'e.g. 1898, or 1965' }),
        field(r, 'On what basis', () => ch.basis, v => { ch.basis = v; }, { ph: 'accession, purchase, bequest' })),
      field(r, 'Note', () => ch.note, v => { ch.note = v; }, { ph: 'anything the holder states about how it was acquired' }),
      U.h('div', { class: 'note' }, 'The holder’s name, date, and basis publish; this note stays in the working file.'));
  }

  /* ----- the chain of custody: dated holders, oldest to newest ----- */
  function custodySect(r) {
    const box = U.h('div');
    const redraw = () => {
      box.innerHTML = '';
      r.custody.forEach((x, i) => {
        const transferSel = U.h('select', null, ...PV.vocab.TRANSFER.map(t =>
          U.h('option', { value: t, selected: x.transfer === t ? '' : null }, t)));
        transferSel.addEventListener('change', () => { x.transfer = transferSel.value; PV.App.entryChanged(r); });
        const certPick = U.h('div', { class: 'marks-pick' });
        PV.vocab.CERTAINTY.forEach(c => {
          const btn = U.h('button', { class: 'mark st-unlocated' + (x.certainty === c.key ? ' on' : '') }, c.pt + ' ' + c.label);
          btn.addEventListener('click', () => {
            x.certainty = c.key;
            certPick.querySelectorAll('button').forEach(y => y.classList.toggle('on', y === btn));
            PV.App.entryChanged(r);
          });
          certPick.append(btn);
        });
        const item = U.h('div', { class: 'item' },
          U.h('div', { class: 'item-head' },
            U.h('span', { class: 'n' }, 'Link ' + (i + 1)),
            U.h('span', { class: 'sp' }),
            U.h('button', { class: 'act', onclick: () => { r.custody.splice(i, 1); PV.App.entryChanged(r, true); redraw(); } }, 'Remove')),
          U.h('div', { class: 'row2' },
            field(r, 'When', () => x.date, v => { x.date = v; }, { ph: 'e.g. 1897, or 1933 to 1945' }),
            field(r, 'Held by', () => x.holder, v => { x.holder = v; }, { ph: 'who held it' })),
          U.h('div', { class: 'row2' },
            U.h('div', { class: 'field' }, U.h('label', null, 'How it passed'), transferSel),
            U.h('div', { class: 'field' }, U.h('label', null, 'How firmly known'), certPick)),
          field(r, 'Note', () => x.note, v => { x.note = v; }, { ph: 'the document or source for this link' }));
        box.append(item);
      });
    };
    redraw();
    return sect('Chain of custody', 'the object passed from hand to hand; record each link, oldest first',
      box,
      U.h('div', { class: 'add-line' }, U.h('button', {
        class: 'act', onclick: () => {
          r.custody.push({ id: U.uid(), date: '', holder: '', transfer: 'unknown', certainty: 'uncertain', note: '' });
          PV.App.entryChanged(r, true); redraw();
        },
      }, '+ Add a link in the chain')),
      U.h('div', { class: 'note' }, 'The card orders these by date. A gap in the chain is itself a finding: leave it, rather than inventing a link.'));
  }

  /* ----- claims for return ----- */
  function claimsSect(r) {
    const box = U.h('div');
    const redraw = () => {
      box.innerHTML = '';
      r.claims.forEach((x, i) => {
        const statusSel = U.h('select', null, ...PV.vocab.CLAIMSTATUS.map(c =>
          U.h('option', { value: c.key, selected: x.status === c.key ? '' : null }, c.label)));
        statusSel.addEventListener('change', () => { x.status = statusSel.value; PV.App.entryChanged(r, true); });
        if (!Array.isArray(x.bases)) x.bases = [];
        const basesPick = U.h('div', { class: 'marks-pick' });
        PV.vocab.CLAIMBASIS.forEach(b => {
          const on = x.bases.includes(b.key);
          const btn = U.h('button', { class: 'mark st-located' + (on ? ' on' : ''), title: b.gloss }, b.label);
          btn.addEventListener('click', () => {
            const k = x.bases.indexOf(b.key);
            if (k >= 0) x.bases.splice(k, 1); else x.bases.push(b.key);
            btn.classList.toggle('on');
            PV.App.entryChanged(r, true);
          });
          basesPick.append(btn);
        });
        const item = U.h('div', { class: 'item' },
          U.h('div', { class: 'item-head' },
            U.h('span', { class: 'n' }, 'Claim ' + (i + 1)),
            U.h('span', { class: 'sp' }),
            U.h('button', { class: 'act', onclick: () => { r.claims.splice(i, 1); PV.App.entryChanged(r, true); redraw(); } }, 'Remove')),
          field(r, 'Claimant', () => x.claimant, v => { x.claimant = v; }, { ph: 'the community, nation, family, or institution asking for its return' }),
          U.h('div', { class: 'field' }, U.h('label', null, 'Legal basis'), basesPick,
            U.h('div', { class: 'note' }, 'The named instruments the claim rests on; they appear in the claim letter and the dossier.')),
          field(r, 'Grounds / reasoning', () => x.basis, v => { x.basis = v; }, { textarea: true, rows: '3', ph: 'in your own words: how the object left, why its return is owed, the record that supports it' }),
          U.h('div', { class: 'row2' },
            U.h('div', { class: 'field' }, U.h('label', null, 'Status of the claim'), statusSel),
            field(r, 'Date', () => x.date, v => { x.date = v; }, { ph: 'when lodged or last moved' })),
          field(r, 'Note', () => x.note, v => { x.note = v; }, { ph: 'correspondence, decisions, where it stands' }));
        box.append(item);
      });
    };
    redraw();
    return sect('Claims for return', 'who is asking for the object back, and on what ground',
      box,
      U.h('div', { class: 'add-line' }, U.h('button', {
        class: 'act', onclick: () => {
          r.claims.push({ id: U.uid(), claimant: '', basis: '', bases: [], status: 'preparing', date: '', note: '' });
          PV.App.entryChanged(r, true); redraw();
        },
      }, '+ Add a claim')));
  }

  /* ----- TK / BC Labels ----- */
  function labelsSect(r) {
    const box = U.h('div');
    const redraw = () => {
      box.innerHTML = '';
      r.tkLabels.forEach((l, i) => {
        const def = PV.Model.resolveLabel(l.code);
        const item = U.h('div', { class: 'item' },
          U.h('div', { class: 'item-head' },
            U.h('span', { class: 'n' }, def.code),
            U.h('span', { style: { fontSize: '15px', color: 'var(--ink-2)' } }, def.name),
            U.h('span', { class: 'sp' }),
            U.h('button', { class: 'act', onclick: () => { r.tkLabels.splice(i, 1); PV.App.entryChanged(r, true); redraw(); } }, 'Remove')),
          def.gloss ? U.h('div', { class: 'note', style: { marginTop: '0' } }, 'Standard text: ' + def.gloss) : null,
          field(r, 'The community’s words', () => l.note, v => { l.note = v; }, { textarea: true, rows: '2', ph: 'the protocol in the community’s own words; leave empty to use the standard text' }),
          U.h('div', { class: 'row2' },
            field(r, 'Community', () => l.community, v => { l.community = v; }, { ph: 'the community or nation placing this label' }),
            field(r, 'Local Contexts Hub URI', () => l.uri, v => { l.uri = v.trim(); }, { type: 'url', ph: 'https://localcontexts.org/…', note: 'the community’s own label record, if registered' })));
        box.append(item);
      });
    };
    redraw();

    const all = PV.vocab.TKLABELS.concat((S.project.labels || []).filter(x => x.code).map(x =>
      ({ code: x.code, name: x.name || x.code, gloss: x.gloss || '', kind: 'community' })));
    const addSel = U.h('select', { style: { minWidth: '280px' } },
      U.h('option', { value: '' }, 'choose a label to add…'),
      U.h('optgroup', { label: 'Traditional Knowledge' }, ...all.filter(l => l.kind === 'tk').map(l =>
        U.h('option', { value: l.code }, l.code + ' · ' + l.name))),
      U.h('optgroup', { label: 'Biocultural' }, ...all.filter(l => l.kind === 'bc').map(l =>
        U.h('option', { value: l.code }, l.code + ' · ' + l.name))),
      ...(all.some(l => l.kind === 'community')
        ? [U.h('optgroup', { label: 'Community-defined' }, ...all.filter(l => l.kind === 'community').map(l =>
            U.h('option', { value: l.code }, l.code + ' · ' + l.name)))]
        : []));
    addSel.addEventListener('change', () => {
      if (!addSel.value) return;
      r.tkLabels.push({ id: U.uid(), code: addSel.value, note: '', community: '', uri: '' });
      addSel.value = '';
      PV.App.entryChanged(r, true); redraw();
    });

    return sect('Traditional Knowledge & Biocultural Labels', 'community protocols (Local Contexts), placed by or with the community of origin',
      box,
      U.h('div', { class: 'add-line' }, addSel),
      U.h('div', { class: 'note' },
        'Labels are statements of a community’s authority, not licences the tool enforces. Place them with the community of origin, never on their behalf. Define your own under Project, in Labels and protocols.'));
  }

  /* ----- CARE notes ----- */
  function careSect(r) {
    const kids = [];
    PV.vocab.CARE.forEach(k => {
      kids.push(field(r, k.label, () => r.careNotes[k.key], v => { r.careNotes[k.key] = v; },
        { textarea: true, rows: '2', ph: k.gloss }));
    });
    return sect('CARE notes', 'Collective benefit, Authority to control, Responsibility, Ethics (GIDA)',
      ...kids,
      U.h('div', { class: 'note' },
        'The CARE principles set the people-and-purpose context that complements the FAIR data this file exports. What you write here travels with the object file into the dossier and the public file.'));
  }

  /* ----- evidence ----- */
  function evidenceItem(r, e, i, redraw) {
    const head = U.h('div', { class: 'item-head' },
      U.h('span', { class: 'n' }, 'Evidence ' + (i + 1)));
    const typeSel = U.h('select', null, ...PV.vocab.EVTYPE.map(t => U.h('option', { value: t, selected: e.type === t ? '' : null }, t)));
    typeSel.addEventListener('change', () => { e.type = typeSel.value; PV.App.entryChanged(r); });
    head.append(typeSel, U.h('span', { class: 'sp' }),
      U.h('button', { class: 'act', onclick: () => { r.evidence.splice(i, 1); PV.App.entryChanged(r, true); redraw(); } }, 'Remove'));

    const item = U.h('div', { class: 'item' }, head);

    item.append(field(r, 'What it is', () => e.label, v => { e.label = v; },
      { ph: 'e.g. Christie’s sale catalogue, 14 June 1981, lot 212' }));

    /* the file line: attach, hash, thumbnail */
    const fileLine = U.h('div', { class: 'field' });
    const drawFileLine = () => {
      fileLine.innerHTML = '';
      fileLine.append(U.h('label', null, 'File'));
      const row = U.h('div', { style: { display: 'flex', gap: '14px', alignItems: 'baseline', flexWrap: 'wrap' } });
      row.append(U.h('button', {
        class: 'btn', onclick: () => PV.App.pickFile(async file => {
          e.file = { name: file.name, size: file.size, type: file.type };
          U.toast('Hashing ' + file.name + '…');
          try {
            e.sha256 = await PV.Hash.sha256(await file.arrayBuffer());
            e.thumb = await PV.Hash.thumbnail(file);
          } catch (err) { U.toast('Could not hash the file'); }
          PV.App.entryChanged(r, true);
          drawFileLine();
        }),
      }, e.file ? 'Replace file' : 'Attach file'));
      if (e.file && e.file.name) {
        row.append(U.h('span', { style: { fontFamily: 'var(--mono)', fontSize: '12.5px', color: 'var(--ink-2)' } },
          e.file.name + (e.sha256 ? ' · sha-256 ' + e.sha256.slice(0, 12) + '…' : '')));
        if (e.sha256) row.append(U.h('button', {
          class: 'act', title: 'Pick the file again and check it against the recorded fingerprint',
          onclick: () => PV.App.pickFile(async file => {
            U.toast('Hashing ' + file.name + '…');
            try {
              const hash = await PV.Hash.sha256(await file.arrayBuffer());
              U.toast(hash === e.sha256
                ? 'Verified: the file matches the recorded fingerprint'
                : 'MISMATCH: this is not the recorded file');
            } catch (err) { U.toast('Could not hash the file'); }
          }),
        }, 'Verify'));
        row.append(U.h('button', { class: 'act', onclick: () => { e.file = null; e.sha256 = e.url ? e.sha256 : ''; e.thumb = ''; PV.App.entryChanged(r, true); drawFileLine(); } }, 'Detach'));
      }
      fileLine.append(row, U.h('div', { class: 'note' },
        'The file itself stays on your machine; the file keeps its name, a small thumbnail for images, and a sha-256 fingerprint that ties the object file to the exact document.'));
    };
    drawFileLine();
    item.append(fileLine);

    const urlField = field(r, 'Or a web address', () => e.url, v => { e.url = v.trim(); }, { type: 'url', ph: 'https://…' });
    const hashBtn = U.h('button', {
      class: 'act',
      onclick: async () => {
        if (!e.url) return U.toast('Give a web address first');
        U.toast('Fetching to hash…');
        try {
          const buf = await (await fetch(e.url)).arrayBuffer();
          e.sha256 = await PV.Hash.sha256(buf);
          PV.App.entryChanged(r, true);
          U.toast('Hashed: ' + e.sha256.slice(0, 12) + '…');
        } catch (err) { U.toast('Could not fetch it (the source may not allow it)'); }
      },
    }, 'Fetch and hash');
    /* the rescue-archiving gesture: ask the Internet Archive to keep a copy */
    const archInput = U.h('input', { type: 'url', value: e.archived || '', placeholder: 'https://web.archive.org/web/…' });
    archInput.addEventListener('input', () => { e.archived = archInput.value.trim(); PV.App.entryChanged(r); });
    const waybackBtn = U.h('button', {
      class: 'act',
      title: 'Open the Internet Archive and ask it to save this address now',
      onclick: () => {
        if (!e.url) return U.toast('Give a web address first');
        window.open('https://web.archive.org/save/' + e.url, '_blank', 'noopener');
        if (!e.archived) {
          e.archived = 'https://web.archive.org/web/' + e.url;
          archInput.value = e.archived;
          PV.App.entryChanged(r, true);
        }
        U.toast('Snapshot requested; the archived address is kept with the evidence');
      },
    }, 'Request a Wayback snapshot');
    item.append(urlField,
      U.h('div', { style: { display: 'flex', gap: '18px', marginTop: '-8px', marginBottom: '14px', flexWrap: 'wrap' } }, hashBtn, waybackBtn),
      U.h('div', { class: 'field' }, U.h('label', null, 'Archived address'), archInput,
        U.h('div', { class: 'note' }, 'The Wayback address of a saved snapshot, so the evidence survives its source going dark.')));

    const consentSel = U.h('select', null, ...PV.vocab.CONSENT.map(c =>
      U.h('option', { value: c.key, selected: e.consent === c.key ? '' : null }, c.label + ': ' + c.gloss)));
    const untilInput = U.h('input', { type: 'date', value: e.until || '' });
    untilInput.addEventListener('input', () => { e.until = untilInput.value; PV.App.entryChanged(r); });
    const untilField = U.h('div', { class: 'field', style: { display: e.consent === 'embargoed' ? '' : 'none' } },
      U.h('label', null, 'Embargoed until'), untilInput,
      U.h('div', { class: 'note' }, 'Optional. When the date passes, the file points it out; the consent state itself changes only by your hand.'));
    consentSel.addEventListener('change', () => {
      e.consent = consentSel.value;
      untilField.style.display = e.consent === 'embargoed' ? '' : 'none';
      PV.App.entryChanged(r);
    });
    item.append(U.h('div', { class: 'row2' },
      field(r, 'Rights / credit', () => e.rights, v => { e.rights = v; }, { ph: 'e.g. courtesy of the family' }),
      U.h('div', { class: 'field' }, U.h('label', null, 'Consent'), consentSel,
        U.h('div', { class: 'note' }, 'Only public evidence enters exports and the public file. Restricted and embargoed material never leaves this file.'))));
    item.append(untilField);

    item.append(U.h('div', { class: 'field' }, U.h('label', null, 'On whose word'),
      sourceSelect(e.sourceId, v => { e.sourceId = v; PV.App.entryChanged(r); }),
      U.h('div', { class: 'note' }, 'Sources are kept under Project, in Sources; only their alias is ever published.')));
    item.append(field(r, 'Note', () => e.note, v => { e.note = v; }, { ph: 'what it shows, where it came from' }));
    return item;
  }

  function evidenceSect(r) {
    const box = U.h('div');
    const redraw = () => {
      box.innerHTML = '';
      r.evidence.forEach((e, i) => box.append(evidenceItem(r, e, i, redraw)));
    };
    redraw();
    return sect('Evidence', 'what lets you assert the provenance and the claim',
      box,
      U.h('div', { class: 'add-line' }, U.h('button', {
        class: 'act', onclick: () => {
          r.evidence.push({ id: U.uid(), type: 'document', label: '', file: null, url: '', sha256: '', rights: '', consent: 'restricted', note: '', thumb: '' });
          PV.App.entryChanged(r, true); redraw();
        },
      }, '+ Add evidence')));
  }

  /* ----- images and holdings ----- */
  function imagesSect(r) {
    const box = U.h('div');
    const redraw = () => {
      box.innerHTML = '';
      r.images.forEach((c, i) => {
        const item = U.h('div', { class: 'item' },
          U.h('div', { class: 'item-head' },
            U.h('span', { class: 'n' }, 'Holding ' + (i + 1)),
            U.h('span', { class: 'sp' }),
            U.h('button', { class: 'act', onclick: () => { r.images.splice(i, 1); PV.App.entryChanged(r, true); redraw(); } }, 'Remove')));
        item.append(
          U.h('div', { class: 'row2' },
            field(r, 'Institution / holder', () => c.institution, v => { c.institution = v; }, { ph: 'who holds or pictures it' }),
            field(r, 'Identifier', () => c.identifier, v => { c.identifier = v; }, { ph: 'accession no., shelfmark' })),
          field(r, 'IIIF address', () => c.iiif, v => { c.iiif = v.trim(); },
            { type: 'url', ph: 'an info.json or manifest; the card gets a Look button', note: 'Paste a IIIF image or manifest address and the holding opens as a deep-zoom image in the card above.' }),
          field(r, 'Web address', () => c.url, v => { c.url = v.trim(); }, { type: 'url', ph: 'catalogue page or plain image' }),
          field(r, 'Note', () => c.note, v => { c.note = v; }, { ph: 'e.g. the museum’s online record' }));
        box.append(item);
      });
    };
    redraw();
    return sect('Images and holdings', 'where the object can be seen: a museum record, an auction image, a IIIF source',
      box,
      U.h('div', { class: 'add-line' }, U.h('button', {
        class: 'act', onclick: () => {
          r.images.push({ id: U.uid(), institution: '', identifier: '', iiif: '', url: '', note: '' });
          PV.App.entryChanged(r, true); redraw();
        },
      }, '+ Add an image or holding')));
  }

  /* ----- sightings: dated reports, supporting or complicating the provenance ----- */
  function sightingsSect(r) {
    const box = U.h('div');
    const redraw = () => {
      box.innerHTML = '';
      r.sightings.forEach((x, i) => {
        const kindSel = U.h('select', null, ...PV.vocab.SIGHTKIND.map(k =>
          U.h('option', { value: k, selected: x.kind === k ? '' : null }, k)));
        kindSel.addEventListener('change', () => { x.kind = kindSel.value; PV.App.entryChanged(r); });
        const bearingPick = U.h('div', { class: 'marks-pick' });
        PV.vocab.BEARING.forEach(b => {
          const btn = U.h('button', { class: 'mark st-unlocated' + (x.bearing === b.key ? ' on' : '') }, b.label);
          btn.addEventListener('click', () => {
            x.bearing = b.key;
            bearingPick.querySelectorAll('button').forEach(y => y.classList.toggle('on', y === btn));
            PV.App.entryChanged(r);
          });
          bearingPick.append(btn);
        });
        const sConsentSel = U.h('select', null, ...PV.vocab.CONSENT.map(c =>
          U.h('option', { value: c.key, selected: x.consent === c.key ? '' : null }, c.label + ': ' + c.gloss)));
        const sUntilInput = U.h('input', { type: 'date', value: x.until || '' });
        sUntilInput.addEventListener('input', () => { x.until = sUntilInput.value; PV.App.entryChanged(r); });
        const sUntilField = U.h('div', { class: 'field', style: { display: x.consent === 'embargoed' ? '' : 'none' } },
          U.h('label', null, 'Embargoed until'), sUntilInput);
        sConsentSel.addEventListener('change', () => {
          x.consent = sConsentSel.value;
          sUntilField.style.display = x.consent === 'embargoed' ? '' : 'none';
          PV.App.entryChanged(r);
        });
        const item = U.h('div', { class: 'item' },
          U.h('div', { class: 'item-head' },
            U.h('span', { class: 'n' }, 'Sighting ' + (i + 1)),
            kindSel,
            U.h('span', { class: 'sp' }),
            U.h('button', { class: 'act', onclick: () => { r.sightings.splice(i, 1); PV.App.entryChanged(r, true); redraw(); } }, 'Remove')),
          U.h('div', { class: 'row2' },
            field(r, 'When', () => x.date, v => { x.date = v; }, { ph: 'e.g. 14 June 1981' }),
            field(r, 'Where', () => x.place, v => { x.place = v; }, { ph: 'sale room, museum, collection' })),
          U.h('div', { class: 'row2' },
            U.h('div', { class: 'field' }, U.h('label', null, 'On whose word'),
              sourceSelect(x.sourceId, v => { x.sourceId = v; PV.App.entryChanged(r); })),
            U.h('div', { class: 'field' }, U.h('label', null, 'Bearing on the provenance'), bearingPick)),
          U.h('div', { class: 'field' }, U.h('label', null, 'Consent'), sConsentSel,
            U.h('div', { class: 'note' }, 'Only sightings marked public enter the object file and exports. The source’s alias is all that ever shows.')),
          sUntilField,
          field(r, 'Note', () => x.note, v => { x.note = v; }, { ph: 'lot, price, citation, what was recorded' }));
        box.append(item);
      });
    };
    redraw();
    return sect('Sightings in the record', 'auction lots, catalogues, accessions, photographs: where the object surfaced',
      box,
      U.h('div', { class: 'add-line' }, U.h('button', {
        class: 'act', onclick: () => {
          r.sightings.push({ id: U.uid(), date: '', kind: 'auction lot', bearing: 'supports', place: '', sourceId: null, note: '', consent: 'restricted', until: '' });
          PV.App.entryChanged(r, true); redraw();
        },
      }, '+ Add a sighting')),
      U.h('div', { class: 'note' },
        'Each sighting carries its own consent: only those marked public enter the object file and exports, always under the source’s alias. What must stay private belongs in the research log below.'));
  }

  /* ----- the research log: the search itself, dated; never exported ----- */
  function logSect(r) {
    const box = U.h('div');
    const redraw = () => {
      box.innerHTML = '';
      r.log.forEach((x, i) => {
        const date = U.h('input', { type: 'text', value: x.date || '', placeholder: 'date', style: { width: '120px', fontFamily: 'var(--mono)', fontSize: '13px' } });
        date.addEventListener('input', () => { x.date = date.value; PV.App.entryChanged(r); });
        const note = U.h('input', { type: 'text', value: x.note || '', placeholder: 'what was tried, who was asked, what came back', style: { flex: '1' }, dir: 'auto' });
        note.addEventListener('input', () => { x.note = note.value; PV.App.entryChanged(r); });
        box.append(U.h('div', { style: { display: 'flex', gap: '14px', alignItems: 'baseline', marginBottom: '12px' } },
          date, note,
          U.h('button', { class: 'act', onclick: () => { r.log.splice(i, 1); PV.App.entryChanged(r, true); redraw(); } }, 'Remove')));
      });
    };
    redraw();
    return sect('Research log', 'dated working notes; these never leave the working file',
      box,
      U.h('div', { class: 'add-line' }, U.h('button', {
        class: 'act', onclick: () => {
          r.log.push({ id: U.uid(), date: new Date().toISOString().slice(0, 10), note: '' });
          PV.App.entryChanged(r, true); redraw();
          const inputs = box.querySelectorAll('input[dir="auto"]');
          if (inputs.length) inputs[inputs.length - 1].focus();
        },
      }, '+ Add a note')),
      U.h('div', { class: 'note' },
        'Negative results are findings: the archive that says no file exists, the dealer who will not answer. Kept out of every export and the public file.'));
  }

  /* ----- relations: typed links; the other side is computed, not stored ----- */
  function relationsSect(r) {
    const box = U.h('div');
    const candidates = x => {
      const list = S.records.filter(o => o.id !== r.id && !o.struck);
      if (x && x.target && !list.some(o => o.id === x.target)) {
        const t = PV.Model.get(x.target);
        if (t) list.push(t);
      }
      return list;
    };
    const redraw = () => {
      box.innerHTML = '';
      r.relations.forEach((x, i) => {
        const typeSel = U.h('select', null, ...PV.vocab.RELATION.map(v =>
          U.h('option', { value: v.key, selected: x.type === v.key ? '' : null }, v.label)));
        typeSel.addEventListener('change', () => { x.type = typeSel.value; PV.App.entryChanged(r); });
        const tgtSel = U.h('select', { style: { flex: '1', minWidth: '220px' } }, ...candidates(x).map(o =>
          U.h('option', { value: o.id, selected: x.target === o.id ? '' : null },
            o.id + ' · ' + PV.Model.title(o) + (o.struck ? ' (struck)' : ''))));
        tgtSel.addEventListener('change', () => { x.target = tgtSel.value; PV.App.entryChanged(r); });
        box.append(U.h('div', { style: { display: 'flex', gap: '14px', alignItems: 'baseline', marginBottom: '12px', flexWrap: 'wrap' } },
          typeSel, tgtSel,
          U.h('button', { class: 'act', onclick: () => { r.relations.splice(i, 1); PV.App.entryChanged(r, true); redraw(); } }, 'Remove')));
      });
    };
    redraw();
    return sect('In relation', 'typed links to other object files; the other side is implied',
      box,
      U.h('div', { class: 'add-line' }, U.h('button', {
        class: 'act', onclick: () => {
          const list = S.records.filter(o => o.id !== r.id && !o.struck);
          if (!list.length) return U.toast('No other object file to link to yet');
          r.relations.push({ type: 'part-of', target: list[0].id });
          PV.App.entryChanged(r, true); redraw();
        },
      }, '+ Add a relation')));
  }

  /* ----- striking out: a ledger cancels, it does not erase ----- */
  function strikeSect(r) {
    if (!r.struck) {
      return sect('Striking out', null,
        U.h('button', {
          class: 'btn danger', onclick: () => {
            r.struck = true;
            PV.App.entryChanged(r, true);
            U.toast('Object ' + r.id + ' struck: it stays as a cancelled line');
            PV.Record.render(r.id);
            window.scrollTo(0, 0);
          },
        }, 'Strike this object file'),
        U.h('div', { class: 'note', style: { marginTop: '10px' } },
          'A struck file stays in the docket as a cancelled line: visible here, kept out of every export, restorable at any time. Its number is never reused.'));
    }
    return sect('Struck out', 'this object file is a cancelled line',
      U.h('div', { style: { display: 'flex', gap: '14px', flexWrap: 'wrap' } },
        U.h('button', {
          class: 'btn', onclick: () => {
            r.struck = false;
            PV.App.entryChanged(r, true);
            U.toast('Object ' + r.id + ' restored to the docket');
            PV.Record.render(r.id);
            window.scrollTo(0, 0);
          },
        }, 'Restore this object file'),
        U.h('button', {
          class: 'btn danger', onclick: () => {
            if (confirm('Remove object ' + r.id + ' from the project entirely? Unlike striking, this cannot be undone.')) {
              PV.Model.remove(r.id);
              PV.Store.save();
              U.toast('Object ' + r.id + ' removed from the project');
              location.hash = '#/register';
            }
          },
        }, 'Remove it outright')),
      U.h('div', { class: 'note', style: { marginTop: '10px' } },
        'Restoring returns the file to the docket and its exports. Removing it outright erases it from the project file: for mistaken files, not for objects.'));
  }

  /* ----- the whole desk ----- */
  function build(r) {
    const desk = U.h('div', { class: 'desk' });
    desk.append(U.h('div', { class: 'desk-head' },
      U.h('h3', null, 'The registrar’s desk'),
      U.h('span', { class: 'hint' }, 'everything you set here appears in the object file above, as you type')));

    desk.append(titlesSect(r));

    desk.append(sect('The object itself', null,
      U.h('div', { class: 'row2' },
        field(r, 'Maker / artist / culture', () => r.creator, v => { r.creator = v; }, { ph: 'who or what made it' }),
        field(r, 'Date or period', () => r.date, v => { r.date = v; }, { ph: 'e.g. 1890s, or 12th century' })),
      U.h('div', { class: 'row2' },
        field(r, 'Object type', () => r.objectType, v => { r.objectType = v; }, { ph: 'e.g. mask, manuscript, photograph' }),
        field(r, 'Materials / medium', () => r.medium, v => { r.medium = v; }, { ph: 'e.g. wood, pigment, fibre' })),
      U.h('div', { class: 'row2' },
        field(r, 'Origin / community of origin', () => r.origin, v => { r.origin = v; }, { ph: 'where it is from; the community it belongs to' }),
        field(r, 'Dimensions', () => r.dimensions, v => { r.dimensions = v; }, { ph: 'e.g. 32 × 21 cm' })),
      U.h('div', { class: 'row2' },
        field(r, 'Extent: how many', () => r.extent.amount == null ? '' : r.extent.amount,
          v => { const n = parseFloat(String(v).replace(/[, ]/g, '')); r.extent.amount = isFinite(n) ? n : null; },
          { ph: 'e.g. 40', note: 'For a body of dispersed objects, so statistics can count objects, not just files.' }),
        field(r, 'Extent: of what', () => r.extent.unit, v => { r.extent.unit = v; }, { ph: 'e.g. plates, leaves, objects' }))));

    desk.append(identifiersSect(r));
    desk.append(statusSect(r));
    desk.append(holderSect(r));
    desk.append(custodySect(r));
    desk.append(sightingsSect(r));
    desk.append(claimsSect(r));

    const loc = r.location;
    const locPick = U.h('div', { class: 'marks-pick' });
    PV.vocab.LOCPUB.forEach(lp => {
      const b = U.h('button', { class: 'mark st-unlocated' + (loc.publish === lp.key ? ' on' : ''), title: lp.gloss, 'data-pub': lp.key }, lp.label);
      b.addEventListener('click', () => {
        loc.publish = lp.key;
        locPick.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        PV.App.entryChanged(r, true);
      });
      locPick.append(b);
    });

    /* coordinates: typed by hand, or filled from a place name (below) */
    const latInput = U.h('input', { type: 'text', value: loc.lat == null ? '' : loc.lat, placeholder: 'e.g. 34.42' });
    const lonInput = U.h('input', { type: 'text', value: loc.lon == null ? '' : loc.lon, placeholder: 'e.g. -119.70' });
    const onManual = () => {
      const a = parseFloat(latInput.value), b = parseFloat(lonInput.value);
      loc.lat = isFinite(a) ? a : null; loc.lon = isFinite(b) ? b : null;
      r._coordsManual = true;            /* the compiler set these; do not overwrite */
      setGeoNote('', '');
      PV.App.entryChanged(r);
    };
    latInput.addEventListener('input', onManual);
    lonInput.addEventListener('input', onManual);

    /* the place name, which can populate the Atlas on its own */
    const geoNote = U.h('div', { class: 'note' });
    function setGeoNote(msg, kind) {
      geoNote.innerHTML = '';
      geoNote.style.color = kind === 'match' ? 'var(--blue)' : (kind === 'miss' ? 'var(--stamp)' : '');
      if (msg) geoNote.append(msg);
    }
    function applyMatch(m, precise) {
      const round = precise ? (x => Math.round(x * 1e5) / 1e5) : (x => Math.round(x * 100) / 100);
      loc.lat = round(m.lat); loc.lon = round(m.lon);
      latInput.value = loc.lat; lonInput.value = loc.lon;
      r._coordsManual = false;
      PV.App.entryChanged(r, true);
    }
    const placeInput = U.h('input', { type: 'text', value: loc.place || '', dir: 'auto',
      placeholder: 'a city, or "British Museum, London"' });
    let geoTimer = null;
    const tryLocal = () => {
      if (!window.PV || !PV.Geocode) return;
      if (r._coordsManual && (loc.lat != null || loc.lon != null)) {
        setGeoNote('Coordinates were entered by hand; clear them to match from the place name.', '');
        return;
      }
      const m = PV.Geocode.resolveLocal(loc.place);
      if (m) {
        applyMatch(m, false);
        setGeoNote('On the atlas: ' + PV.Geocode.describe(m) + ' · approximate. Choose Approximate or Exact below to publish it.', 'match');
      } else if (loc.place.trim()) {
        setGeoNote('No place matched offline. Look it up online, or type coordinates.', 'miss');
      } else {
        setGeoNote('', '');
      }
    };
    placeInput.addEventListener('input', () => {
      loc.place = placeInput.value;
      PV.App.entryChanged(r);
      clearTimeout(geoTimer); geoTimer = setTimeout(tryLocal, 350);
    });

    const onlineBtn = U.h('button', {
      class: 'act', title: 'Ask OpenStreetMap to resolve this exact place',
      onclick: async () => {
        if (!loc.place.trim()) return U.toast('Type a place first');
        setGeoNote('Looking up online…', '');
        try {
          const m = await PV.Geocode.lookupOnline(loc.place);
          applyMatch(m, true);
          setGeoNote('Found online: ' + m.label, 'match');
          U.toast('Place found; coordinates set');
        } catch (e) { setGeoNote(e.message || 'The lookup failed.', 'miss'); }
      },
    }, 'Look up online');

    desk.append(sect('Current location', 'where the object is now; type a place and it lands on the atlas',
      U.h('div', { class: 'field' }, U.h('label', null, 'Place name'), placeInput, geoNote),
      U.h('div', { class: 'add-line' }, onlineBtn,
        U.h('span', { class: 'note', style: { marginLeft: '14px' } },
          'Offline matching stays on your machine. The online lookup sends the place name to OpenStreetMap, only when you press it.')),
      U.h('div', { class: 'row2' },
        U.h('div', { class: 'field' }, U.h('label', null, 'Latitude'), latInput),
        U.h('div', { class: 'field' }, U.h('label', null, 'Longitude'), lonInput)),
      U.h('div', { class: 'field' },
        U.h('label', null, 'Publication of this place'), locPick,
        U.h('div', { class: 'note' },
          'Withheld by default: a current location can endanger an object or the people around it. Approximate publishes the place rounded to about 10 km. Exact publishes it precisely.'))));
    if (loc.place && loc.place.trim()) setTimeout(tryLocal, 0);

    desk.append(labelsSect(r));
    desk.append(careSect(r));

    const pubBox = U.h('input', { type: 'checkbox' });
    pubBox.checked = !!r.publish;
    pubBox.addEventListener('change', () => { r.publish = pubBox.checked; PV.App.entryChanged(r, true); });
    desk.append(sect('Publication', 'whether this object file leaves the working file at all',
      U.h('div', { class: 'field' },
        U.h('label', { class: 'inline', style: { fontFamily: 'var(--serif)', textTransform: 'none', letterSpacing: '0' } },
          pubBox, 'Publish this object file'),
        U.h('div', { class: 'note' },
          'Off by default. Until you tick it, the whole file stays out of the dossier, the public file, the spreadsheet, and the sought notice: catalogued and counted, but held back.'))));

    desk.append(sect('Narrative note', 'the object’s story, in your own words',
      field(r, 'Note', () => r.note, v => { r.note = v; }, { textarea: true, rows: '6', ph: 'What it is, how it came to be where it is, what the record shows and leaves open.' })));

    const tagsInput = U.h('input', { type: 'text', value: (r.tags || []).join(', '), placeholder: 'comma-separated, e.g. masks, Benin, bronze' });
    tagsInput.addEventListener('input', () => {
      r.tags = tagsInput.value.split(',').map(s => s.trim()).filter(Boolean);
      PV.App.entryChanged(r);
    });
    desk.append(sect('Tags', null, U.h('div', { class: 'field' }, U.h('label', null, 'Tags'), tagsInput)));

    desk.append(evidenceSect(r));
    desk.append(imagesSect(r));
    desk.append(relationsSect(r));
    desk.append(logSect(r));

    desk.append(strikeSect(r));

    return desk;
  }

  return { build };
})();
