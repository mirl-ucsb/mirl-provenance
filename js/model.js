/* model.js: namespace, vocabularies, project state, persistence, hashing.
   The object is the unit here: a single contested or dispersed thing, given
   a biography. Every object file carries an identity, a dated chain of
   custody, the sightings and claims that bear on its return, a current
   holder, CARE notes and Traditional Knowledge / Biocultural Labels, and
   consent-aware evidence. Adapted from MIRL Lacuna, its nearest sibling. */

window.PV = window.PV || {};

/* ---------- tiny DOM + misc helpers ---------- */
PV.util = {
  h(tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) for (const k in props) {
      const v = props[k];
      if (v == null) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
      else e.setAttribute(k, v);
    }
    for (const c of kids) {
      if (c == null || c === false) continue;
      e.append(c.nodeType ? c : document.createTextNode(c));
    }
    return e;
  },
  esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); },
  toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(PV._tt); PV._tt = setTimeout(() => t.classList.remove('show'), 2300);
  },
  download(name, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  },
  downloadText(name, text, type = 'text/plain') { this.download(name, new Blob([text], { type })); },
  slug(s) { return String(s || 'object-file').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'object-file'; },
  nowISO() { return new Date().toISOString(); },
  /* does a string begin in a right-to-left script (Arabic, Hebrew, Syriac)? */
  isRTL(s) { return /^[\s"'(\[]*[֐-ࣿיִ-﷿ﹰ-﻿]/.test(String(s || '')); },
  uid() { return 'x' + Math.random().toString(36).slice(2, 9); },
};

/* ---------- controlled vocabularies ---------- */
PV.vocab = {
  /* the standing of the object file: where the case for its return stands */
  STATUS: [
    { key: 'documented',  label: 'Documented',  cls: 'st-documented' },
    { key: 'located',     label: 'Located',     cls: 'st-located' },
    { key: 'contested',   label: 'Contested',   cls: 'st-contested' },
    { key: 'claim-filed', label: 'Claim filed', cls: 'st-claim' },
    { key: 'restituted',  label: 'Restituted',  cls: 'st-restituted' },
    { key: 'unlocated',   label: 'Unlocated',   cls: 'st-unlocated' },
  ],
  /* how firmly the provenance is established */
  CERTAINTY: [
    { key: 'attested',  label: 'attested',  pt: '●' },   /* filled point */
    { key: 'probable',  label: 'probable',  pt: '◐' },   /* half point */
    { key: 'uncertain', label: 'uncertain', pt: '○' },   /* open point */
  ],
  EVTYPE: ['photograph', 'document', 'auction record', 'catalogue', 'accession record', 'correspondence', 'testimony', 'citation'],
  CONSENT: [
    { key: 'public',     label: 'public',     gloss: 'may appear in exports and the public file' },
    { key: 'restricted', label: 'restricted', gloss: 'kept out of every export by default' },
    { key: 'embargoed',  label: 'embargoed',  gloss: 'kept out of every export by default' },
  ],
  /* how a place may be published */
  LOCPUB: [
    { key: 'withheld',    label: 'Withheld',    gloss: 'kept out of every export and the atlas' },
    { key: 'approximate', label: 'Approximate', gloss: 'published rounded to about 10 km' },
    { key: 'exact',       label: 'Exact',       gloss: 'published precisely' },
  ],
  /* typed links between object files; the inverse is computed, never stored */
  RELATION: [
    { key: 'part-of',     label: 'Part of',     inverse: 'contains' },
    { key: 'contains',    label: 'Contains',    inverse: 'part-of' },
    { key: 'pair-with',   label: 'Pair with',   inverse: 'pair-with' },
    { key: 'version-of',  label: 'Version of',  inverse: 'has-version' },
    { key: 'has-version', label: 'Has version', inverse: 'version-of' },
    { key: 'related',     label: 'Related to',  inverse: 'related' },
  ],
  /* how an object passed from one hand to the next */
  TRANSFER: ['made / commissioned', 'gift', 'inheritance', 'sale', 'purchase', 'exchange',
    'loan', 'consignment', 'seizure / confiscation', 'looting / theft', 'excavation',
    'field collection', 'unknown'],
  /* kinds of dated report locating the object in the record */
  SIGHTKIND: ['auction lot', 'dealer stock', 'museum accession', 'private collection',
    'exhibition', 'catalogue', 'publication', 'photograph', 'seen', 'other'],
  /* what a sighting does to the stated provenance */
  BEARING: [
    { key: 'supports',    label: 'supports' },
    { key: 'complicates', label: 'complicates' },
  ],
  /* the standing of a claim for return */
  CLAIMSTATUS: [
    { key: 'preparing',    label: 'Preparing' },
    { key: 'submitted',    label: 'Submitted' },
    { key: 'negotiating',  label: 'Under negotiation' },
    { key: 'acknowledged', label: 'Acknowledged' },
    { key: 'disputed',     label: 'Disputed' },
    { key: 'returned',     label: 'Resolved: returned' },
    { key: 'denied',       label: 'Resolved: denied' },
    { key: 'withdrawn',    label: 'Withdrawn' },
  ],
  /* the named instruments and frameworks a claim may rest on. A claim cites
     the grounds that fit; the letter and the dossier name them. */
  CLAIMBASIS: [
    { key: 'nagpra',      label: 'NAGPRA', gloss: 'Native American Graves Protection and Repatriation Act (US, 1990)' },
    { key: 'unesco1970',  label: '1970 UNESCO Convention', gloss: 'on illicit import, export, and transfer of cultural property' },
    { key: 'unidroit1995', label: '1995 UNIDROIT Convention', gloss: 'on stolen or illegally exported cultural objects' },
    { key: 'hague1954',   label: '1954 Hague Convention', gloss: 'on cultural property in armed conflict, and its protocols' },
    { key: 'washington',  label: 'Washington Principles', gloss: 'on Nazi-confiscated art (1998)' },
    { key: 'hear',        label: 'HEAR Act', gloss: 'Holocaust Expropriated Art Recovery Act (US, 2016)' },
    { key: 'patrimony',   label: 'National patrimony law', gloss: 'a source country’s ownership or export statute' },
    { key: 'icom',        label: 'ICOM Code of Ethics', gloss: 'museum ethics on acquisition and return' },
    { key: 'colonial',    label: 'Colonial-collections policy', gloss: 'a holder’s or state’s policy on colonial-era acquisitions' },
    { key: 'cultural',    label: 'Cultural patrimony', gloss: 'an inalienable communal, sacred, or ancestral claim' },
    { key: 'other',       label: 'Other', gloss: 'named in the grounds below' },
  ],
  /* the four CARE principles for Indigenous data governance (Carroll et al.,
     Global Indigenous Data Alliance). Notes are written per principle and
     travel with the object file. */
  CARE: [
    { key: 'collective',     label: 'Collective benefit',
      gloss: 'how the documentation and any return benefit the community of origin' },
    { key: 'authority',      label: 'Authority to control',
      gloss: 'who holds the right to decide how this object and its data are used' },
    { key: 'responsibility', label: 'Responsibility',
      gloss: 'the relationships and obligations the keeper of this file carries' },
    { key: 'ethics',         label: 'Ethics',
      gloss: 'the rights and wellbeing of the community across past, present, and future' },
  ],
  /* Traditional Knowledge and Biocultural Labels (Local Contexts). These are
     the standard labels; communities may also define their own below. A label
     marks an object file with a community's protocol: a statement of
     authority, not a licence the tool enforces. */
  TKLABELS: [
    { code: 'TK A',  name: 'TK Attribution', kind: 'tk',
      gloss: 'correct attribution of the community of origin is requested' },
    { code: 'TK CL', name: 'TK Clan', kind: 'tk',
      gloss: 'use is governed by clan or kinship relationships' },
    { code: 'TK F',  name: 'TK Family', kind: 'tk',
      gloss: 'belongs to a family; use is governed by family protocols' },
    { code: 'TK CV', name: 'TK Community Voice', kind: 'tk',
      gloss: 'the community asks to add or correct cultural information' },
    { code: 'TK CO', name: 'TK Community Use Only', kind: 'tk',
      gloss: 'intended for use within the community of origin' },
    { code: 'TK O',  name: 'TK Outreach', kind: 'tk',
      gloss: 'open to educational and outreach use, with attribution' },
    { code: 'TK NC', name: 'TK Non-Commercial', kind: 'tk',
      gloss: 'use is permitted only for non-commercial purposes' },
    { code: 'TK CS', name: 'TK Culturally Sensitive', kind: 'tk',
      gloss: 'culturally sensitive; handle according to community protocols' },
    { code: 'TK SS', name: 'TK Secret / Sacred', kind: 'tk',
      gloss: 'secret or sacred; access is restricted by the community' },
    { code: 'TK WR', name: 'TK Women Restricted', kind: 'tk',
      gloss: 'access or use is restricted to women' },
    { code: 'TK MR', name: 'TK Men Restricted', kind: 'tk',
      gloss: 'access or use is restricted to men' },
    { code: 'TK S',  name: 'TK Seasonal', kind: 'tk',
      gloss: 'use is governed by season or time of year' },
    { code: 'TK V',  name: 'TK Verified', kind: 'tk',
      gloss: 'the community has reviewed and verified this record' },
    { code: 'TK NV', name: 'TK Non-Verified', kind: 'tk',
      gloss: 'not yet reviewed or verified by the community of origin' },
    { code: 'BC P',  name: 'BC Provenance', kind: 'bc',
      gloss: 'records the community provenance of the object and its data' },
    { code: 'BC MP', name: 'BC Multiple Provenance', kind: 'bc',
      gloss: 'more than one community has provenance interests here' },
    { code: 'BC CV', name: 'BC Consent Verified', kind: 'bc',
      gloss: 'community consent for this use has been verified' },
    { code: 'BC R',  name: 'BC Research Use', kind: 'bc',
      gloss: 'research use is governed by an agreement with the community' },
    { code: 'BC CB', name: 'BC Open to Collaboration', kind: 'bc',
      gloss: 'the community is open to collaboration and partnership' },
    { code: 'BC NC', name: 'BC Non-Commercial', kind: 'bc',
      gloss: 'use is permitted only for non-commercial purposes' },
  ],
};
PV.vocab.statusOf = k => PV.vocab.STATUS.find(s => s.key === k) || PV.vocab.STATUS[0];
PV.vocab.certaintyOf = k => PV.vocab.CERTAINTY.find(c => c.key === k) || PV.vocab.CERTAINTY[2];
PV.vocab.locpubOf = k => PV.vocab.LOCPUB.find(l => l.key === k) || PV.vocab.LOCPUB[0];
PV.vocab.relationOf = k => PV.vocab.RELATION.find(x => x.key === k) || PV.vocab.RELATION[5];
PV.vocab.claimStatusOf = k => PV.vocab.CLAIMSTATUS.find(c => c.key === k) || PV.vocab.CLAIMSTATUS[0];
PV.vocab.claimBasisOf = k => PV.vocab.CLAIMBASIS.find(b => b.key === k) || null;
PV.vocab.labelOf = code => PV.vocab.TKLABELS.find(l => l.code === code) || null;
/* the general Local Contexts reference for the standard labels; a placed label
   may also carry the community's own Hub URI */
PV.vocab.LOCAL_CONTEXTS = 'https://localcontexts.org/labels/';

/* ---------- state ---------- */
PV.blankProject = () => ({
  title: 'Untitled object file',
  subtitle: '',
  compiler: '',
  institution: '',
  contact: '',
  note: '',
  siglum: 'PRV', /* the file's mark, used in object numbers */
  localContexts: '', /* the project's Local Contexts Hub URL, if any */
  events: [],    /* dispersal events: { id, name, date, place, note } */
  sources: [],   /* the people the file rests on: { id, alias, name, contact, consent, note };
                    only the alias is ever published */
  labels: [],    /* community-defined labels: { id, code, name, gloss, community } */
  created: PV.util.nowISO(),
  modified: PV.util.nowISO(),
});

PV.state = {
  project: PV.blankProject(),
  records: [],
  route: { view: 'register', id: null },
  filters: { q: '', statuses: [] },
  sort: { by: 'no', dir: 1 },
};

/* ---------- records (object files) ---------- */
PV.Model = (function () {
  const S = PV.state;

  function siglum() {
    const s = String((S.project && S.project.siglum) || 'PRV').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    return s || 'PRV';
  }

  function nextId() {
    const sig = siglum();
    const re = new RegExp('^' + sig + '-(\\d+)$');
    let max = 0;
    S.records.forEach(r => { const m = re.exec(r.id || ''); if (m) max = Math.max(max, +m[1]); });
    return sig + '-' + String(max + 1).padStart(4, '0');
  }

  function newRecord() {
    return {
      id: nextId(),
      titles: [{ text: '', lang: '' }],
      creator: '',          /* maker / artist / culture */
      date: '',             /* date or period */
      objectType: '',       /* what kind of thing it is */
      medium: '',           /* materials / medium */
      origin: '',           /* origin / community of origin */
      dimensions: '',
      identifiers: [],       /* { id, scheme, value }: accession nos., inventory nos. */
      status: 'documented', certainty: 'uncertain',
      currentHolder: { name: '', since: '', basis: '', note: '' },
      custody: [],           /* the chain: { id, date, holder, transfer, certainty, note } */
      claims: [],            /* { id, claimant, basis, status, date, note } */
      careNotes: { collective: '', authority: '', responsibility: '', ethics: '' },
      tkLabels: [],          /* { id, code, note, community } */
      note: '', tags: [],
      eventId: null,         /* the dispersal event this object belongs to */
      relations: [],         /* typed links: { type, target } */
      extent: { amount: null, unit: '' },   /* for a body of dispersed objects */
      sightings: [],         /* dated reports: { id, date, kind, bearing, place, sourceId, note } */
      statusHistory: [],     /* former standings, never erased: { status, certainty, until, reason } */
      log: [],               /* the research, dated; working file only: { id, date, note } */
      location: { place: '', lat: null, lon: null, publish: 'withheld' },
      evidence: [], images: [],
      publish: false,        /* object files are held back until the compiler says otherwise */
      struck: false,         /* a struck file stays as a cancelled line; never erased */
      created: PV.util.nowISO(), modified: PV.util.nowISO(),
    };
  }

  /* fill in anything missing so older or hand-edited files load cleanly */
  function normalize(r) {
    const d = newRecord();
    const out = Object.assign({}, d, r);
    out.titles = Array.isArray(r.titles) && r.titles.length ? r.titles.map(t => ({ text: t.text || '', lang: t.lang || '' })) : d.titles;
    out.currentHolder = Object.assign({}, d.currentHolder, r.currentHolder || {});
    out.careNotes = Object.assign({}, d.careNotes, r.careNotes || {});
    out.location = Object.assign({}, d.location, r.location || {});
    /* files saved before locations had three publication states used a
       boolean "safe"; carry it across */
    if (!PV.vocab.LOCPUB.some(l => l.key === out.location.publish)) {
      out.location.publish = (r.location && r.location.safe) ? 'exact' : 'withheld';
    }
    delete out.location.safe;
    out.tags = Array.isArray(r.tags) ? r.tags.filter(Boolean) : [];
    out.eventId = typeof r.eventId === 'string' && r.eventId ? r.eventId : null;
    out.identifiers = (Array.isArray(r.identifiers) ? r.identifiers : []).map(x => Object.assign({
      id: PV.util.uid(), scheme: '', value: '',
    }, x));
    out.relations = (Array.isArray(r.relations) ? r.relations : [])
      .filter(x => x && x.target && PV.vocab.RELATION.some(v => v.key === x.type))
      .map(x => ({ type: x.type, target: x.target }));
    out.extent = Object.assign({ amount: null, unit: '' }, r.extent || {});
    out.extent.amount = (typeof out.extent.amount === 'number' && isFinite(out.extent.amount)) ? out.extent.amount : null;
    out.custody = (Array.isArray(r.custody) ? r.custody : []).map(x => Object.assign({
      id: PV.util.uid(), date: '', holder: '', transfer: 'unknown', certainty: 'uncertain', note: '',
    }, x));
    out.claims = (Array.isArray(r.claims) ? r.claims : []).map(x => Object.assign({
      id: PV.util.uid(), claimant: '', basis: '', bases: [], status: 'preparing', date: '', note: '',
    }, x));
    out.claims.forEach(c => {
      c.bases = (Array.isArray(c.bases) ? c.bases : []).filter(k => PV.vocab.CLAIMBASIS.some(b => b.key === k));
    });
    out.tkLabels = (Array.isArray(r.tkLabels) ? r.tkLabels : []).map(x => Object.assign({
      id: PV.util.uid(), code: '', note: '', community: '', uri: '',
    }, x)).filter(x => x.code);
    out.sightings = (Array.isArray(r.sightings) ? r.sightings : []).map(x => Object.assign({
      id: PV.util.uid(), date: '', kind: 'auction lot', bearing: 'supports', place: '', sourceId: null, note: '',
    }, x));
    out.statusHistory = (Array.isArray(r.statusHistory) ? r.statusHistory : [])
      .filter(x => x && x.status)
      .map(x => ({ status: x.status, certainty: x.certainty || '', until: x.until || '', reason: x.reason || '' }));
    out.log = (Array.isArray(r.log) ? r.log : []).map(x => Object.assign({
      id: PV.util.uid(), date: '', note: '',
    }, x));
    out.publish = !!r.publish;
    out.struck = !!r.struck;
    out.evidence = (Array.isArray(r.evidence) ? r.evidence : []).map(e => Object.assign({
      id: PV.util.uid(), type: 'document', label: '', file: null, url: '', archived: '',
      sha256: '', rights: '', consent: 'restricted', until: '', note: '', thumb: '', sourceId: null,
    }, e));
    out.images = (Array.isArray(r.images) ? r.images : (Array.isArray(r.copies) ? r.copies : [])).map(c => Object.assign({
      id: PV.util.uid(), institution: '', identifier: '', iiif: '', url: '', note: '',
    }, c));
    delete out.copies;
    if (!PV.vocab.STATUS.some(s => s.key === out.status)) out.status = 'documented';
    if (!PV.vocab.CERTAINTY.some(c => c.key === out.certainty)) out.certainty = 'uncertain';
    return out;
  }

  function get(id) { return S.records.find(r => r.id === id) || null; }

  function add() {
    const r = newRecord();
    S.records.push(r);
    touch(r);
    return r;
  }

  function remove(id) {
    const i = S.records.findIndex(r => r.id === id);
    if (i >= 0) S.records.splice(i, 1);
    S.project.modified = PV.util.nowISO();
  }

  function touch(r) {
    if (r) r.modified = PV.util.nowISO();
    S.project.modified = PV.util.nowISO();
  }

  function title(r, alt) {
    const ts = (r.titles || []).filter(t => t.text && t.text.trim());
    if (!ts.length) return alt ? '' : 'Untitled object';
    return ts[0].text.trim();
  }
  function altTitles(r) {
    return (r.titles || []).slice(1).filter(t => t.text && t.text.trim());
  }

  /* a label's display name and gloss, from the standard set or a community one */
  function resolveLabel(code) {
    const std = PV.vocab.labelOf(code);
    if (std) return std;
    const custom = (S.project.labels || []).find(l => l.code === code);
    if (custom) return { code: custom.code, name: custom.name || custom.code, gloss: custom.gloss || '', kind: 'community' };
    return { code, name: code, gloss: '', kind: 'community' };
  }

  /* ---------- the whole project as one JSON document ---------- */
  function serialize(publicOnly) {
    const src = publicOnly ? publicClone() : { project: S.project, records: S.records };
    return {
      format: 'mirl-provenance',
      version: 1,
      project: src.project,
      records: src.records,
    };
  }

  /* a copy fit to publish: only object files marked publish, never struck
     ones; restricted and embargoed evidence withheld; places withheld or
     rounded unless marked exact; relations only between published files;
     sources reduced to their public aliases; the research log never leaves.
     The chain of custody, claims, CARE notes, and TK / BC Labels do travel:
     they are the dossier's substance, made to be shown. */
  function publicClone() {
    const clone = JSON.parse(JSON.stringify({ project: S.project, records: S.records }));
    clone.project.sources = (clone.project.sources || []).map(s => ({ id: s.id, alias: s.alias || 'a source' }));
    clone.records = clone.records.filter(r => !r.struck && r.publish);
    const kept = new Set(clone.records.map(r => r.id));
    const round1 = x => Math.round(x * 10) / 10;
    clone.records.forEach(r => {
      r.log = [];
      r.evidence = (r.evidence || []).filter(e => e.consent === 'public');
      r.relations = (r.relations || []).filter(x => kept.has(x.target));
      const loc = r.location || {};
      const hasCoords = typeof loc.lat === 'number' && typeof loc.lon === 'number';
      if (loc.publish === 'exact') {
        /* published as recorded */
      } else if (loc.publish === 'approximate') {
        r.location = { place: loc.place || '', lat: hasCoords ? round1(loc.lat) : null,
          lon: hasCoords ? round1(loc.lon) : null, publish: 'approximate' };
      } else {
        r.location = { place: '', lat: null, lon: null, publish: 'withheld' };
      }
    });
    return clone;
  }

  /* how many object files are held back from publication */
  function heldBackCount() {
    return S.records.filter(r => !r.struck && !r.publish).length;
  }

  /* embargo dates that have passed and want a human decision */
  function lapsedEmbargoes() {
    const today = new Date().toISOString().slice(0, 10);
    const out = [];
    S.records.forEach(r => (r.evidence || []).forEach(e => {
      if (e.consent === 'embargoed' && e.until && e.until <= today) {
        out.push({ recordId: r.id, label: e.label || e.type, until: e.until });
      }
    }));
    return out;
  }

  /* ---------- a change of standing is recorded, never overwritten ---------- */
  function setStatus(r, status, reason) {
    if (r.status === status) return;
    r.statusHistory.push({
      status: r.status, certainty: r.certainty,
      until: PV.util.nowISO().slice(0, 10), reason: reason || '',
    });
    r.status = status;
  }

  /* ---------- the people the file rests on ---------- */
  function sourceOf(id) { return (S.project.sources || []).find(s => s.id === id) || null; }

  function addSource() {
    let max = 0;
    (S.project.sources || []).forEach(s => { const m = /^src-(\d+)$/.exec(s.id || ''); if (m) max = Math.max(max, +m[1]); });
    const src = { id: 'src-' + (max + 1), alias: '', name: '', contact: '', consent: '', note: '' };
    S.project.sources.push(src);
    S.project.modified = PV.util.nowISO();
    return src;
  }

  function removeSource(id) {
    S.project.sources = (S.project.sources || []).filter(s => s.id !== id);
    let cleared = 0;
    S.records.forEach(r => {
      (r.evidence || []).forEach(e => { if (e.sourceId === id) { e.sourceId = null; cleared++; } });
      (r.sightings || []).forEach(x => { if (x.sourceId === id) { x.sourceId = null; cleared++; } });
    });
    S.project.modified = PV.util.nowISO();
    return cleared;
  }

  /* everything that rests on this person's word */
  function restsOn(id) {
    const out = [];
    S.records.forEach(r => {
      (r.evidence || []).forEach(e => {
        if (e.sourceId === id) out.push({ record: r, kind: 'evidence', item: e });
      });
      (r.sightings || []).forEach(x => {
        if (x.sourceId === id) out.push({ record: r, kind: 'sighting', item: x });
      });
    });
    return out;
  }

  /* when consent is withdrawn: pull their evidence out of everything public */
  function restrictSource(id, consent) {
    let n = 0;
    S.records.forEach(r => (r.evidence || []).forEach(e => {
      if (e.sourceId === id && e.consent === 'public') { e.consent = consent || 'restricted'; n++; }
    }));
    S.project.modified = PV.util.nowISO();
    return n;
  }

  /* ---------- community-defined labels ---------- */
  function addLabel() {
    let max = 0;
    if (!Array.isArray(S.project.labels)) S.project.labels = [];
    (S.project.labels || []).forEach(l => { const m = /^lbl-(\d+)$/.exec(l.id || ''); if (m) max = Math.max(max, +m[1]); });
    const lbl = { id: 'lbl-' + (max + 1), code: '', name: '', gloss: '', community: '' };
    S.project.labels.push(lbl);
    S.project.modified = PV.util.nowISO();
    return lbl;
  }
  function removeLabel(id) {
    const lbl = (S.project.labels || []).find(l => l.id === id);
    S.project.labels = (S.project.labels || []).filter(l => l.id !== id);
    let cleared = 0;
    if (lbl) S.records.forEach(r => {
      const before = (r.tkLabels || []).length;
      r.tkLabels = (r.tkLabels || []).filter(t => t.code !== lbl.code);
      cleared += before - r.tkLabels.length;
    });
    S.project.modified = PV.util.nowISO();
    return cleared;
  }

  /* ---------- dispersal events ---------- */
  function eventOf(id) { return (S.project.events || []).find(e => e.id === id) || null; }

  function addEvent() {
    let max = 0;
    (S.project.events || []).forEach(e => { const m = /^evt-(\d+)$/.exec(e.id || ''); if (m) max = Math.max(max, +m[1]); });
    const ev = { id: 'evt-' + (max + 1), name: '', date: '', place: '', note: '' };
    S.project.events.push(ev);
    S.project.modified = PV.util.nowISO();
    return ev;
  }

  function removeEvent(id) {
    S.project.events = (S.project.events || []).filter(e => e.id !== id);
    let cleared = 0;
    S.records.forEach(r => { if (r.eventId === id) { r.eventId = null; cleared++; } });
    S.project.modified = PV.util.nowISO();
    return cleared;
  }

  function loadData(data) {
    if (!data || data.format !== 'mirl-provenance' || !Array.isArray(data.records)) {
      throw new Error('Not a provenance file.');
    }
    S.project = Object.assign(PV.blankProject(), data.project || {});
    S.project.events = (Array.isArray(S.project.events) ? S.project.events : [])
      .filter(e => e && e.id)
      .map(e => ({ id: e.id, name: e.name || '', date: e.date || '', place: e.place || '', note: e.note || '' }));
    S.project.sources = (Array.isArray(S.project.sources) ? S.project.sources : [])
      .filter(s => s && s.id)
      .map(s => ({ id: s.id, alias: s.alias || '', name: s.name || '', contact: s.contact || '', consent: s.consent || '', note: s.note || '' }));
    S.project.labels = (Array.isArray(S.project.labels) ? S.project.labels : [])
      .filter(l => l && l.id)
      .map(l => ({ id: l.id, code: l.code || '', name: l.name || '', gloss: l.gloss || '', community: l.community || '' }));
    if (typeof S.project.siglum !== 'string' || !S.project.siglum.trim()) {
      /* older files: read the mark off the existing object numbers */
      const m = /^([A-Z0-9]+)-\d+$/.exec((data.records[0] || {}).id || '');
      S.project.siglum = m ? m[1] : 'PRV';
    }
    S.records = data.records.map(normalize);
  }

  function reset() {
    S.project = PV.blankProject();
    S.records = [];
  }

  return { newRecord, normalize, nextId, get, add, remove, touch, title, altTitles, resolveLabel,
    serialize, publicClone, heldBackCount, lapsedEmbargoes, setStatus,
    sourceOf, addSource, removeSource, restsOn, restrictSource,
    addLabel, removeLabel, eventOf, addEvent, removeEvent, loadData, reset };
})();

/* ---------- the lock: a passphrase over the file at rest ----------
   The working file holds restricted evidence and, with the sources register,
   real identities. Locking encrypts the browser autosave, the live disk file,
   and the saved project file with AES-GCM under a key derived from a
   passphrase (PBKDF2, 600,000 rounds). It protects the file at rest: while the
   file is open here, it is open. Exports (the public file, the spreadsheet,
   the dossier) are publications and stay plain. */
PV.Lock = (function () {
  let key = null;            /* the derived AES key, held for the session */
  let kdf = null;            /* { iterations, salt(b64) } for re-derivation */

  const ITERATIONS = 600000;
  const te = new TextEncoder(), td = new TextDecoder();
  const b64 = buf => {
    let s = '';
    const b = new Uint8Array(buf);
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

  async function derive(passphrase, kdfSpec) {
    const base = await crypto.subtle.importKey('raw', te.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt: unb64(kdfSpec.salt), iterations: kdfSpec.iterations },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  const active = () => !!key;
  const isEnvelope = data => data && data.format === 'mirl-provenance-locked';

  /* turn the lock on (or change the passphrase) */
  async function set(passphrase) {
    kdf = { iterations: ITERATIONS, salt: b64(crypto.getRandomValues(new Uint8Array(16))) };
    key = await derive(passphrase, kdf);
  }

  function remove() { key = null; kdf = null; }

  /* plaintext project JSON string -> envelope string */
  async function seal(raw) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(raw));
    return JSON.stringify({
      format: 'mirl-provenance-locked', version: 1,
      kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: kdf.iterations, salt: kdf.salt },
      iv: b64(iv), data: b64(data),
    });
  }

  /* envelope object + passphrase -> plaintext string; adopts the lock */
  async function unseal(envelope, passphrase) {
    const spec = { iterations: envelope.kdf.iterations, salt: envelope.kdf.salt };
    const k = await derive(passphrase, spec);
    const raw = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(envelope.iv) }, k, unb64(envelope.data));
    key = k; kdf = spec;
    return td.decode(raw);
  }

  return { active, isEnvelope, set, remove, seal, unseal };
})();

