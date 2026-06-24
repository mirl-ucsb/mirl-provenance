/* exporters.js: ways the file leaves the room, always on the project's terms.
   Every export starts from the public clone: restricted and embargoed evidence
   withheld, locations withheld unless marked safe to publish. The chain of
   custody, claims, CARE notes, and TK / BC Labels travel with it: they are the
   dossier's substance. The one exception is "save project", which is the
   compiler's own working file and keeps everything. */

PV.Exporters = (function () {
  const S = PV.state;
  const U = PV.util;

  /* ---------- the working file (everything; sealed when locked) ---------- */
  async function saveProject() {
    const name = U.slug(S.project.title) + '.provenance.json';
    let text = JSON.stringify(PV.Model.serialize(false), null, 2);
    if (PV.Lock.active()) {
      try { text = await PV.Lock.seal(text); }
      catch (e) { return U.toast('Could not encrypt the file'); }
    }
    U.downloadText(name, text, 'application/json');
    U.toast('Project saved: ' + name + (PV.Lock.active() ? ' (locked)' : ''));
  }

  /* ---------- public data (consent applied) ---------- */
  function publicJSON() {
    const name = U.slug(S.project.title) + '-public.json';
    U.downloadText(name, JSON.stringify(PV.Model.serialize(true), null, 2), 'application/json');
    U.toast('Public data saved: ' + name);
  }

  /* ---------- the docket as a spreadsheet ---------- */
  function csvCell(v) {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function registerCSV() {
    const pub = PV.Model.publicClone();
    const head = ['id', 'title', 'parallel_titles', 'maker', 'date', 'object_type', 'materials',
      'origin_community', 'dimensions', 'identifiers',
      'status', 'provenance_certainty', 'dispersal_event', 'extent_amount', 'extent_unit',
      'current_holder', 'held_since', 'chain_of_custody', 'claims', 'legal_bases', 'tk_bc_labels', 'tk_bc_label_uris',
      'narrative', 'tags', 'current_place', 'latitude', 'longitude', 'location_precision',
      'public_evidence', 'holdings', 'relations'];
    const rows = pub.records.map(r => {
      const titles = (r.titles || []).filter(t => t.text && t.text.trim());
      const loc = r.location || {};
      const hasCoords = typeof loc.lat === 'number' && typeof loc.lon === 'number';
      const ev = r.eventId && (pub.project.events || []).find(x => x.id === r.eventId);
      const ch = r.currentHolder || {};
      return [
        r.id,
        titles.length ? titles[0].text : '',
        titles.slice(1).map(t => t.text).join(' | '),
        r.creator, r.date, r.objectType, r.medium, r.origin, r.dimensions,
        (r.identifiers || []).map(x => [x.scheme, x.value].filter(Boolean).join(' ')).filter(Boolean).join(' | '),
        PV.vocab.statusOf(r.status).label,
        r.certainty,
        ev ? ev.name : '',
        (r.extent && typeof r.extent.amount === 'number') ? r.extent.amount : '',
        (r.extent && r.extent.unit) || '',
        ch.name || '', ch.since || '',
        (r.custody || []).map(x => [x.date, x.holder, x.transfer && x.transfer !== 'unknown' ? '(' + x.transfer + ')' : ''].filter(Boolean).join(' ')).join(' | '),
        (r.claims || []).map(x => x.claimant + ' [' + PV.vocab.claimStatusOf(x.status).label + ']').join(' | '),
        (r.claims || []).flatMap(x => (x.bases || []).map(k => (PV.vocab.claimBasisOf(k) || {}).label)).filter(Boolean).join(' | '),
        (r.tkLabels || []).map(x => x.code).join(' | '),
        (r.tkLabels || []).map(x => x.uri).filter(Boolean).join(' | '),
        r.note,
        (r.tags || []).join(' | '),
        loc.place || '',
        hasCoords ? loc.lat : '',
        hasCoords ? loc.lon : '',
        hasCoords || loc.place ? loc.publish : '',
        (r.evidence || []).length,
        (r.images || []).map(c => [c.institution, c.identifier].filter(Boolean).join(': ')).filter(Boolean).join(' | '),
        (r.relations || []).map(x => PV.vocab.relationOf(x.type).label.toLowerCase() + ' ' + x.target).join(' | '),
      ].map(csvCell).join(',');
    });
    /* BOM so spreadsheets read Arabic and accents correctly */
    const csv = '﻿' + head.join(',') + '\n' + rows.join('\n') + '\n';
    const name = U.slug(S.project.title) + '-docket.csv';
    U.downloadText(name, csv, 'text/csv;charset=utf-8');
    U.toast('Docket saved: ' + name);
  }

  /* ---------- the public file: one self-contained page ---------- */
  async function inlineCSS() {
    let css = '';
    try { css = await (await fetch('css/style.css')).text(); } catch (e) { return ''; }
    /* carry the fonts along as data, so the single file stands alone */
    const names = [];
    css.replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, (m, n) => { names.push(n); return m; });
    try {
      const datas = {};
      for (const n of names) {
        const buf = await (await fetch('fonts/' + n)).arrayBuffer();
        let bin = '';
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        datas[n] = 'data:font/woff2;base64,' + btoa(bin);
      }
      css = css.replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, (m, n) => 'url("' + datas[n] + '")');
    } catch (e) {
      /* no fonts to be had (file:// perhaps): fall back to system faces */
      css = css.replace(/@font-face\s*\{[^}]*\}/g, '');
    }
    return css;
  }

  const STATIC_JS = [
    'function show(h){',
    "  var m=/^#\\/entry\\/(.+)$/.exec(h||'');",
    "  var view=m?'entry':(h==='#/statistics'?'statistics':(h==='#/atlas'?'atlas':(h==='#/timeline'?'timeline':(h==='#/index'?'index':'register'))));",
    "  ['register','entry','timeline','statistics','atlas','index'].forEach(function(v){",
    "    var s=document.getElementById('v-'+v);",
    "    if(s)s.classList.toggle('hidden',v!==view);",
    "    var b=document.querySelector('nav.folio button[data-view=\"'+v+'\"]');",
    "    if(b)b.classList.toggle('on',v===view);",
    '  });',
    "  document.querySelectorAll('#v-entry .one').forEach(function(d){d.classList.add('hidden');});",
    '  if(m){var d=document.getElementById(\'r-\'+m[1]);if(d)d.classList.remove(\'hidden\');}',
    '  window.scrollTo(0,0);',
    '}',
    "window.addEventListener('hashchange',function(){show(location.hash);});",
    "document.addEventListener('click',function(e){",
    "  var v=e.target.closest('nav.folio button[data-view]');",
    "  if(v){location.hash='#/'+v.getAttribute('data-view');return;}",
    "  var t=e.target.closest('[data-id]');",
    "  if(t&&!e.target.closest('a')){location.hash='#/entry/'+t.getAttribute('data-id');}",
    '});',
    'show(location.hash);',
  ].join('\n');

  async function findingAid() {
    const pub = PV.Model.publicClone();
    if (!pub.records.length) return U.toast('Nothing is marked publish yet; the public file would be empty');
    U.toast('Composing the public file…');
    const p = pub.project;
    const css = await inlineCSS();
    const e = U.esc;
    const kept = [p.compiler, p.institution].filter(Boolean).join(', ');
    const today = new Date();
    const dateLine = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    let body = '';
    body += '<header class="app"><div class="plate"><h1>' + e(p.title || 'Untitled object file') + '</h1>' +
      '<span class="tag">' + e(p.subtitle || 'object files of contested and dispersed things') + '</span></div></header>';
    body += '<nav class="folio"><div class="views">' +
      '<button class="view on" data-view="register"><span class="fol">Fol. I</span>Docket</button>' +
      '<button class="view" data-view="timeline"><span class="fol">Fol. II</span>Chronology</button>' +
      '<button class="view" data-view="statistics"><span class="fol">Fol. III</span>Statistics</button>' +
      '<button class="view" data-view="atlas"><span class="fol">Fol. IV</span>Atlas</button>' +
      '<button class="view" data-view="index"><span class="fol">Fol. V</span>Index</button>' +
      '</div></nav>';

    const heldBack = PV.Model.heldBackCount();
    body += '<main><section class="view" id="v-register"><div class="sheet">';
    body += '<div class="frontmatter"><div class="fm-line">A file of contested and dispersed objects' + (kept ? ' · kept by ' + e(kept) : '') + '</div>';
    if (p.note) body += '<p class="hint" style="max-width:760px;margin-top:14px">' + e(p.note) + '</p>';
    if (heldBack) body += '<div class="fm-line" style="margin-top:8px">' + heldBack +
      (heldBack === 1 ? ' further object file is' : ' further object files are') +
      ' recorded in the working file and not published here</div>';
    if (p.contact) body += '<div class="fm-line" style="margin-top:8px">Contact · ' + e(p.contact) + '</div>';
    body += '</div>';
    body += '<div class="countline">' + pub.records.length + (pub.records.length === 1 ? ' object file' : ' object files') + ' · ' + e(dateLine) + '</div>';
    body += PV.Register.tableHTML(pub.records, { static: true });
    body += '</div></section>';

    body += '<section class="view hidden" id="v-entry"><div class="sheet narrow">';
    body += '<div style="margin:36px 0 0"><a href="#/register" style="font-family:var(--mono);font-size:12.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);text-decoration:none">‹ Docket</a></div>';
    pub.records.forEach(r => {
      body += '<div class="one objfile-wrap hidden" id="r-' + e(r.id) + '">' +
        PV.Card.html(r, { static: true, publicOnly: true, project: p, records: pub.records }) + '</div>';
    });
    body += '</div></section>';

    body += '<section class="view hidden" id="v-timeline"><div class="sheet narrow">' +
      PV.Timeline.html(pub, { publicOnly: true }) + '</div></section>';
    body += '<section class="view hidden" id="v-statistics"><div class="sheet narrow">' +
      PV.Stats.html(pub, { publicOnly: true }) + '</div></section>';
    body += '<section class="view hidden" id="v-atlas"><div class="sheet">' +
      PV.Atlas.html(pub, { publicOnly: true }) + '</div></section>';
    body += '<section class="view hidden" id="v-index"><div class="sheet narrow">' +
      PV.Indexes.html(pub, { publicOnly: true }) + '</div></section>';
    body += '</main>';

    body += '<footer style="padding:50px 44px 60px;text-align:center">' +
      '<div class="fm-line" style="margin:0">Compiled ' + e(dateLine) +
      ' · restricted evidence and unpublished locations are withheld from this document</div>' +
      '<div class="fm-line" style="margin-top:8px">Made with MIRL Provenance · Material / Image Research Lab, UC Santa Barbara</div></footer>';

    const html = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<title>' + e(p.title || 'Untitled object file') + '</title>\n' +
      '<style>\n' + css + '\n</style>\n</head>\n<body>\n' + body +
      '\n<script>\n' + STATIC_JS + '\n</' + 'script>\n</body>\n</html>\n';

    const name = U.slug(p.title) + '-public-file.html';
    U.downloadText(name, html, 'text/html;charset=utf-8');
    U.toast('Public file saved: ' + name);
  }

  /* ---------- the restitution dossier: composed for paper ----------
     A cover leaf from the front matter, one object file per page with its
     chain of custody and claims, and the docket and index as appendices.
     Consent applies as in every export; the browser's print dialog turns it
     into a PDF that can sit before a court, a ministry, or a NAGPRA review. */
  function printBook() {
    const pub = PV.Model.publicClone();
    const p = pub.project;
    const e = U.esc;
    if (!pub.records.length) {
      return U.toast('Nothing is marked publish yet; the dossier would be empty');
    }
    const heldBack = PV.Model.heldBackCount();
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const kept = [p.compiler, p.institution].filter(Boolean).join(', ');

    let h = '<div class="book-page"><div class="book-cover"><div class="inner">' +
      '<div class="kind">Restitution dossier</div>' +
      '<h1>' + e(p.title || 'Untitled object file') + '</h1>' +
      (p.subtitle ? '<div class="sub">' + e(p.subtitle) + '</div>' : '') +
      '<hr>' +
      (kept ? '<div class="kept">prepared by ' + e(kept) + '</div>' : '') +
      (p.note ? '<div class="scope">' + e(p.note) + '</div>' : '') +
      '<div class="foot"><div>' + pub.records.length + (pub.records.length === 1 ? ' object file' : ' object files') + ' · ' + e(today) + '</div>' +
      (heldBack ? '<div>' + heldBack + (heldBack === 1 ? ' further object file is' : ' further object files are') + ' recorded and not published here</div>' : '') +
      '<div>made with MIRL Provenance · Material / Image Research Lab, UC Santa Barbara</div></div>' +
      '</div></div></div>';

    pub.records.forEach(r => {
      h += '<div class="book-page objfile-wrap">' +
        PV.Card.html(r, { static: true, publicOnly: true, project: p, records: pub.records }) + '</div>';
    });

    h += '<div class="book-page"><h2 class="appendix">Appendix I · The docket</h2>' +
      PV.Register.tableHTML(pub.records, { static: true }) + '</div>';
    h += '<div class="book-page"><h2 class="appendix">Appendix II · Index</h2>' +
      PV.Indexes.html(pub, { publicOnly: true }).replace('<h2 class="head">Index</h2>', '') + '</div>';

    let book = document.getElementById('book');
    if (!book) {
      book = document.createElement('div');
      book.id = 'book';
      document.body.append(book);
    }
    book.innerHTML = h;
    document.body.classList.add('book-mode');
    const cleanup = () => {
      document.body.classList.remove('book-mode');
      book.innerHTML = '';
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    U.toast('Composing the dossier… choose Save as PDF in the print dialog');
    setTimeout(() => window.print(), 150);
  }

  /* ---------- a sought notice for circulation ----------
     One object as a printable appeal for return: what it is, where it is held
     now, who is asking for it, whom to tell. Evidence consent and place
     publication apply as ever; the compiler chooses to circulate it, so a
     held-back file may print, with a reminder. */
  function printNotice(r) {
    if (!r) return U.toast('Open an object file first');
    if (r.struck) return U.toast('This object file is struck; a struck record is not circulated as a notice.');
    const p = S.project;
    const e = U.esc;
    const st = PV.vocab.statusOf(r.status);
    const title = PV.Model.title(r);
    const alts = PV.Model.altTitles(r);
    const photo = (r.evidence || []).find(x => x.consent === 'public' && x.thumb);
    const ch = r.currentHolder || {};
    const claim = (r.claims || []).find(x => x.claimant);
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const contact = p.contact || p.compiler || p.institution || '';

    let h = '<div class="book-page"><div class="notice-poster"><div class="inner">';
    h += '<div class="np-head">Sought for return</div>';
    h += '<h1' + (U.isRTL(title) ? ' dir="rtl"' : '') + '>' + e(title) + '</h1>';
    alts.forEach(a => {
      h += '<div class="np-alt"' + (U.isRTL(a.text) ? ' dir="rtl"' : '') + '>' + e(a.text) + '</div>';
    });
    const vital = [r.creator, r.objectType, r.medium, r.date].filter(s => s && s.trim()).join(' · ');
    if (vital) h += '<div class="np-vital">' + e(vital) + '</div>';
    if (photo) h += '<img class="np-img" src="' + photo.thumb + '" alt="">';
    h += '<div class="np-status"><span class="mark ' + st.cls + '">' + e(st.label) + '</span></div>';
    if (r.origin) h += '<div class="np-seen">Origin · ' + e(r.origin) + '</div>';
    if (ch.name) h += '<div class="np-seen">Held by ' + e(ch.name) + (ch.since ? ', since ' + e(ch.since) : '') + '</div>';
    if (claim) h += '<div class="np-seen">Claimed by ' + e(claim.claimant) + '</div>';
    if (r.extent && typeof r.extent.amount === 'number') {
      h += '<div class="np-seen">' + r.extent.amount.toLocaleString('en-US') + ' ' + e(r.extent.unit || 'objects') + '</div>';
    }
    h += '<hr class="np-rule">';
    h += '<div class="np-ask">If you know anything of it, or can help with its return:</div>';
    if (contact) h += '<div class="np-contact">' + e(contact) + '</div>';
    h += '<div class="np-foot">' + e(p.title || 'Untitled object file') + ' · object ' + e(r.id) + ' · ' + e(today) + '</div>';
    h += '</div></div></div>';

    let book = document.getElementById('book');
    if (!book) {
      book = document.createElement('div');
      book.id = 'book';
      document.body.append(book);
    }
    book.innerHTML = h;
    document.body.classList.add('book-mode');
    const cleanup = () => {
      document.body.classList.remove('book-mode');
      book.innerHTML = '';
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    if (!r.publish) U.toast('This object file is held back; the notice still honours evidence consent');
    setTimeout(() => window.print(), 150);
  }

  /* ---------- a claim letter, composed for paper ----------
     A draft request for return for the open object, addressed to the current
     holder, naming the object, how it left, the claim, and the legal bases it
     rests on, with the dossier offered as the evidence. A starting point for a
     real letter, not a substitute for counsel. */
  function claimLetter(r) {
    if (!r) return U.toast('Open an object file first');
    if (r.struck) return U.toast('This object file is struck; a struck record is not circulated as a claim letter.');
    const p = S.project;
    const e = U.esc;
    const title = PV.Model.title(r);
    const ch = r.currentHolder || {};
    const claim = (r.claims || [])[0] || null;
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const ev = r.eventId && (p.events || []).find(x => x.id === r.eventId);
    const bases = claim ? (claim.bases || []).map(k => PV.vocab.claimBasisOf(k)).filter(Boolean) : [];
    const sender = [p.compiler, p.institution].filter(Boolean).join(', ');

    let body = '';
    body += '<div class="lt-head"><div class="lt-from">' + (sender ? e(sender) : '[your name and institution]') +
      (p.contact ? '<br>' + e(p.contact) : '') + '</div><div class="lt-date">' + e(today) + '</div></div>';
    body += '<div class="lt-to">' + (ch.name ? e(ch.name) : '[the current holder]') + '</div>';
    body += '<div class="lt-re">Re: request for the return of <em>' + e(title) + '</em> (object ' + e(r.id) +
      (r.identifiers && r.identifiers[0] && r.identifiers[0].value ? ', ' + e(r.identifiers[0].value) : '') + ')</div>';

    body += '<p>To whom it may concern,</p>';

    let p1 = 'We write concerning <em>' + e(title) + '</em>';
    if (r.creator || r.objectType) p1 += ', ' + e([r.creator, r.objectType].filter(Boolean).join(', '));
    if (r.origin) p1 += ', of ' + e(r.origin);
    p1 += (ch.name ? ', now held by ' + e(ch.name) + (ch.since ? ' since ' + e(ch.since) : '') : '') + '.';
    body += '<p>' + p1 + '</p>';

    if ((r.custody || []).length || ev) {
      let p2 = 'The record assembled in the accompanying dossier traces how the object left its place of origin';
      if (ev) p2 += ', in connection with ' + e(ev.name || 'a documented dispersal') + (ev.date ? ' (' + e(ev.date) + ')' : '');
      p2 += '. Its chain of custody is set out there in full, with each link and its source.';
      body += '<p>' + p2 + '</p>';
    }

    if (claim) {
      let p3 = 'On behalf of ' + e(claim.claimant || '[the claimant]') + ', we ask for the object’s return';
      if (bases.length) p3 += ', on the basis of ' + bases.map(b => e(b.label)).join(', ');
      p3 += '.';
      if (claim.basis) p3 += ' ' + e(claim.basis);
      body += '<p>' + p3 + '</p>';
    } else {
      body += '<p>We ask that you open a dialogue regarding the object’s return. [State the claimant and the grounds.]</p>';
    }

    body += '<p>The full dossier, with the evidence and its provenance, is enclosed. We would welcome your response and the opportunity to discuss the object’s return.</p>';
    body += '<p class="lt-sign">Respectfully,<br><br>' + (sender ? e(sender) : '[your name]') + '</p>';
    body += '<div class="lt-foot">A draft generated by MIRL Provenance from object ' + e(r.id) +
      '. Review and adapt before sending; this is not legal advice.</div>';

    paperOut('<div class="book-page"><div class="letter">' + body + '</div></div>',
      'Composing the claim letter… choose Save as PDF in the print dialog', r.publish);
  }

  /* ---------- Object ID export (Getty / ICOM standard) ----------
     The international checklist for describing an object so it can be reported
     to police, customs, and INTERPOL. One record per published object. */
  function objectIDExport() {
    const pub = PV.Model.publicClone();
    const records = pub.records.map(r => {
      const inscr = (r.identifiers || []).filter(x => /inscription|mark|stamp/i.test(x.scheme))
        .map(x => x.value).join('; ');
      const photos = (r.evidence || []).filter(x => x.thumb || x.url).map(x => x.url || x.thumb).filter(Boolean)
        .concat((r.images || []).map(x => x.url || x.iiif).filter(Boolean));
      return {
        objectID_standard: 'Getty/ICOM Object ID',
        type_of_object: r.objectType || '',
        materials_and_techniques: r.medium || '',
        measurements: r.dimensions || '',
        inscriptions_and_markings: inscr,
        distinguishing_features: '',
        title: PV.Model.title(r),
        subject: (r.tags || []).join('; '),
        date_or_period: r.date || '',
        maker: r.creator || '',
        short_description: (r.note || '').split(/\n/)[0].slice(0, 600),
        origin_or_community: r.origin || '',
        identifiers: (r.identifiers || []).map(x => ({ scheme: x.scheme, value: x.value })),
        photographs: photos,
        reference: r.id,
      };
    });
    const out = { standard: 'Object ID (Getty / ICOM)', source: 'MIRL Provenance',
      file: pub.project.title || '', generated: new Date().toISOString().slice(0, 10), objects: records };
    const name = U.slug(S.project.title) + '-object-id.json';
    U.downloadText(name, JSON.stringify(out, null, 2), 'application/json');
    U.toast('Object ID records saved: ' + name);
  }

  /* ---------- CIDOC-CRM as JSON-LD ----------
     A linked-data shape an Arches instance or another CRM consumer can ingest:
     each object an E22 Human-Made Object, each custody link an E10 Transfer of
     Custody, each claim noted, so MIRL feeds the big systems without depending
     on them. */
  function jsonldExport() {
    const pub = PV.Model.publicClone();
    const base = 'urn:mirl-provenance:' + U.slug(S.project.title) + ':';
    const graph = pub.records.map(r => {
      const node = {
        '@id': base + r.id,
        '@type': 'crm:E22_Human-Made_Object',
        'rdfs:label': PV.Model.title(r),
        'crm:P2_has_type': r.objectType || undefined,
        'crm:P45_consists_of': r.medium || undefined,
        'crm:P3_has_note': r.note || undefined,
        'dcterms:identifier': (r.identifiers || []).map(x => [x.scheme, x.value].filter(Boolean).join(' ')),
      };
      const ch = r.currentHolder || {};
      if (ch.name) node['crm:P52_has_current_owner'] = ch.name;
      node['crm:P24i_changed_ownership_through'] = (r.custody || []).map((x, i) => ({
        '@id': base + r.id + '/custody/' + (i + 1),
        '@type': 'crm:E10_Transfer_of_Custody',
        'crm:P4_has_time-span': x.date || undefined,
        'crm:P29_custody_received_by': x.holder || undefined,
        'crm:P2_has_type': x.transfer || undefined,
        'crm:P3_has_note': x.note || undefined,
      }));
      if ((r.claims || []).length) node['mirl:claim'] = r.claims.map(c => ({
        'mirl:claimant': c.claimant,
        'mirl:status': PV.vocab.claimStatusOf(c.status).label,
        'mirl:basis': (c.bases || []).map(k => (PV.vocab.claimBasisOf(k) || {}).label).filter(Boolean),
        'mirl:grounds': c.basis || undefined,
      }));
      if ((r.tkLabels || []).length) node['mirl:tkLabel'] = r.tkLabels.map(l => ({
        'mirl:code': l.code, 'mirl:uri': l.uri || undefined, 'mirl:community': l.community || undefined,
      }));
      return node;
    });
    const doc = {
      '@context': {
        crm: 'http://www.cidoc-crm.org/cidoc-crm/',
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
        dcterms: 'http://purl.org/dc/terms/',
        mirl: 'https://mirl.arthistory.ucsb.edu/ns/provenance#',
      },
      '@graph': graph,
    };
    const name = U.slug(S.project.title) + '-cidoc-crm.jsonld';
    U.downloadText(name, JSON.stringify(doc, null, 2), 'application/ld+json');
    U.toast('Linked data saved: ' + name);
  }

  /* shared paper output for the letter, dossier, and notice */
  function paperOut(html, toast, held) {
    let book = document.getElementById('book');
    if (!book) { book = document.createElement('div'); book.id = 'book'; document.body.append(book); }
    book.innerHTML = html;
    document.body.classList.add('book-mode');
    const cleanup = () => {
      document.body.classList.remove('book-mode');
      book.innerHTML = '';
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    if (held === false) U.toast('This object file is held back; the document still honours evidence consent');
    U.toast(toast);
    setTimeout(() => window.print(), 150);
  }

  /* ---------- a plain account of what an export carries, and what stays ---------- */
  function releaseSummary() {
    const pub = PV.Model.publicClone();
    const pubRecs = pub.records || [];
    const pubIds = new Set(pubRecs.map(r => r.id));
    const all = S.records || [];
    let evidence = 0, sightings = 0, claims = 0, placesExact = 0, placesApprox = 0;
    pubRecs.forEach(r => {
      evidence += (r.evidence || []).length;
      sightings += (r.sightings || []).length;
      claims += (r.claims || []).length;
      const lp = r.location && r.location.publish;
      if (lp === 'exact') placesExact++; else if (lp === 'approximate') placesApprox++;
    });
    let evidenceWithheld = 0, sightingsWithheld = 0, placesWithheld = 0, holderNotes = 0;
    all.forEach(r => {
      if (!pubIds.has(r.id)) return;
      (r.evidence || []).forEach(e => { if (e.consent !== 'public') evidenceWithheld++; });
      (r.sightings || []).forEach(x => { if (x.consent !== 'public') sightingsWithheld++; });
      const loc = r.location || {};
      if (loc.publish === 'withheld' && (loc.lat != null || (loc.place || '').trim())) placesWithheld++;
      if (r.currentHolder && (r.currentHolder.note || '').trim()) holderNotes++;
    });
    return {
      total: all.length,
      publishing: { objects: pubRecs.length, evidence, sightings, claims, placesExact, placesApprox },
      withheld: {
        heldBack: all.filter(r => !r.struck && !r.publish).length,
        struck: all.filter(r => r.struck).length,
        evidence: evidenceWithheld, sightings: sightingsWithheld, places: placesWithheld,
        holderNotes, sources: (S.project.sources || []).length,
      },
    };
  }

  return { saveProject, publicJSON, registerCSV, findingAid, printBook, printNotice,
    claimLetter, objectIDExport, jsonldExport, releaseSummary };
})();
