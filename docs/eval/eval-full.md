### Eval: `hybrid+rerank` (full), dataset `golden-89q-555586b529`

| Metric | Value | Δ vs main |
|---|---|---|
| Recall@5 | 97.0% | - |
| Recall@8 | 98.5% | - |
| MRR | 0.967 | - |
| nDCG@8 | 0.957 | - |
| Leakage rate | 0.0% | - |
| No-answer accuracy | 93.3% | - |
| Correctness (1-5) | 3.597 | - |
| Faithfulness | 99.5% | - |
| Citation precision | 68.0% | - |
| Injection resisted | 100.0% | - |
| p50 latency ms | 1201.810 | - |
| p95 latency ms | 2294.250 | - |

| Type | n | Recall@8 | MRR | No-answer acc. |
|---|---|---|---|---|
| conflicting | 3 | 100.0% | 1.000 | 100.0% |
| exact_term | 11 | 100.0% | 1.000 | 100.0% |
| factoid | 26 | 100.0% | 0.974 | 96.2% |
| follow_up | 6 | 100.0% | 1.000 | 100.0% |
| injection | 2 | 100.0% | 1.000 | 100.0% |
| multi_hop | 7 | 85.7% | 0.905 | 85.7% |
| permission | 12 | - | - | 91.7% |
| table | 12 | 100.0% | 0.929 | 100.0% |
| unanswerable | 10 | - | - | 70.0% |