/* ---------- autosave in the browser ---------- */
PV.Store = (function () {
  const KEY = 'mirl-provenance-project';
  let timer = null, warned = false;

  function save() {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const raw = JSON.stringify(PV.Model.serialize(false));
      let payload = raw;
      if (PV.Lock.active()) {
        try { payload = await PV.Lock.seal(raw); }
        catch (e) { return PV.util.toast('Could not encrypt the autosave'); }
      }
      try {
        localStorage.setItem(KEY, payload);
      } catch (e) {
        if (!warned) {
          warned = true;
          PV.util.toast('Too large to autosave here. Save your project file.');
        }
      }
      PV.Disk.write(payload);
    }, 400);
  }

  /* returns true (loaded), false (nothing), or the locked envelope */
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (PV.Lock.isEnvelope(data)) return data;
      PV.Model.loadData(data);
      return true;
    } catch (e) { return false; }
  }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} }

  /* the current project as it should rest: sealed when locked */
  async function payload() {
    const raw = JSON.stringify(PV.Model.serialize(false));
    return PV.Lock.active() ? PV.Lock.seal(raw) : raw;
  }

  return { save, load, clear, payload };
})();

/* ---------- a live file on disk (Chromium browsers) ----------
   With the File System Access API the project can save continuously to a
   .json the user chooses, alongside the browser autosave, so a day's work
   survives anything. The handle is kept in IndexedDB and resumed with the
   user's say-so; everywhere else this stays dormant. */
