# Memory Performance Report

- Generated at: 2026-04-01T07:37:01.646Z
- Source persona: e92e08d8-a25e-4a56-a439-60d71b0e4e69
- Temporary persona: d3d38aa7-8377-48c4-8b8d-a6714ab2b9a5
- Embedding provider: openai (text-embedding-3-large)
- Reranker provider: jina
- External embedding key configured: no (fallback active)
- External reranker key configured: no (fallback/original order)

## Sequential Core Metrics

| Metric | Count | Mean (ms) | P95 (ms) | Max (ms) | Target | Verdict |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| memory.search.duration | 4 | 709.75 | 992.00 | 992.00 | < 2000ms | PASS |
| memory.getContext.duration | 4 | 1177.50 | 1405.00 | 1405.00 | < 2000ms | PASS |
| embedding.duration | 4 | 1.00 | 1.00 | 1.00 | - | - |
| reranker.duration | 4 | 0.25 | 1.00 | 1.00 | - | - |

## Sequential Samples

| Case | Input | Duration (ms) | Retrieved Memories |
| --- | --- | ---: | ---: |
| C01 | 你还记得我上次说的面试吗 | 1493 | 1 |
| C03 | 那只猫今天又来了 | 1605 | 2 |
| C09 | 我今天去看了那个展 | 1191 | 1 |
| C10 | 我真的照你说的做了 | 1223 | 1 |

## Concurrency

- Concurrent requests: 5
- Wall time: 2211ms
- Average client duration: 1736.20ms

| Metric | Count | Mean (ms) | P95 (ms) | Max (ms) | Target | Verdict |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| memory.search.duration | 5 | 843.40 | 1365.00 | 1365.00 | < 2000ms | PASS |
| memory.getContext.duration | 5 | 1530.80 | 2020.00 | 2020.00 | < 2000ms | FAIL |
| embedding.duration | 5 | 1.00 | 1.00 | 1.00 | - | - |
| reranker.duration | 5 | 0.40 | 1.00 | 1.00 | - | - |

| Case | Input | Duration (ms) | Retrieved Memories |
| --- | --- | ---: | ---: |
| C01 | 你还记得我上次说的面试吗 | 1519 | 1 |
| C03 | 那只猫今天又来了 | 1884 | 2 |
| C06 | 我那个项目终于收尾了 | 2211 | 3 |
| C09 | 我今天去看了那个展 | 1519 | 1 |
| C10 | 我真的照你说的做了 | 1548 | 1 |

## Verdict

- Memory retrieval target (<2s): PASS
- Embedding latency interpretation: Measured in fallback mode because no external embedding API key is configured.
- Reranker latency interpretation: Measured in fallback/original-order mode because no reranker API key is configured.

