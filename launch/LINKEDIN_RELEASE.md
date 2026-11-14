# RecVerity: LinkedIn launch package

**Status:** usable only after PR merge, all main-branch GitHub workflows succeed, and live benchmark page is confirmed. Do not claim real-world online lift or Amazon-equivalent model quality.

## Recommended LinkedIn post

**I built a hybrid recommendation engine. A simpler popularity baseline beat it.**

That turned out to be the most valuable finding.

What started as a recommendation-system case study evolved into **RecVerity** — an independent, open-source recommendation engineering lab where the focus is not just making predictions, but making them *defensible*.

The first lesson came from the original educational Amazon snapshot: a naive evaluation showed 81.67% Hit Rate@5, but repeated review events contaminated the split. A stricter event-level evaluation fell to 3.48%.

Then I ran a separate experiment on **100,000 genuine MovieLens ratings**, with global chronological splits and user-level bootstrap uncertainty:

• Popularity baseline: **46.26% Hit Rate@5**
• Content-based: **46.26%**
• Hybrid (60% CF + 40% content): **44.22%**
• Collaborative filtering: **42.18%**

These are **movie-rating offline results**, not Amazon purchasing metrics, and they are not directly comparable to the earlier snapshot.

I also built the engineering tools I wished more recommendation demos included:
- Leakage checks for reused events, repeated user–item pairs and future-data contamination
- Drift monitoring for feature distributions, prediction scores and held-out ranking quality
- A private, browser-local CSV workbench to test your own catalog and interactions
- Explainable top-five recommendations and cold-start fallback behavior
- Local semantic research chat with project-grounded answers
- Reproducible Python evaluation, automated browser QA and GitHub Actions

The whole public demo runs on **GitHub Pages** — no SQL pipeline, paid inference, or hosted API required.

**Live demo:** https://mohit231007.github.io/recverity/  
**Real-data research:** https://mohit231007.github.io/recverity/benchmark.html  
**Source:** https://github.com/mohit231007/recverity

An extra model isn't automatically an improvement. Leakage prevention, honest baselines, reproducibility and uncertainty should come first.

**What's a case where your simplest baseline surprised you?**

#RecommenderSystems #MachineLearning #MLOps #DataScience #OpenSource #ResponsibleAI

## Launch asset recommendations

Use a LinkedIn carousel with 4 screenshots or a short screen recording:
1. RecVerity landing page and the event-leakage correction.
2. Real MovieLens model comparison (hybrid 44.22% vs popularity 46.26%).
3. Research Assurance page showing CSV uploads, drift checks and local chat.
4. The GitHub repository's verified CI and benchmark provenance.

If presenting a benchmark figure in a carousel, include **MovieLens 100K, 147 eligible test users, 96 shared popularity fallbacks** in its caption.

## Media and license checklist

- No Amazon logo or fake Amazon affiliation.
- No GroupLens endorsement implied.
- Cite Harper & Konstan (2015), DOI https://doi.org/10.1145/2827872.
- No raw MovieLens user ratings, original Amazon review text or other restricted source data in screenshots / downloadable assets.
- Publish the code under MIT; third-party datasets remain under their own terms.
