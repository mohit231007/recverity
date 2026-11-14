# Independent authentic-ratings benchmark protocol

## Domain and licensing

The Amazon educational snapshot used for the earlier case study has **product-level mean rating**, not observed individual star ratings or purchase timestamps. Honest collaborative filtering must use actual event-level ratings.

RecVerity therefore provides an **independent MovieLens 100K research benchmark runner**, without redistributing the third-party dataset. This benchmark is **movie recommendations, not Amazon products**; performance must not be compared as if domains, user behavior or exposure distributions were equivalent.

GroupLens MovieLens research dataset and licensing: https://grouplens.org/datasets/movielens/100k/ . Read the included README, respect restrictions on redistribution and commercial use, and separately obtain permissions when appropriate.

## Recommended protocol

1. Download `ml-100k.zip` from GroupLens yourself, inspect its README and extract it locally. Do not commit files from that archive.
2. Parse `u.data`: user ID, movie ID, **individual** rating, integer timestamp. Optional `u.item`: movie genres for metadata ranking.
3. Validate duplicates and invalid labels, reject conflicting events, use chronological train (80%), validation (10%), test (10%) **by distinct timestamp boundaries**.
4. Train popularity, item co-interaction cosine, content cosine on genre metadata, and an untuned 60/40 hybrid using only training positives (rating >= 4).
5. Evaluate on catalog-known future positive items: warm and history-free / sparse users separately. Exclude already-seen items, report cold-item exclusions, denominator, and sample cap.
6. Report HR@5/10, Recall@5/10, NDCG@5/10, catalog coverage, runtime, and user-cluster bootstrap intervals. Dataset limitations and test selection must accompany every public metric.

Unlike web demo synthetic controls, every figure from this runner is derived from the genuine downloaded ratings. No MovieLens outcomes have been claimed as measured until the user runs the benchmark and publishes its versioned report.

## Leakage-aware splits

Using per-user last-event holdout alone permits users' **future** events to influence item co-occurrences that score another user's earlier test events. The runner instead uses **global chronological boundaries**, avoids identical timestamps spanning partitions, checks user–item overlap, and learns item similarities exclusively on the training partition. Tuning on test is disallowed. Score fusion weights are predeclared; no claimed online improvement.

## Reproducibility

The benchmark runner will be available at `research/benchmark.py` (stdlib Python). Run as:

```bash
python research/benchmark.py --ratings ./ml-100k/u.data --items ./ml-100k/u.item --max-users 200 --output ./research-result.json
```

Uploaded datasets and generated individual-level outputs must remain local. Only share aggregated, vetted metrics and protocol metadata.
