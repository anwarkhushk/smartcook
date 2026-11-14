#!/usr/bin/env python3
"""
analyze.py — Within-Subject User Study Analysis Script for SmartCook (Phase 6)

Reads:
  1. SmartCook JSON event log file(s) downloaded from the app
  2. A System Usability Scale (SUS) CSV questionnaire file

Computes:
  - Mean and standard deviation of task completion time (seconds) per mode
  - Mean and total error counts per mode
  - Paired t-test (scipy.stats.ttest_rel) and Wilcoxon signed-rank test
    (scipy.stats.wilcoxon) comparing "baseline" vs "smartcook"
  - System Usability Scale (SUS) scores (0-100) per participant and mode

Setup & Usage:
  pip install -r analysis/requirements.txt
  python3 analysis/analyze.py
  python3 analysis/analyze.py --logs path/to/logs.json --sus path/to/sus.csv
"""

import argparse
import csv
import json
import math
from pathlib import Path

try:
    import pandas as pd
    from scipy import stats

    HAS_SCIPY_PANDAS = True
except ImportError:
    HAS_SCIPY_PANDAS = False


def load_task_runs_raw(log_paths):
    """
    Extract completed task runs from one or more SmartCook JSON log files.
    Each task_end event records: participantId, mode, taskName,
    durationSeconds, and errorCount.
    """
    rows = []

    for path in log_paths:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        events = data.get("events", data if isinstance(data, list) else [])

        for ev in events:
            if ev.get("eventType") == "task_end" or ev.get("action") == "task_end":
                rows.append(
                    {
                        "participantId": ev.get("participantId", "unknown"),
                        "mode": ev.get("mode", "smartcook"),
                        "taskName": ev.get("taskName", "unknown"),
                        "durationSeconds": float(ev.get("durationSeconds", 0.0)),
                        "errorCount": int(ev.get("errorCount", 0)),
                    }
                )

    return rows


def compute_sus_score(row):
    """
    Standard System Usability Scale (SUS) formula (Brooke, 1996):
      - Odd items (q1, q3, q5, q7, q9): score - 1
      - Even items (q2, q4, q6, q8, q10): 5 - score
      - Sum all 10 adjusted values and multiply by 2.5 -> scale of 0 to 100
    """
    odd_cols = ["q1", "q3", "q5", "q7", "q9"]
    even_cols = ["q2", "q4", "q6", "q8", "q10"]

    odd_sum = sum(int(row[c]) - 1 for c in odd_cols)
    even_sum = sum(5 - int(row[c]) for c in even_cols)
    return (odd_sum + even_sum) * 2.5


# =====================================================================
# PRIMARY IMPLEMENTATION (pandas + scipy.stats)
# =====================================================================

def run_paired_tests_scipy(series_baseline, series_smartcook, metric_name):
    """Run paired t-test and Wilcoxon signed-rank test using scipy.stats."""
    print(f"\n--- Statistical Comparison: {metric_name} ---")
    n = len(series_baseline)
    if n < 2:
        print("  Not enough paired participants (need >= 2) to run statistical tests.")
        return

    # 1. Paired Student's t-test (parametric)
    t_stat, t_pval = stats.ttest_rel(series_baseline, series_smartcook)
    print(f"  Paired t-test (n={n}):      t = {t_stat:.4f}, p = {t_pval:.4f}")

    # 2. Wilcoxon signed-rank test (non-parametric)
    diffs = series_baseline - series_smartcook
    if (diffs == 0).all():
        print("  Wilcoxon test:           All differences are zero.")
    else:
        w_stat, w_pval = stats.wilcoxon(series_baseline, series_smartcook)
        print(f"  Wilcoxon signed-rank:    W = {w_stat:.4f}, p = {w_pval:.4f}")


