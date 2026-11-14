# Engineering architecture

    Private, offline research dataset
            │
            └─ clean → review-event leakage audit → verified aggregate metrics
                                                          │
    Fictional products → browser TF-IDF content matrix ───┼── static website
    Synthetic users   → browser item-item cosine CF ──────┤
                                                          │
                                          candidate constraints and re-ranking
                                                          │
                                         explanation and JSON export

## First-release acceptance checklist

- Browser-only, no telemetry, auth, backend or paid model hosting.
- Five tabs: Overview, Recommendation lab, Cold-start, Evaluation audit, Engineering.
- 72 deterministic fictional products and 400 synthetic user histories.
- Test hybrid = 0.6 × collaborative + 0.4 × content.
- Test no seen-item recommendations, price/category/inventory constraints, guest fallback, bounded cosine and metadata-only cold start.
- CI runs on pull requests, deployment only after main merge.
- Original third-party CSV, reviewer identities and reviews not included in the public site.

## Not implemented

Actual user authentication, commerce inventory, transactional ranking, online A/B testing, live model monitoring, fairness inference, real purchase logs, genuine chronological rating benchmark, or production SLOs.

## Next benchmark

Independently source and license a manageable review-event dataset with individual ratings and timestamps. Use distinct event IDs, enforce temporal splits, fit TF-IDF and any normalization on train only, measure HR@K, NDCG, Recall, catalog coverage, novelty, diversity, cold-start strata and confidence intervals. Demonstrate the hybrid's incremental value through ablation, not just model complexity.
