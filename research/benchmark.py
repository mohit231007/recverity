#!/usr/bin/env python3
"""RecVerity MovieLens 100K benchmark.

No dependency beyond Python 3.10. No third-party dataset downloaded or redistributed.
Movie ratings are genuinely per-user event labels, unlike the Amazon product snapshot.
Uses global chronological boundaries, train-only similarity, full-catalog ranking.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from dataclasses import dataclass
from hashlib import sha256
from itertools import combinations
from functools import lru_cache
from pathlib import Path
import csv
import json
import math
import random
import statistics
import time


@dataclass(frozen=True)
class Event:
    user: str
    item: str
    rating: int
    ts: int


def load_ratings(path: Path) -> list[Event]:
    result = []
    pairs = set()
    with path.open(encoding="utf-8", newline="") as stream:
        for line, row in enumerate(csv.reader(stream, delimiter="\t"), 1):
            if len(row) != 4:
                raise ValueError(f"ratings row {line}: expected 4 tab-separated fields")
            user, item, raw_rating, raw_ts = row
            try:
                rating, ts = int(raw_rating), int(raw_ts)
            except ValueError as error:
                raise ValueError(f"ratings row {line}: invalid rating or timestamp") from error
            if not user or not item or not 1 <= rating <= 5 or ts < 1:
                raise ValueError(f"ratings row {line}: missing ID or out-of-range value")
            if (user, item) in pairs:
                raise ValueError(f"ratings row {line}: duplicate user-item pair; resolve leakage explicitly")
            pairs.add((user, item))
            result.append(Event(user, item, rating, ts))
    if len(result) < 15:
        raise ValueError("At least 15 events are required for chronological evaluation")
    return result


def load_genres(path: Path) -> dict[str, frozenset[int]]:
    """MovieLens u.item: id|title|dates|url|19 one-hot genre flags."""
    items = {}
    with path.open(encoding="latin-1", newline="") as stream:
        for number, row in enumerate(csv.reader(stream, delimiter="|"), 1):
            if len(row) < 24 or not row[0]:
                raise ValueError(f"metadata row {number}: expected MovieLens u.item layout")
            try:
                flags = [int(n) for n in row[5:24]]
            except ValueError as error:
                raise ValueError(f"metadata row {number}: invalid genre flag") from error
            if any(flag not in (0, 1) for flag in flags):
                raise ValueError(f"metadata row {number}: genre flags must be 0 or 1")
            items[row[0]] = frozenset(i for i, flag in enumerate(flags) if flag)
    return items


def chronological_split(events: list[Event]) -> tuple[list[Event], list[Event], list[Event]]:
    """Never split identical timestamps between subsets."""
    values = sorted(event.ts for event in events)
    cut_train = values[int(.8 * len(values)) - 1]
    cut_val = values[int(.9 * len(values)) - 1]
    if cut_train >= cut_val:
        raise ValueError("Insufficient distinct timestamps for a three-way time split")
    train = [x for x in events if x.ts <= cut_train]
    val = [x for x in events if cut_train < x.ts <= cut_val]
    test = [x for x in events if x.ts > cut_val]
    if not train or not val or not test:
        raise ValueError("One of the chronological splits is empty")
    if max(e.ts for e in train) >= min(e.ts for e in val):
        raise AssertionError("Temporal leakage between train and validation")
    if max(e.ts for e in val) >= min(e.ts for e in test):
        raise AssertionError("Temporal leakage between validation and test")
    sets = [{(x.user, x.item) for x in group} for group in (train, val, test)]
    if sets[0] & sets[1] or sets[0] & sets[2] or sets[1] & sets[2]:
        raise AssertionError("User-item pair leaked across splits")
    return train, val, test


class Ranker:
    """Positive-feedback cosine co-interaction; metadata cosine; popularity baseline."""

    def __init__(self, train: list[Event], genres: dict[str, frozenset[int]]):
        self.catalog = sorted({x.item for x in train})
        self.seen: dict[str, set[str]] = defaultdict(set)
        self.history: dict[str, list[tuple[int, str]]] = defaultdict(list)
        self.genre = genres
        self.freq: Counter[str] = Counter()
        self.co: Counter[tuple[str, str]] = Counter()

        for e in train:
            self.seen[e.user].add(e.item)
            if e.rating >= 4:
                self.history[e.user].append((e.ts, e.item))
                self.freq[e.item] += 1

        for events in self.history.values():
            ids = sorted({item for _, item in events})
            for a, b in combinations(ids, 2):
                self.co[a, b] += 1

        self.max_pop = max(self.freq.values(), default=1)

    def cf_score(self, item: str, history: list[str]) -> float:
        if not history or self.freq[item] == 0:
            return 0.0
        values = []
        for past in history:
            if self.freq[past] == 0:
                continue
            pair = tuple(sorted((item, past)))
            count = self.co[pair] if item != past else self.freq[item]
            values.append(count / math.sqrt(self.freq[item] * self.freq[past]))
        return max(values, default=0.0)

    def content_score(self, item: str, history: list[str]) -> float:
        a = self.genre.get(item, frozenset())
        if not a or not history:
            return 0.0
        def cosine(past: str) -> float:
            b = self.genre.get(past, frozenset())
            return len(a & b) / math.sqrt(len(a) * len(b)) if b else 0.0
        return max((cosine(past) for past in history), default=0.0)

    @lru_cache(maxsize=600)
    def feature_rows(self, user: str) -> tuple[tuple[str, float, float, float], ...]:
        """Training-only item features cached once per user for fair model comparisons."""
        history = [x[1] for x in sorted(self.history.get(user, []), reverse=True)[:20]]
        blocked = self.seen.get(user, set())
        result = []
        for item in self.catalog:
            if item in blocked:
                continue
            pop = self.freq[item] / self.max_pop
            content = self.content_score(item, history) if history else 0.0
            cf = self.cf_score(item, history) if history else 0.0
            result.append((item, content, cf, pop))
        return tuple(result)

    @lru_cache(maxsize=2400)
    def recommend_scored(self, user: str, method: str, k: int) -> tuple[tuple[str, float], ...]:
        history_free = not self.history.get(user)
        scored = []
        for item, content, cf, pop in self.feature_rows(user):
            if history_free or method == "popularity":
                score = pop
            elif method == "collaborative":
                score = cf
            elif method == "content":
                score = content
            elif method == "hybrid":
                score = .6 * cf + .4 * content
            else:
                raise ValueError("Unknown model: " + method)
            scored.append((-score, -pop, item))
        scored.sort()
        return tuple((item, -score) for score, _, item in scored[:k])

    def recommend(self, user: str, method: str, k: int) -> list[str]:
        return [item for item, _ in self.recommend_scored(user, method, k)]


def percentile(sorted_values: list[float], p: float) -> float:
    if not sorted_values:
        return 0.0
    pos = p * (len(sorted_values) - 1)
    lo = int(pos)
    return sorted_values[lo] + (sorted_values[min(lo + 1, len(sorted_values) - 1)] -
                                 sorted_values[lo]) * (pos - lo)


def bootstrap_interval(values: list[float], seed: int = 2307, resamples: int = 300) -> list[float]:
    """Resample *users*, not individual clicks/reviews."""
    if not values:
        return [0.0, 0.0]
    rng = random.Random(seed)
    estimates = sorted(statistics.fmean(rng.choices(values, k=len(values))) for _ in range(resamples))
    return [round(percentile(estimates, .025), 4), round(percentile(estimates, .975), 4)]


def evaluate(ranker: Ranker, heldout: list[Event], max_users: int, seed: int) -> dict:
    truth: dict[str, set[str]] = defaultdict(set)
    heldout_positive = 0
    new_item_positive = 0
    catalog = set(ranker.catalog)
    for x in heldout:
        if x.rating >= 4:
            heldout_positive += 1
            if x.item in catalog and x.item not in ranker.seen.get(x.user, set()):
                truth[x.user].add(x.item)
            elif x.item not in catalog:
                new_item_positive += 1
    users = sorted(truth)
    if len(users) > max_users:
        users = sorted(random.Random(seed).sample(users, max_users))
    if not users:
        return {"eligible_users": 0, "heldout_positive_events": heldout_positive,
                "cold_item_positive_events": new_item_positive, "models": {}, "_internal": {}}
    methods = ["popularity", "collaborative", "content", "hybrid"]
    report, internal = {}, {}
    for name in methods:
        rows, top1_scores = [], []
        exposed = set()
        start = time.perf_counter()
        subgroup_rows: dict[str, list[float]] = defaultdict(list)
        for user in users:
            history_size = len(ranker.history.get(user, []))
            group = "history_free" if history_size == 0 else "sparse_1_2" if history_size <= 2 else "returning_3_plus"
            scored = ranker.recommend_scored(user, name, 10)
            predicted = [item for item, _ in scored]
            top1_scores.append(scored[0][1] if scored else 0.0)
            exposed.update(predicted)
            relevant = truth[user]
            one = {}
            for k in (5, 10):
                hits = sum(x in relevant for x in predicted[:k])
                dcg = sum((1 / math.log2(i + 2)) for i, x in enumerate(predicted[:k]) if x in relevant)
                ideal = sum(1 / math.log2(i + 2) for i in range(min(len(relevant), k)))
                one[f"hr@{k}"] = float(hits > 0)
                one[f"recall@{k}"] = hits / len(relevant)
                one[f"ndcg@{k}"] = dcg / ideal if ideal else 0.0
            subgroup_rows[group].append(one["hr@5"])
            rows.append(one)
        metrics = {key: round(statistics.fmean(r[key] for r in rows), 4)
                   for key in ("hr@5", "hr@10", "recall@5", "recall@10", "ndcg@5", "ndcg@10")}
        hr5 = [r["hr@5"] for r in rows]
        metrics.update({"hr@5_95pct_user_bootstrap": bootstrap_interval(hr5, seed),
                        "catalog_coverage_at_10": round(len(exposed) / len(catalog), 4),
                        "history_free_users": len(subgroup_rows["history_free"]),
                        "evaluated_users": len(users),
                        "subgroups": {group: {"users": len(scores),
                                               "hr@5": round(statistics.fmean(scores), 4) if scores else None}
                                      for group, scores in subgroup_rows.items()},
                        "top1_rank_score_mean": round(statistics.fmean(top1_scores), 4),
                        "top1_rank_score_p50": round(percentile(sorted(top1_scores), .5), 4),
                        "elapsed_seconds": round(time.perf_counter() - start, 3)})
        report[name] = metrics
        internal[name] = {"hr5": hr5, "scores": top1_scores}
    return {"eligible_users": len(users), "eligible_users_before_cap": len(truth),
            "heldout_positive_events": heldout_positive,
            "cold_item_positive_events": new_item_positive,
            "models": report, "_internal": internal}


def ks_distance(before: list[float], after: list[float]) -> float | None:
    """Empirical 2-sample KS D; descriptive, not a p-value or concept-drift test."""
    if not before or not after:
        return None
    a, b = sorted(before), sorted(after)
    ia = ib = 0
    maximum = 0.0
    for value in sorted(set(a + b)):
        while ia < len(a) and a[ia] <= value:
            ia += 1
        while ib < len(b) and b[ib] <= value:
            ib += 1
        maximum = max(maximum, abs(ia / len(a) - ib / len(b)))
    return round(maximum, 4)


def distribution_psi(reference: list[float], current: list[float], bins: int = 5) -> float | None:
    """Quantile PSI with fixed reference boundaries, smoothing; heuristic only."""
    if len(reference) < bins or not current:
        return None
    sorted_reference = sorted(reference)
    edges = sorted(set(percentile(sorted_reference, i / bins) for i in range(1, bins)))
    def bucket(value: float) -> int:
        return sum(value > boundary for boundary in edges)
    ref_count, cur_count = Counter(map(bucket, reference)), Counter(map(bucket, current))
    total = 0.0
    for i in range(len(edges) + 1):
        p = max(1e-6, ref_count[i] / len(reference))
        q = max(1e-6, cur_count[i] / len(current))
        total += (q - p) * math.log(q / p)
    return round(max(0.0, total), 4)


def bootstrap_difference(before: list[float], after: list[float],
                         seed: int = 2307, resamples: int = 300) -> list[float] | None:
    """Independent-user bootstrap on separate evaluation cohorts."""
    if not before or not after:
        return None
    rng = random.Random(seed)
    estimates = sorted(
        statistics.fmean(rng.choices(after, k=len(after))) -
        statistics.fmean(rng.choices(before, k=len(before)))
        for _ in range(resamples)
    )
    return [round(percentile(estimates, .025), 4), round(percentile(estimates, .975), 4)]


def build_drift_report(val: dict, test: dict,
                       val_events: list[Event], test_events: list[Event],
                       seed: int) -> dict:
    """Frozen train model; validation vs test cohorts: diagnostic, not causal drift."""
    v = val.pop("_internal")
    t = test.pop("_internal")
    by_model = {}
    for method in ("popularity", "collaborative", "content", "hybrid"):
        a, b = v.get(method, {}), t.get(method, {})
        if not a or not b:
            continue
        va, te = a["scores"], b["scores"]
        hp_a, hp_b = a["hr5"], b["hr5"]
        ci = bootstrap_difference(hp_a, hp_b, seed)
        delta = statistics.fmean(hp_b) - statistics.fmean(hp_a)
        by_model[method] = {
            "validation_users": len(va), "test_users": len(te),
            "top1_score_ks_d": ks_distance(va, te),
            "top1_score_psi": distribution_psi(va, te),
            "top1_score_mean_delta": round(statistics.fmean(te) - statistics.fmean(va), 4),
            "hr@5_test_minus_validation": round(delta, 4),
            "hr@5_delta_95pct_independent_user_bootstrap": ci,
            "hr@5_ci_excludes_zero": bool(ci and (ci[0] > 0 or ci[1] < 0)),
        }
    vr = sum(x.rating >= 4 for x in val_events) / len(val_events)
    tr = sum(x.rating >= 4 for x in test_events) / len(test_events)
    return {
        "interpretation": "Descriptive score-distribution and label-based ranking-quality shifts across two later cohorts using a single frozen training model. Cohort composition may differ; neither a KS D nor PSI is a significance or concept-drift test. HR differences do not establish causal online impact.",
        "label_positive_rate_validation": round(vr, 4),
        "label_positive_rate_test": round(tr, 4),
        "label_positive_rate_delta": round(tr - vr, 4),
        "user_cluster_bootstrap_resamples": 300,
        "models": by_model,
    }


def run(ratings: Path, items: Path, max_users: int = 200, seed: int = 2307) -> dict:
    if not 1 <= max_users <= 1000:
        raise ValueError("max-users must be between 1 and 1000")
    events = load_ratings(ratings)
    genres = load_genres(items)
    train, val, test = chronological_split(events)
    start = time.perf_counter()
    ranker = Ranker(train, genres)
    fit_seconds = time.perf_counter() - start
    validation_report = evaluate(ranker, val, max_users, seed)
    test_report = evaluate(ranker, test, max_users, seed)
    drift_report = build_drift_report(validation_report, test_report, val, test, seed)
    return {
        "benchmark_version": "1.0.0",
        "dataset": "MovieLens 100K (user-level star ratings; movie domain; separate from Amazon snapshot)",
        "provenance": "https://grouplens.org/datasets/movielens/100k/",
        "ratings_sha256": sha256(ratings.read_bytes()).hexdigest(),
        "items_sha256": sha256(items.read_bytes()).hexdigest(),
        "split": {"strategy": "global_timestamp_boundary_80_10_10", "train_events": len(train),
                  "validation_events": len(val), "test_events": len(test),
                  "train_max_time": max(x.ts for x in train),
                  "validation_min_time": min(x.ts for x in val),
                  "validation_max_time": max(x.ts for x in val),
                  "test_min_time": min(x.ts for x in test)},
        "settings": {"positive_label_min": 4, "seed": seed, "evaluation_user_cap": max_users,
                     "hybrid_cf_weight": .6, "hybrid_content_weight": .4,
                     "candidate_set": "all train-observed items excluding user's train-rated items",
                     "cold_user_fallback": "training-only popularity", "bootstraps": 300},
        "train": {"unique_users": len(ranker.seen), "unique_items": len(ranker.catalog),
                  "positive_events": sum(ranker.freq.values()), "fit_seconds": round(fit_seconds, 3)},
        "validation": validation_report,
        "test": test_report,
        "drift": drift_report,
        "limitations": [
            "Film recommendations do not represent e-commerce behavior.",
            "Ratings lack impressions and true exposure negatives; no online uplift measured.",
            "A fixed 60/40 fusion is not selected by validation and is not calibrated.",
            "Users with test positives on unknown cold items are partially excluded and counted separately.",
            "Prediction-score drift compares different user cohorts with a frozen train model, not causal within-user changes.",
            "Missing exposure logs, delayed feedback and stochastic uncertainty limit interpretation of drift diagnostics.",
            "A capped deterministic sample of users is used for evaluation; report before-cap counts.",
            "Model uses genre metadata and positive co-interaction similarity, not embeddings.",
        ],
    }


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--ratings", required=True, type=Path, help="Downloaded GroupLens u.data")
    p.add_argument("--items", required=True, type=Path, help="Downloaded GroupLens u.item")
    p.add_argument("--max-users", type=int, default=200)
    p.add_argument("--seed", type=int, default=2307)
    p.add_argument("--output", type=Path, default=Path("recverity-benchmark.json"))
    args = p.parse_args()
    outcome = run(args.ratings, args.items, args.max_users, args.seed)
    args.output.write_text(json.dumps(outcome, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Saved aggregate evaluation for {outcome['test']['eligible_users']} test users to {args.output}")


if __name__ == "__main__":
    main()
