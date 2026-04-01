# Memory Performance Report

- Generated at: 2026-03-28T12:01:05.379Z
- Base URL: http://localhost:3000
- Persona ID: e92e08d8-a25e-4a56-a439-60d71b0e4e69
- Embedding provider: openai (text-embedding-3-large)
- Reranker provider: jina
- External embedding key configured: no (fallback active)
- External reranker key configured: no (fallback/original order)

## Sequential Metrics

| Metric | Count | Mean (ms) | P95 (ms) | Max (ms) | Target | Verdict |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| memory.search.duration | 0 | - | - | - | < 2000ms | FAIL |
| memory.getContext.duration | 0 | - | - | - | < 2000ms | FAIL |
| embedding.duration | 0 | - | - | - | - | - |
| reranker.duration | 0 | - | - | - | - | - |

## Sequential Case Samples

| Case | Input | Duration (ms) | Reply |
| --- | --- | ---: | --- |
| C01 | 你还记得我上次说的面试吗 | 11155 | 記得啊，下週的那個對吧 |
| C03 | 那只猫今天又来了 | 10952 | 又來喔,今天有靠近你嗎 |
| C09 | 我今天去看了那个展 | 10532 | 喔你去看啦,怎麼樣 |
| C10 | 我真的照你说的做了 | 11900 | 欸真的喔,怎麼樣 |

## Concurrency

- Concurrent requests: 5
- Wall time: 25167ms
- Average client duration: 11073.40ms
- memory.getContext.duration mean: -ms
- memory.getContext.duration p95: -ms

## Concurrent Case Samples

| Case | Input | Duration (ms) | Reply |
| --- | --- | ---: | --- |
| C01 | 你还记得我上次说的面试吗 | 10982 | 欸，你是說哪個面試呀，我忘了 |
| C03 | 那只猫今天又来了 | 11547 | 又來喔,今天有靠近你嗎 |
| C06 | 我那个项目终于收尾了 | 10778 | 啊終於！那可以好好休息一下了吧 |
| C09 | 我今天去看了那个展 | 10283 | 喔你去看啦,怎麼樣 |
| C10 | 我真的照你说的做了 | 11777 | 欸真的喔,然後呢?他怎麼說 |

## Verdict

- Memory retrieval target (<2s): FAIL
- Embedding latency note: Measured in fallback mode because no external embedding API key is configured.
- Reranker latency note: Measured in fallback/original-order mode because no reranker API key is configured.

