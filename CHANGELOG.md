# Changelog

All notable changes to MIRL Provenance are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project aims at
[semantic versioning](https://semver.org/).

## [1.0.0] - 2026-06-18

First public release, archived on Zenodo. Concept DOI
[10.5281/zenodo.20750381](https://doi.org/10.5281/zenodo.20750381) (resolves to
the latest version); this release is
[10.5281/zenodo.20750382](https://doi.org/10.5281/zenodo.20750382).

MIRL Provenance is a no-build, local-first object-file and restitution-dossier
tool, the nearest sibling of MIRL Lacuna, sharing its model, consent
discipline, sources register, sightings, hashing, atlas, and offline geocoder.

### Added

- **The object file.** A biography of a single contested or dispersed object,
  shown above the registrar's desk and updated as you type: titles in any
  script, maker or culture, type, materials, origin and community of origin,
  dimensions, and repeatable identifiers (accession, lot, inventory numbers).
- **Chain of custody.** A dated ledger of who held the object, how it passed
  from each hand to the next, and how firmly each link is known. The card
  orders the chain by date; a gap is left as a gap.
- **Sightings in the record.** Auction lots, dealer stock, accessions,
  exhibitions, and publications, each dated, sourced, and marked as supporting
  or complicating the provenance.
- **Claims for return.** Who is asking for the object back, on what ground, and
  where the claim stands, from preparing through to returned, denied, or
  withdrawn. A claim flag rides on the docket.
- **Current holder and location.** The present keeper and place, with the same
  three-state publication discipline as Lacuna: withheld by default,
  approximate (rounded to about 10 km), or exact.
- **CARE notes and Traditional Knowledge / Biocultural Labels.** The four CARE
  principles (Collective benefit, Authority to control, Responsibility, Ethics)
  as notes that travel with the file, and the Local Contexts TK and BC Labels,
  with room for communities to define their own under Project, in Labels and
  protocols. Each placed label can carry the community's own **Local Contexts
  Hub URI**, and the project can carry its Hub page, so the labels link back to
  the authoritative record rather than standing alone.
- **Named legal bases on claims, and a claim-letter generator.** A claim cites
  the instruments it rests on from a controlled vocabulary (NAGPRA, the 1970
  UNESCO and 1995 UNIDROIT Conventions, the 1954 Hague Convention, the
  Washington Principles, the HEAR Act, national patrimony law, ICOM ethics,
  colonial-collections policy, cultural patrimony), and the tool drafts a
  request-for-return letter to the current holder that names them.
- **Provenance gap analysis.** The chain of custody is charted as a coverage
  bar, and red flags are raised where a gap falls across a sensitive window:
  the 1933 to 1945 (Nazi-era) period, a dispersal event on the file, a chain
  too short to stand, or undated links. It appears on the card and in the
  dossier.
- **Dispersal events.** A shared event (a punitive expedition, a wartime
  looting, a market sale) that gathers objects scattered together, set on the
  chronology and counted in the statistics.
- **Exports.** A restitution dossier (print to PDF: a cover leaf, one object
  file per page with its custody chain, gap analysis, and claims, and the
  docket and index as appendices), a draft **claim letter**, a sought notice
  for circulation, a self-contained public file (.html), **Object ID records
  (.json)** in the Getty / ICOM standard for police and customs, a **CIDOC-CRM
  / JSON-LD** linked-data export an Arches instance can ingest, a docket
  spreadsheet (.csv), and public data (.json).
- **Carried over from Lacuna, almost wholesale.** Evidence hashed with sha-256
  and held to public, restricted, or embargoed consent; a register of sources
  whose identities never publish; an atlas with an offline gazetteer and an
  on-request OpenStreetMap lookup; a chronology; CSV import; serverless,
  human-decided merge; fixity checks; passphrase encryption of the working
  file at rest; struck-but-never-erased object files; and Arabic / right-to-left
  support.

[1.0.0]: https://github.com/mirl-ucsb/mirl-provenance/releases/tag/v1.0.0