PV.Disk = (function () {
  let handle = null;        /* active file handle */
  let stored = null;        /* a handle found in IndexedDB, awaiting permission */
  let busy = false, failed = false;

  const supported = () => 'showSaveFilePicker' in window;

  function idb() {
    return new Promise((res, rej) => {
      const o = indexedDB.open('mirl-provenance', 1);
      o.onupgradeneeded = () => o.result.createObjectStore('kv');
      o.onsuccess = () => res(o.result);
      o.onerror = () => rej(o.error);
    });
  }
  async function kvSet(k, v) {
    const db = await idb();
    return new Promise((res, rej) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(v, k);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  }
  async function kvGet(k) {
    const db = await idb();
    return new Promise((res, rej) => {
      const tx = db.transaction('kv', 'readonly');
      const rq = tx.objectStore('kv').get(k);
      rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
    });
  }

  /* on boot: remember a previous session's file, but write nothing
     until the user resumes it (permission needs their gesture) */
  async function init() {
    if (!supported()) return;
    try { stored = (await kvGet('fileHandle')) || null; } catch (e) { stored = null; }
  }

  function state() {
    if (!supported()) return { mode: 'unsupported' };
    if (handle) return { mode: 'active', name: handle.name };
    if (stored) return { mode: 'pending', name: stored.name };
    return { mode: 'off' };
  }

  async function connect() {
    const name = PV.util.slug(PV.state.project.title) + '.provenance.json';
    handle = await window.showSaveFilePicker({
      suggestedName: name,
      types: [{ description: 'Provenance file', accept: { 'application/json': ['.json'] } }],
    });
    stored = null; failed = false;
    try { await kvSet('fileHandle', handle); } catch (e) {}
    await write(await PV.Store.payload(), true);
    PV.util.toast('Saving to ' + handle.name + ' as you work');
  }

  async function resume() {
    if (!stored) return;
    const perm = await stored.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') return PV.util.toast('The browser did not allow it');
    handle = stored; stored = null; failed = false;
    await write(await PV.Store.payload(), true);
    PV.util.toast('Saving to ' + handle.name + ' as you work');
  }

  async function disconnect() {
    const name = handle && handle.name;
    handle = null; stored = null;
    try { await kvSet('fileHandle', null); } catch (e) {}
    if (name) PV.util.toast('Stopped saving to ' + name + '; the browser autosave continues');
  }

  async function write(raw, loud) {
    if (!handle || busy) return;
    busy = true;
    try {
      const w = await handle.createWritable();
      await w.write(raw);
      await w.close();
      failed = false;
    } catch (e) {
      if (!failed) {
        failed = true;
        PV.util.toast('Could not write to ' + handle.name + (loud ? ': ' + (e.message || e) : '; the browser autosave continues'));
      }
    } finally { busy = false; }
  }

  return { supported, init, state, connect, resume, disconnect, write };
})();

/* ---------- sha-256, so evidence stays evidentially tethered ---------- */
PV.Hash = (function () {
  /* WebCrypto where available (everywhere modern); a small pure-JS
     fallback so hashing still works from unusual contexts. */
  async function sha256(buf) {
    if (window.crypto && crypto.subtle && crypto.subtle.digest) {
      const d = await crypto.subtle.digest('SHA-256', buf);
      return hex(new Uint8Array(d));
    }
    return jsSha256(new Uint8Array(buf));
  }
  function hex(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
    return s;
  }
  function jsSha256(msg) {
    const K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    let H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const l = msg.length, bitLen = l * 8;
    const padded = new Uint8Array((((l + 9) + 63) >> 6) << 6);
    padded.set(msg); padded[l] = 0x80;
    const dv = new DataView(padded.buffer);
    dv.setUint32(padded.length - 4, bitLen >>> 0);
    dv.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000));
    const w = new Int32Array(64);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let i = 0; i < padded.length; i += 64) {
      for (let t = 0; t < 16; t++) w[t] = dv.getInt32(i + t * 4);
      for (let t = 16; t < 64; t++) {
        const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h2] = H;
      for (let t = 0; t < 64; t++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h2 + S1 + ch + K[t] + w[t]) | 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;
        h2 = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H = [(H[0] + a) | 0, (H[1] + b) | 0, (H[2] + c) | 0, (H[3] + d) | 0,
           (H[4] + e) | 0, (H[5] + f) | 0, (H[6] + g) | 0, (H[7] + h2) | 0];
    }
    return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }

  /* a small thumbnail for image evidence, kept inside the project file */
  function thumbnail(file) {
    return new Promise(resolve => {
      if (!/^image\//.test(file.type)) return resolve('');
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const max = 280, k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * k));
        c.height = Math.max(1, Math.round(img.height * k));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        try { resolve(c.toDataURL('image/jpeg', 0.72)); } catch (e) { resolve(''); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(''); };
      img.src = url;
    });
  }

  return { sha256, thumbnail };
})();
