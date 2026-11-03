"""Embed the catalog images with CLIP and project them onto the five mood axes.

Usage: .venv/Scripts/python scripts/embed.py [--per-room 220]

Reads  data/catalog/objects.jsonl and data/catalog/img/<id>.jpg
Writes data/catalog/embeddings.npz          (image embeddings, ids)
       data/catalog/axes.json               (axis directions, calibration numbers)
       src/data/paintings.json              (curated records first, then the catalog picks)
       src/data/embedding-stats.json        (numbers and 2D coordinates for the About page)

How the five axes come out of CLIP: each axis has a positive and a negative pole described by
several short sentences. Both poles are embedded with the text encoder and averaged; the axis
direction is the difference of the two unit means. An image's raw score on an axis is the dot
product of its unit embedding with that direction. Raw scores are then standardized over the
whole catalog (median to 0, 90th percentile of |score| to 1) and clipped to [-1, 1], so every
axis uses the full range and the hand-curated vectors stay comparable.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import torch
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "catalog"
IMG = CATALOG / "img"

AXES = ["energy", "warmth", "outlook", "focus", "social"]

# Positive pole first, negative pole second. Plain descriptions of what a picture feels like.
POLES = {
    "energy": (
        ["a restless, energetic painting full of motion",
         "a dramatic scene with action and tension",
         "a busy, lively image with a lot going on"],
        ["a calm, still, quiet painting",
         "a serene, peaceful scene with nothing moving",
         "a slow, tranquil image that feels like rest"],
    ),
    "warmth": (
        ["a warm painting in golden sunlight, reds and ochres",
         "a cozy, warm-toned image",
         "a sunlit scene with warm colors"],
        ["a cool painting in blues, greys and silver",
         "a cold, pale, cool-toned image",
         "an overcast scene with cool colors"],
    ),
    "outlook": (
        ["a hopeful, bright, uplifting painting",
         "a joyful scene full of light and promise",
         "an optimistic image that feels like a good day"],
        ["a heavy, somber, melancholy painting",
         "a dark scene of grief or worry",
         "a sad, weighty image"],
    ),
    "focus": (
        ["an inward, introspective painting of a single quiet figure or object",
         "a private, contemplative image with a close focus",
         "a solitary subject seen up close, turned inward"],
        ["an outward-looking painting of a wide landscape or a crowd",
         "a sweeping scene that looks out at the world",
         "a panoramic view with distance and open space"],
    ),
    "social": (
        ["a painting of people together, company and conversation",
         "a crowded, convivial scene of a gathering",
         "a warm group portrait of friends or family"],
        ["a painting of solitude, one person alone",
         "an empty, lonely scene with nobody in it",
         "a quiet image of being by yourself"],
    ),
}

ROOM_PLAN = {
    "european-paintings": "eurp",
    "nineteenth-century": "c19",
    "american-wing": "amer",
    "arms-and-armor": "arms",
    "egyptian-art": "egypt",
    "asian-art": "asian",
    "greek-and-roman": "greek",
}
INNER = {"822": "g822"}
DENDUR = {"131"}


def load_records() -> list[dict]:
    recs = []
    with open(CATALOG / "objects.jsonl", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            r = json.loads(line)
            if r.get("skip") or not r.get("image"):
                continue
            if (IMG / f"{r['objectID']}.jpg").exists():
                recs.append(r)
    return recs


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-room", type=int, default=220)
    ap.add_argument("--model", default="ViT-B-32")
    ap.add_argument("--pretrained", default="laion2b_s34b_b79k")
    args = ap.parse_args()

    import open_clip

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"device {device}, model {args.model} {args.pretrained}")
    model, _, preprocess = open_clip.create_model_and_transforms(args.model, pretrained=args.pretrained)
    model = model.to(device).eval()
    tokenizer = open_clip.get_tokenizer(args.model)

    # Axis directions from the text encoder.
    axes_dir = []
    pole_means = {}
    with torch.no_grad():
        for axis in AXES:
            pos, neg = POLES[axis]
            tp = model.encode_text(tokenizer(pos).to(device)).float()
            tn = model.encode_text(tokenizer(neg).to(device)).float()
            tp = torch.nn.functional.normalize(tp, dim=-1).mean(0)
            tn = torch.nn.functional.normalize(tn, dim=-1).mean(0)
            tp = tp / tp.norm()
            tn = tn / tn.norm()
            d = tp - tn
            axes_dir.append((d / d.norm()).cpu().numpy())
            pole_means[axis] = {"pole_cosine": float((tp @ tn).item())}
    A = np.stack(axes_dir)  # 5 x D

    recs = load_records()
    print(f"{len(recs)} records with images")
    ids = []
    embs = []
    batch = []
    batch_ids = []

    def flush() -> None:
        if not batch:
            return
        with torch.no_grad():
            x = torch.stack(batch).to(device)
            e = model.encode_image(x).float()
            e = torch.nn.functional.normalize(e, dim=-1)
        embs.append(e.cpu().numpy())
        ids.extend(batch_ids)
        batch.clear()
        batch_ids.clear()

    for i, r in enumerate(recs):
        try:
            img = Image.open(IMG / f"{r['objectID']}.jpg").convert("RGB")
        except Exception as e:  # noqa: BLE001
            print(f"bad image {r['objectID']}: {e}", file=sys.stderr)
            continue
        batch.append(preprocess(img))
        batch_ids.append(r["objectID"])
        if len(batch) == 64:
            flush()
            if (i + 1) % 640 == 0:
                print(f"{i + 1}/{len(recs)}")
    flush()
    E = np.concatenate(embs) if embs else np.zeros((0, A.shape[1]))
    ids_arr = np.array(ids)
    np.savez(CATALOG / "embeddings.npz", ids=ids_arr, embeddings=E.astype(np.float32), axes=A.astype(np.float32))
    print(f"embedded {len(ids)} images, dim {E.shape[1]}")

    # Raw axis scores, standardized per axis so each uses the full -1..1 range.
    raw = E @ A.T  # N x 5
    med = np.median(raw, axis=0)
    scale = np.percentile(np.abs(raw - med), 90, axis=0)
    scale[scale == 0] = 1
    mood = np.clip((raw - med) / scale, -1, 1)

    # Axis correlation across the catalog, for the About page.
    corr = np.corrcoef(mood.T).round(3).tolist()
    axes_json = {
        "model": f"{args.model}/{args.pretrained}",
        "poles": POLES,
        "pole_cosine": pole_means,
        "median": med.round(4).tolist(),
        "scale": scale.round(4).tolist(),
        "axis_correlation": corr,
        "images": int(len(ids)),
    }
    (CATALOG / "axes.json").write_text(json.dumps(axes_json, indent=2), encoding="utf-8")

    # Pick the catalog works that make it into the app: per room, highlights and paintings first,
    # then the rest, up to --per-room. Curated records keep their hand-written vectors and copy.
    by_id = {r["objectID"]: r for r in recs}
    curated = json.loads((ROOT / "src" / "data" / "paintings.json").read_text(encoding="utf-8"))
    curated_ids = {p["objectID"] for p in curated if p.get("why")}
    rows = []
    for k, oid in enumerate(ids):
        r = by_id[int(oid)]
        if int(oid) in curated_ids:
            continue
        is_painting = "Painting" in (r.get("classification") or "") or "painting" in (r.get("objectName") or "").lower()
        rank = (0 if r.get("highlight") else 1, 0 if is_painting else 1)
        rows.append((r["room"], rank, k, r))
    rows.sort(key=lambda t: (t[0], t[1]))
    picked: dict[str, list] = {}
    for room, _rank, k, r in rows:
        bucket = picked.setdefault(room, [])
        if len(bucket) >= args.per_room:
            continue
        m = {a: float(round(float(mood[k, i]), 3)) for i, a in enumerate(AXES)}
        gallery = str(r.get("gallery") or "")
        gallery_key = INNER.get(gallery) or ("dendur" if gallery in DENDUR else ROOM_PLAN[room])
        strongest = sorted(AXES, key=lambda a: -abs(m[a]))[:3]
        words = {
            "energy": ("Restless", "Calm"), "warmth": ("Warm", "Cool"), "outlook": ("Hopeful", "Heavy"),
            "focus": ("Inward", "Outward"), "social": ("Close", "Alone"),
        }
        tags = [words[a][0 if m[a] > 0 else 1] for a in strongest]
        bucket.append({
            "objectID": int(r["objectID"]),
            "title": r["title"],
            "artist": r["artist"] or "Unknown artist",
            "date": r["date"],
            "medium": r["medium"],
            "gallery": r["gallery"],
            "image": r["image"],
            "imageLarge": r["imageLarge"],
            "objectURL": r["objectURL"],
            "room": room,
            "galleryKey": gallery_key,
            "mood": m,
            "tags": tags,
            "why": "",
            "source": "clip",
        })
    extra = [p for bucket in picked.values() for p in bucket]
    out = curated + extra
    (ROOT / "src" / "data" / "paintings.json").write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(out)} paintings ({len(curated)} curated + {len(extra)} from CLIP)")
    print({room: len(b) for room, b in picked.items()})

    # 2D map of the catalog for the About page: PCA of the embeddings of the app's paintings.
    app_ids = [p["objectID"] for p in out]
    idx = {int(oid): k for k, oid in enumerate(ids)}
    sel = [idx[i] for i in app_ids if i in idx]
    X = E[sel]
    Xc = X - X.mean(0)
    _, _, vt = np.linalg.svd(Xc, full_matrices=False)
    pts = Xc @ vt[:2].T
    pts = pts / (np.abs(pts).max(0) + 1e-9)
    scatter = []
    sel_ids = [i for i in app_ids if i in idx]
    room_of = {p["objectID"]: p["room"] for p in out}
    for (x, y), oid in zip(pts, sel_ids):
        scatter.append([round(float(x), 3), round(float(y), 3), room_of[oid]])
    explained = (np.linalg.svd(Xc, compute_uv=False) ** 2)
    explained = (explained / explained.sum())[:2].round(3).tolist()
    stats = {
        "model": axes_json["model"],
        "catalogImages": int(len(ids)),
        "appPaintings": len(out),
        "curated": len(curated),
        "fromClip": len(extra),
        "perRoom": {room: len(b) for room, b in picked.items()},
        "axisCorrelation": corr,
        "poleCosine": {a: pole_means[a]["pole_cosine"] for a in AXES},
        "pcaExplained": explained,
        "scatter": scatter,
    }
    (ROOT / "src" / "data" / "embedding-stats.json").write_text(json.dumps(stats) + "\n", encoding="utf-8")
    print("wrote src/data/embedding-stats.json")


if __name__ == "__main__":
    main()
