/* app.js: interface wiring. The folio line, the menus, project open and
   save, the hash routes, and the small chores. Loaded last. */

PV.App = (function () {
  const S = PV.state;
  const U = PV.util;
  let filePickCb = null;

  /* ---------- routing: #/register, #/entry/<id>, #/timeline, #/statistics, #/atlas ---------- */
  function parseHash() {
    const h = location.hash || '';
    const m = /^#\/entry\/(.+)$/.exec(h);
    if (m) return { view: 'entry', id: decodeURIComponent(m[1]) };
    if (h === '#/timeline') return { view: 'timeline', id: null };
    if (h === '#/statistics') return { view: 'statistics', id: null };
    if (h === '#/atlas') return { view: 'atlas', id: null };
    if (h === '#/index') return { view: 'index', id: null };
    return { view: 'register', id: null };
  }

  function route() {
    const r = parseHash();
    if (r.view === 'entry' && !r.id && S.route.id) r.id = S.route.id;
    if (r.view === 'entry' && r.id) S.route.id = r.id;
    S.route.view = r.view;

    ['register', 'entry', 'timeline', 'statistics', 'atlas', 'index'].forEach(v => {
      const sect = document.getElementById('view-' + v);
      if (sect) sect.classList.toggle('hidden', v !== r.view);
      const btn = document.querySelector('nav.folio button[data-view="' + v + '"]');
      if (btn) btn.classList.toggle('on', v === r.view);
    });

    if (r.view === 'register') PV.Register.render();
    else if (r.view === 'entry') PV.Record.render(r.id);
    else if (r.view === 'timeline') PV.Timeline.render();
    else if (r.view === 'statistics') PV.Stats.render();
    else if (r.view === 'atlas') PV.Atlas.render();
    else if (r.view === 'index') PV.Indexes.render();
    window.scrollTo(0, 0);
  }

  /* ---------- a paper dialog over the page ---------- */
  function sheet(title, body, actions) {
    const overlay = U.h('div', { class: 'sheet-overlay' });
    const close = () => overlay.remove();
    const dlg = U.h('div', { class: 'paper-dialog' },
      U.h('h3', null, title),
      U.h('div', { class: 'dlg-body' }, body));
    const acts = U.h('div', { class: 'dlg-actions' });
    (actions || [{ label: 'Close' }]).forEach(a => {
      acts.append(U.h('button', { class: 'btn' + (a.danger ? ' danger' : '') }, a.label));
      const b = acts.lastElementChild;
      b.addEventListener('click', () => { if (!a.onclick || a.onclick() !== false) close(); });
    });
    dlg.append(acts);
    overlay.append(dlg);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.body.append(overlay);
    return close;
  }

  /* ---------- release preview: a deliberate pause before a public export ---------- */
  function confirmRelease(label, onProceed) {
    const s = PV.Exporters.releaseSummary();
    const p = s.publishing, w = s.withheld;
    const n = (x, one, many) => x + ' ' + (x === 1 ? one : (many || one + 's'));
    const line = (box, txt) => box.append(U.h('div', { class: 'rl-line' }, txt));
    const body = U.h('div', { class: 'release-summary' });
    body.append(U.h('p', { class: 'rl-intro' },
      'This is what the ' + label + ' carries out of the working file. Restricted material, holder notes, the research log, and source identities stay here.'));
    const pub = U.h('div', { class: 'rl-sec rl-publish' }, U.h('h4', null, 'Leaves in the ' + label));
    line(pub, n(p.objects, 'object file') + ' of ' + s.total);
    line(pub, n(p.evidence, 'evidence item') + ', public consent only');
    line(pub, n(p.sightings, 'sighting') + ' cleared for publication');
    line(pub, n(p.claims, 'claim'));
    line(pub, n(p.placesExact + p.placesApprox, 'place') + ' located: ' + p.placesExact + ' exact, ' + p.placesApprox + ' rounded');
    const wh = U.h('div', { class: 'rl-sec rl-withheld' }, U.h('h4', null, 'Stays in the working file'));
    line(wh, n(w.heldBack, 'object file') + ' held back, ' + w.struck + ' struck');
    line(wh, n(w.evidence, 'evidence item') + ' restricted or embargoed');
    line(wh, n(w.sightings, 'sighting') + ' withheld by consent');
    line(wh, n(w.holderNotes, 'current-holder note') + ', never exported');
    line(wh, n(w.places, 'place') + ' withheld; coordinates rounded unless marked exact');
    line(wh, 'The research log, and every source identity behind the ' + w.sources + ' ' + (w.sources === 1 ? 'alias' : 'aliases'));
    body.append(pub, wh);
    sheet('Before the ' + label + ' leaves', body, [
      { label: 'Cancel' },
      { label: 'Export the ' + label, onclick: () => { onProceed(); } },
    ]);
  }

  /* ---------- change notifications ---------- */
  function entryChanged(r, structural) {
    PV.Model.touch(r);
    PV.Store.save();
    if (S.route.view === 'entry') PV.Record.refreshTombstone(r, !!structural);
  }

  function projectChanged() {
    S.project.modified = U.nowISO();
    PV.Store.save();
    /* update the displayed front matter in place, keeping focus in the form */
    const t = document.querySelector('.fm-title');
    if (t) t.textContent = S.project.title || 'Untitled object file';
    const kept = [S.project.compiler, S.project.institution].filter(Boolean).join(', ');
    const line = document.querySelector('.frontmatter > .fm-line');
    if (line) line.textContent = 'A file of contested and dispersed objects' + (kept ? ' · kept by ' + kept : '');
  }

  /* ---------- the lock ---------- */
  function updateLockItem() {
    const item = document.getElementById('lock-item');
    if (!item) return;
    if (!(window.crypto && crypto.subtle)) { item.style.display = 'none'; return; }
    item.innerHTML = PV.Lock.active()
      ? 'Change or remove the lock<small>the autosave, the disk file, and saved projects are encrypted</small>'
      : 'Lock this file<small>a passphrase encrypts the file at rest; exports stay plain</small>';
  }

  function passField(label, ph) {
    const input = U.h('input', { type: 'password', placeholder: ph || '', autocomplete: 'new-password' });
    return { input, field: U.h('div', { class: 'field' }, U.h('label', null, label), input) };
  }

  function lockDialog() {
    if (!(window.crypto && crypto.subtle)) return U.toast('This browser cannot encrypt here');
    const body = U.h('div');
    const err = U.h('div', { class: 'note', style: { color: 'var(--stamp)', minHeight: '18px' } });
    if (!PV.Lock.active()) {
      const p1 = passField('Passphrase'), p2 = passField('The same again');
      body.append(
        U.h('p', { class: 'hint', style: { marginTop: '12px' } },
          'The passphrase encrypts the browser autosave, the live disk file, and saved project files. It protects the file at rest: while the file is open here, it is open. There is no recovery if the passphrase is lost. Exports (the public file, the spreadsheet, the dossier) are publications and stay plain.'),
        p1.field, p2.field, err);
      sheet('Lock this file', body, [
        { label: 'Cancel', onclick: () => true },
        {
          label: 'Lock it', onclick: () => {
            const a = p1.input.value, b = p2.input.value;
            if (a.length < 8) { err.textContent = 'Use at least eight characters.'; return false; }
            if (a !== b) { err.textContent = 'The two do not match.'; return false; }
            PV.Lock.set(a).then(() => {
              PV.Store.save();
              updateLockItem();
              U.toast('Locked: the file at rest is now encrypted');
            });
          },
        },
      ]);
      setTimeout(() => p1.input.focus(), 60);
    } else {
      const p1 = passField('New passphrase', 'leave empty to keep the current one');
      const p2 = passField('The same again');
      body.append(
        U.h('p', { class: 'hint', style: { marginTop: '12px' } },
          'Set a new passphrase, or remove the lock and return the file at rest to plain JSON.'),
        p1.field, p2.field, err);
      sheet('Change or remove the lock', body, [
        { label: 'Cancel', onclick: () => true },
        {
          label: 'Remove the lock', danger: true, onclick: () => {
            if (!confirm('Remove the lock? The autosave and future saves return to plain, readable JSON.')) return false;
            PV.Lock.remove();
            PV.Store.save();
            updateLockItem();
            U.toast('Unlocked: the file at rest is plain again');
          },
        },
        {
          label: 'Set new passphrase', onclick: () => {
            const a = p1.input.value, b = p2.input.value;
            if (a.length < 8) { err.textContent = 'Use at least eight characters.'; return false; }
            if (a !== b) { err.textContent = 'The two do not match.'; return false; }
            PV.Lock.set(a).then(() => {
              PV.Store.save();
              U.toast('The passphrase is changed');
            });
          },
        },
      ]);
    }
  }

  /* a modal that will not be clicked away: the file is locked */
  function unlockOverlay(envelope, onOpen, cancellable) {
    const overlay = U.h('div', { class: 'sheet-overlay' });
    const err = U.h('div', { class: 'note', style: { color: 'var(--stamp)', minHeight: '18px' } });
    const pass = U.h('input', { type: 'password', placeholder: 'passphrase', autocomplete: 'current-password', style: { width: '100%' } });
    const tryOpen = () => {
      err.textContent = '';
      PV.Lock.unseal(envelope, pass.value).then(raw => {
        overlay.remove();
        onOpen(raw);
      }).catch(() => {
        err.textContent = 'That passphrase does not open it.';
        pass.select();
      });
    };
    pass.addEventListener('keydown', e => { if (e.key === 'Enter') tryOpen(); });
    const acts = U.h('div', { class: 'dlg-actions' });
    if (cancellable) {
      acts.append(U.h('button', { class: 'btn quiet', onclick: () => overlay.remove() }, 'Cancel'));
    } else {
      acts.append(U.h('button', {
        class: 'btn quiet', onclick: () => {
          if (confirm('Set the locked file aside and start empty? Nothing is deleted: it stays locked in this browser and in any file you saved, and unlocking later brings it back.')) {
            overlay.remove();
            PV.Model.reset();
            route();
          }
        },
      }, 'Start empty instead'));
    }
    acts.append(U.h('button', { class: 'btn', onclick: tryOpen }, 'Unlock'));
    overlay.append(U.h('div', { class: 'paper-dialog', style: { maxWidth: '460px' } },
      U.h('h3', null, 'This file is locked'),
      U.h('div', { class: 'dlg-body' },
        U.h('p', { class: 'hint', style: { margin: '12px 0 16px' } }, 'Its passphrase opens it; nothing shows until then.'),
        U.h('div', { class: 'field' }, pass), err),
      acts));
    document.body.append(overlay);
    setTimeout(() => pass.focus(), 60);
  }

  /* ---------- project I/O ---------- */
  function newProject() {
    if (!confirm('Start a new, empty file? If the current one matters, save its project file first.')) return;
    PV.Lock.remove();
    PV.Model.reset();
    PV.Store.save();
    updateLockItem();
    S.route.id = null;
    location.hash = '#/register';
    route();
    U.toast('A new object file is open');
  }

  function openProject(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try { data = JSON.parse(reader.result); }
      catch (e) { return U.toast('That file could not be read as a provenance project'); }
      const finish = raw => {
        try {
          PV.Model.loadData(typeof raw === 'string' ? JSON.parse(raw) : raw);
          PV.Store.save();
          updateLockItem();
          S.route.id = null;
          location.hash = '#/register';
          route();
          U.toast('Project opened' + (PV.Lock.active() ? ' (locked; this session keeps its passphrase)' : ''));
        } catch (e) {
          U.toast(e.message || 'That file could not be read as a provenance project');
        }
      };
      if (PV.Lock.isEnvelope(data)) unlockOverlay(data, finish, true);
      else finish(data);
    };
    reader.readAsText(file);
  }

  function loadSample() {
    if (!window.PV.SAMPLE) return U.toast('No sample is bundled with this copy');
    if (S.records.length && !confirm('Replace the current file with the sample? Save your project file first if it matters.')) return;
    PV.Model.loadData(JSON.parse(JSON.stringify(PV.SAMPLE)));
    PV.Store.save();
    S.route.id = null;
    location.hash = '#/register';
    route();
    U.toast('The sample file is open');
  }

  function newEntry() {
    const r = PV.Model.add();
    PV.Store.save();
    location.hash = '#/entry/' + r.id;
    /* focus the first title field once the page is drawn */
    setTimeout(() => {
      const first = document.querySelector('.desk input');
      if (first) first.focus();
    }, 60);
  }

  /* ---------- bringing work in ---------- */

  /* possible duplicates, quietly raised after an import or merge */
  function offerDuplicates(newIds) {
    const pairs = PV.Importers.findDuplicates(newIds);
    if (!pairs.length) return;
    const body = U.h('div');
    body.append(U.h('p', { class: 'hint', style: { marginTop: '12px' } },
      (pairs.length === 1 ? 'One new object file shares' : pairs.length + ' new object files share') +
      ' a title and maker with a file already in the docket. Relate them, strike the new one as a duplicate, or keep both.'));
    pairs.forEach(pr => {
      const row = U.h('div', { class: 'conflict' },
        U.h('div', { class: 'cid' }, pr.fresh.id + ' · possible duplicate of ' + pr.existing.id),
        U.h('div', { class: 'sum', style: { fontSize: '15px', color: 'var(--ink-2)', marginBottom: '10px' } },
          PV.Model.title(pr.fresh) + (pr.fresh.creator ? ' · ' + pr.fresh.creator : '')));
      const acts = U.h('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap' } });
      const done = note => {
        acts.innerHTML = '';
        acts.append(U.h('span', { class: 'hint', style: { fontStyle: 'italic' } }, note));
        PV.Store.save();
      };
      acts.append(
        U.h('button', {
          class: 'btn', onclick: () => {
            pr.fresh.relations.push({ type: 'related', target: pr.existing.id });
            PV.Model.touch(pr.fresh);
            done('related to ' + pr.existing.id);
          },
        }, 'Relate them'),
        U.h('button', {
          class: 'btn danger', onclick: () => {
            pr.fresh.struck = true;
            PV.Model.touch(pr.fresh);
            done(pr.fresh.id + ' struck as a duplicate');
          },
        }, 'Strike the new one'),
        U.h('button', { class: 'btn quiet', onclick: () => done('kept both') }, 'Keep both'));
      row.append(acts);
      body.append(row);
    });
    sheet('Possible duplicates', body, [{ label: 'Done', onclick: () => { route(); } }]);
  }

  function importCSVFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const res = PV.Importers.importCSV(reader.result);
        PV.Store.save();
        route();
        let msg = res.added + (res.added === 1 ? ' object file' : ' object files') + ' imported, held back until you publish them';
        if (res.renumbered) msg += '; ' + res.renumbered + ' renumbered';
        U.toast(msg);
        if (res.unmatched.length) setTimeout(() =>
          U.toast('Columns not understood: ' + res.unmatched.slice(0, 4).join(', ') + (res.unmatched.length > 4 ? '…' : '')), 2600);
        offerDuplicates(res.ids);
      } catch (e) {
        U.toast(e.message || 'That file could not be read as a CSV');
      }
    };
    reader.readAsText(file);
  }

  function mergeFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let plan;
      try { plan = PV.Importers.planMerge(JSON.parse(reader.result)); }
      catch (e) { return U.toast(e.message || 'That file could not be read as a provenance project'); }

      const summary = () => {
        PV.Importers.applyMerge(plan, choices);
        PV.Store.save();
        route();
        U.toast('Merged: ' + plan.newRecords.length + ' new, ' +
          plan.conflicts.length + ' reconciled, ' + plan.identical + ' identical' +
          (plan.newEvents.length ? ', ' + plan.newEvents.length + ' events' : '') +
          (plan.newSources.length ? ', ' + plan.newSources.length + ' sources' : ''));
        if (plan.newRecords.length) setTimeout(() => offerDuplicates(plan.newRecords.map(r => r.id)), 400);
      };
      const choices = {};
      if (!plan.conflicts.length) {
        if (!plan.newRecords.length && !plan.newEvents.length) return U.toast('Nothing new: the files already agree');
        return summary();
      }

      /* conflicts decided by a human, side by side */
      const body = U.h('div');
      body.append(U.h('p', { class: 'hint', style: { marginTop: '12px' } },
        plan.newRecords.length + ' new object files will be added. These ' + plan.conflicts.length +
        ' exist in both files and differ; choose which version stands. The newer one is suggested.'));
      plan.conflicts.forEach(c => {
        const newer = (c.incoming.modified || '') > (c.local.modified || '') ? 'theirs' : 'mine';
        choices[c.id] = newer;
        const side = (who, label, rec) => {
          const radio = U.h('input', { type: 'radio', name: 'cf-' + c.id, value: who });
          radio.checked = choices[c.id] === who;
          radio.addEventListener('change', () => { choices[c.id] = who; });
          return U.h('div', { class: 'side' },
            U.h('label', null, radio,
              U.h('span', null,
                U.h('span', { class: 'who' }, label + (newer === who ? ' · newer' : '')),
                U.h('div', { class: 'sum' },
                  PV.Model.title(rec) + ' · ' + PV.vocab.statusOf(rec.status).label.toLowerCase() +
                  (rec.modified ? ' · ' + rec.modified.slice(0, 10) : '')))));
        };
        const bothRadio = U.h('input', { type: 'radio', name: 'cf-' + c.id, value: 'both' });
        bothRadio.addEventListener('change', () => { choices[c.id] = 'both'; });
        body.append(U.h('div', { class: 'conflict' },
          U.h('div', { class: 'cid' }, c.id),
          U.h('div', { class: 'sides' }, side('mine', 'Mine', c.local), side('theirs', 'Theirs', c.incoming)),
          U.h('label', { style: { display: 'flex', gap: '10px', alignItems: 'baseline', marginTop: '10px', cursor: 'pointer', fontSize: '15px', color: 'var(--ink-2)' } },
            bothRadio,
            U.h('span', null, 'Keep both: these are different objects; theirs joins under a fresh number'))));
      });
      sheet('Reconcile the two files', body, [
        { label: 'Cancel', onclick: () => true },
        { label: 'Apply merge', onclick: () => { summary(); } },
      ]);
    };
    reader.readAsText(file);
  }

  async function checkFixity(files) {
    U.toast('Hashing ' + files.length + (files.length === 1 ? ' file…' : ' files…'));
    const results = await PV.Importers.checkFiles(files);
    if (results.length && results.every(x => x.verdict === 'verified')) {
      return U.toast('All ' + results.length + ' verified: the files match their fingerprints');
    }
    const body = U.h('div');
    const table = U.h('table', { class: 'report-table' });
    results.forEach(x => {
      table.append(U.h('tr', null,
        U.h('td', { class: 'f' }, x.name),
        U.h('td', null, x.entry || ''),
        U.h('td', { class: x.verdict === 'verified' ? 'ok' : x.verdict === 'mismatch' ? 'bad' : '' },
          x.verdict === 'verified' ? 'unchanged' : x.verdict === 'mismatch' ? 'DOES NOT MATCH' : 'not in the file')));
    });
    body.append(table);
    sheet('Fixity report', body, [{ label: 'Close' }]);
  }

  /* a shared file dialog: callers hand over what to do with the file */
  function pickFile(cb) {
    filePickCb = cb;
    const input = document.getElementById('file-input');
    input.value = '';
    input.click();
  }

  /* ---------- the people the file rests on ----------
     The manager for sources: aliases publish, identities do not, and the
     view that matters when consent shifts: everything that rests on this
     person's word, restrictable at once. */
  function sourcesDialog() {
    const body = U.h('div');

    const srcField = (s, key, label, ph, note) => {
      const input = U.h('input', { type: 'text', value: s[key] || '', placeholder: ph || '', dir: 'auto' });
      input.addEventListener('input', () => {
        s[key] = input.value;
        S.project.modified = U.nowISO();
        PV.Store.save();
      });
      const f = U.h('div', { class: 'field' }, U.h('label', null, label), input);
      if (note) f.append(U.h('div', { class: 'note' }, note));
      return f;
    };

    const redraw = () => {
      body.innerHTML = '';
      body.append(U.h('p', { class: 'hint', style: { marginTop: '12px' } },
        'The people the file rests on. Only the alias is ever published or exported; the identity, contact, and consent notes stay in the working file. Link evidence and sightings to a source from the registrar’s desk.'));
      if (!(S.project.sources || []).length) {
        body.append(U.h('p', { class: 'hint', style: { fontStyle: 'italic' } }, 'No sources are recorded yet.'));
      }
      (S.project.sources || []).forEach(s => {
        const rests = PV.Model.restsOn(s.id);
        const item = U.h('div', { class: 'item' },
          U.h('div', { class: 'item-head' },
            U.h('span', { class: 'n' }, s.id),
            U.h('span', { class: 'sp' }),
            U.h('button', {
              class: 'act', onclick: () => {
                const cleared = PV.Model.removeSource(s.id);
                PV.Store.save();
                U.toast('Source removed' + (cleared ? '; unlinked from ' + cleared + (cleared === 1 ? ' item' : ' items') : ''));
                redraw();
              },
            }, 'Remove')),
          srcField(s, 'alias', 'Alias, as published', 'e.g. a community elder',
            'The public handle; choose one that cannot identify them.'),
          U.h('div', { class: 'row2' },
            srcField(s, 'name', 'Identity', 'name; never published'),
            srcField(s, 'contact', 'Contact', 'never published')),
          srcField(s, 'consent', 'Consent', 'what they agreed to, and when',
            'In their words where possible: what may be used, what must wait, until when.'),
          srcField(s, 'note', 'Note', ''));

        const restsBox = U.h('div', { class: 'field' });
        restsBox.append(U.h('label', null, 'Rests on their word'));
        if (!rests.length) {
          restsBox.append(U.h('div', { class: 'note' }, 'Nothing yet.'));
        } else {
          rests.forEach(x => {
            restsBox.append(U.h('div', { style: { display: 'flex', gap: '12px', alignItems: 'baseline', padding: '4px 0' } },
              U.h('button', {
                class: 'act', style: { color: 'var(--stamp)' },
                onclick: () => { document.querySelector('.sheet-overlay').remove(); location.hash = '#/entry/' + x.record.id; },
              }, x.record.id),
              U.h('span', { style: { fontSize: '15px', color: 'var(--ink-2)' } },
                PV.Model.title(x.record) + ' · ' + x.kind + ' (' + x.item.consent + ')')));
          });
          const pub = rests.filter(x => x.item.consent === 'public').length;
          if (pub) {
            restsBox.append(U.h('div', { class: 'add-line' }, U.h('button', {
              class: 'btn danger', onclick: () => {
                if (!confirm('Mark all ' + pub + ' public item' + (pub === 1 ? '' : 's') + ' (evidence and sightings) from this source as restricted? Use this when their consent is withdrawn or in doubt.')) return;
                const n = PV.Model.restrictSource(s.id, 'restricted');
                PV.Store.save();
                U.toast(n + (n === 1 ? ' item' : ' items') + ' restricted; nothing of theirs will publish');
                redraw();
              },
            }, 'Restrict everything public of theirs')));
          }
        }
        item.append(restsBox);
        body.append(item);
      });
      body.append(U.h('div', { class: 'add-line' }, U.h('button', {
        class: 'act', onclick: () => { PV.Model.addSource(); PV.Store.save(); redraw(); },
      }, '+ Add a source')));
    };
    redraw();
    sheet('Sources', body, [{ label: 'Done', onclick: () => { route(); } }]);
  }

  /* ---------- community-defined labels and protocols ----------
     The standard TK / BC Labels ship with the tool; this is where a community
     defines its own, so the protocol can be placed on an object file without
     hard-coding it into the program. */
  function labelsDialog() {
    const body = U.h('div');
    const lField = (l, key, label, ph, mono) => {
      const input = U.h('input', { type: 'text', value: l[key] || '', placeholder: ph || '', dir: 'auto',
        style: mono ? { fontFamily: 'var(--mono)' } : null });
      input.addEventListener('input', () => { l[key] = input.value; S.project.modified = U.nowISO(); PV.Store.save(); });
      return U.h('div', { class: 'field' }, U.h('label', null, label), input);
    };
    const redraw = () => {
      body.innerHTML = '';
      body.append(U.h('p', { class: 'hint', style: { marginTop: '12px' } },
        'Labels are statements of a community’s authority over an object and its data, in the manner of Local Contexts. The standard TK and BC Labels are always available on the registrar’s desk; define a community’s own here, then place it on any object file.'));
      const lcInput = U.h('input', { type: 'url', value: S.project.localContexts || '', placeholder: 'https://localcontexts.org/…', style: { fontFamily: 'var(--mono)' } });
      lcInput.addEventListener('input', () => { S.project.localContexts = lcInput.value.trim(); S.project.modified = U.nowISO(); PV.Store.save(); });
      body.append(U.h('div', { class: 'field' }, U.h('label', null, 'Local Contexts Hub project'), lcInput,
        U.h('div', { class: 'note' }, 'The project’s page on the Local Contexts Hub, if registered; it appears with the labels in the object file and the public exports.')));
      if (!(S.project.labels || []).length) {
        body.append(U.h('p', { class: 'hint', style: { fontStyle: 'italic' } }, 'No community labels are defined yet.'));
      }
      (S.project.labels || []).forEach(l => {
        const item = U.h('div', { class: 'item' },
          U.h('div', { class: 'item-head' },
            U.h('span', { class: 'n' }, l.id),
            U.h('span', { class: 'sp' }),
            U.h('button', {
              class: 'act', onclick: () => {
                const cleared = PV.Model.removeLabel(l.id);
                PV.Store.save();
                U.toast('Label removed' + (cleared ? '; cleared from ' + cleared + (cleared === 1 ? ' object' : ' objects') : ''));
                redraw();
              },
            }, 'Remove')),
          U.h('div', { class: 'row2' },
            lField(l, 'code', 'Code', 'e.g. TK CO (local)', true),
            lField(l, 'community', 'Community', 'who places it')),
          lField(l, 'name', 'Name', 'e.g. Community Use Only'),
          lField(l, 'gloss', 'Standard text', 'the protocol this label states'));
        body.append(item);
      });
      body.append(U.h('div', { class: 'add-line' }, U.h('button', {
        class: 'act', onclick: () => { PV.Model.addLabel(); PV.Store.save(); redraw(); },
      }, '+ Define a label')));
    };
    redraw();
    sheet('Labels and protocols', body, [{ label: 'Done', onclick: () => { route(); } }]);
  }

  /* ---------- the live file on disk ---------- */
  function updateDiskItem() {
    const item = document.getElementById('disk-item');
    if (!item) return;
    const st = PV.Disk.state();
    if (st.mode === 'unsupported') { item.style.display = 'none'; return; }
    item.style.display = '';
    if (st.mode === 'active') {
      item.innerHTML = 'Stop saving to disk<small>now saving to ' + U.esc(st.name) + ' as you work</small>';
    } else if (st.mode === 'pending') {
      item.innerHTML = 'Resume saving to disk<small>pick up ' + U.esc(st.name) + ' from last time</small>';
    } else {
      item.innerHTML = 'Keep the file on disk<small>save continuously to a .json you choose, alongside the browser autosave</small>';
    }
  }

  async function diskAction() {
    const st = PV.Disk.state();
    try {
      if (st.mode === 'active') await PV.Disk.disconnect();
      else if (st.mode === 'pending') await PV.Disk.resume();
      else await PV.Disk.connect();
    } catch (e) {
      if (e && e.name !== 'AbortError') U.toast('Could not open the file: ' + (e.message || e));
    }
    updateDiskItem();
  }

  /* ---------- menus ---------- */
  function closeMenus() {
    document.querySelectorAll('.menu').forEach(m => m.classList.add('hidden'));
  }
  function wireMenu(btnId, menuId) {
    const btn = document.getElementById(btnId);
    const menu = document.getElementById(menuId);
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const wasHidden = menu.classList.contains('hidden');
      closeMenus();
      if (wasHidden) menu.classList.remove('hidden');
    });
    menu.addEventListener('click', e => e.stopPropagation());
  }

  /* ---------- boot ---------- */
  function boot() {
    const loaded = PV.Store.load();
    if (loaded === false) {
      if (window.PV.SAMPLE) {
        try { PV.Model.loadData(JSON.parse(JSON.stringify(PV.SAMPLE))); } catch (e) { PV.Model.reset(); }
      } else {
        PV.Model.reset();
      }
    } else if (loaded !== true) {
      /* a locked file waits in the autosave: ask before showing anything */
      setTimeout(() => unlockOverlay(loaded, raw => {
        try {
          PV.Model.loadData(JSON.parse(raw));
          updateLockItem();
          route();
          U.toast('Unlocked');
        } catch (e) { U.toast('The locked file could not be read'); }
      }, false), 50);
    }

    document.querySelectorAll('nav.folio button[data-view]').forEach(b => {
      b.addEventListener('click', () => {
        const v = b.dataset.view;
        location.hash = v === 'entry' ? (S.route.id ? '#/entry/' + S.route.id : '#/entry/') : '#/' + v;
      });
    });

    document.getElementById('new-entry-btn').addEventListener('click', newEntry);
    wireMenu('project-btn', 'project-menu');
    wireMenu('export-btn', 'export-menu');
    document.addEventListener('click', closeMenus);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenus(); });

    document.getElementById('project-menu').addEventListener('click', e => {
      const act = e.target.closest('button') && e.target.closest('button').dataset.act;
      if (!act) return;
      closeMenus();
      if (act === 'new') newProject();
      else if (act === 'open') { const i = document.getElementById('project-input'); i.value = ''; i.click(); }
      else if (act === 'save') PV.Exporters.saveProject();
      else if (act === 'lock') lockDialog();
      else if (act === 'sources') sourcesDialog();
      else if (act === 'labels') labelsDialog();
      else if (act === 'disk') diskAction();
      else if (act === 'csv') { const i = document.getElementById('csv-input'); i.value = ''; i.click(); }
      else if (act === 'merge') { const i = document.getElementById('merge-input'); i.value = ''; i.click(); }
      else if (act === 'fixity') { const i = document.getElementById('fixity-input'); i.value = ''; i.click(); }
      else if (act === 'sample') loadSample();
    });
    document.getElementById('export-menu').addEventListener('click', e => {
      const act = e.target.closest('button') && e.target.closest('button').dataset.act;
      if (!act) return;
      closeMenus();
      if (act === 'csv') confirmRelease('docket spreadsheet', () => PV.Exporters.registerCSV());
      else if (act === 'json') confirmRelease('public data file', () => PV.Exporters.publicJSON());
      else if (act === 'manifest') confirmRelease('hash manifest', () => PV.Exporters.manifest());
      else if (act === 'objectid') confirmRelease('Object ID records', () => PV.Exporters.objectIDExport());
      else if (act === 'jsonld') confirmRelease('linked data file', () => PV.Exporters.jsonldExport());
      else if (act === 'aid') confirmRelease('public file', () => PV.Exporters.findingAid());
      else if (act === 'book') confirmRelease('restitution dossier', () => PV.Exporters.printBook());
      else if (act === 'notice') {
        if (S.route.view !== 'entry' || !PV.Record.current) U.toast('Open an object file first; the notice prints one object');
        else confirmRelease('sought notice', () => PV.Exporters.printNotice(PV.Record.current));
      }
      else if (act === 'letter') {
        if (S.route.view !== 'entry' || !PV.Record.current) U.toast('Open an object file first; the letter is for one object');
        else confirmRelease('claim letter', () => PV.Exporters.claimLetter(PV.Record.current));
      }
      else if (act === 'print') window.print();
    });

    document.getElementById('project-input').addEventListener('change', e => {
      if (e.target.files && e.target.files[0]) openProject(e.target.files[0]);
    });
    document.getElementById('file-input').addEventListener('change', e => {
      if (e.target.files && e.target.files[0] && filePickCb) filePickCb(e.target.files[0]);
      filePickCb = null;
    });
    document.getElementById('csv-input').addEventListener('change', e => {
      if (e.target.files && e.target.files[0]) importCSVFile(e.target.files[0]);
    });
    document.getElementById('merge-input').addEventListener('change', e => {
      if (e.target.files && e.target.files[0]) mergeFile(e.target.files[0]);
    });
    document.getElementById('fixity-input').addEventListener('change', e => {
      if (e.target.files && e.target.files.length) checkFixity(Array.from(e.target.files));
    });

    window.addEventListener('hashchange', route);
    route();

    /* a gentle word when an embargo date has passed */
    const lapsed = PV.Model.lapsedEmbargoes();
    if (lapsed.length) {
      const ids = [...new Set(lapsed.map(x => x.recordId))];
      setTimeout(() => U.toast(
        (lapsed.length === 1 ? 'An embargo date has passed' : lapsed.length + ' embargo dates have passed') +
        ': review ' + ids.slice(0, 3).join(', ') + (ids.length > 3 ? '…' : '')), 900);
    }

    /* remember a live file from last session, if there was one */
    updateDiskItem();
    updateLockItem();
    PV.Disk.init().then(updateDiskItem).catch(() => {});

    /* offline: a service worker caches the tool after the first visit */
    if ('serviceWorker' in navigator &&
        (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  document.addEventListener('DOMContentLoaded', boot);

  return { route, entryChanged, projectChanged, newEntry, newProject, loadSample, pickFile, sheet };
})();
