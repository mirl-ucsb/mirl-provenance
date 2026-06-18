#!/usr/bin/env python3
"""Generate the sample object file that ships with MIRL Provenance.

Everything here is invented: the Marrow Coast and its peoples, the fictional
Halvern punitive expedition of 1898, the dealers and museums named, and every
object and claim recorded. The sample exists so the tool opens with a worked
example; it makes no claim about any real person, place, community, object, or
event, and any resemblance is coincidental. The evidence images are drawn from
scratch with Pillow (flat, sepia, plainly synthetic), and each object's
sha-256 hashes are computed from the exact files written, so the sample
demonstrates evidential tethering with true hashes.

    python3 make-samples.py

Writes img/*.png, sample-project.json (for reading), and sample-data.js
(loaded by the page so the sample works even from file://). Needs Pillow.
"""

import base64
import hashlib
import io
import json
import os
import random

try:
    from PIL import Image, ImageDraw, ImageFilter
except ImportError:
    raise SystemExit("This script needs Pillow: python3 -m pip install Pillow")

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, "img")
os.makedirs(IMG, exist_ok=True)

R = random.Random(1898)  # the year of the fictional expedition; keeps output deterministic

PAPER = (236, 226, 205)
CREAM = (244, 237, 220)
DARK = (62, 48, 34)
MID = (122, 98, 70)
LIGHT = (196, 178, 148)
SHADOW = (88, 68, 48)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def vgrad(d, box, top, bottom):
    x0, y0, x1, y1 = box
    for y in range(y0, y1):
        d.line([(x0, y), (x1, y)], fill=lerp(top, bottom, (y - y0) / max(1, y1 - y0)))


def print_border(img, margin=36):
    """Mount the drawing inside a cream print border, like an old plate."""
    w, h = img.size
    out = Image.new("RGB", (w + 2 * margin, h + 2 * margin), CREAM)
    out.paste(img, (margin, margin))
    d = ImageDraw.Draw(out)
    d.rectangle([margin - 1, margin - 1, margin + w, margin + h], outline=MID, width=1)
    return out


