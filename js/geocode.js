/* geocode.js: turn a typed place name into a point on the Atlas, so no one has
   to enter latitude and longitude by hand.

   Local first. The bundled gazetteer (vendor/gazetteer.js, built from GeoNames)
   resolves cities entirely in the browser, sending nothing anywhere. Typing a
   city ("Beirut") sets it; typing a specific place whose name ends in a known
   city ("Institute of Palestine Studies, Beirut") falls back to that city, at
   a deliberately approximate, city-level precision.

   An online lookup against OpenStreetMap's Nominatim is offered too, but only
   when the cataloguer asks for it by pressing the button: that is the one case
   where a place name leaves the machine, and it is never automatic. */

window.PV = window.PV || {};

PV.Geocode = (function () {
  let cities = null;        /* [{ n, cc, lat, lon }] */
  let index = null;         /* folded name -> { lat, lon, label, cc } (most populous wins) */
  let countries = null;     /* folded country name -> { lat, lon, label } */

  /* well-known names whose common English form differs from the gazetteer's,
     weighted toward this tool's subject matter */
  const ALIASES = {
    palmyra: 'tadmur', constantinople: 'istanbul', smyrna: 'izmir',
    bombay: 'mumbai', calcutta: 'kolkata', madras: 'chennai',
    peking: 'beijing', saigon: 'ho chi minh city', rangoon: 'yangon',
    leningrad: 'saint petersburg', stalingrad: 'volgograd',
    tombouctou: 'timbuktu', alep: 'aleppo', halab: 'aleppo', mossoul: 'mosul',
    bayrut: 'beirut', damas: 'damascus', dimashq: 'damascus', sanaa: "sana'a",
  };

  /* lowercase, strip diacritics and punctuation, collapse spaces */
  function fold(s) {
    return String(s || '')
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06ff\s]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  function ready() {
    if (index) return true;
    if (!window.PV || typeof PV.GAZ !== 'string') return false;
    cities = [];
    index = new Map();
    const rows = PV.GAZ.split('\n');
    for (const row of rows) {
      const c = row.split('\t');
      if (c.length < 5) continue;
      const name = c[0], ascii = c[1], cc = c[2];
      const lat = parseFloat(c[3]), lon = parseFloat(c[4]);
      if (!isFinite(lat) || !isFinite(lon)) continue;
      const rec = { lat, lon, label: name, cc };
      cities.push(rec);
      /* rows run most-populous first, so only the first of a name wins */
      const k1 = fold(name);
      if (k1 && !index.has(k1)) index.set(k1, rec);
      if (ascii) { const k2 = fold(ascii); if (k2 && !index.has(k2)) index.set(k2, rec); }
    }
    countries = new Map();
    const cc = (window.PV && PV.GAZ_COUNTRIES) || {};
    for (const name in cc) {
      const parts = String(cc[name]).split(',');
      const lat = parseFloat(parts[0]), lon = parseFloat(parts[1]);
      if (isFinite(lat) && isFinite(lon)) countries.set(fold(name), { lat, lon, label: name });
    }
    return true;
  }

  function lookupCity(folded) {
    if (!folded) return null;
    if (ALIASES[folded]) folded = ALIASES[folded];
    return index.get(folded) || null;
  }

  function cityHit(h) { return { lat: h.lat, lon: h.lon, label: h.label, cc: h.cc, kind: 'city', precision: 'approximate' }; }
  function countryHit(c) { return { lat: c.lat, lon: c.lon, label: c.label, cc: '', kind: 'country', precision: 'approximate' }; }

  /* resolve a typed place to a point, entirely from the bundled gazetteer.
     Returns { lat, lon, label, cc, kind, precision } or null. A trailing
     country name ("..., Beirut, Lebanon") is read as the country slot, not as
     a same-named city (so it does not land on Lebanon, Tennessee). */
  function resolveLocal(text) {
    if (!ready()) return null;
    const raw = String(text || '').trim();
    if (!raw) return null;
    const whole = fold(raw);

    /* 1. the whole string is a country name: "Lebanon" means the country */
    if (countries.has(whole)) return countryHit(countries.get(whole));

    /* 2. the whole string is a city */
    let hit = lookupCity(whole);
    if (hit) return cityHit(hit);

    /* 3. a city in any comma-separated segment, last first, skipping segments
          that are country names (those are the country slot) */
    const segs = raw.split(',').map(s => s.trim()).filter(Boolean);
    for (let i = segs.length - 1; i >= 0; i--) {
      const f = fold(segs[i]);
      if (countries.has(f)) continue;
      hit = lookupCity(f);
      if (hit) return cityHit(hit);
    }

    /* 4. trailing word runs of the last non-country segment ("... town Mostar") */
    let lastSeg = segs.length ? segs[segs.length - 1] : raw;
    if (segs.length > 1 && countries.has(fold(lastSeg))) lastSeg = segs[segs.length - 2];
    const words = fold(lastSeg).split(' ');
    for (let take = Math.min(3, words.length); take >= 1; take--) {
      hit = lookupCity(words.slice(words.length - take).join(' '));
      if (hit) return cityHit(hit);
    }

    /* 5. a country, as a last resort */
    for (let i = segs.length - 1; i >= 0; i--) {
      const co = countries.get(fold(segs[i]));
      if (co) return countryHit(co);
    }
    return null;
  }

  /* a label for the match, e.g. "Beirut, LB" */
  function describe(m) {
    if (!m) return '';
    return m.label + (m.cc ? ', ' + m.cc : '') + (m.kind === 'country' ? ' (country)' : '');
  }

  /* the one path that leaves the machine, and only on request: ask OpenStreetMap
     to resolve a specific place. Returns { lat, lon, label } or throws. */
  async function lookupOnline(text) {
    const q = String(text || '').trim();
    if (!q) throw new Error('Type a place first.');
    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q);
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('The lookup service did not answer (' + res.status + ').');
    const list = await res.json();
    if (!list || !list.length) throw new Error('No place of that name was found.');
    const r = list[0];
    const lat = parseFloat(r.lat), lon = parseFloat(r.lon);
    if (!isFinite(lat) || !isFinite(lon)) throw new Error('The lookup returned no coordinates.');
    return { lat, lon, label: r.display_name || q };
  }

  return { resolveLocal, describe, lookupOnline, fold, ready };
})();
