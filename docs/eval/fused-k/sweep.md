Dataset `golden-91q-dae72572a6`, hybrid retrieval + cross-encoder rerank, k = 8, one run per size, sequential, CPU reranker.

| KB_FUSED_TOP_K | Recall@5 | Recall@8 | MRR | nDCG@8 | No-answer acc. | Leakage | p50 retrieval | p95 retrieval |
|---|---|---|---|---|---|---|---|---|
| 12 | 98.6% | 98.6% | 0.972 | 0.962 | 94.5% | 0 | 156 ms | 365 ms |
| 20 | 97.8% | 100.0% | 0.968 | 0.966 | 94.5% | 0 | 298 ms | 611 ms |
| 30 | 97.8% | 99.3% | 0.968 | 0.962 | 93.4% | 0 | 557 ms | 1013 ms |
| 50 | 97.1% | 98.6% | 0.968 | 0.958 | 93.4% | 0 | 751 ms | 1619 ms |
