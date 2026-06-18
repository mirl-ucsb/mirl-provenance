#!/usr/bin/env python3
"""Regenerate vendor/gazetteer.js, the offline place index used to turn a
typed place name into a point on the Atlas without anyone entering latitude
and longitude by hand.

Source: GeoNames (https://www.geonames.org), licensed CC BY 4.0. Two public
dumps:
    cities15000.txt  (cities with population over 15,000)
    countryInfo.txt  (country names and capitals, for a country-level fallback)

This reads local copies (download them once from
https://download.geonames.org/export/dump/) and writes a compact gazetteer:

    python3 make-gazetteer.py [cities15000.txt] [countryInfo.txt]

The app itself never touches the network for this; the index is bundled.
Coordinates are rounded to two decimals (about a kilometre), which is ample
for a city-level, deliberately approximate placement.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CITIES = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "cities15000.txt")
COUNTRIES = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "countryInfo.txt")


def round2(s):
    try:
        return ("%.2f" % float(s)).rstrip("0").rstrip(".")
    except ValueError:
        return "0"


def build_cities():
    rows = []
    capitals = {}  # country code -> "lat,lon" from the capital (feature code PPLC)
    with open(CITIES, encoding="utf-8") as f:
        for line in f:
            c = line.rstrip("\n").split("\t")
            if len(c) < 15:
                continue
            name, ascii_name = c[1], c[2]
            lat, lon = round2(c[4]), round2(c[5])
            feature, cc = c[7], c[8]
            try:
                pop = int(c[14] or 0)
            except ValueError:
                pop = 0
            rows.append((pop, name, ascii_name, cc, lat, lon))
            if feature == "PPLC" and cc not in capitals:
                capitals[cc] = lat + "," + lon
    rows.sort(key=lambda r: -r[0])  # biggest first, so the first match wins
    out = []
    for pop, name, ascii_name, cc, lat, lon in rows:
        # store the ascii name only when it differs, to save space; population
        # is not stored, the row order (most populous first) carries the rank
        an = "" if ascii_name == name else ascii_name
        out.append("\t".join([name, an, cc, lat, lon]))
    return out, capitals


def build_countries(capitals):
    # country (and a few demonyms left aside) -> "lat,lon", via the capital
    out = {}
    with open(COUNTRIES, encoding="utf-8") as f:
        for line in f:
            if line.startswith("#"):
                continue
            c = line.rstrip("\n").split("\t")
            if len(c) < 6:
                continue
            iso, country = c[0], c[4]
            if iso in capitals and country:
                out[country] = capitals[iso]
    return out


def js_string(s):
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n") + '"'


def main():
    cities, capitals = build_cities()
    countries = build_countries(capitals)
    body = "\n".join(cities)
    ckeys = ",".join(js_string(k) + ":" + js_string(v) for k, v in sorted(countries.items()))
    js = (
        "/* gazetteer.js: an offline place index, so typing a place name (a city,\n"
        "   or a specific place whose name ends in a known city) can be set on the\n"
        "   Atlas without entering coordinates by hand. Bundled so the app stays\n"
        "   local-first: resolving a place sends nothing anywhere. Built from\n"
        "   GeoNames (CC BY 4.0) by vendor/make-gazetteer.py; coordinates rounded\n"
        "   to about a kilometre. Each city row is name, ascii name (when it\n"
        "   differs), country code, lat, lon; rows run most-populous first. */\n"
        "window.LC = window.LC || {};\n"
        "LC.GAZ = " + js_string(body) + ";\n"
        "LC.GAZ_COUNTRIES = {" + ckeys + "};\n"
    )
    out = os.path.join(HERE, "gazetteer.js")
    with open(out, "w", encoding="utf-8") as f:
        f.write(js)
    print("wrote gazetteer.js: %d cities, %d countries, %d KB"
          % (len(cities), len(countries), len(js) // 1024))


if __name__ == "__main__":
    main()
