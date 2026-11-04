"""
Why each work carries its tags.

For every work in src/data/paintings.json that the rater saw, and for each of its three tags,
find the two adjectives whose standardized rating contributed most to the work's score on that
tag's axis, in the tag's direction (contribution = loading x z-score, signed by the pole). The
pairs (adjective index, raw 1 to 7 rating) are written to the work's `ev` field, so the app can
say "Everyday: worldly 6, sacred 1" under a painting without shipping the ratings themselves.

Reads:  data/catalog/ratings.jsonl, src/data/factor-stats.json, src/data/axes.json
Writes: src/data/paintings.json (adds / refreshes `ev`)

Run after scripts/factor.py:  .venv/Scripts/python scripts/evidence.py
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "catalog"


def main() -> None:
    stats = json.loads((ROOT / "src" / "data" / "factor-stats.json").read_text(encoding="utf-8"))
    axes = json.loads((ROOT / "src" / "data" / "axes.json").read_text(encoding="utf-8"))["axes"]
    adj: list[str] = stats["adjectives"]
    L = np.array(stats["loadings"], dtype=float)  # adjectives x k, already oriented like axes.json
    k = L.shape[1]
    assert k == len(axes)

    rows = [json.loads(line) for line in (CATALOG / "ratings.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]
    ids = np.array([int(r["objectID"]) for r in rows])
    X = np.array([[r["ratings"][a] for a in adj] for r in rows], dtype=float)
    mean = X.mean(0)
    std = X.std(0)
    std[std == 0] = 1
    Z = (X - mean) / std
    row_of = {int(i): n for n, i in enumerate(ids)}

    path = ROOT / "src" / "data" / "paintings.json"
    paintings = json.loads(path.read_text(encoding="utf-8"))
    axis_ids = [a["id"] for a in axes]
    done = 0
    for p in paintings:
        n = row_of.get(int(p["objectID"]))
        if n is None:
            p.pop("ev", None)
            continue
        v = [p["mood"][a] for a in axis_ids]
        strongest = sorted(range(k), key=lambda j: -abs(v[j]))[:3]
        ev: list[list[int]] = []
        for j in strongest:
            sign = 1.0 if v[j] > 0 else -1.0
            contrib = sign * L[:, j] * Z[n]
            top = np.argsort(contrib)[::-1][:2]
            pairs: list[int] = []
            for i in top:
                pairs += [int(i), int(X[n, i])]
            ev.append(pairs)
        p["ev"] = ev
        done += 1
    path.write_text(json.dumps(paintings, indent=2) + "\n", encoding="utf-8")
    print(f"evidence written for {done} of {len(paintings)} works")

    # The app turns a rating into "more X" or "less X" by comparing it with the catalog mean.
    stats["adjectiveMeans"] = [round(float(m), 2) for m in mean]
    (ROOT / "src" / "data" / "factor-stats.json").write_text(json.dumps(stats) + "\n", encoding="utf-8")

    # Spot check.
    for oid in (436158, 436535):
        p = next((q for q in paintings if int(q["objectID"]) == oid), None)
        if not p or "ev" not in p:
            continue
        def word(i: int, r: int) -> str:
            return f"{'more' if r > mean[i] else 'less'} {adj[i]} ({r} vs {mean[i]:.1f})"
        print(p["title"], "|", "; ".join(f"{t}: {word(e[0], e[1])}, {word(e[2], e[3])}" for t, e in zip(p["tags"], p["ev"])))


if __name__ == "__main__":
    main()