def analyze_with_pandas_scipy(rows, sus_csv_path):
    """Full analysis using pandas DataFrames and scipy.stats."""
    print("==========================================================")
    print("1. TASK PERFORMANCE ANALYSIS (TIME & ERRORS BY MODE)")
    print("==========================================================")

    df_tasks = pd.DataFrame(rows)
    if df_tasks.empty:
        print("No 'task_end' events found in the provided log file(s).")
    else:
        summary = (
            df_tasks.groupby("mode")
            .agg(
                runs=("durationSeconds", "count"),
                mean_time_s=("durationSeconds", "mean"),
                sd_time_s=("durationSeconds", "std"),
                mean_errors=("errorCount", "mean"),
                total_errors=("errorCount", "sum"),
            )
            .reset_index()
        )
        print("\nDescriptive Summary by Mode:")
        print(summary.to_string(index=False, float_format=lambda x: f"{x:.2f}"))

        paired = (
            df_tasks.groupby(["participantId", "mode"])
            .agg(
                mean_time=("durationSeconds", "mean"),
                total_errors=("errorCount", "sum"),
            )
            .unstack("mode")
        )

        if ("mean_time", "baseline") in paired.columns and (
            "mean_time",
            "smartcook",
        ) in paired.columns:
            valid_time = paired["mean_time"].dropna()
            run_paired_tests_scipy(
                valid_time["baseline"],
                valid_time["smartcook"],
                "Task Completion Time (seconds)",
            )

            valid_err = paired["total_errors"].dropna()
            run_paired_tests_scipy(
                valid_err["baseline"],
                valid_err["smartcook"],
                "Error Count per Participant",
            )

    if Path(sus_csv_path).exists():
        print("\n==========================================================")
        print("2. SYSTEM USABILITY SCALE (SUS) ANALYSIS")
        print("==========================================================")

        df_sus = pd.read_csv(sus_csv_path)
        df_sus["sus_score"] = df_sus.apply(compute_sus_score, axis=1)

        print("\nIndividual SUS Scores:")
        print(
            df_sus[["participantId", "mode", "sus_score"]].to_string(
                index=False, float_format=lambda x: f"{x:.1f}"
            )
        )

        sus_summary = (
            df_sus.groupby("mode")["sus_score"]
            .agg(
                count="count",
                mean_sus="mean",
                sd_sus="std",
                min_sus="min",
                max_sus="max",
            )
            .reset_index()
        )
        print("\nSUS Summary by Mode (0–100 scale, >= 68 is above average):")
        print(sus_summary.to_string(index=False, float_format=lambda x: f"{x:.2f}"))

        pivoted = df_sus.pivot(
            index="participantId", columns="mode", values="sus_score"
        ).dropna()
        if "baseline" in pivoted.columns and "smartcook" in pivoted.columns:
            run_paired_tests_scipy(
                pivoted["baseline"],
                pivoted["smartcook"],
                "SUS Score (0–100)",
            )


# =====================================================================
# STDLIB FALLBACK (if pandas/scipy are not installed in current venv)
# =====================================================================

def _mean(vals):
    return sum(vals) / len(vals) if vals else 0.0


def _std(vals):
    if len(vals) < 2:
        return 0.0
    m = _mean(vals)
    return math.sqrt(sum((x - m) ** 2 for x in vals) / (len(vals) - 1))


def _paired_tests_stdlib(vals_a, vals_b, metric_name):
    print(f"\n--- Statistical Comparison: {metric_name} ---")
    n = len(vals_a)
    if n < 2:
        print("  Not enough paired participants (need >= 2).")
        return

    diffs = [a - b for a, b in zip(vals_a, vals_b)]
    m_diff = _mean(diffs)
    sd_diff = _std(diffs)
    t_stat = m_diff / (sd_diff / math.sqrt(n)) if sd_diff > 0 else 0.0

    # Normal approx for two-tailed p-value
    z = abs(t_stat)
    p_approx = 2.0 * (1.0 - 0.5 * (1.0 + math.erf(z / math.sqrt(2.0))))
    print(f"  Paired t-test (n={n}):      t = {t_stat:.4f}, p ≈ {p_approx:.4f}")

    # Wilcoxon signed-rank statistic W
    non_zero = [(abs(d), 1 if d > 0 else -1) for d in diffs if d != 0]
    non_zero.sort(key=lambda x: x[0])
    w_plus = sum((idx + 1) for idx, (_, sign) in enumerate(non_zero) if sign > 0)
    w_minus = sum((idx + 1) for idx, (_, sign) in enumerate(non_zero) if sign < 0)
    w_stat = min(w_plus, w_minus)
    print(f"  Wilcoxon signed-rank:    W = {w_stat:.4f}")


