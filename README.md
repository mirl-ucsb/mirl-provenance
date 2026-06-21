# MIRL Provenance

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.20750381.svg)](https://doi.org/10.5281/zenodo.20750381)

> **In active development.** This tool is being built and refined in the open. Its features, file formats, and interface may still change, and some parts may be incomplete or rough. Because it is still in development, do not rely on it alone to protect the people named in a case, and confirm what is safe to release before you export or share. Please keep your own copies of anything important, and reports of whatever breaks are welcome.

**An object file for dispersal and restitution.** A no-build, local-first tool
for building the biography of a single contested or dispersed object, or a body
of them: its identity, the dated chain of custody, the sightings and the
competing claims, the current holder, and a restitution-ready output. Made for
a scholar, a curator, or a community member working on a laptop, often offline,
who needs to assemble an object-level case and keep control of their data and
the safety of the people in it.

From the [Material / Image Research Lab](https://mirl.arthistory.ucsb.edu) at
UC Santa Barbara. The nearest sibling of [MIRL
Lacuna](https://github.com/mirl-ucsb/mirl-lacuna), with which it shares its
model, consent discipline, sources register, sightings, hashing, and atlas.

## Why this tool

The large actors in cultural-heritage provenance work at infrastructure scale.
ICOM Red Lists name *categories* of at-risk object types for customs and police,
not actual objects. lostart.de and museum provenance databases are
institutional. Mukurtu is a full content-management system. None of them lets a
claimant assemble an object-level case for one specific contested thing on a
laptop, and the conflict-heritage field almost wholly ignores colonial
dispersal. MIRL Provenance sits beneath and beside those systems and treats both
threads, looted antiquities and trafficked conflict objects, and colonial
dispersal and Indigenous repatriation, as the same problem.

It also makes two moves that distinguish the wider MIRL suite: it carries the
**Berkeley Protocol** evidentiary discipline (intact provenance, hashed
originals, chain of custody) into laptop scale, and it treats **CARE and
Traditional Knowledge / Biocultural Labels** as a first-class layer, not an
afterthought.

## What it does

- **The object file.** A biography of one object, shown above the registrar's
  desk and updated as you type. Titles in any script (Arabic and other
  right-to-left text set themselves), maker or culture, object type, materials,
  origin and community of origin, dimensions, and repeatable identifiers.
- **Chain of custody.** A dated ledger of who held the object and how it passed
  from hand to hand, each link marked attested, probable, or uncertain. A gap in
  the chain is left as a gap rather than invented.
- **Sightings in the record.** Auction lots, dealer stock, museum accessions,
  exhibitions, and publications, each dated and sourced, and marked as
  supporting or complicating the stated provenance.
- **Claims for return.** Who is asking for the object back and where the claim
  stands, with the named legal bases it rests on chosen from a controlled list
  (NAGPRA, the 1970 UNESCO and 1995 UNIDROIT Conventions, the 1954 Hague
  Convention, the Washington Principles, the HEAR Act, national patrimony law,
  ICOM ethics, colonial-collections policy, cultural patrimony) alongside your
  own grounds in prose.
- **Provenance gap analysis.** The custody chain is charted as a coverage bar,
  and red flags are raised where a gap falls across a sensitive window: the
  1933 to 1945 (Nazi-era) period, a dispersal event on the file, a chain too
  short to stand, or undated links.
- **CARE notes and TK / BC Labels.** Notes under the four CARE principles
  (Collective benefit, Authority to control, Responsibility, Ethics), and the
  Local Contexts Traditional Knowledge and Biocultural Labels, placed by or with
  the community of origin. Communities can define their own labels, and each
  label can carry its own Local Contexts Hub URI so it links back to the
  authoritative record. These are statements of authority, not licences the
  tool enforces, and they travel with the file into every public output.
- **Evidence, hashed and consent-aware.** Attach a document or an image, or give
  a web address; the file keeps its name, a thumbnail, and a sha-256 fingerprint
  that ties the object file to the exact source. Each item is public,
  restricted, or embargoed, and only public evidence ever leaves the working
  file.
- **Sources, by alias only.** The people the file rests on are kept under
  Project; only an alias is ever published, and when consent is withdrawn you
  can pull everything of theirs out of publication at once.
- **Atlas and chronology.** Current locations on a world plate, with an offline
  gazetteer and an on-request OpenStreetMap lookup, and a chronology that sets
  every link of custody and every sighting in time, with the dispersal events
  among them.

## Exports

Every export starts from the public clone: held-back files, restricted and
embargoed evidence, and unpublished locations are withheld; the chain of
custody, claims, CARE notes, and TK / BC Labels travel, because they are the
dossier's substance.

- **Restitution dossier (print).** A cover leaf, one object file per page with
  its chain of custody, gap analysis, and claims, and the docket and index as
  appendices. Print to PDF for a court, a ministry, a museum's restitution
  committee, or a NAGPRA review.
- **Claim letter (print).** A draft request for return of the open object,
  addressed to the current holder and naming the legal bases the claim rests
  on. A starting point for a real letter, not a substitute for counsel.
- **Sought notice (print).** One object as a one-page public appeal for return:
  what it is, where it is held, who is claiming it, and whom to tell.
- **Public file (.html).** One self-contained page (docket, object files,
  chronology, atlas, index) that opens with no server, fonts and all.
- **Object ID records (.json).** The Getty / ICOM international standard for
  describing an object so it can be reported to police, customs, and INTERPOL.
- **Linked data (CIDOC-CRM / JSON-LD).** Each object an E22 Human-Made Object
  with its custody links as transfer-of-custody events, for an Arches instance
  or another CRM consumer to ingest.
- **Docket spreadsheet (.csv)** and **public data (.json)**.

## Running it

There is no build step and nothing to install. Open `index.html` in a browser,
or serve the folder over any static host:

```sh
python3 -m http.server 8794
```

Then visit `http://127.0.0.1:8794/`. It runs from `file://` too, and from
GitHub Pages with relative paths. After the first visit a service worker caches
the whole tool so it works offline. Your work autosaves to the browser; use
**Project → Save project** for a portable file, or **Keep the file on disk**
(Chromium browsers) to save continuously to a `.json` you choose.

Open **Project → Open the sample file** for a worked example: a fictional file
of dispersed objects of the Marrow Coast, with a chain of custody, a community
claim, CARE notes, and TK / BC Labels. Everything in it is invented.

## Privacy and consent, by default

- Object files are **held back from publication** until you tick Publish.
- Evidence is **restricted by default**; only public evidence is exported.
- Current locations are **withheld by default**; publish them exact or rounded.
- Source **identities never publish**; only their alias does.
- The working file can be **encrypted at rest** with a passphrase (AES-GCM,
  PBKDF2). Exports are publications and stay plain.

## Building the sample

The sample and its plainly synthetic images are generated, with true sha-256
hashes of the files written, by:

```sh
cd samples && python3 make-samples.py   # needs Pillow
```

## Credits and license

Built by Jeff O'Brien for the Material / Image Research Lab, Department of
History of Art & Architecture, UC Santa Barbara. MIT licensed; see
[`LICENSE`](LICENSE). Type: Spectral and IBM Plex Mono, with Noto Naskh Arabic,
all vendored from Fontsource. Deep-zoom viewing by OpenSeadragon. Offline
geocoding from GeoNames; coastline from Natural Earth. The CARE principles are
those of the Global Indigenous Data Alliance; the TK and BC Labels are those of
[Local Contexts](https://localcontexts.org). If you use it, please cite it with
the metadata in [`CITATION.cff`](CITATION.cff) (concept DOI
[10.5281/zenodo.20750381](https://doi.org/10.5281/zenodo.20750381), which always
resolves to the latest version).
