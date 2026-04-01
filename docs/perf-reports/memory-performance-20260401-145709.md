# Memory Performance Report

- Generated at: 2026-04-01T06:57:09.630Z
- Source persona: e92e08d8-a25e-4a56-a439-60d71b0e4e69
- Temporary persona: d3dc72fe-03fb-4b76-a5c3-b3003d951ce8
- Embedding provider: openai (text-embedding-3-large)
- Reranker provider: jina
- External embedding key configured: no (fallback active)
- External reranker key configured: no (fallback/original order)

## Sequential Core Metrics

| Metric | Count | Mean (ms) | P95 (ms) | Max (ms) | Target | Verdict |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| memory.search.duration | 4 | 718.50 | 1032.00 | 1032.00 | < 2000ms | PASS |
| memory.getContext.duration | 4 | 1187.00 | 1439.00 | 1439.00 | < 2000ms | PASS |
| embedding.duration | 4 | 1.00 | 1.00 | 1.00 | - | - |
| reranker.duration | 4 | 0.00 | 0.00 | 0.00 | - | - |

## Sequential Samples

| Case | Input | Duration (ms) | Retrieved Memories |
| --- | --- | ---: | ---: |
| C01 | 你还记得我上次说的面试吗 | 1463 | 1 |
| C03 | 那只猫今天又来了 | 1647 | 2 |
| C09 | 我今天去看了那个展 | 1233 | 1 |
| C10 | 我真的照你说的做了 | 1226 | 1 |

## Concurrency

- Concurrent requests: 5
- Wall time: 2336ms
- Average client duration: 1862.20ms

| Metric | Count | Mean (ms) | P95 (ms) | Max (ms) | Target | Verdict |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| memory.search.duration | 5 | 893.40 | 1406.00 | 1406.00 | < 2000ms | PASS |
| memory.getContext.duration | 5 | 1667.80 | 2141.00 | 2141.00 | < 2000ms | FAIL |
| embedding.duration | 5 | 1.00 | 1.00 | 1.00 | - | - |
| reranker.duration | 5 | 0.20 | 1.00 | 1.00 | - | - |

| Case | Input | Duration (ms) | Retrieved Memories |
| --- | --- | ---: | ---: |
| C01 | 你还记得我上次说的面试吗 | 1498 | 1 |
| C03 | 那只猫今天又来了 | 1916 | 2 |
| C06 | 我那个项目终于收尾了 | 2336 | 3 |
| C09 | 我今天去看了那个展 | 1463 | 1 |
| C10 | 我真的照你说的做了 | 2098 | 1 |

## Verdict

- Memory retrieval target (<2s): PASS
- Embedding latency interpretation: Measured in fallback mode because no external embedding API key is configured.
- Reranker latency interpretation: Measured in fallback/original-order mode because no reranker API key is configured.

