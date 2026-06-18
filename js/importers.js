/* importers.js: ways work enters the register. A CSV of an old inventory
   becomes draft entries; a colleague's project file merges in, with
   conflicts decided by a human; and the evidence folder can be checked
   against its recorded sha-256 fingerprints. Imported entries arrive held
   back from publication, like everything else here: consent first. */

PV.Importers = (function () {
  const S = PV.state;
  const U = PV.util;

  /* ---------- a small, careful CSV parser: quotes, commas, newlines ---------- */
  function parseCSV(text) {
    const rows = [];
    let row = [], cur = '', q = false;
    text = String(text).replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { cur += '"'; i++; } else q = false;
        } else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); cur = '';
        rows.push(row); row = [];
      } else cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(c => String(c).trim() !== ''));
  }

  /* header names from our own CSV export, and the names old inventories use */
  const HEADER_MAP = {
    id: 'id', no: 'id', number: 'id', objectno: 'id', entryno: 'id',
    title: 'title', name: 'title', object: 'title', work: 'title',
    paralleltitles: 'titles2', paralleltitle: 'titles2',
    creator: 'creator', maker: 'creator', artist: 'creator', culture: 'creator', author: 'creator',
    date: 'date', dateofthework: 'date', period: 'date', year: 'date',
    objecttype: 'objectType', type: 'objectType', form: 'objectType',
    medium: 'medium', material: 'medium', materials: 'medium',
    origin: 'origin', originorcommunity: 'origin', community: 'origin', provenance: 'origin', findspot: 'origin',
    dimensions: 'dimensions', dimension: 'dimensions', size: 'dimensions',
    status: 'status', standing: 'status',
    certainty: 'certainty',
    currentholder: 'holder', holder: 'holder', repository: 'holder', collection: 'holder', heldby: 'holder', owner: 'holder',
    accession: 'accession', accessionno: 'accession', accessionnumber: 'accession', inventoryno: 'accession', inventorynumber: 'accession',
    narrative: 'note', note: 'note', notes: 'note', description: 'note',
    tags: 'tags', keywords: 'tags', subjects: 'tags',
    place: 'place', location: 'place', currentlocation: 'place', site: 'place',
    latitude: 'lat', lat: 'lat',
    longitude: 'lon', lon: 'lon', lng: 'lon',
  };
  const normHeader = h => String(h || '').toLowerCase().replace(/[^a-z]/g, '');

  function statusKey(v) {
    v = String(v || '').trim().toLowerCase();
    const hit = PV.vocab.STATUS.find(s => s.key === v || s.label.toLowerCase() === v);
    return hit ? hit.key : null;
  }
  function certaintyKey(v) {
    v = String(v || '').trim().toLowerCase();
    const hit = PV.vocab.CERTAINTY.find(c => c.key === v || c.label === v);
    return hit ? hit.key : null;
  }

  /* rows in, draft records out; every import arrives unpublished */
  function importCSV(text) {
    const rows = parseCSV(text);
    if (rows.length < 2) throw new Error('The file needs a header row and at least one entry.');
    const fields = rows[0].map(h => HEADER_MAP[normHeader(h)] || null);
    const unmatched = rows[0].filter((h, i) => !fields[i] && String(h).trim() !== '');
    let added = 0, renumbered = 0;
    const ids = [];

    rows.slice(1).forEach(cells => {
      const v = {};
      fields.forEach((f, i) => {
        if (f && cells[i] != null && String(cells[i]).trim() !== '') v[f] = String(cells[i]).trim();
      });
      if (!Object.keys(v).length) return;

      const r = PV.Model.newRecord();
      if (v.id) {
        if (S.records.some(x => x.id === v.id)) renumbered++;
        else r.id = v.id;
      }
      r.titles = [{ text: v.title || 'Untitled', lang: '' }];
      if (v.titles2) v.titles2.split(/\s*\|\s*/).filter(Boolean).forEach(t => r.titles.push({ text: t, lang: '' }));
      if (v.creator) r.creator = v.creator;
      if (v.date) r.date = v.date;
      if (v.objectType) r.objectType = v.objectType;
      if (v.medium) r.medium = v.medium;
      if (v.origin) r.origin = v.origin;
      if (v.dimensions) r.dimensions = v.dimensions;
      if (v.status) r.status = statusKey(v.status) || r.status;
      if (v.certainty) r.certainty = certaintyKey(v.certainty) || r.certainty;
      if (v.holder) r.currentHolder.name = v.holder;
      if (v.accession) r.identifiers.push({ id: U.uid(), scheme: 'accession', value: v.accession });
      if (v.note) r.note = v.note;
      if (v.tags) r.tags = v.tags.split(/[|;,]/).map(s => s.trim()).filter(Boolean);
      if (v.place) r.location.place = v.place;
      const lat = parseFloat(v.lat), lon = parseFloat(v.lon);
      if (isFinite(lat)) r.location.lat = lat;
      if (isFinite(lon)) r.location.lon = lon;

      S.records.push(r);
      ids.push(r.id);
      added++;
    });

    S.project.modified = U.nowISO();
    return { added, renumbered, unmatched, ids };
  }

  /* ---------- merging a colleague's project file ---------- */
  function contentKey(r) {
    const c = JSON.parse(JSON.stringify(r));
    delete c.created; delete c.modified;
    return JSON.stringify(c);
  }

  /* what a merge would do: new entries, identical ones, and true conflicts.
     Events and sources from the other file come along too; where their ids
     collide with different content (two unrelated registers both counting
     from evt-1), the incoming ones are renumbered rather than confused. */
  function planMerge(data) {
    if (!data || data.format !== 'mirl-provenance' || !Array.isArray(data.records)) {
      throw new Error('Not a provenance project file.');
    }
    const incoming = data.records.map(PV.Model.normalize);
    const plan = { newRecords: [], conflicts: [], identical: 0, newEvents: [], newSources: [], evtMap: {}, srcMap: {} };

    const meatOf = o => { const c = Object.assign({}, o); delete c.id; return JSON.stringify(c); };
    const remapSide = (list, local, prefix, mapOut, addOut) => {
      let max = 0;
      local.forEach(x => { const m = new RegExp('^' + prefix + '-(\\d+)$').exec(x.id || ''); if (m) max = Math.max(max, +m[1]); });
      list.forEach(x => {
        if (!x || !x.id) return;
        const mine = local.find(y => y.id === x.id);
        if (!mine) addOut.push(x);
        else if (meatOf(mine) !== meatOf(x)) {
          const nid = prefix + '-' + (++max);
          mapOut[x.id] = nid;
          addOut.push(Object.assign({}, x, { id: nid }));
        }
        /* identical content under the same id: nothing to do */
      });
    };
    remapSide(((data.project && data.project.events) || []).map(e =>
      ({ id: e.id, name: e.name || '', date: e.date || '', place: e.place || '', note: e.note || '' })),
      S.project.events || [], 'evt', plan.evtMap, plan.newEvents);
    remapSide(((data.project && data.project.sources) || []).map(s =>
      ({ id: s.id, alias: s.alias || '', name: s.name || '', contact: s.contact || '', consent: s.consent || '', note: s.note || '' })),
      S.project.sources || [], 'src', plan.srcMap, plan.newSources);

    incoming.forEach(inc => {
      const local = PV.Model.get(inc.id);
      if (!local) plan.newRecords.push(inc);
      else if (contentKey(local) === contentKey(inc)) plan.identical++;
      else plan.conflicts.push({ id: inc.id, local, incoming: inc });
    });
    return plan;
  }

  /* choices: { entryId: 'mine' | 'theirs' | 'both' }; unchosen keeps mine.
     'both' lets the incoming entry join under a fresh number: the honest
     answer when two registers used the same number for different works. */
  function applyMerge(plan, choices) {
    const idMap = {};
    const taken = [];   /* every record adopted from the other register */

    plan.newRecords.forEach(r => { S.records.push(r); taken.push(r); });
    plan.conflicts.forEach(c => {
      const pick = (choices && choices[c.id]) || 'mine';
      if (pick === 'theirs') {
        const i = S.records.findIndex(x => x.id === c.id);
        if (i >= 0) { S.records[i] = c.incoming; taken.push(c.incoming); }
      } else if (pick === 'both') {
        const nid = PV.Model.nextId();
        idMap[c.id] = nid;
        const copy = Object.assign({}, c.incoming, { id: nid });
        S.records.push(copy);
        taken.push(copy);
      }
    });

    /* point everything adopted at its renumbered companions */
    taken.forEach(r => {
      (r.relations || []).forEach(x => { if (idMap[x.target]) x.target = idMap[x.target]; });
      if (r.eventId && plan.evtMap[r.eventId]) r.eventId = plan.evtMap[r.eventId];
      (r.evidence || []).forEach(e => { if (e.sourceId && plan.srcMap[e.sourceId]) e.sourceId = plan.srcMap[e.sourceId]; });
      (r.sightings || []).forEach(x => { if (x.sourceId && plan.srcMap[x.sourceId]) x.sourceId = plan.srcMap[x.sourceId]; });
    });

    plan.newEvents.forEach(e => S.project.events.push(e));
    plan.newSources.forEach(s => S.project.sources.push(s));
    S.project.modified = U.nowISO();
  }

  /* ---------- duplicate flagging after an import or merge ----------
     Two live entries are possible duplicates when title and creator agree
     once case, punctuation, and diacritics are set aside. */
  function dupKey(r) {
    const norm = s => String(s || '').toLowerCase().normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const t = norm(PV.Model.title(r) === 'Untitled object' ? '' : PV.Model.title(r));
    if (!t) return null;
    return t + '|' + norm(r.creator);
  }

  function findDuplicates(newIds) {
    const pairs = [];
    const fresh = S.records.filter(r => newIds.includes(r.id) && !r.struck);
    const taken = new Set();
    fresh.forEach(n => {
      const k = dupKey(n);
      if (!k) return;
      const twin = S.records.find(o =>
        o.id !== n.id && !o.struck && !taken.has(o.id) && dupKey(o) === k &&
        !(newIds.includes(o.id) && newIds.indexOf(o.id) > newIds.indexOf(n.id)));
      if (twin) {
        taken.add(n.id); taken.add(twin.id);
        pairs.push({ fresh: n, existing: twin });
      }
    });
    return pairs;
  }

  /* ---------- fixity: the evidence folder against its fingerprints ---------- */
  async function checkFiles(files) {
    const results = [];
    for (const f of files) {
      const matches = [];
      S.records.forEach(r => (r.evidence || []).forEach(e => {
        if (e.file && e.file.name === f.name && e.sha256) matches.push({ r, e });
      }));
      if (!matches.length) {
        results.push({ name: f.name, entry: '', verdict: 'unknown' });
        continue;
      }
      let hash = null;
      try { hash = await PV.Hash.sha256(await f.arrayBuffer()); } catch (err) {}
      matches.forEach(m => results.push({
        name: f.name, entry: m.r.id,
        verdict: hash && hash === m.e.sha256 ? 'verified' : 'mismatch',
      }));
    }
    return results;
  }

  return { parseCSV, importCSV, planMerge, applyMerge, findDuplicates, checkFiles };
})();
