# RecVerity: When the hybrid does not win

**Research status:** completed and independently reproducible offline benchmark, protocol v1.0.0  
**Author:** Mohit Bhatnagar  
**Execution evidence:** https://github.com/mohit231007/recverity/actions/runs/43640849373  
**Aggregate evidence:** https://github.com/mohit231007/recverity/blob/main/web/data/movielens-100k-v1.json  
**Executable source:** https://github.com/mohit231007/recverity/blob/main/research/benchmark.py

## Executive finding

On the real user-level MovieLens 100K rating benchmark, a fixed 60% collaborative + 40% content hybrid yielded **44.22% held-out Hit Rate@5**, versus **46.26% for popularity and content**. Model complexity did not automatically improve the headline metric. These are offline rating-recovery measurements, *not* click, purchase, revenue, or online A/B-test uplift.

This MovieLens experiment is separate from the earlier Amazon educational snapshot, which contains product-average ratings and reused review identifiers. No individual Amazon star ratings are invented.

## Dataset rights and provenance

- **Official source:** https://grouplens.org/datasets/movielens/100k/
- 100,000 individual 1–5-star rating events from **943 users** on **1,682 movies** (1997–1998).
- Downloaded from GroupLens to an ephemeral GitHub Actions runner; official archive MD5 checked before extraction; no third-party data committed, served or redistributed.
- Ratings SHA-256: 06416e597f82b7342361e41163890c81036900f418ad91315590814211dca490
- Metadata SHA-256: 553841ebc7de3a0fd0d6b62a204ea30c1e651aacfb2814c7a6584ac52f2c5701
- GroupLens requires research attribution, forbids redistribution without permission and disallows commercial/revenue use without prior permission. Read https://files.grouplens.org/datasets/movielens/ml-100k/README.
- Citation: F. Maxwell Harper and Joseph A. Konstan (2015), *The MovieLens Datasets: History and Context*. https://doi.org/10.1145/2827872. No endorsement is claimed.

## Evaluation contract

| Feature | Contract |
|---|---|
| Split | Global chronological train **80,003**, validation **9,997**, test **10,000** rating events; tied timestamps never cross a boundary |
| Time boundaries, Unix seconds | Train ≤ 889237269; validation 889237297–891382267; test ≥ 891382309 |
| Training catalog | 1,616 movies observed in training; future catalog items excluded from candidates |
| Positive feedback | Rating ≥ 4; **44,072** positive training events |
| Previously seen | All training-rated items, including negatives, removed from candidates |
| Methods | Training-only popularity; positive item co-interaction cosine; binary genre cosine; fixed 0.6 CF + 0.4 content |
| History | At most 20 recent positive training events; zero positive history uses popularity fallback |
| Ground truth | Future positively rated, catalog-known, unobserved items |
| Sample | 185 eligible validation users and 147 eligible test users; deterministic seed 2307; cap 300 unused |
| Confidence intervals | 300 user-level bootstrap draws; 95% percentile intervals |
| Drift | Same frozen model evaluated on two later chronological user cohorts |

Global time splitting avoids future ratings entering training; duplicate user–item pairs are rejected. Item genre metadata has no historical validity timestamp, so all possible metadata-availability leakage cannot be ruled out; only training-seen catalog items are rankable.

## Actual held-out test results

| Model | Hit Rate@5 | 95% bootstrap CI | NDCG@5 | Recall@5 | Catalog coverage@10 |
|---|---:|---|---:|---:|---:|
| Popularity | **46.26%** | 38.10%–53.74% | **0.2555** | 3.61% | 4.27% |
| Content / genres | **46.26%** | 38.10%–53.06% | 0.2456 | 3.52% | 6.19% |
| Hybrid 60/40 | 44.22% | 36.05%–51.38% | 0.2433 | **3.81%** | **14.17%** |
| Collaborative | 42.18% | 34.01%–49.66% | 0.2398 | 3.28% | 13.74% |

A wider catalog exposure from the hybrid is a diversity/coverage trade-off, not proof of superior relevance. No paired-model significance test was performed to establish statistically reliable differences among methods.

**Cold-start confounding:** **96 of 147** test users had no positive training history and consequently received the *same popularity fallback* under all four methods. Only 51 users had 3+ positive history events. On those returning users, hybrid HR@5 was **23.53%** compared with popularity **29.41%**. Subgroup size is small.

**New-item exclusion:** 66 test positive events involved movies not in the training catalog. Their inability to appear is explicitly counted, not hidden.

## Measured, limited drift

For each method, scores from the identical frozen training model were compared across the validation and later test cohorts. This measures **cohort composition / prediction-score distribution shift**, not causal within-user preference changes.

| Model | HR@5: test minus validation | 95% independent-user bootstrap interval | Top-1 KS D | Top-1 PSI |
|---|---:|---:|---:|---:|
| Popularity | −1.31 percentage points | [−10.62, +10.08] pp | 0.0301 | 0.0053 |
| Content | +0.31 pp | [−9.73, +11.24] pp | 0.0000 | 0.0000 |
| Hybrid | −0.11 pp | [−10.15, +11.97] pp | 0.0690 | 0.0198 |
| Collaborative | −2.15 pp | [−12.79, +8.28] pp | 0.0582 | 0.0060 |

Every HR@5 difference interval **includes zero**. No statistically established ranking-performance deterioration or improvement can be claimed from this comparison. Held-out positive-label shares changed from **56.76%** to **56.29%** (−0.47 pp).

Content top-1 scores saturate at 1.0 for these cohorts because the genre representation is coarse and cosine similarities frequently tie. A zero KS or PSI here indicates no distributional separation *in this particular representation*, not a universally drift-free content model. PSI is a heuristic; KS D is descriptive here, not a p-value.

## Engineering boundaries and next tests

1. Unrated catalog items are not observed negative impressions; Hit Rate is conditional on available positives, not a click-through estimator.
2. Historic movie ratings cannot establish modern shopping or Amazon ranking performance.
3. Most test users share a fallback, so evaluate users with genuine histories separately.
4. The 60/40 blend was predeclared, not selected on validation and never tuned on test.
5. The low-resolution binary-genre content signal produces saturated similarities.
6. Production drift additionally requires real impression logging, candidate-set snapshots, delayed feedback, time-aware features, score calibration and operational guardrails.
7. Future work: repeated time windows, paired-model difference intervals, user-history strata, fair exposure, validation-only weight tuning and domain-appropriate test datasets.

## Reproduction

Download ml-100k.zip from GroupLens under its terms, extract u.data and u.item **outside the repository**, then run this command locally:

    python research/benchmark.py --ratings ./ml-100k/u.data --items ./ml-100k/u.item --max-users 300 --seed 2307 --output ./aggregate.json

The public site displays only audited aggregate results: https://mohit231007.github.io/recverity/benchmark.html

**Conclusion:** The contribution is trustworthy data splits, sensible baselines, reproducible experiments, explicit cold-start behavior, monitoring with uncertainty and honest negative findings—not a claim that more complex always means better.
