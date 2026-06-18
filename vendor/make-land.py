#!/usr/bin/env python3
"""Regenerate vendor/land.js, the world coastline drawn in the Atlas view.

Source: Natural Earth 1:110m "land" (public domain), packaged as TopoJSON by
the world-atlas project. This script downloads it (or reads a local copy),
decodes the TopoJSON arcs, projects every ring to a plain equirectangular
1000 x 500 canvas, and writes the result as one SVG path string:

    python3 make-land.py            # downloads land-110m.json
    python3 make-land.py FILE.json  # converts a local copy

Build-time only; the app itself never touches the network.
"""

import json
import sys
import urllib.request

URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json"
W, H = 1000.0, 500.0


def load(arg):
    if arg:
        with open(arg) as f:
            return json.load(f)
    with urllib.request.urlopen(URL) as r:
        return json.loads(r.read().decode("utf-8"))


def decode_arcs(topo):
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx
            y += dy
            pts.append((x * sx + tx, y * sy + ty))
        arcs.append(pts)
    return arcs


def ring_points(ring, arcs):
    pts = []
    for idx in ring:
        seg = arcs[idx] if idx >= 0 else list(reversed(arcs[~idx]))
        pts.extend(seg if not pts else seg[1:])
    return pts


def project(lon, lat):
    return ((lon + 180.0) / 360.0 * W, (90.0 - lat) / 180.0 * H)


def ring_path(pts):
    out, last = [], None
    for lon, lat in pts:
        x, y = project(lon, lat)
        p = (round(x, 1), round(y, 1))
        if p == last:
            continue
        out.append(("M" if last is None else "L") + ("%g %g" % p))
        last = p
    return "".join(out) + "Z" if len(out) > 2 else ""


def main():
    topo = load(sys.argv[1] if len(sys.argv) > 1 else None)
    arcs = decode_arcs(topo)
    land = topo["objects"]["land"]
    geoms = land["geometries"] if land["type"] == "GeometryCollection" else [land]
    polys = []
    for g in geoms:
        polys.extend(g["arcs"] if g["type"] == "MultiPolygon" else [g["arcs"]])
    path = "".join(ring_path(ring_points(ring, arcs))
                   for poly in polys for ring in poly)
    js = ("/* land.js: world coastline for the Atlas view, drawn as one SVG path\n"
          "   on a 1000 x 500 equirectangular canvas. Natural Earth 1:110m land\n"
          "   (public domain) via the world-atlas package; regenerate with\n"
          "   vendor/make-land.py. */\n"
          "window.LC = window.LC || {};\n"
          'LC.LAND = "' + path + '";\n')
    with open("land.js" if "/" not in __file__ else __file__.rsplit("/", 1)[0] + "/land.js", "w") as f:
        f.write(js)
    print("wrote land.js (%d KB, %d rings)" % (len(js) // 1024, path.count("Z")))


if __name__ == "__main__":
    main()
