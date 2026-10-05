### Eval: `hybrid+rerank` (retrieval), dataset `golden-91q-dae72572a6`

| Metric | Value | Δ vs main |
|---|---|---|
| Recall@5 | 97.1% | - |
| Recall@8 | 99.3% | - |
| MRR | 0.968 | - |
| nDCG@8 | 0.962 | - |
| Leakage rate | 0.0% | - |
| No-answer accuracy | 94.5% | - |
| p50 latency ms | 350.380 | - |
| p95 latency ms | 668.710 | - |

| Type | n | Recall@8 | MRR | No-answer acc. |
|---|---|---|---|---|
| conflicting | 3 | 100.0% | 1.000 | 100.0% |
| exact_term | 12 | 100.0% | 1.000 | 100.0% |
| factoid | 27 | 100.0% | 0.975 | 96.3% |
| follow_up | 6 | 100.0% | 1.000 | 100.0% |
| injection | 2 | 100.0% | 1.000 | 100.0% |
| multi_hop | 7 | 92.9% | 0.905 | 100.0% |
| permission | 12 | - | - | 91.7% |
| table | 12 | 100.0% | 0.929 | 100.0% |
| unanswerable | 10 | - | - | 70.0% |
