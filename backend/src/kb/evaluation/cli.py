from __future__ import annotations

import argparse
import asyncio
import json
import sys
import uuid
from pathlib import Path
from typing import Any

from kb.config import Settings, get_settings
from kb.core.container import build_container
from kb.core.dbadmin import create_database, drop_database, migrate
from kb.evaluation.dataset import default_data_dir, load_dataset
from kb.evaluation.runner import EvalConfig, EvalReport, evaluate, store_report
from kb.evaluation.source_hash import source_tree_hash
from kb.ingestion.chunking.profiles import ChunkingProfile, get_profile
from kb.providers.rerankers import build_reranker
from kb.retrieval.retriever import RetrievalConfig

GATE_RECALL = 0.85
GATE_MAX_DROP = 0.03


def out(message: str) -> None:
    sys.stdout.write(message + "\n")
    sys.stdout.flush()


def fmt(value: object, pct: bool = False) -> str:
    if value is None:
        return "-"
    if isinstance(value, float):
        return f"{value * 100:.1f}%" if pct else f"{value:.3f}"
    return str(value)


def report_markdown(report: EvalReport, baseline: dict[str, Any] | None = None) -> str:
    m = report.metrics
    rows = [
        ("Recall@5", "recall@5", True),
        ("Recall@8", "recall@8", True),
        ("MRR", "mrr", False),
        ("nDCG@8", "ndcg@8", False),
        ("Leakage rate", "leakage_rate", True),
        ("No-answer accuracy", "no_answer_accuracy", True),
        ("Correctness (1-5)", "correctness", False),
        ("Faithfulness", "faithfulness", True),
        ("Citation precision", "citation_precision", True),
        ("Injection resisted", "injection_resisted", True),
        ("p50 latency ms", "p50_latency_ms", False),
        ("p95 latency ms", "p95_latency_ms", False),
    ]
    lines = [
        f"### Eval: `{report.config.name}` ({report.config.mode}), dataset `{report.dataset_version}`",
        "",
        "| Metric | Value | Δ vs main |",
        "|---|---|---|",
    ]
    for label, name, pct in rows:
        if m.get(name) is None:
            continue
        delta = "-"
        if baseline and isinstance(baseline.get(name), int | float) and isinstance(m.get(name), int | float):
            d = float(m[name]) - float(baseline[name])
            delta = f"{d * 100:+.1f} pp" if pct else f"{d:+.3f}"
        lines.append(f"| {label} | {fmt(m.get(name), pct)} | {delta} |")
    lines += ["", "| Type | n | Recall@8 | MRR | No-answer acc. |", "|---|---|---|---|---|"]
    for kind, values in report.by_type.items():
        lines.append(
            f"| {kind} | {values['questions']} | {fmt(values.get('recall@8'), True)} | {fmt(values.get('mrr'))} | "
            f"{fmt(values.get('no_answer_accuracy'), True)} |"
        )
    return "\n".join(lines) + "\n"


def config_from_args(args: argparse.Namespace) -> EvalConfig:
    fused_k = args.fused_k if args.fused_k is not None else get_settings().fused_top_k
    retrieval = RetrievalConfig(mode=args.retrieval, rerank=not args.no_rerank, k=args.k, fused_k=fused_k)
    return EvalConfig(
        name=args.name or f"{args.retrieval}{'' if args.no_rerank else '+rerank'}",
        mode=args.mode,
        retrieval=retrieval,
        threshold=args.threshold,
        llm_provider=args.llm_provider,
        judge_provider=args.judge_provider,
        limit=args.limit,
    )


async def cmd_run(args: argparse.Namespace) -> int:
    settings = get_settings()
    container = build_container(settings)
    try:
        dataset = load_dataset(limit=args.limit)
        config = config_from_args(args)
        out(
            f"eval: {config.name} mode={config.mode} questions={len(dataset.questions)} dataset={dataset.version}"
        )
        report = await evaluate(container, dataset, config, progress=True)
        if args.store:
            run_id = await store_report(container, report, source_tree_hash())
            out(f"eval: stored run {run_id}")
    finally:
        await container.aclose()
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(report.model_dump_json(indent=2))
    baseline = None
    if args.baseline and Path(args.baseline).exists():
        baseline = json.loads(Path(args.baseline).read_text()).get("metrics")
    markdown = report_markdown(report, baseline)
    if args.markdown:
        Path(args.markdown).write_text(markdown)
    out(markdown)
    return 0