def make_figure():
    """PRV-0001: a museum photograph of the carved ancestor figure."""
    w, h = 1000, 1300
    img = Image.new("RGB", (w, h), (40, 34, 28))
    d = ImageDraw.Draw(img)
    vgrad(d, (0, 0, w, h), (60, 52, 44), (28, 24, 20))     # studio backdrop
    cx = w // 2
    base = h - 150
    # plinth
    d.rectangle([cx - 150, base, cx + 150, base + 80], fill=(72, 60, 48))
    d.line([(cx - 150, base), (cx + 150, base)], fill=(96, 80, 64), width=3)
    # the body of the figure: a tall carved column, hands across the chest
    body = [(cx - 92, base), (cx - 70, base - 720), (cx - 36, base - 880),
            (cx + 36, base - 880), (cx + 70, base - 720), (cx + 92, base)]
    d.polygon(body, fill=(118, 86, 56))
    # carved banding down the body
    for yy in range(base - 700, base, 60):
        d.line([(cx - 78 - (base - yy) // 28, yy), (cx + 78 + (base - yy) // 28, yy)],
               fill=(92, 66, 44), width=4)
    # the head: an oval, downcast, with a high carved crest
    d.ellipse([cx - 96, base - 1010, cx + 96, base - 850], fill=(132, 98, 64))
    d.polygon([(cx - 70, base - 990), (cx, base - 1120), (cx + 70, base - 990)], fill=(118, 86, 56))
    # eyes and mouth incised, the calm frontal gaze of the form
    for ex in (cx - 40, cx + 40):
        d.ellipse([ex - 16, base - 950, ex + 16, base - 926], fill=(48, 36, 26))
    d.line([(cx - 26, base - 902), (cx + 26, base - 902)], fill=(48, 36, 26), width=5)
    # the arms folded, a darker incised band
    d.line([(cx - 84, base - 560), (cx + 84, base - 560)], fill=(80, 58, 40), width=22)
    return print_border(img, 30)


def make_auction():
    """PRV-0001 / PRV-0002: a page of a dealer's sale catalogue."""
    w, h = 1050, 1360
    img = Image.new("RGB", (w, h), CREAM)
    d = ImageDraw.Draw(img)
    vgrad(d, (0, 0, w, 90), (224, 212, 186), CREAM)
    # a framed plate at the top: the lot, a small dark figure
    px0, py0, px1, py1 = 360, 150, 690, 560
    d.rectangle([px0 - 10, py0 - 10, px1 + 10, py1 + 10], fill=(70, 58, 46))
    vgrad(d, (px0, py0, px1, py1), (150, 128, 100), (96, 78, 60))
    fx = (px0 + px1) // 2
    d.polygon([(fx - 34, py1 - 20), (fx - 22, py0 + 70), (fx + 22, py0 + 70), (fx + 34, py1 - 20)],
              fill=(54, 42, 30))
    d.ellipse([fx - 30, py0 + 30, fx + 30, py0 + 90], fill=(60, 46, 32))
    # the lot number and a block of catalogue text as ruled strokes
    d.line([(150, 640), (150, 700)], fill=MID, width=6)   # the "lot" stroke
    d.line([(180, 668), (260, 668)], fill=DARK, width=5)
    y = 740
    while y < h - 120:
        x = 150
        wide = R.randint(5, 9)
        for _ in range(wide):
            seg = R.randint(40, 130)
            d.line([(x, y), (x + seg, y)], fill=SHADOW, width=4)
            x += seg + R.randint(14, 26)
            if x > w - 200:
                break
        y += 48
    return print_border(img, 30)


def make_museum():
    """PRV-0001: the museum's accession card for the figure."""
    w, h = 1200, 820
    img = Image.new("RGB", (w, h), (240, 234, 219))
    d = ImageDraw.Draw(img)
    d.rectangle([40, 40, w - 40, h - 40], outline=(120, 100, 78), width=2)
    d.line([(40, 150), (w - 40, 150)], fill=(120, 100, 78), width=2)
    # a header block, "ACCESSION" as a bar
    d.rectangle([70, 86, 360, 120], fill=(150, 60, 46))
    # ruled rows with field labels (short bars) and hand entries (longer strokes)
    y = 200
    while y < h - 90:
        d.line([(70, y), (w - 70, y)], fill=(205, 190, 160), width=1)
        d.line([(90, y - 18), (230, y - 18)], fill=(150, 60, 46), width=4)   # field label
        x = 280
        for _ in range(R.randint(3, 7)):
            seg = R.randint(40, 140)
            d.line([(x, y - 18), (x + seg, y - 18)], fill=SHADOW, width=4)
            x += seg + R.randint(16, 30)
            if x > w - 160:
                break
        y += 70
    # the accession number, stamped at lower right
    d.rectangle([w - 360, h - 150, w - 90, h - 96], outline=(150, 60, 46), width=3)
    for i in range(6):
        d.line([(w - 340 + i * 40, h - 138), (w - 340 + i * 40, h - 108)], fill=(150, 60, 46), width=5)
    return print_border(img, 26)


def make_portrait():
    """PRV-0003: a copy print of the dispersed studio portrait."""
    w, h = 1100, 1320
    img = Image.new("RGB", (w, h), PAPER)
    d = ImageDraw.Draw(img)
    vgrad(d, (0, 0, w, h), (208, 190, 158), (150, 126, 96))
    img = img.filter(ImageFilter.GaussianBlur(16))
    d = ImageDraw.Draw(img)
    cx = w // 2
    base = h - 120
    # a seated sitter, formal
    d.polygon([(cx - 230, base), (cx - 150, base - 560), (cx + 150, base - 560), (cx + 230, base)],
              fill=(58, 46, 34))
    d.ellipse([cx - 110, base - 760, cx + 110, base - 540], fill=(126, 98, 70))   # face
    d.pieslice([cx - 120, base - 800, cx + 120, base - 560], 180, 360, fill=(44, 34, 24))  # hair
    # chair back
    d.rectangle([cx - 250, base - 360, cx - 220, base], fill=(70, 54, 38))
    d.rectangle([cx + 220, base - 360, cx + 250, base], fill=(70, 54, 38))
    return print_border(img)


def make_relief():
    """PRV-0004: a photograph of the limestone relief fragment."""
    w, h = 1280, 900
    img = Image.new("RGB", (w, h), (54, 46, 38))
    d = ImageDraw.Draw(img)
    # the slab
    sx0, sy0, sx1, sy1 = 120, 90, w - 120, h - 90
    vgrad(d, (sx0, sy0, sx1, sy1), (206, 192, 166), (168, 152, 124))
    # a broken right edge
    edge = [(sx1, sy0), (sx1 - 90, sy0 + 160), (sx1 - 30, sy0 + 340),
            (sx1 - 120, sy0 + 520), (sx1 - 40, sy1)]
    d.polygon([(sx1 + 10, sy0)] + edge + [(sx1 + 10, sy1)], fill=(54, 46, 38))
    # a carved profile figure in low relief, incised lines
    fx, fy = (sx0 + sx1) // 2 - 120, (sy0 + sy1) // 2
    d.line([(fx, fy - 230), (fx, fy + 230)], fill=(120, 104, 80), width=10)        # the standing line
    d.ellipse([fx - 70, fy - 300, fx + 70, fy - 170], outline=(120, 104, 80), width=8)  # head
    d.line([(fx, fy - 120), (fx + 130, fy - 60)], fill=(120, 104, 80), width=9)    # outstretched arm
    for yy in range(fy + 60, fy + 230, 36):                                        # robe folds
        d.line([(fx - 60, yy), (fx + 60, yy + 18)], fill=(150, 134, 108), width=5)
    # an incised band of fictional script along the top
    for bx in range(sx0 + 60, sx1 - 200, 70):
        d.rectangle([bx, sy0 + 50, bx + 40, sy0 + 96], outline=(120, 104, 80), width=4)
    return print_border(img, 26)


IMAGES = {
    "ancestor-figure.png": make_figure,
    "sale-catalogue.png": make_auction,
    "accession-card.png": make_museum,
    "studio-portrait.png": make_portrait,
    "relief-fragment.png": make_relief,
}

written = {}
for name, fn in IMAGES.items():
    path = os.path.join(IMG, name)
    fn().save(path, optimize=True)
    written[name] = path
    print("wrote", os.path.relpath(path, HERE))


def sha256_of(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def thumb_of(path):
    im = Image.open(path).convert("RGB")
    im.thumbnail((280, 280))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=72)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


_ev_n = [0]


def ev(evtype, label, name=None, url="", consent="public", rights="", note="", source=None):
    """An evidence item; when a shipped image is named, hash and thumb it."""
    _ev_n[0] += 1
    e = {"id": "ev-%02d" % _ev_n[0], "type": evtype, "label": label, "file": None,
         "url": url, "archived": "", "sha256": "", "rights": rights, "consent": consent,
         "until": "", "sourceId": source, "note": note, "thumb": ""}
    if name:
        path = written[name]
        e["file"] = {"name": name, "size": os.path.getsize(path), "type": "image/png"}
        e["sha256"] = sha256_of(path)
        e["thumb"] = thumb_of(path)
        e["url"] = "samples/img/" + name
        if not rights:
            e["rights"] = "sample illustration, plainly fictional"
    return e


_im_n = [0]


def im(institution, identifier="", iiif="", url="", note=""):
    _im_n[0] += 1
    return {"id": "im-%02d" % _im_n[0], "institution": institution,
            "identifier": identifier, "iiif": iiif, "url": url, "note": note}


_cu_n = [0]


def cu(date, holder, transfer="unknown", certainty="probable", note=""):
    _cu_n[0] += 1
    return {"id": "cu-%02d" % _cu_n[0], "date": date, "holder": holder,
            "transfer": transfer, "certainty": certainty, "note": note}


_cl_n = [0]


def cl(claimant, basis, status="preparing", date="", note="", bases=None):
    _cl_n[0] += 1
    return {"id": "cl-%02d" % _cl_n[0], "claimant": claimant, "basis": basis, "bases": bases or [],
            "status": status, "date": date, "note": note}


_id_n = [0]


def ident(scheme, value):
    _id_n[0] += 1
    return {"id": "id-%02d" % _id_n[0], "scheme": scheme, "value": value}


def tk(code, note="", community="", uri=""):
    return {"id": "tk-%s" % code.replace(" ", "").replace("(", "").replace(")", "").lower(),
            "code": code, "note": note, "community": community, "uri": uri}


T = "2026-06-15T12:00:00.000Z"


def care(collective="", authority="", responsibility="", ethics=""):
    return {"collective": collective, "authority": authority,
            "responsibility": responsibility, "ethics": ethics}


def rec(n, **kw):
    base = {
        "id": "PRV-%04d" % n,
        "titles": [{"text": "", "lang": ""}],
        "creator": "", "date": "", "objectType": "", "medium": "", "origin": "", "dimensions": "",
        "identifiers": [],
        "status": "documented", "certainty": "uncertain",
        "currentHolder": {"name": "", "since": "", "basis": "", "note": ""},
        "custody": [], "claims": [],
        "careNotes": care(), "tkLabels": [],
        "note": "", "tags": [],
        "eventId": None, "relations": [],
        "extent": {"amount": None, "unit": ""},
        "sightings": [], "statusHistory": [], "log": [],
        "location": {"place": "", "lat": None, "lon": None, "publish": "withheld"},
        "evidence": [], "images": [],
        "publish": True,   # the sample publishes its files so the dossier is full
        "struck": False,
        "created": T, "modified": T,
    }
    base.update(kw)
    return base


SOURCES = [
    {"id": "src-1", "alias": "a council elder",
     "name": "(invented; kept off the record in the sample)", "contact": "",
     "consent": "recorded 2024; the account is restricted at the council's request",
     "note": "speaks for the cultural council on the figure's standing"},
    {"id": "src-2", "alias": "a provenance researcher",
     "name": "(invented; kept off the record in the sample)", "contact": "",
     "consent": "consents to be named as a source by alias",
     "note": "traced the dealer records of the mid-twentieth century"},
]

EVENTS = [
    {"id": "evt-1", "name": "The Halvern punitive expedition", "date": "1898",
     "place": "the Marrow Coast",
     "note": "A fictional colonial expedition that burned the council house and removed "
             "its ritual furnishings. Objects entered the market through officers' "
             "estates over the following decades."},
    {"id": "evt-2", "name": "The 1962 Harradine sale", "date": "March 1962",
     "place": "London",
     "note": "The dispersal of the Harradine collection at auction, where several "
             "objects of the Marrow Coast were sold to institutions and dealers."},
]

LABELS = [
    {"id": "lbl-1", "code": "TK CC (local)", "name": "Council Consent",
     "gloss": "use of this object and its record requires the cultural council's consent.",
     "community": "the Marrow Coast cultural council"},
]

records = [
    rec(1,
        titles=[{"text": "Ancestor figure of the council house", "lang": "en"},
                {"text": "figure dite « du foyer »", "lang": "fr"}],
        creator="Marrow Coast, carver unrecorded", date="early 19th century",
        objectType="ancestor figure", medium="hardwood, pigment, fibre",
        origin="the Marrow Coast; the council house at Vell",
        dimensions="118 × 26 × 22 cm",
        identifiers=[ident("museum accession", "1962.41.7"),
                     ident("Harradine sale lot", "lot 112")],
        status="contested", certainty="probable",
        currentHolder={"name": "a national museum of world cultures", "since": "1962",
                       "basis": "purchased at the Harradine sale, 1962",
                       "note": "acquisition predates the museum's current provenance policy"},
        custody=[
            cu("about 1820", "the council house at Vell", "made / commissioned", "probable",
               "stood in the council house as an ancestor figure; the community's account"),
            cu("1898", "Captain E. Halvern", "looting / theft", "attested",
               "removed during the punitive expedition; named in the officer's published memoir"),
            cu("1899 to 1961", "the Harradine collection", "sale", "attested",
               "acquired from the Halvern estate; entry 41 in the Harradine catalogue"),
            cu("1962", "a national museum of world cultures", "purchase", "attested",
               "bought at the 1962 Harradine sale, lot 112"),
        ],
        claims=[
            cl("the Marrow Coast cultural council",
               "The figure was taken by force in the 1898 expedition, an act the community "
               "regards as theft; its return is sought under the museum's own restitution "
               "framework and the principle of cultural patrimony.",
               status="submitted", date="2024",
               bases=["colonial", "icom", "cultural"],
               note="a formal request was lodged with the museum in 2024; under review"),
        ],
        careNotes=care(
            collective="Return and, failing that, full digital access on the council's terms "
                       "benefit the community of origin, for whom the figure is an ancestor, "
                       "not an artwork.",
            authority="The Marrow Coast cultural council holds the authority to decide how "
                      "the figure and this record are used, shown, and described.",
            responsibility="The compiler keeps this file in consultation with the council and "
                           "defers to it on what may be shown.",
            ethics="The figure is treated as a living relation. Its image is shown here only "
                   "with the council's standing consent for the restitution effort."),
        tkLabels=[tk("TK CL", community="the Marrow Coast cultural council"),
                  tk("TK CS"),
                  tk("BC P", community="the Marrow Coast cultural council",
                     uri="https://localcontexts.org/label/bc-provenance/"),
                  tk("TK CC (local)",
                     note="use of this object and its record requires the council's consent",
                     community="the Marrow Coast cultural council",
                     uri="https://localcontexts.org/")],
        note=("The central object of this file. Carved for the council house at Vell, "
              "removed in the 1898 expedition, and sold through a colonial estate into the "
              "Harradine collection, from which a national museum bought it in 1962. The "
              "community seeks its return.\n\nThe museum's accession card and the 1962 sale "
              "catalogue both survive and are entered as evidence."),
        tags=["ancestor figure", "colonial dispersal", "restitution"],
        eventId="evt-1",
        location={"place": "the museum, a European capital", "lat": 52.37, "lon": 4.90, "publish": "approximate"},
        evidence=[
            ev("photograph", "Museum photograph of the figure", name="ancestor-figure.png",
               note="the museum's own image, used here for the claim"),
            ev("accession record", "Museum accession card, 1962.41.7", name="accession-card.png",
               note="records the purchase at the Harradine sale"),
            ev("catalogue", "Harradine sale catalogue, 1962, lot 112", name="sale-catalogue.png",
               note="the lot entry, with a plate of the figure"),
            ev("testimony", "Account of a council elder, recorded 2024", consent="restricted",
               source="src-1", note="held for the council; not for publication"),
        ],
        images=[
            im("a national museum of world cultures", "1962.41.7",
               url="samples/img/ancestor-figure.png",
               note="the museum's online record; the Look button opens the image"),
        ]),

    rec(2,
        titles=[{"text": "Illuminated Qur'an leaf", "lang": "en"},
                {"text": "ورقة من مصحف", "lang": "ar"}],
        creator="copyist unrecorded", date="14th century",
        objectType="manuscript leaf", medium="ink, gold, and pigment on parchment",
        origin="a mosque library, dispersed in wartime",
        dimensions="34 × 25 cm",
        identifiers=[ident("dealer stock", "MS-2204")],
        status="claim-filed", certainty="attested",
        currentHolder={"name": "a private collection", "since": "1991",
                       "basis": "purchased from a dealer", "note": ""},
        custody=[
            cu("to 1990", "a mosque library", "made / commissioned", "probable",
               "one of a known group of leaves from a single manuscript"),
            cu("1990 to 1991", "a dealer in manuscripts", "looting / theft", "probable",
               "appeared on the market shortly after the library was emptied in wartime"),
            cu("1991", "a private collection", "purchase", "attested",
               "bought in good faith; the buyer now supports the return"),
        ],
        claims=[
            cl("the library's successor institution",
               "The leaf is one of a documented group dispersed when the library was looted; "
               "reunification of the manuscript is sought.",
               status="negotiating", date="2025",
               bases=["unesco1970", "unidroit1995", "hague1954"],
               note="the current holder is in correspondence about a return"),
        ],
        note=("A single leaf from a manuscript dispersed when its library was looted in "
              "wartime. The current holder, who bought it unknowingly, now supports its "
              "return to the reconstituted collection."),
        tags=["manuscript", "looting", "Middle East", "reunification"],
        location={"place": "a private collection", "lat": None, "lon": None, "publish": "withheld"},
        sightings=[
            {"id": "sg-01", "date": "1991", "kind": "dealer stock", "bearing": "complicates",
             "place": "London", "sourceId": "src-2",
             "note": "offered as stock MS-2204, with no provenance before 1991"},
        ],
        evidence=[
            ev("citation", "Catalogue of the dispersed leaves, 2019",
               note="lists this leaf among the known group; transcribed"),
        ]),

    rec(3,
        titles=[{"text": "Studio portrait of an unnamed family", "lang": "en"}],
        creator="a coastal studio", date="about 1905",
        objectType="photograph", medium="albumen print, mounted",
        origin="the Marrow Coast",
        dimensions="21 × 16 cm on a 30 × 24 cm mount",
        identifiers=[ident("museum accession", "1962.41.50")],
        status="located", certainty="attested",
        currentHolder={"name": "a national museum of world cultures", "since": "1962",
                       "basis": "part of the Harradine purchase", "note": ""},
        custody=[
            cu("about 1905", "the family portrayed", "made / commissioned", "probable", ""),
            cu("1899 to 1961", "the Harradine collection", "unknown", "uncertain",
               "how it entered the collection is not recorded"),
            cu("1962", "a national museum of world cultures", "purchase", "attested",
               "part of the same 1962 purchase as PRV-0001"),
        ],
        note=("A studio portrait acquired with the same 1962 purchase. Located and "
              "documented; the sitters are unnamed, and the council asks that any "
              "publication wait until descendants can be consulted."),
        tags=["photograph", "studio portrait", "colonial dispersal"],
        eventId="evt-2",
        relations=[{"type": "related", "target": "PRV-0001"}],
        tkLabels=[tk("TK CV", community="the Marrow Coast cultural council"),
                  tk("TK NV")],
        careNotes=care(
            authority="The council asks to identify the sitters before the portrait is "
                      "published or exhibited.",
            ethics="Held located but unpublished pending consultation with possible descendants."),
        publish=False,
        evidence=[
            ev("photograph", "Copy print of the portrait", name="studio-portrait.png",
               consent="restricted",
               note="held back pending consultation; restricted in the sample"),
        ]),

    rec(4,
        titles=[{"text": "Limestone relief fragment with a standing figure", "lang": "en"}],
        creator="unrecorded", date="antiquity",
        objectType="architectural relief", medium="carved limestone",
        origin="an excavated site, exported without record",
        dimensions="44 × 38 × 9 cm",
        status="contested", certainty="uncertain",
        currentHolder={"name": "a regional museum", "since": "1978",
                       "basis": "gift of a private collector", "note": "no export licence on file"},
        custody=[
            cu("antiquity", "an architectural setting", "made / commissioned", "probable", ""),
            cu("about 1970", "a private collector", "excavation", "uncertain",
               "said to have come from a site cleared without record"),
            cu("1978", "a regional museum", "gift", "attested",
               "given by the collector; no documentation of lawful export"),
        ],
        claims=[
            cl("the country of origin's antiquities service",
               "The fragment lacks any record of lawful export and is claimed under the "
               "1970 UNESCO Convention framework.",
               status="preparing", date="2026",
               bases=["unesco1970", "patrimony"],
               note="a request is being prepared; the museum has been notified"),
        ],
        note=("A relief fragment with no documented export. Its right edge is broken, "
              "suggesting it was cut from a larger setting. The case is at an early stage."),
        tags=["antiquities", "relief", "1970 UNESCO Convention"],
        location={"place": "a regional museum", "lat": None, "lon": None, "publish": "withheld"},
        sightings=[
            {"id": "sg-02", "date": "1974", "kind": "exhibition", "bearing": "supports",
             "place": "a dealer's gallery", "sourceId": "src-2",
             "note": "shown before the 1978 gift; the first record of it on the market"},
        ],
        evidence=[
            ev("photograph", "Photograph of the fragment", name="relief-fragment.png",
               note="photographed in the museum store, 2025"),
        ]),

    rec(5,
        titles=[{"text": "Set of council regalia, dispersed", "lang": "en"}],
        creator="Marrow Coast", date="19th century",
        objectType="regalia (multiple objects)", medium="brass, beadwork, fibre, wood",
        origin="the council house at Vell",
        status="dispersed", certainty="probable",
        currentHolder={"name": "several collections", "since": "after 1898",
                       "basis": "various", "note": "whereabouts of most pieces unknown"},
        custody=[
            cu("to 1898", "the council house at Vell", "made / commissioned", "probable", ""),
            cu("1898", "members of the expedition", "looting / theft", "probable",
               "the regalia was divided among the party, by the same memoir"),
        ],
        claims=[
            cl("the Marrow Coast cultural council",
               "The regalia belongs with the ancestor figure (PRV-0001) and is sought as a "
               "single body, wherever its pieces are found.",
               status="preparing",
               bases=["colonial", "cultural"],
               note="a standing claim; pieces are added to this file as they surface"),
        ],
        note=("A body of dispersed objects rather than a single thing. Counted here so the "
              "statistics can answer in objects. Individual pieces, as they are located, are "
              "given their own files and related to this one."),
        tags=["regalia", "colonial dispersal", "body of objects"],
        eventId="evt-1",
        extent={"amount": 24, "unit": "objects"},
        relations=[{"type": "related", "target": "PRV-0001"}],
        tkLabels=[tk("BC MP", community="the Marrow Coast cultural council")]),

    rec(6,
        titles=[{"text": "Ancestor figure (entered twice)", "lang": "en"}],
        creator="Marrow Coast", date="early 19th century",
        objectType="ancestor figure", medium="hardwood",
        origin="the council house at Vell",
        status="contested", certainty="probable",
        note=("Entered a second time by mistake; the figure is recorded at PRV-0001. Struck "
              "rather than erased, in the ledger's manner, so the numbering stands."),
        tags=["duplicate"],
        eventId="evt-1", publish=False,
        relations=[{"type": "related", "target": "PRV-0001"}],
        struck=True),
]

project = {
    "title": "Object files of the Marrow Coast",
    "subtitle": "a worked example, entirely fictional",
    "compiler": "the sample compiler",
    "institution": "MIRL Provenance sample data",
    "contact": "",
    "siglum": "PRV",
    "localContexts": "https://localcontexts.org/",
    "events": EVENTS,
    "sources": SOURCES,
    "labels": LABELS,
    "note": ("Everything in this file is invented: the Marrow Coast and its peoples, the "
             "1898 Halvern expedition, the dealers and museums named, and every object and "
             "claim recorded. It exists to show how MIRL Provenance works. Any resemblance "
             "to real people, places, communities, objects, or events is coincidental. The "
             "CARE notes and TK / BC Labels here are illustrative; in real use they are "
             "placed by or with the community of origin."),
    "created": T,
    "modified": T,
}

data = {"format": "mirl-provenance", "version": 1, "project": project, "records": records}

with open(os.path.join(HERE, "sample-project.json"), "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write("\n")
print("wrote sample-project.json")

js = ("/* sample-data.js: the fictional sample object file, generated by\n"
      "   samples/make-samples.py. Loaded as a script so the sample opens\n"
      "   even from file://, where fetch() cannot read local JSON. */\n"
      "window.PV = window.PV || {};\n"
      "PV.SAMPLE = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
with open(os.path.join(HERE, "sample-data.js"), "w", encoding="utf-8") as f:
    f.write(js)
print("wrote sample-data.js")
