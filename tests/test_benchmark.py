"""Network-free tests for the authentic-ratings benchmark (fixtures are entirely synthetic)."""
from pathlib import Path
from tempfile import TemporaryDirectory
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from research.benchmark import Event, Ranker, bootstrap_interval, chronological_split, load_ratings, run


class TestBenchmark(unittest.TestCase):
    def test_three_way_split_prevents_future_leakage(self):
        events = [Event(str(i % 8), str(i), 5, i) for i in range(1, 101)]
        train, val, test = chronological_split(events)
        self.assertLess(max(x.ts for x in train), min(x.ts for x in val))
        self.assertLess(max(x.ts for x in val), min(x.ts for x in test))

    def test_repeated_user_item_rejected(self):
        with TemporaryDirectory() as d:
            file = Path(d) / "u.data"
            file.write_text("u1\tp1\t5\t1\nu1\tp1\t4\t2\n" +
                            "".join(f"u{i}\tp{i}\t5\t{i+3}\n" for i in range(15)), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "duplicate"):
                load_ratings(file)

    def test_fallback_excludes_seen(self):
        events = [Event("u", "a", 5, 1), Event("u", "b", 5, 2),
                  Event("v", "c", 5, 3), Event("v", "d", 5, 4)]
        ranker = Ranker(events, {"a": frozenset([0]), "b": frozenset([0]),
                                 "c": frozenset([1]), "d": frozenset([1])})
        self.assertTrue(set(ranker.recommend("u", "hybrid", 5)).isdisjoint({"a", "b"}))
        self.assertEqual(len(ranker.recommend("guest", "hybrid", 5)), 4)

    def test_bootstrap_is_reproducible(self):
        self.assertEqual(bootstrap_interval([0, 1, 1, 0]), bootstrap_interval([0, 1, 1, 0]))

    def test_fixture_end_to_end_does_not_pretend_real_dataset(self):
        with TemporaryDirectory() as d:
            ratings, items = Path(d) / "u.data", Path(d) / "u.item"
            rows = []
            for j in range(10):
                for u in range(10):
                    rows.append(f"{u+1}\t{(j+u)%12+1}\t{4+(u+j)%2}\t{j*100+u+1}")
            ratings.write_text("\n".join(rows)+"\n", encoding="utf-8")
            with items.open("w", encoding="latin-1") as out:
                for i in range(1, 13):
                    flags = ["1" if j == i % 4 else "0" for j in range(19)]
                    out.write("|".join([str(i), f"Sample {i}", "", "", ""] + flags)+"\n")
            report = run(ratings, items, max_users=10)
            self.assertEqual(report["split"]["train_events"], 80)
            self.assertGreater(report["test"]["eligible_users"], 0)
            self.assertIn("hybrid", report["test"]["models"])
            self.assertIn("hr@5_95pct_user_bootstrap", report["test"]["models"]["hybrid"])


if __name__ == "__main__":
    unittest.main()
