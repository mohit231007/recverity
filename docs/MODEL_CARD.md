# Model and data card

## Purpose and scope
RecVerity is a publicly inspectable engineering demo. It is not a live purchasing tool or an estimate of Amazon's algorithms. Do not use it to infer real people, target customers or make sensitive recommendations.

## Public simulation
A fixed-seed browser generator creates 72 fictional products and 400 fictional user histories. Text is vectorized with TF-IDF and compared by cosine similarity; category and relative price add a small similarity contribution. Collaborative similarity comes from fictional binary co-interactions. Hybrid fusion is 0.6 collaborative + 0.4 content by default, without probabilistic calibration. Constraints exclude seen products, optionally limit inventory, price or category, and penalize redundant items.

## Separate educational research
A private 1,465-row Amazon snapshot supports only *aggregate* retrospective review-event analysis. The dataset lacks per-user star ratings, timestamps, purchases, impressions, sale value and actual availability. Reused review IDs across SKUs contaminated the naive holdout. Strict Hit Rate@5 on 201 eligible users is 3.48% for both content and hybrid, with no observed incremental accuracy improvement from fusion.

## Known failure modes
Extreme sparsity; reused review IDs; no time-aware causal estimation; cold-start collaborative scores; uncalibrated component fusion; simulated behavior divergence; no deployment feedback loop; potential popularity bias.

## Safety and disclosure
Source CSV, reviewer identifiers and review text are excluded from the public Git repository. Synthetic data cannot be interpreted as observed human preferences. Future authentic benchmarks require verified reuse rights, strict data contracts and group/temporal leakage tests.
