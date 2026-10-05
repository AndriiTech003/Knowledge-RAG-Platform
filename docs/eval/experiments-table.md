| Configuration | Recall@5 | Recall@8 | MRR | nDCG@8 | exact_term R@8 | No-answer acc. | Faithfulness | Correctness | p95 latency (retrieval) | p95 latency (answer) |
|---|---|---|---|---|---|---|---|---|---|---|
| Vector only, chunk 800 | 91.8% | 94.8% | 0.867 | 0.873 | 100.0% | 80.9% | 99.5% | 3.403 | 58.290 ms | 54.870 ms |
| Vector only, chunk 450 | 91.8% | 94.8% | 0.859 | 0.870 | 100.0% | 80.9% | 99.5% | 3.403 | 121.580 ms | 74.530 ms |
| + contextual prefix | 95.5% | 95.5% | 0.945 | 0.934 | 100.0% | 79.8% | 100.0% | 3.582 | 84.820 ms | 69.330 ms |
| + lexical (hybrid RRF) | 98.5% | 98.5% | 0.943 | 0.942 | 100.0% | 79.8% | 99.5% | 3.448 | 82.980 ms | 57.050 ms |
| + reranker | 97.0% | 98.5% | 0.967 | 0.957 | 100.0% | 93.3% | 99.5% | 3.597 | 2673.300 ms | 1965.280 ms |
