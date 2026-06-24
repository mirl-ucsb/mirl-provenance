/* atlas.js: the current locations of the objects, drawn as an atlas plate. In
   the working file the compiler sees every located object, so a place typed
   into an object file appears here at once; files not yet cleared for
   publication are drawn faintly, and the strict, consent-filtered plate is
   what every export shows. Coastline: Natural Earth 1:110m land (public
   domain), vendored as one SVG path in vendor/land.js. A pure renderer over
   data, so the static public file can reuse it. */

PV.Atlas = (function () {
  const U = PV.util;
  const W = 1000, H = 500;

  const px = lon => (lon + 180) / 360 * W;
  const py = lat => (90 - lat) / 180 * H;

  function plateSVG(points) {
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="World map of current locations of the objects">';
    for (let lon = -150; lon <= 150; lon += 30) s += '<line class="grat" x1="' + px(lon) + '" y1="0" x2="' + px(lon) + '" y2="' + H + '"/>';
    for (let lat = -60; lat <= 60; lat += 30) s += '<line class="grat" x1="0" y1="' + py(lat) + '" x2="' + W + '" y2="' + py(lat) + '"/>';
    s += '<path class="coast" d="' + (window.PV && PV.LAND ? PV.LAND : '') + '"/>';
    /* preview points first, so publishable ones sit on top */
    points.slice().sort((a, b) => (a.state === 'preview' ? 0 : 1) - (b.state === 'preview' ? 0 : 1)).forEach(p => {
      const x = px(p.lon), y = py(p.lat);
      const cls = 'site' + (p.state === 'preview' ? ' preview' : '');
      s += '<g class="' + cls + '" data-id="' + U.esc(p.id) + '">' +
        '<circle class="pt" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (p.approx ? 5.5 : 4) + '"' +
        (p.approx ? ' stroke-dasharray="2.5 2"' : '') + '/>' +
        (p.approx ? '' : '<circle class="pt-core" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="1.2"/>') +
        '<text class="ptlab" x="' + (x + 7).toFixed(1) + '" y="' + (y - 5).toFixed(1) + '">' + U.esc(p.id) + '</text></g>';
    });
    s += '<rect class="frame" x="0.5" y="0.5" width="' + (W - 1) + '" height="' + (H - 1) + '"/></svg>';
    return s;
  }

  function html(data, opts) {
    opts = opts || {};
    const round1 = x => Math.round(x * 10) / 10;
    const rs = (data.records || []).filter(r => !r.struck);
    const located = rs.filter(r => r.location && (r.location.place || (typeof r.location.lat === 'number' && typeof r.location.lon === 'number')));
    const hasCoords = r => typeof r.location.lat === 'number' && typeof r.location.lon === 'number';
    const publishable = r => (opts.publicOnly || r.publish) && r.location.publish !== 'withheld';
    /* why an entry is not on the published plate */
    const heldReason = r => !r.publish ? 'entry held back' : (r.location.publish === 'withheld' ? 'place withheld' : '');

    /* the rows the gazetteer lists: in an export, only the publishable; in the
       working view, every located entry, so the cataloguer sees their work */
    const rows = opts.publicOnly ? located.filter(publishable) : located;

    /* the points plotted: publishable ones rounded as they would publish;
       in the working view, the rest too, drawn faintly */
    const points = rows.filter(hasCoords).map(r => {
      const pub = publishable(r);
      const approx = r.location.publish === 'approximate';
      const showApprox = pub && approx;          /* mirror the export rounding */
      return {
        id: r.id, state: pub ? 'publish' : 'preview', approx: showApprox,
        lat: showApprox ? round1(r.location.lat) : r.location.lat,
        lon: showApprox ? round1(r.location.lon) : r.location.lon,
      };
    });
    const previewCount = opts.publicOnly ? 0 : rows.filter(r => !publishable(r)).length;
    const withheldFromExport = located.filter(r => !publishable(r)).length;

    let h = '<h2 class="head">Atlas</h2>' +
      '<p class="subhead">' + (opts.publicOnly
        ? 'current locations of the objects, published only with consent'
        : 'current locations of the objects; files not yet published are shown faintly') + '</p>';

    h += '<div class="atlas-plate"><div class="inner">' + plateSVG(points) +
      '<div class="atlas-caption">' + (opts.publicOnly
        ? 'Current locations · published places only · equirectangular'
        : 'Current locations · working view · equirectangular') +
      '</div></div></div>';

    if (rows.length) {
      h += '<table class="gazetteer"><thead><tr><th>No.</th><th>Object</th><th>Place</th><th>Coordinates</th><th>Status</th></tr></thead><tbody>';
      rows.forEach(r => {
        const st = PV.vocab.statusOf(r.status);
        const loc = r.location;
        const pub = publishable(r);
        const approx = loc.publish === 'approximate';
        let coords = '';
        if (hasCoords(r)) {
          const showApprox = (!opts.publicOnly && approx) || (pub && approx);
          const la = (pub && approx) ? round1(loc.lat) : loc.lat;
          const lo = (pub && approx) ? round1(loc.lon) : loc.lon;
          coords = Math.abs(la).toFixed(showApprox ? 1 : 3) + (la >= 0 ? ' N' : ' S') + ', ' +
            Math.abs(lo).toFixed(showApprox ? 1 : 3) + (lo >= 0 ? ' E' : ' W') + (approx ? ' · approx.' : '');
        } else {
          coords = '<span class="gaz-state">no coordinates yet</span>';
        }
        const reason = !opts.publicOnly && !pub ? '<div class="gaz-state">' + heldReason(r) + '</div>' : '';
        h += '<tr class="row' + (pub ? '' : ' preview') + '" data-id="' + U.esc(r.id) + '">' +
          '<td class="no">' + U.esc(r.id) + '</td>' +
          '<td>' + U.esc(PV.Model.title(r)) + '</td>' +
          '<td>' + U.esc(loc.place || '') + '</td>' +
          '<td class="coords">' + coords + reason + '</td>' +
          '<td><span class="mark ' + st.cls + '" style="font-size:11.5px;padding:4px 7px 3px">' + U.esc(st.label) + '</span></td></tr>';
      });
      h += '</tbody></table>';
    } else {
      h += '<p class="hint" style="margin-top:26px;font-style:italic">Nothing is plotted yet. Type a current location into an object file (a city, or a place ending in a city) and it appears here.</p>';
    }

    if (opts.publicOnly && withheldFromExport > 0) {
      h += '<p class="stats-note">' + withheldFromExport + ' recorded ' + (withheldFromExport === 1 ? 'place is' : 'places are') +
        ' withheld from this document.</p>';
    } else if (!opts.publicOnly && previewCount > 0) {
      h += '<p class="stats-note">' + previewCount + (previewCount === 1 ? ' place is' : ' places are') +
        ' shown faintly: held back from publication, or with the place set to withheld. They will not appear in any export until you publish them.</p>';
    }
    return h;
  }

  function render() {
    const sect = document.getElementById('view-atlas');
    sect.innerHTML = '<div class="sheet">' + html({ project: PV.state.project, records: PV.state.records }, {}) + '</div>';
    sect.querySelectorAll('[data-id]').forEach(el => {
      el.style.cursor = 'pointer';
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      const rec = PV.Model.get(el.dataset.id);
      el.setAttribute('aria-label', (el.tagName.toLowerCase() === 'g' ? 'Place: ' : 'Open ') + (rec ? PV.Model.title(rec) : el.dataset.id));
      const go = () => { location.hash = '#/entry/' + el.dataset.id; };
      el.addEventListener('click', go);
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
  }

  return { html, render };
})();
