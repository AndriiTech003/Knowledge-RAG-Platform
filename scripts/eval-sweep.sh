#!/usr/bin/env bash
set -euo pipefail
STACK_NAME=evalsweep
API_PORT="${API_PORT:-4446}" WEB_PORT="${WEB_PORT:-4447}" MODELS_PORT="${MODELS_PORT:-4448}"
source "$(dirname "$0")/stack.sh"
stack_init evalsweep
OUT="$ROOT/docs/eval/fused-k"
SIZES="${FUSED_K_SIZES-12 20 30 50}"
mkdir -p "$OUT"

finish() {
  local code=$?
  set +e
  stack_cleanup
  if [ "$code" -eq 0 ]; then echo "eval-sweep: PASSED (logs in $LOG_DIR)"; else echo "eval-sweep: FAILED ($code), logs in $LOG_DIR"; fi
  exit "$code"
}
trap finish EXIT INT TERM

check_ports "$MODELS_PORT"
start_models
(cd "$BACKEND" && "$VENV/kb-seed" --mode inline >"$LOG_DIR/seed.log" 2>&1)
tail -n 1 "$LOG_DIR/seed.log"
cd "$BACKEND"
for k in $SIZES; do
  "$VENV/kb-eval" run --mode retrieval --fused-k "$k" --name "hybrid+rerank, fused_k=$k" --out "$OUT/eval-k$k.json" >"$LOG_DIR/eval-k$k.log" 2>&1
  tail -n 2 "$LOG_DIR/eval-k$k.log"
done
"$VENV/kb-eval" run --mode retrieval --out "$OUT/eval-default.json" --markdown "$OUT/eval-default.md" >"$LOG_DIR/eval-default.log" 2>&1
"$VENV/kb-eval" gate --report "$OUT/eval-default.json" | tee "$LOG_DIR/gate.log"
[ -z "$SIZES" ] && exit 0
"$VENV/python" - "$OUT" $SIZES <<'PY'
import json, sys
from pathlib import Path
out = Path(sys.argv[1])
rows = []
for k in sys.argv[2:]:
    report = json.loads((out / f"eval-k{k}.json").read_text())
    m = report["metrics"]
    rows.append(
        f"| {k} | {m['recall@5']:.1%} | {m['recall@8']:.1%} | {m['mrr']:.3f} | {m['ndcg@8']:.3f} | "
        f"{m['no_answer_accuracy']:.1%} | {m['leakage_rate']:.0f} | {m['p50_latency_ms']:.0f} ms | {m['p95_latency_ms']:.0f} ms |"
    )
dataset = json.loads((out / f"eval-k{sys.argv[2]}.json").read_text())["dataset_version"]
table = [
    f"Dataset `{dataset}`, hybrid retrieval + cross-encoder rerank, k = 8, one run per size, sequential, CPU reranker.",
    "",
    "| KB_FUSED_TOP_K | Recall@5 | Recall@8 | MRR | nDCG@8 | No-answer acc. | Leakage | p50 retrieval | p95 retrieval |",
    "|---|---|---|---|---|---|---|---|---|",
    *rows,
]
(out / "sweep.md").write_text("\n".join(table) + "\n")
print("\n".join(table))
PY