def cmd_gate(args: argparse.Namespace) -> int:
    report = json.loads(Path(args.report).read_text())
    metrics = report["metrics"]
    failures: list[str] = []
    if metrics.get("leakage_rate", 1) != 0:
        failures.append(f"leakage_rate={metrics.get('leakage_rate')} (must be 0)")
    recall = metrics.get("recall@8") or 0.0
    if recall < args.min_recall:
        failures.append(f"recall@8={recall:.3f} < {args.min_recall}")
    if args.baseline and Path(args.baseline).exists():
        base = json.loads(Path(args.baseline).read_text())["metrics"]
        drop = float(base.get("recall@8") or 0) - float(recall)
        if drop > args.max_drop:
            failures.append(
                f"recall@8 dropped by {drop * 100:.1f} pp vs main (max {args.max_drop * 100:.0f} pp)"
            )
    if failures:
        out("eval gate: FAILED\n- " + "\n- ".join(failures))
        return 1
    out(f"eval gate: passed (recall@8={recall:.3f}, leakage_rate={metrics.get('leakage_rate')})")
    return 0


def cmd_tune(args: argparse.Namespace) -> int:
    report = json.loads(Path(args.report).read_text())
    rows = [(r["metrics"]["best_score"], r["expected"] == "no_answer") for r in report["results"]]
    sweep: list[tuple[float, float, int]] = []
    lines = ["| τ | no-answer accuracy | false refusals | missed refusals |", "|---|---|---|---|"]
    for step in range(0, 101, 2):
        tau = step / 100
        correct = sum(1 for score, should in rows if (score < tau) == should)
        false_refusal = sum(1 for score, should in rows if score < tau and not should)
        missed = sum(1 for score, should in rows if score >= tau and should)
        accuracy = correct / len(rows)
        sweep.append((tau, accuracy, false_refusal))
        if step % 4 == 0:
            lines.append(f"| {tau:.2f} | {accuracy * 100:.1f}% | {false_refusal} | {missed} |")
    out("\n".join(lines))
    top = max(a for _t, a, _f in sweep)
    plateau = [(t, f) for t, a, f in sweep if a == top]
    fewest = min(f for _t, f in plateau)
    choice = [t for t, f in plateau if f == fewest]
    out(
        f"best accuracy {top * 100:.1f}% for τ in [{plateau[0][0]:.2f}, {plateau[-1][0]:.2f}]; "
        f"fewest false refusals ({fewest}) for τ in [{choice[0]:.2f}, {choice[-1]:.2f}]"
    )
    return 0


VARIANTS: dict[str, tuple[str, bool]] = {
    "large-noprefix": ("large", False),
    "default-noprefix": ("default", False),
    "default-prefix": ("default", True),
}

EXPERIMENTS: list[tuple[str, str, str, bool]] = [
    ("Vector only, chunk 800", "large-noprefix", "vector", False),
    ("Vector only, chunk 450", "default-noprefix", "vector", False),
    ("+ contextual prefix", "default-prefix", "vector", False),
    ("+ lexical (hybrid RRF)", "default-prefix", "hybrid", False),
    ("+ reranker", "default-prefix", "hybrid", True),
]


async def build_variant(settings: Settings, variant: str, data_dir: Path) -> None:
    from kb.seed import ensure_collections, ingest_inline, register_corpus

    profile_name, prefix = VARIANTS[variant]
    base = get_profile(profile_name)
    profile = ChunkingProfile(
        name=f"{profile_name}-{'prefix' if prefix else 'noprefix'}",
        max_tokens=base.max_tokens,
        contextual_prefix=prefix,
    )
    container = build_container(settings)
    try:
        await container.storage.ensure_bucket()
        collections = await ensure_collections(container, data_dir)
        queued = await register_corpus(container, data_dir, collections)
        stats = await ingest_inline(container, queued, profile)
        out(f"experiments: built {variant}: {stats}")
    finally:
        await container.aclose()


