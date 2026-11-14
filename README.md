# RecVerity

**Explainable Recommendations. Defensible Evaluation.**

RecVerity is an independent, open-source recommendation engineering lab by **Mohit Bhatnagar**. It demonstrates how content, collaborative, and hybrid ranking systems behave—and why a misleading train/test split can completely change an apparently impressive result.

**Interactive website:** https://mohit231007.github.io/recverity/ (GitHub Pages)

## What you can explore

- Five synthetic shopper personas (including a guest with no previous interactions).
- Content-based TF-IDF similarity on fictional product text and metadata.
- Item–item collaborative cosine using synthetic binary interactions.
- Hybrid scoring with adjustable CF and content weights (default 60/40).
- Price, category, availability, and redundancy/diversity constraints.
- Five metadata-nearest recommendations for fictional products without reviews.
- Export current synthetic ranked results as JSON.
- A separate evaluation audit exposing dramatic review-event leakage.
- A **Research Assurance** page with event/pair/chronological leakage fixtures, price/category/inventory drift diagnostics, browser-local CSV upload auditing, and an on-device semantic research assistant.
- Two uploaded catalog files can be compared as reference/current distributions, while two event files can be audited as train/test. You can also generate top-5 recommendations **directly from uploaded catalog and training interactions CSVs**, using content similarity, co-interaction signals, hybrid scoring or popularity fallback. Uploaded data are never sent to a backend.

## Research result — evidence boundaries

The **educational Amazon snapshot** is private and is **not** published in this repository. It contains 1,465 rows, 1,351 unique SKU identifiers and 9,050 sampled reviewer identifiers. A further investigation found 761 review IDs reused across different SKUs, with 710 seemingly multi-product users who had only one distinct review event.

A naive held-out evaluation reported **81.67% hybrid Hit Rate@5** but review-event overlap contaminated 749 of 911 test users. A stricter leave-one-review-event-out test on 201 eligible users returned **3.48% Hit Rate@5 for both content and hybrid** (0% for collaborative and popularity). This is a small, retrospective reconstruction benchmark, *not* an estimate of customer conversion, purchasing, CTR or revenue lift.

The **public, live browser demo** is completely separate: 72 fictional products and 400 invented shopper histories generated deterministically. It cannot establish Amazon recommendation accuracy. Product-level aggregate ratings are never fabricated into per-user ratings.

## Quick start

No API key, Node packages, database, server framework, account, or paid service is required.

    python -m http.server 8000 --directory web

Open http://localhost:8000 . Run tests with Node.js 22+:

    node --test tests/*.test.mjs

## Repository structure

    web/                 Browser application, recommendation and research assurance modules
    tests/               Deterministic unit checks
    docs/                Model card, quality gates, CSV contract, benchmark protocol, assistant architecture
    .github/workflows/   Pull request CI; GitHub Pages deployment

**Note:** The complete Scaler notebook and private Python research pipeline have not yet been imported into this public release. They remain in the separate local reproducibility bundle. The website displays only vetted, aggregate results.

## Architecture

Client-side synthetic catalog → TF-IDF vectorization + simulated user-item incidence → cosine similarities → constrained candidate filtering → transparent score fusion → greedy diversity rerank → top-5 explanations.

A history-free guest uses a **popularity fallback** rather than inventing personal tastes. Ranking scores are similarities, **not calibrated probabilities**.

## Deployment at zero paid infrastructure cost

After this PR merges, select **Settings → Pages → Build and deployment → Source: GitHub Actions**. A push to main executes the tests and deploys the web/ folder. Public Pages and Actions remain subject to GitHub's terms, usage limits and repository settings. This is an educational site rather than a hosted commercial SaaS.

## Local data science workbench

Open [Research Assurance](https://mohit231007.github.io/recverity/trust-lab.html) to investigate simulated drift and leakage, upload two local CSV files for validation/comparison, or ask the free local document retriever a grounded question. **All CSV parsing happens in the browser; no SQL, server, or API key is required.** The assistant performs deterministic semantic search over authored notes, not generative LLM chat. See [CSV schema](docs/CSV_SCHEMA.md), [quality gates](docs/QUALITY_GATES.md) and [assistant design](docs/LOCAL_ASSISTANT.md).

## Authentic ratings benchmark

A standalone `research/benchmark.py` runner accepts the officially downloaded **MovieLens 100K** `u.data` and `u.item` files to produce aggregate, reproducible chronological benchmark reports. This movie-domain benchmark is separate from the e-commerce Scaler research and no MovieLens outcomes are presented as verified yet. Tests use fictional fixtures only. **The dataset is not redistributed.** See [benchmark protocol](docs/BENCHMARK_PROTOCOL.md) and [GroupLens license](https://grouplens.org/datasets/movielens/100k/).

Run:
```bash
python research/benchmark.py --ratings ./ml-100k/u.data --items ./ml-100k/u.item --max-users 200 --output ./recverity-benchmark.json
```

## Scientific upgrade roadmap

1. Independent desktop/mobile browser smoke tests and screenshot QA.
2. Privacy-reviewed integration of the original full Python case study.
3. A rights-checked review-event dataset with *real* per-user ratings and timestamps, chronological holdout, leakage guards and bootstrap confidence intervals.
4. Ablation studies, NDCG/Recall@K, runtime budgets, subgroup cold-start tests, data/model manifests, and experiment reproducibility.

## Attribution

**Mohit Bhatnagar** · Independent portfolio project. MIT licensed. **Not affiliated with, endorsed by or sponsored by Amazon.** The MIT license applies to our code, not third-party datasets, imagery, papers or course materials. No course data, raw reviewer IDs, or original review texts are redistributed.
