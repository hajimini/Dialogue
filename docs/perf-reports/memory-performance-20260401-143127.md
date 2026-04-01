# Memory Performance Report

- Generated at: 2026-04-01T06:31:27.845Z
- Source persona: e92e08d8-a25e-4a56-a439-60d71b0e4e69
- Temporary persona: faa9b8d4-23b4-4904-af0d-681c54bd1d63
- Embedding provider: openai (text-embedding-3-large)
- Reranker provider: jina
- External embedding key configured: no (fallback active)
- External reranker key configured: no (fallback/original order)

## Sequential Core Metrics

| Metric | Count | Mean (ms) | P95 (ms) | Max (ms) | Target | Verdict |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| memory.search.duration | 4 | 729.00 | 1008.00 | 1008.00 | < 2000ms | PASS |
| memory.getContext.duration | 4 | 1206.00 | 1412.00 | 1412.00 | < 2000ms | PASS |
| embedding.duration | 4 | 1.00 | 1.00 | 1.00 | - | - |
| reranker.duration | 4 | 0.25 | 1.00 | 1.00 | - | - |

## Sequential Samples

| Case | Input | Duration (ms) | Retrieved Memories |
| --- | --- | ---: | ---: |
| C01 | 你还记得我上次说的面试吗 | 1528 | 1 |
| C03 | 那只猫今天又来了 | 1616 | 2 |
| C09 | 我今天去看了那个展 | 1260 | 1 |
| C10 | 我真的照你说的做了 | 1246 | 1 |

## Concurrency

- Concurrent requests: 5
- Wall time: 3169ms
- Average client duration: 1937.00ms

| Metric | Count | Mean (ms) | P95 (ms) | Max (ms) | Target | Verdict |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| memory.search.duration | 5 | 877.80 | 1547.00 | 1547.00 | < 2000ms | PASS |
| memory.getContext.duration | 5 | 1590.80 | 2249.00 | 2249.00 | < 2000ms | FAIL |
| embedding.duration | 5 | 1.00 | 1.00 | 1.00 | - | - |
| reranker.duration | 5 | 0.00 | 0.00 | 0.00 | - | - |

| Case | Input | Duration (ms) | Retrieved Memories |
| --- | --- | ---: | ---: |
| C01 | 你还记得我上次说的面试吗 | 1518 | 1 |
| C03 | 那只猫今天又来了 | 1883 | 2 |
| C06 | 我那个项目终于收尾了 | 3169 | 3 |
| C09 | 我今天去看了那个展 | 1586 | 1 |
| C10 | 我真的照你说的做了 | 1529 | 1 |

## Verdict

- Memory retrieval target (<2s): PASS
- Embedding latency interpretation: Measured in fallback mode because no external embedding API key is configured.
- Reranker latency interpretation: Measured in fallback/original-order mode because no reranker API key is configured.

