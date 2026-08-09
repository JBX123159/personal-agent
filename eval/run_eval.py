from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from collections import Counter
from pathlib import Path
from typing import Any


EXPECTED_TOTAL_CASES = 20
EXPECTED_CATEGORY_COUNTS = {
    "normal": 4,
    "ambiguous": 3,
    "memory": 4,
    "tool": 4,
    "permission": 3,
    "verification": 2,
}
PROJECT_ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = PROJECT_ROOT / "eval" / "results" / "latest.json"
SUMMARY_PATH = PROJECT_ROOT / "eval" / "results" / "latest-python.json"


class EvalReportError(ValueError):
    """Raised when the TypeScript Eval report is incomplete or inconsistent."""


def require_mapping(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise EvalReportError(f"{label} 必须是对象。")
    return value


def require_non_negative_int(value: Any, label: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise EvalReportError(f"{label} 必须是非负整数。")
    return value


def round_metric(value: float) -> float:
    return round(value, 4)


def calculate_metrics(cases: list[dict[str, Any]]) -> dict[str, int | float]:
    total_cases = len(cases)
    passed_cases = sum(case["passed"] is True for case in cases)
    intent_matches = sum(
        require_mapping(case["assertions"], f"{case['id']}.assertions").get(
            "intent"
        )
        is True
        for case in cases
    )
    memory_matches = sum(
        require_mapping(case["assertions"], f"{case['id']}.assertions").get(
            "memoryIds"
        )
        is True
        for case in cases
    )
    successful_tools = sum(
        require_non_negative_int(
            case.get("successfulToolCount"),
            f"{case['id']}.successfulToolCount",
        )
        for case in cases
    )
    executed_tools = sum(
        require_non_negative_int(
            case.get("executedToolCount"),
            f"{case['id']}.executedToolCount",
        )
        for case in cases
    )
    false_successes = sum(
        require_non_negative_int(
            case.get("falseSuccessCount"),
            f"{case['id']}.falseSuccessCount",
        )
        for case in cases
    )
    unauthorized_actions = sum(
        require_non_negative_int(
            case.get("unauthorizedActionCount"),
            f"{case['id']}.unauthorizedActionCount",
        )
        for case in cases
    )

    return {
        "totalCases": total_cases,
        "passedCases": passed_cases,
        "intentAccuracy": round_metric(intent_matches / total_cases),
        "memoryAccuracy": round_metric(memory_matches / total_cases),
        "taskCompletionRate": round_metric(passed_cases / total_cases),
        "toolSuccessRate": (
            0
            if executed_tools == 0
            else round_metric(successful_tools / executed_tools)
        ),
        "falseSuccessRate": round_metric(false_successes / total_cases),
        "unauthorizedActionCount": unauthorized_actions,
    }


def summarize_report(report: Any) -> dict[str, Any]:
    report_object = require_mapping(report, "Eval 报告")
    cases_value = report_object.get("cases")
    if not isinstance(cases_value, list):
        raise EvalReportError("cases 必须是数组。")
    if len(cases_value) != EXPECTED_TOTAL_CASES:
        raise EvalReportError(
            f"Eval 必须包含 {EXPECTED_TOTAL_CASES} 条 Case，实际为 {len(cases_value)}。"
        )

    cases = [
        require_mapping(case, f"cases[{index}]")
        for index, case in enumerate(cases_value)
    ]
    case_ids: list[str] = []
    categories: list[str] = []
    for index, case in enumerate(cases):
        case_id = case.get("id")
        category = case.get("category")
        if not isinstance(case_id, str) or not case_id:
            raise EvalReportError(f"cases[{index}].id 必须是非空字符串。")
        if category not in EXPECTED_CATEGORY_COUNTS:
            raise EvalReportError(f"{case_id}.category 不在允许范围内。")
        if not isinstance(case.get("passed"), bool):
            raise EvalReportError(f"{case_id}.passed 必须是布尔值。")
        case_ids.append(case_id)
        categories.append(category)

    if len(set(case_ids)) != len(case_ids):
        raise EvalReportError("Eval Case ID 必须唯一。")

    category_counts = dict(Counter(categories))
    if category_counts != EXPECTED_CATEGORY_COUNTS:
        raise EvalReportError(
            f"Eval 分类数量不匹配：{category_counts}。"
        )

    reported_metrics = require_mapping(report_object.get("metrics"), "metrics")
    calculated_metrics = calculate_metrics(cases)
    for name, expected_value in calculated_metrics.items():
        if reported_metrics.get(name) != expected_value:
            raise EvalReportError(
                f"指标 {name} 不一致：报告为 {reported_metrics.get(name)}，"
                f"复算为 {expected_value}。"
            )

    return {
        "sourceReport": "eval/results/latest.json",
        "validatedCases": EXPECTED_TOTAL_CASES,
        "passedCases": calculated_metrics["passedCases"],
        "categoryCounts": EXPECTED_CATEGORY_COUNTS,
        "metrics": calculated_metrics,
    }


def run_typescript_eval() -> None:
    npm_name = "npm.cmd" if os.name == "nt" else "npm"
    npm_path = shutil.which(npm_name)
    if not npm_path:
        raise EvalReportError(f"未找到 {npm_name}，无法运行 TypeScript Eval。")

    try:
        completed = subprocess.run(
            [npm_path, "run", "eval"],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=120,
            check=False,
        )
    except subprocess.TimeoutExpired as error:
        raise EvalReportError("TypeScript Eval 超过 120 秒。") from error

    if completed.stdout:
        print(completed.stdout.rstrip())
    if completed.returncode != 0:
        if completed.stderr:
            print(completed.stderr.rstrip(), file=sys.stderr)
        raise EvalReportError(
            f"TypeScript Eval 失败，退出码 {completed.returncode}。"
        )


def load_report(path: Path) -> dict[str, Any]:
    try:
        content = path.read_text(encoding="utf-8")
    except OSError as error:
        raise EvalReportError(f"无法读取 {path}：{error}。") from error

    try:
        return require_mapping(json.loads(content), "Eval 报告")
    except json.JSONDecodeError as error:
        raise EvalReportError(f"{path} 不是合法 JSON。") from error


def write_summary(summary: dict[str, Any]) -> None:
    try:
        SUMMARY_PATH.parent.mkdir(parents=True, exist_ok=True)
        SUMMARY_PATH.write_text(
            json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    except OSError as error:
        raise EvalReportError(f"无法写入 {SUMMARY_PATH}：{error}。") from error


def main() -> int:
    try:
        run_typescript_eval()
        summary = summarize_report(load_report(REPORT_PATH))
        write_summary(summary)
    except EvalReportError as error:
        print(f"Python Eval 失败：{error}", file=sys.stderr)
        return 1

    metrics = summary["metrics"]
    print(f"Python Validated Cases: {summary['validatedCases']}")
    print(f"Python Passed Cases: {summary['passedCases']}")
    print(f"Intent Accuracy: {metrics['intentAccuracy']:.4f}")
    print(f"Memory Accuracy: {metrics['memoryAccuracy']:.4f}")
    print(f"Task Completion Rate: {metrics['taskCompletionRate']:.4f}")
    print(f"Tool Success Rate: {metrics['toolSuccessRate']:.4f}")
    print(f"False Success Rate: {metrics['falseSuccessRate']:.4f}")
    print(f"Unauthorized Actions: {metrics['unauthorizedActionCount']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
