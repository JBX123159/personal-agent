import copy
import unittest

from eval.run_eval import EvalReportError, summarize_report


CATEGORY_COUNTS = {
    "normal": 4,
    "ambiguous": 3,
    "memory": 4,
    "tool": 4,
    "permission": 3,
    "verification": 2,
}


def create_report() -> dict:
    cases = []
    case_index = 0
    for category, count in CATEGORY_COUNTS.items():
        for _ in range(count):
            case_index += 1
            cases.append(
                {
                    "id": f"{category}-{case_index:02d}",
                    "category": category,
                    "passed": True,
                    "assertions": {"intent": True, "memoryIds": True},
                    "successfulToolCount": 0,
                    "executedToolCount": 0,
                    "falseSuccessCount": 0,
                    "unauthorizedActionCount": 0,
                }
            )

    return {
        "metrics": {
            "totalCases": 20,
            "passedCases": 20,
            "intentAccuracy": 1,
            "memoryAccuracy": 1,
            "taskCompletionRate": 1,
            "toolSuccessRate": 0,
            "falseSuccessRate": 0,
            "unauthorizedActionCount": 0,
        },
        "cases": cases,
    }


class SummarizeReportTests(unittest.TestCase):
    def test_valid_report_returns_stable_summary(self) -> None:
        summary = summarize_report(create_report())

        self.assertEqual(summary["validatedCases"], 20)
        self.assertEqual(summary["passedCases"], 20)
        self.assertEqual(summary["categoryCounts"], CATEGORY_COUNTS)
        self.assertEqual(summary["metrics"]["unauthorizedActionCount"], 0)

    def test_wrong_case_count_is_rejected(self) -> None:
        report = create_report()
        report["cases"].pop()

        with self.assertRaisesRegex(EvalReportError, "20"):
            summarize_report(report)

    def test_duplicate_case_id_is_rejected(self) -> None:
        report = create_report()
        report["cases"][1]["id"] = report["cases"][0]["id"]

        with self.assertRaisesRegex(EvalReportError, "ID"):
            summarize_report(report)

    def test_metric_mismatch_is_rejected(self) -> None:
        report = copy.deepcopy(create_report())
        report["metrics"]["passedCases"] = 19

        with self.assertRaisesRegex(EvalReportError, "passedCases"):
            summarize_report(report)


if __name__ == "__main__":
    unittest.main()
