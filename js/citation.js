/* citation.js: build a citation for an object file. The cited thing is the
   file describing a single contested or dispersed object, so the reference
   names the object, its standing, and the file that records it. Returns an
   HTML form (titles in italics) and a plain-text form. Styles: Chicago note,
   MLA, APA, BibTeX. Adapted from the citation builder in MIRL Collate. */

PV.Citation = (function () {
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const has = s => s && String(s).trim();

  function today(style) {
    const d = new Date();
    if (style === 'mla') return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function build(record, project, style) {
    const title = PV.Model.title(record);
    const creator = has(record.creator) ? record.creator.trim() : '';
    const date = has(record.date) ? record.date.trim() : '';
    const medium = has(record.medium) ? record.medium.trim() : '';
    const origin = has(record.origin) ? record.origin.trim() : '';
    const fate = PV.vocab.statusOf(record.status).label.toLowerCase();
    const reg = has(project.title) ? project.title.trim() : 'Untitled object file';
    const comp = has(project.compiler) ? project.compiler.trim() : '';
    const inst = has(project.institution) ? project.institution.trim() : '';
    const entry = 'object file ' + record.id;
    const titleH = '<em>' + esc(title) + '</em>';
    const regH = '<em>' + esc(reg) + '</em>';

    let H = '', T = '';

    if (style === 'chicago') {
      const ph = [], pt = [];
      if (creator) { ph.push(esc(creator)); pt.push(creator); }
      ph.push(titleH); pt.push(title);
      [date, medium, origin].forEach(p => { if (p) { ph.push(esc(p)); pt.push(p); } });
      H = ph.join(', ') + '; ' + fate + '. ';
      T = pt.join(', ') + '; ' + fate + '. ';
      H += entry.charAt(0).toUpperCase() + entry.slice(1) + ' in ' + regH;
      T += entry.charAt(0).toUpperCase() + entry.slice(1) + ' in ' + reg;
      if (comp) { H += ', comp. ' + esc(comp); T += ', comp. ' + comp; }
      if (inst) { H += ' (' + esc(inst) + ')'; T += ' (' + inst + ')'; }
      H += ', accessed ' + today() + '.'; T += ', accessed ' + today() + '.';

    } else if (style === 'mla') {
      const sh = [], st = [];
      if (creator) { sh.push(esc(creator)); st.push(creator); }
      sh.push(titleH); st.push(title);
      const md = [date, medium].filter(Boolean).join(', ');
      if (md) { sh.push(esc(md)); st.push(md); }
      sh.push(fate.charAt(0).toUpperCase() + fate.slice(1));
      st.push(fate.charAt(0).toUpperCase() + fate.slice(1));
      let tail = entry.charAt(0).toUpperCase() + entry.slice(1) + ' in ' + reg;
      let tailH = entry.charAt(0).toUpperCase() + entry.slice(1) + ' in ';
      if (comp) tail += ', compiled by ' + comp;
      sh.push(tailH + regH + (comp ? ', compiled by ' + esc(comp) : ''));
      st.push(tail);
      H = sh.join('. ') + '. Accessed ' + today('mla') + '.';
      T = st.join('. ') + '. Accessed ' + today('mla') + '.';

    } else if (style === 'apa') {
      let h = '', t = '';
      if (creator) { h += esc(creator) + ' '; t += creator + ' '; }
      h += '(' + (date || 'n.d.') + '). '; t += '(' + (date || 'n.d.') + '). ';
      h += titleH; t += title;
      const desc = [medium, fate].filter(Boolean).join('; ');
      h += ' [' + esc(desc) + ']. '; t += ' [' + desc + ']. ';
      h += entry.charAt(0).toUpperCase() + entry.slice(1) + ' in ' + regH + '. ';
      t += entry.charAt(0).toUpperCase() + entry.slice(1) + ' in ' + reg + '. ';
      if (comp) { h += 'Compiled by ' + esc(comp) + '. '; t += 'Compiled by ' + comp + '. '; }
      if (inst) { h += esc(inst) + '.'; t += inst + '.'; }
      H = h.trim(); T = t.trim();

    } else { // bibtex
      const key = (((creator || comp || 'entry').split(/\s+/).pop() || 'entry').replace(/\W/g, '') +
        (date.replace(/\D/g, '') || record.id.replace(/\D/g, ''))) || 'entry';
      const lines = ['@misc{' + key + ','];
      if (creator) lines.push('  author       = {' + creator + '},');
      lines.push('  title        = {' + title + '},');
      if (date) lines.push('  year         = {' + date + '},');
      lines.push('  howpublished = {' + entry.charAt(0).toUpperCase() + entry.slice(1) + ' in ' + reg +
        (inst ? ', ' + inst : '') + '},');
      const note = [medium, fate, comp ? 'compiled by ' + comp : ''].filter(Boolean).join('; ');
      if (note) lines.push('  note         = {' + note + '},');
      lines.push('}');
      T = lines.join('\n'); H = esc(T);
    }
    return { html: H, text: T };
  }

  return { build };
})();
