# Quality gates and drift monitoring

RecVerity includes a deterministic **synthetic** monitor plus a **private, local CSV** audit surface.

## Catalog checks

Input data quality is checked before comparing feature distributions: missing or nonnumeric price, invalid or duplicate product IDs, missing categories and missing ratings are counted. A missing rating is not automatically an error: new products can be unrated. Data drift is not evidence of concept drift and must not automatically trigger model retraining.

- **Price PSI:** quantile bins computed on the reference window, Laplace-style epsilon for empty bins. Default threshold 0.20 is a **heuristic only**, not a p-value.
- **Price KS D:** largest empirical CDF difference, descriptive; it is not used as a significance test in this demo.
- **Category JS distance:** square root of Jensen-Shannon divergence, 0–1 when using base-2 logarithms.
- **Inventory JS distance:** comparable only when both files provide availability flags.
- **Completeness:** absolute increase in fraction of missing prices, alert at +0.05.
- **Schema:** duplicate IDs and invalid prices are blocking quality errors; they should not be hidden by imputing them.

For real monitoring, compare **separate, genuinely time-indexed reference and current windows of the same business data**, calibrate thresholds using historic clean and incident windows, establish minimum sample sizes, and monitor prediction scores and delayed outcome quality separately. Avoid drawing conclusions from the built-in synthetic distribution comparison.

## Leakage threat model

A safe ranking split requires more than randomly holding out observed rows:
1. A single review/event ID must not appear across train, validation and test, even if linked to different SKU identifiers.
2. A user-item pair must not appear in both sets.
3. Future events must not be included in earlier periods; also check that feature engineering, popularity, text vocabulary and normalization are fit only on training data.
4. If `event_id` or `timestamp` is missing, the corresponding audit is **unknown**, not passed.
5. A gap in timestamps cannot certify the absence of leakage from derivative features or target leakage; review the entire pipeline.

The built-in fixture demonstrates three separate failures. The upload checker compares the supplied train and test files. It does **not** store, log, transmit, train on or score uploaded private records.

## Out-of-scope until connected to production telemetry

Performance and business drift require real timestamped impressions, candidate/ranker versions, click or purchase labels, item inventory state, delayed outcome windows, safeguards against selection bias, and controlled A/B experiments. RecVerity does not claim these are currently available.
