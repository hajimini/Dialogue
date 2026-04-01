# Memory Performance Report

- Generated at: 2026-03-28T12:05:48.449Z
- Source persona: e92e08d8-a25e-4a56-a439-60d71b0e4e69
- Temporary persona: 708a907e-82a9-4aec-bcb9-98333bb7a980
- Embedding provider: openai (text-embedding-3-large)
- Reranker provider: jina
- External embedding key configured: no (fallback active)
- External reranker key configured: no (fallback/original order)

## Sequential Core Metrics

| Metric | Count | Mean (ms) | P95 (ms) | Max (ms) | Target | Verdict |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| memory.search.duration | 4 | 214.00 | 225.00 | 225.00 | < 2000ms | PASS |
| memory.getContext.duration | 4 | 483.25 | 677.00 | 677.00 | < 2000ms | PASS |
| embedding.duration | 4 | 0.25 | 1.00 | 1.00 | - | - |
| reranker.duration | 0 | - | - | - | - | - |

## Sequential Samples

| Case | Input | Duration (ms) | Retrieved Memories |
| --- | --- | ---: | ---: |
| C01 | 你还记得我上次说的面试吗 | 677 | 0 |
| C03 | 那只猫今天又来了 | 417 | 0 |
| C09 | 我今天去看了那个展 | 425 | 0 |
| C10 | 我真的照你说的做了 | 414 | 0 |

## Concurrency

- Concurrent requests: 5
- Wall time: 1774ms
- Average client duration: 1064.00ms

| Metric | Count | Mean (ms) | P95 (ms) | Max (ms) | Target | Verdict |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| memory.search.duration | 5 | 258.60 | 314.00 | 314.00 | < 2000ms | PASS |
| memory.getContext.duration | 5 | 1064.00 | 1774.00 | 1774.00 | < 2000ms | PASS |
| embedding.duration | 5 | 0.00 | 0.00 | 0.00 | - | - |
| reranker.duration | 0 | - | - | - | - | - |

| Case | Input | Duration (ms) | Retrieved Memories |
| --- | --- | ---: | ---: |
| C01 | 你还记得我上次说的面试吗 | 1774 | 0 |
| C03 | 那只猫今天又来了 | 420 | 0 |
| C06 | 我那个项目终于收尾了 | 1072 | 0 |
| C09 | 我今天去看了那个展 | 1093 | 0 |
| C10 | 我真的照你说的做了 | 961 | 0 |

## Verdict

- Memory retrieval target (<2s): PASS
- Embedding latency interpretation: Measured in fallback mode because no external embedding API key is configured.
- Reranker latency interpretation: Measured in fallback/original-order mode because no reranker API key is configured.