async def cmd_experiments(args: argparse.Namespace) -> int:
    base_settings = get_settings()
    data_dir = default_data_dir()
    dataset = load_dataset(limit=args.limit)
    run_tag = uuid.uuid4().hex[:6]
    results: list[dict[str, Any]] = []
    for variant in VARIANTS:
        url = (
            base_settings.database_url.rsplit("/", 1)[0]
            + f"/kb_test_exp_{variant.replace('-', '_')}_{run_tag}"
        )
        settings = base_settings.model_copy(
            update={
                "database_url": url,
                "s3_bucket": f"kb-test-exp-{run_tag}",
                "redis_prefix": f"kbexp{run_tag}",
            }
        )
        create_database(url, exist_ok=False)
        try:
            migrate(url)
            await build_variant(settings, variant, data_dir)
            for label, v, mode, rerank in EXPERIMENTS:
                if v != variant:
                    continue
                for full in [False, True] if args.full else [False]:
                    container = build_container(settings)
                    if rerank and container.reranker is None:
                        container.reranker = build_reranker(
                            settings.model_copy(update={"reranker": "remote"})
                        )
                    try:
                        config = EvalConfig(
                            name=label,
                            mode="full" if full else "retrieval",
                            retrieval=RetrievalConfig.model_validate({"mode": mode, "rerank": rerank}),
                            chunking_profile=VARIANTS[variant][0],
                            contextual_prefix=VARIANTS[variant][1],
                            judge_stability=False,
                        )
                        report = await evaluate(container, dataset, config)
                    finally:
                        await container.aclose()
                    results.append(
                        {
                            "label": label,
                            "variant": variant,
                            "mode": config.mode,
                            "metrics": report.metrics,
                            "by_type": report.by_type,
                        }
                    )
                    out(
                        f"experiments: {label} [{config.mode}] recall@8={report.metrics.get('recall@8')} "
                        f"mrr={report.metrics.get('mrr')} p95={report.metrics.get('p95_latency_ms')}"
                    )
        finally:
            if not args.keep:
                drop_database(url)
                from kb.core.storage import ObjectStorage

                ObjectStorage(settings).remove_bucket_sync()
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps({"dataset": dataset.version, "results": results}, indent=2))
    out(experiments_markdown(results))
    return 0


def experiments_markdown(results: list[dict[str, Any]]) -> str:
    lines = [
        "| Configuration | Recall@5 | Recall@8 | MRR | nDCG@8 | exact_term R@8 | No-answer acc. | Faithfulness | Correctness | p95 latency (retrieval) | p95 latency (answer) |",
        "|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    by_label: dict[str, dict[str, dict[str, Any]]] = {}
    for item in results:
        by_label.setdefault(item["label"], {})[item["mode"]] = item
    for label, modes in by_label.items():
        r = modes.get("retrieval", {}).get("metrics", {})
        f = modes.get("full", {}).get("metrics", {})
        exact = modes.get("retrieval", {}).get("by_type", {}).get("exact_term", {})
        lines.append(
            f"| {label} | {fmt(r.get('recall@5'), True)} | {fmt(r.get('recall@8'), True)} | {fmt(r.get('mrr'))} | "
            f"{fmt(r.get('ndcg@8'))} | {fmt(exact.get('recall@8'), True)} | {fmt(r.get('no_answer_accuracy'), True)} | "
            f"{fmt(f.get('faithfulness'), True)} | {fmt(f.get('correctness'))} | {fmt(r.get('p95_latency_ms'))} ms | "
            f"{fmt(f.get('p95_latency_ms'))} ms |"
        )
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="kb-eval")
    sub = parser.add_subparsers(dest="command", required=True)
    run = sub.add_parser("run")
    run.add_argument("--mode", choices=["retrieval", "full"], default="retrieval")
    run.add_argument("--retrieval", choices=["vector", "lexical", "hybrid"], default="hybrid")
    run.add_argument("--no-rerank", action="store_true")
    run.add_argument("--k", type=int, default=8)
    run.add_argument("--fused-k", type=int, default=None)
    run.add_argument("--threshold", type=float, default=None)
    run.add_argument("--llm-provider", choices=["fake", "anthropic", "openai"], default="fake")
    run.add_argument("--judge-provider", choices=["fake", "anthropic", "openai"], default="fake")
    run.add_argument("--limit", type=int, default=None)
    run.add_argument("--name", default=None)
    run.add_argument("--store", action="store_true")
    run.add_argument("--out", default="reports/eval-latest.json")
    run.add_argument("--markdown", default=None)
    run.add_argument("--baseline", default=None)
    gate = sub.add_parser("gate")
    gate.add_argument("--report", default="reports/eval-latest.json")
    gate.add_argument("--baseline", default=None)
    gate.add_argument("--min-recall", type=float, default=GATE_RECALL)
    gate.add_argument("--max-drop", type=float, default=GATE_MAX_DROP)
    tune = sub.add_parser("tune-threshold")
    tune.add_argument("--report", default="reports/eval-latest.json")
    exp = sub.add_parser("experiments")
    exp.add_argument("--out", default="reports/experiments.json")
    exp.add_argument("--full", action="store_true")
    exp.add_argument("--keep", action="store_true")
    exp.add_argument("--limit", type=int, default=None)
    args = parser.parse_args(argv)
    if args.command == "run":
        return asyncio.run(cmd_run(args))
    if args.command == "gate":
        return cmd_gate(args)
    if args.command == "tune-threshold":
        return cmd_tune(args)
    return asyncio.run(cmd_experiments(args))


if __name__ == "__main__":
    raise SystemExit(main())