def analyze_with_stdlib(rows, sus_csv_path):
    print(
        "[Note] Running with built-in Python math fallback (install pandas & scipy via "
        "'pip install -r analysis/requirements.txt' for exact scipy p-values).\n"
    )
    print("==========================================================")
    print("1. TASK PERFORMANCE ANALYSIS (TIME & ERRORS BY MODE)")
    print("==========================================================")

    by_mode = {"baseline": [], "smartcook": []}
    by_pid = {}
    for r in rows:
        m = r["mode"]
        by_mode.setdefault(m, []).append(r)
        by_pid.setdefault(r["participantId"], {})[m] = r

    print("\nDescriptive Summary by Mode:")
    print(f"{'mode':<12} {'runs':>6} {'mean_time_s':>13} {'sd_time_s':>11} {'mean_errors':>13} {'total_errors':>14}")
    for m, items in by_mode.items():
        if not items:
            continue
        times = [x["durationSeconds"] for x in items]
        errs = [x["errorCount"] for x in items]
        print(
            f"{m:<12} {len(items):>6} {_mean(times):>13.2f} {_std(times):>11.2f} {_mean(errs):>13.2f} {sum(errs):>14}"
        )

    paired_pids = [
        p for p, modes in by_pid.items() if "baseline" in modes and "smartcook" in modes
    ]
    if len(paired_pids) >= 2:
        b_times = [by_pid[p]["baseline"]["durationSeconds"] for p in paired_pids]
        s_times = [by_pid[p]["smartcook"]["durationSeconds"] for p in paired_pids]
        _paired_tests_stdlib(b_times, s_times, "Task Completion Time (seconds)")

        b_errs = [by_pid[p]["baseline"]["errorCount"] for p in paired_pids]
        s_errs = [by_pid[p]["smartcook"]["errorCount"] for p in paired_pids]
        _paired_tests_stdlib(b_errs, s_errs, "Error Count per Participant")

    if Path(sus_csv_path).exists():
        print("\n==========================================================")
        print("2. SYSTEM USABILITY SCALE (SUS) ANALYSIS")
        print("==========================================================")
        with open(sus_csv_path, "r", encoding="utf-8") as f:
            sus_rows = list(csv.DictReader(f))

        sus_by_mode = {"baseline": [], "smartcook": []}
        sus_by_pid = {}
        print("\nIndividual SUS Scores:")
        print(f"{'participantId':<15} {'mode':<12} {'sus_score':>10}")
        for r in sus_rows:
            score = compute_sus_score(r)
            m = r["mode"]
            pid = r["participantId"]
            sus_by_mode.setdefault(m, []).append(score)
            sus_by_pid.setdefault(pid, {})[m] = score
            print(f"{pid:<15} {m:<12} {score:>10.1f}")

        print("\nSUS Summary by Mode (0–100 scale, >= 68 is above average):")
        print(f"{'mode':<12} {'count':>6} {'mean_sus':>10} {'sd_sus':>10} {'min_sus':>9} {'max_sus':>9}")
        for m, scores in sus_by_mode.items():
            if not scores:
                continue
            print(
                f"{m:<12} {len(scores):>6} {_mean(scores):>10.2f} {_std(scores):>10.2f} {min(scores):>9.2f} {max(scores):>9.2f}"
            )

        sus_pids = [
            p for p, modes in sus_by_pid.items() if "baseline" in modes and "smartcook" in modes
        ]
        if len(sus_pids) >= 2:
            b_sus = [sus_by_pid[p]["baseline"] for p in sus_pids]
            s_sus = [sus_by_pid[p]["smartcook"] for p in sus_pids]
            _paired_tests_stdlib(b_sus, s_sus, "SUS Score (0–100)")


def main():
    base_dir = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(
        description="Analyze SmartCook user study logs and SUS CSV."
    )
    parser.add_argument(
        "--logs",
        nargs="+",
        default=[str(base_dir / "sample_logs.json")],
        help="Path(s) to downloaded SmartCook JSON log file(s)",
    )
    parser.add_argument(
        "--sus",
        default=str(base_dir / "sample_sus.csv"),
        help="Path to SUS questionnaire CSV file",
    )
    args = parser.parse_args()

    rows = load_task_runs_raw(args.logs)
    if HAS_SCIPY_PANDAS:
        analyze_with_pandas_scipy(rows, args.sus)
    else:
        analyze_with_stdlib(rows, args.sus)

    print("\n==========================================================\n")


if __name__ == "__main__":
    main()
