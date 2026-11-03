"""Discover the mood axes from Claude's adjective ratings.

Usage: .venv/Scripts/python scripts/factor.py [--max-k 6] [--min-k 2] [--names names.json]

Reads  data/catalog/ratings.jsonl        (one line per work: objectID, ratings{adjective: 1..7})
       data/catalog/embeddings.npz       (CLIP embeddings, for works the rater skipped)
       data/catalog/objects.jsonl, src/data/paintings.json (which works are in the app)
       scripts/llm/axis-names.json       (optional: hand-finalized names and phrases per factor)
Writes src/data/axes.json                (the discovered axes with words, phrases and loadings)
       src/data/rooms-affinity.json      (mean factor scores per room)
       src/data/paintings.json           (mood vectors rewritten in the new axes)
       src/data/factor-stats.json        (scree, noise line, loadings, coverage, for the About page)

Method: standardize the N x 40 rating matrix; parallel analysis (eigenvalues of the correlation
matrix against the 95th percentile of 200 shuffled copies) picks k; principal-axis extraction via
SVD; varimax rotation; factor scores by regression; scores standardized to [-1, 1] per axis
(median 0, 90th percentile of |x| to 1). Works without a rating get scores from a ridge regression
CLIP-embedding -> factor scores fitted on the rated works.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "catalog"
ADJ = json.loads((ROOT / "scripts" / "llm" / "adjectives.json").read_text(encoding="utf-8"))


def parallel_analysis(z: np.ndarray, reps: int = 200, pct: float = 95, seed: int = 7) -> tuple[np.ndarray, np.ndarray]:
    n, p = z.shape
    corr = np.corrcoef(z, rowvar=False)
    eig = np.sort(np.linalg.eigvalsh(corr))[::-1]
    rng = np.random.default_rng(seed)
    noise = np.empty((reps, p))
    for r in range(reps):
        shuffled = np.column_stack([rng.permutation(z[:, j]) for j in range(p)])
        noise[r] = np.sort(np.linalg.eigvalsh(np.corrcoef(shuffled, rowvar=False)))[::-1]
    return eig, np.percentile(noise, pct, axis=0)


def varimax(L: np.ndarray, gamma: float = 1.0, iters: int = 200, tol: float = 1e-6) -> np.ndarray:
    p, k = L.shape
    R = np.eye(k)
    d = 0.0
    for _ in range(iters):
        Lr = L @ R
        u, s, vt = np.linalg.svd(L.T @ (Lr**3 - (gamma / p) * Lr @ np.diag(np.sum(Lr**2, axis=0))))
        R = u @ vt
        d_new = s.sum()
        if d_new < d * (1 + tol):
            break
        d = d_new
    return L @ R


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-k", type=int, default=6)
    ap.add_argument("--min-k", type=int, default=2)
    ap.add_argument("--force-k", type=int, default=0)
    args = ap.parse_args()

    rows = [json.loads(l) for l in (CATALOG / "ratings.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
    ids = np.array([r["objectID"] for r in rows])
    X = np.array([[r["ratings"][a] for a in ADJ] for r in rows], dtype=float)
    print(f"{len(rows)} rated works x {len(ADJ)} adjectives")

    mean = X.mean(0)
    std = X.std(0)
    std[std == 0] = 1
    Z = (X - mean) / std

    eig, noise = parallel_analysis(Z)
    k = int(np.sum(eig > noise))
    k = max(args.min_k, min(args.max_k, k))
    if args.force_k:
        k = args.force_k
    print("eigenvalues", np.round(eig[:10], 2))
    print("noise line ", np.round(noise[:10], 2))
    print(f"k = {k}")

    # Principal-axis extraction on the correlation matrix, then varimax.
    corr = np.corrcoef(Z, rowvar=False)
    vals, vecs = np.linalg.eigh(corr)
    order = np.argsort(vals)[::-1]
    vals, vecs = vals[order], vecs[:, order]
    L = vecs[:, :k] * np.sqrt(vals[:k])  # p x k loadings
    L = varimax(L)
    # Sign convention: each factor's largest absolute loading is positive.
    for j in range(k):
        if L[np.argmax(np.abs(L[:, j])), j] < 0:
            L[:, j] *= -1
    # Order factors by variance explained after rotation.
    var = (L**2).sum(0)
    order = np.argsort(var)[::-1]
    L = L[:, order]
    var = var[order]
    explained = var / len(ADJ)

    # Hand-chosen orientation: a factor may read better with its poles swapped ("flip" in axis-names.json).
    names_path = ROOT / "scripts" / "llm" / "axis-names.json"
    names = json.loads(names_path.read_text(encoding="utf-8")) if names_path.exists() else []
    for j in range(k):
        if j < len(names) and names[j].get("flip"):
            L[:, j] *= -1

    # Regression scores: Z @ inv(R) @ L
    W = np.linalg.solve(corr, L)
    S = Z @ W  # n x k raw scores

    # Standardize to [-1, 1] per axis.
    med = np.median(S, axis=0)
    scale = np.percentile(np.abs(S - med), 90, axis=0)
    scale[scale == 0] = 1
    scores = np.clip((S - med) / scale, -1, 1)

    # Name drafts from loadings.
    drafts = []
    for j in range(k):
        o = np.argsort(L[:, j])
        pos = [ADJ[i] for i in o[::-1][:4]]
        neg = [ADJ[i] for i in o[:4]]
        drafts.append({"positive": pos, "negative": neg})
        print(f"factor {j + 1}: {explained[j]*100:.1f}% | + {', '.join(pos)} | - {', '.join(neg)}")

    # Hand-finalized names and phrases, if present; otherwise draft ids and words.
    axes = []
    for j in range(k):
        d = drafts[j]
        n = names[j] if j < len(names) else {}
        axes.append({
            "id": n.get("id", f"f{j + 1}"),
            "name": n.get("name", f"{d['positive'][0]} vs {d['negative'][0]}"),
            "topic": n.get("topic", f"{d['positive'][0]} or {d['negative'][0]}"),
            "positive": n.get("positive", {"word": d["positive"][0].capitalize(), "tail": d["positive"][0], "lead": f"you're feeling {d['positive'][0]}", "valence": 0}),
            "negative": n.get("negative", {"word": d["negative"][0].capitalize(), "tail": d["negative"][0], "lead": f"you're feeling {d['negative'][0]}", "valence": 0}),
            "neutral": n.get("neutral", {"word": "Even", "tail": "even", "lead": "you're somewhere in between"}),
            "loadings": {ADJ[i]: round(float(L[i, j]), 3) for i in range(len(ADJ))},
            "explained": round(float(explained[j]), 4),
            "topPositive": d["positive"],
            "topNegative": d["negative"],
        })
    axis_ids = [a["id"] for a in axes]

    # Scores for works the rater skipped: ridge regression from CLIP embeddings.
    emb = np.load(CATALOG / "embeddings.npz")
    emb_ids = emb["ids"].astype(int)
    E = emb["embeddings"].astype(float)
    idx = {int(i): r for r, i in enumerate(emb_ids)}
    rated = {int(i): r for r, i in enumerate(ids)}
    common = [i for i in rated if i in idx]
    Xe = np.column_stack([E[[idx[i] for i in common]], np.ones(len(common))])
    Y = scores[[rated[i] for i in common]]
    lam = 1.0
    A = Xe.T @ Xe + lam * np.eye(Xe.shape[1])
    B = np.linalg.solve(A, Xe.T @ Y)
    pred = Xe @ B
    r2 = 1 - ((Y - pred) ** 2).sum(0) / ((Y - Y.mean(0)) ** 2).sum(0)
    print("CLIP -> factor R^2 per axis", np.round(r2, 2))

    def score_for(oid: int) -> list[float] | None:
        if oid in rated:
            return [round(float(v), 3) for v in scores[rated[oid]]]
        if oid in idx:
            v = np.clip(np.append(E[idx[oid]], 1.0) @ B, -1, 1)
            return [round(float(x), 3) for x in v]
        return None

    # Rewrite the app's paintings.
    paintings = json.loads((ROOT / "src" / "data" / "paintings.json").read_text(encoding="utf-8"))
    kept = []
    fallback = 0
    for p in paintings:
        v = score_for(int(p["objectID"]))
        if v is None:
            continue
        if int(p["objectID"]) not in rated:
            fallback += 1
        p["mood"] = {axis_ids[j]: v[j] for j in range(k)}
        strongest = sorted(range(k), key=lambda j: -abs(v[j]))[:3]
        p["tags"] = [(axes[j]["positive"]["word"] if v[j] > 0 else axes[j]["negative"]["word"]) for j in strongest]
        p["source"] = "curated" if p.get("why") else ("clip-regression" if int(p["objectID"]) not in rated else "claude")
        kept.append(p)
    (ROOT / "src" / "data" / "paintings.json").write_text(json.dumps(kept, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(kept)} paintings ({fallback} scored by the CLIP regression)")

    # Room affinities and per-room spread.
    rooms: dict[str, list] = {}
    for p in kept:
        rooms.setdefault(p["room"], []).append([p["mood"][a] for a in axis_ids])
    affinity = {}
    spread = {}
    for room, vs in rooms.items():
        m = np.array(vs)
        affinity[room] = {axis_ids[j]: round(float(m[:, j].mean()), 3) for j in range(k)}
        spread[room] = {axis_ids[j]: round(float(m[:, j].std()), 3) for j in range(k)}
        top = sorted(axis_ids, key=lambda a: -spread[room][a])[:2]
        print(f"{room:22s} affinity {affinity[room]}  most varied: {top}")
    (ROOT / "src" / "data" / "rooms-affinity.json").write_text(json.dumps(affinity, indent=2) + "\n", encoding="utf-8")

    (ROOT / "src" / "data" / "axes.json").write_text(json.dumps({"k": k, "axes": axes}, indent=2) + "\n", encoding="utf-8")

    corr_axes = np.corrcoef(scores.T).round(3).tolist()
    stats = {
        "rated": int(len(rows)),
        "adjectives": ADJ,
        "k": k,
        "eigenvalues": [round(float(x), 3) for x in eig],
        "noiseLine": [round(float(x), 3) for x in noise],
        "explained": [round(float(x), 4) for x in explained],
        "loadings": [[round(float(L[i, j]), 3) for j in range(k)] for i in range(len(ADJ))],
        "axisCorrelation": corr_axes,
        "clipRegressionR2": [round(float(x), 3) for x in r2],
        "fallbackScored": fallback,
        "roomSpread": spread,
        "meteredCostUsd": round(float(sum((r.get("cost") or 0) for r in rows)), 2),
    }
    (ROOT / "src" / "data" / "factor-stats.json").write_text(json.dumps(stats) + "\n", encoding="utf-8")
    print("wrote axes.json, rooms-affinity.json, factor-stats.json")


if __name__ == "__main__":
    main()
