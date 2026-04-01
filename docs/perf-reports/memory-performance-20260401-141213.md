# Memory Performance Report

- Generated at: 2026-04-01T06:12:13.517Z
- Source persona: e92e08d8-a25e-4a56-a439-60d71b0e4e69
- Temporary persona: bd46ea1d-ca93-4a72-8edc-fad625017e3e
- Embedding provider: openai (text-embedding-3-large)
- Reranker provider: jina
- External embedding key configured: no (fallback active)
- External reranker key configured: no (fallback/original order)

## Sequential Core Metrics

| Metric | Count | Mean (ms) | P95 (ms) | Max (ms) | Target | Verdict |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| memory.search.duration | 4 | 1104.25 | 1705.00 | 1705.00 | < 2000ms | PASS |
| memory.getContext.duration | 4 | 1881.00 | 2169.00 | 2169.00 | < 2000ms | FAIL |
| embedding.duration | 4 | 1.00 | 1.00 | 1.00 | - | - |
| reranker.duration | 4 | 0.25 | 1.00 | 1.00 | - | - |

## Sequential Samples

| Case | Input | Duration (ms) | Retrieved Memories |
| --- | --- | ---: | ---: |
| C01 | 你还记得我上次说的面试吗 | 1524 | 1 |
| C03 | 那只猫今天又来了 | 2337 | 2 |
| C09 | 我今天去看了那个展 | 2107 | 1 |
| C10 | 我真的照你说的做了 | 2747 | 1 |

## Concurrency

- Concurrent requests: 5
- Wall time: 4163ms
- Average client duration: 2989.60ms

| Metric | Count | Mean (ms) | P95 (ms) | Max (ms) | Target | Verdict |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| memory.search.duration | 5 | 1929.00 | 3281.00 | 3281.00 | < 2000ms | FAIL |
| memory.getContext.duration | 5 | 2683.80 | 3953.00 | 3953.00 | < 2000ms | FAIL |
| embedding.duration | 5 | 1.00 | 1.00 | 1.00 | - | - |
| reranker.duration | 5 | 0.00 | 0.00 | 0.00 | - | - |

| Case | Input | Duration (ms) | Retrieved Memories |
| --- | --- | ---: | ---: |
| C01 | 你还记得我上次说的面试吗 | 1634 | 1 |
| C03 | 那只猫今天又来了 | 3488 | 2 |
| C06 | 我那个项目终于收尾了 | 3860 | 3 |
| C09 | 我今天去看了那个展 | 4163 | 1 |
| C10 | 我真的照你说的做了 | 1803 | 1 |

## Verdict

- Memory retrieval target (<2s): FAIL
- Embedding latency interpretation: Measured in fallback mode because no external embedding API key is configured.
- Reranker latency interpretation: Measured in fallback/original-order mode because no reranker API key is configured.

