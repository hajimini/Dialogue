# Implementation Tasks

## Phase 1: 鍩虹璁炬柦鍑嗗

### Task 1: 瀹夎渚濊禆鍜岄厤缃幆澧?

- [x] 1.1 瀹夎Mem0 Node SDK (`npm install mem0ai`)
- [x] 1.2 瀹夎Supabase瀹㈡埛绔?(`npm install @supabase/supabase-js`)
- [x] 1.3 閰嶇疆鐜鍙橀噺锛?env.local锛?
  - MEM0_API_KEY
  - SUPABASE_URL
  - SUPABASE_ANON_KEY
  - SUPABASE_SERVICE_KEY
  - EMBEDDING_PROVIDER (openai | bge-m3)
  - EMBEDDING_MODEL (text-embedding-3-large)
  - RERANKER_PROVIDER (jina | cohere | none)
  - RERANKER_API_KEY
  - MEMORY_RETRIEVAL_LIMIT (榛樿5)
- [x] 1.4 鍦⊿upabase鍚敤pgvector鎵╁睍

### Task 2: 鍒涘缓Supabase鏁版嵁搴揝chema

- [x] 2.1 鍒涘缓memories琛紙鍖呭惈鍚戦噺瀛楁锛?
- [x] 2.2 鍒涘缓鍚戦噺鐩镐技搴︽悳绱㈢储寮?
- [x] 2.3 鍒涘缓user_profiles_per_persona琛紙濡傛灉涓嶅瓨鍦級
- [x] 2.4 鍒涘缓sessions琛紙濡傛灉涓嶅瓨鍦級
- [x] 2.5 楠岃瘉schema鍒涘缓鎴愬姛

## Phase 2: MemoryGateway鎶借薄灞?

### Task 3: 瀹炵幇MemoryGateway鎺ュ彛瀹氫箟

- [x] 3.1 鍒涘缓 `src/lib/memory/gateway.ts`
- [x] 3.2 瀹氫箟MemoryGateway鎺ュ彛锛坅dd, search, update, delete鏂规硶锛?
- [x] 3.3 瀹氫箟绫诲瀷锛欰ddMemoryParams, SearchMemoryParams, UpdateMemoryParams
- [x] 3.4 瀹氫箟绫诲瀷锛歁emoryResult, MemorySearchResult
- [x] 3.5 瀹氫箟绫诲瀷锛歋aveSessionMemoriesParams, SaveSessionMemoriesResult
- [x] 3.6 瀹氫箟绫诲瀷锛欸etMemoryContextParams, MemoryContext

### Task 4: 瀹炵幇閰嶇疆绠＄悊

- [x] 4.1 鍒涘缓 `src/lib/memory/config.ts`
- [x] 4.2 瀹炵幇getMemoryGatewayConfig()鍑芥暟
- [x] 4.3 瀹氫箟MemoryGatewayConfig绫诲瀷
- [x] 4.4 瀹氫箟Mem0AdapterConfig绫诲瀷
- [x] 4.5 娣诲姞閰嶇疆楠岃瘉閫昏緫

### Task 5: 瀹炵幇宸ュ巶鍑芥暟

- [x] 5.1 鍒涘缓 `src/lib/memory/factory.ts`
- [x] 5.2 瀹炵幇getMemoryGateway()宸ュ巶鍑芥暟
- [x] 5.3 瀹炵幇鍗曚緥妯″紡锛堢紦瀛榞ateway瀹炰緥锛?
- [x] 5.4 娣诲姞provider鍒囨崲閫昏緫
- [x] 5.5 娣诲姞閿欒澶勭悊锛堜笉鏀寔鐨刾rovider锛?

## Phase 3: 鏈嶅姟灞傚疄鐜?

### Task 6: 瀹炵幇EmbeddingService

- [x] 6.1 鍒涘缓 `src/lib/memory/services/embedding-service.ts`
- [x] 6.2 瀹炵幇EmbeddingService绫?
- [x] 6.3 瀹炵幇embedWithOpenAI()鏂规硶
- [x] 6.4 瀹炵幇embedWithBGE()鏂规硶锛堥鐣欐帴鍙ｏ級
- [x] 6.5 瀹炵幇generateFallbackEmbedding()闄嶇骇鏂规
- [x] 6.6 娣诲姞鎬ц兘鎸囨爣璁板綍
- [x] 6.7 娣诲姞閿欒澶勭悊鍜岄噸璇曢€昏緫

### Task 7: 瀹炵幇RerankerService

- [x] 7.1 鍒涘缓 `src/lib/memory/services/reranker-service.ts`
- [x] 7.2 瀹炵幇RerankerService绫?
- [x] 7.3 瀹炵幇rerankWithJina()鏂规硶
- [x] 7.4 瀹炵幇rerankWithCohere()鏂规硶锛堥鐣欐帴鍙ｏ級
- [x] 7.5 瀹炵幇闄嶇骇閫昏緫锛堣繑鍥炲師濮嬮『搴忥級
- [x] 7.6 娣诲姞鎬ц兘鎸囨爣璁板綍
- [x] 7.7 娣诲姞閿欒澶勭悊

## Phase 4: Mem0Adapter瀹炵幇

### Task 8: 瀹炵幇Mem0Adapter鍩虹鏂规硶

- [x] 8.1 鍒涘缓 `src/lib/memory/adapters/mem0-adapter.ts`
- [x] 8.2 瀹炵幇Mem0Adapter绫绘瀯閫犲嚱鏁?
- [x] 8.3 鍒濆鍖朚em0 SDK瀹㈡埛绔?
- [x] 8.4 瀹炵幇add()鏂规硶
- [x] 8.5 瀹炵幇search()鏂规硶
- [x] 8.6 瀹炵幇update()鏂规硶
- [x] 8.7 瀹炵幇delete()鏂规硶

### Task 9: 瀹炵幇Mem0Adapter楂樼骇鏂规硶

- [x] 9.1 瀹炵幇saveSessionMemories()鏂规硶
- [x] 9.2 瀹炵幇getMemoryContext()鏂规硶
- [x] 9.3 瀹炵幇getUserProfile()杈呭姪鏂规硶
- [x] 9.4 瀹炵幇getRecentSummaries()杈呭姪鏂规硶
- [x] 9.5 瀹炵幇buildEnhancedQuery()杈呭姪鏂规硶
- [x] 9.6 瀹炵幇mapMem0ResultToMemoryResult()鏄犲皠鏂规硶

### Task 10: 瀹炵幇寤剁画涓婁笅鏂囦紭鍖?

- [x] 10.1 淇濈暀extractQueryAnchors()鍑芥暟锛堜粠鐜版湁retriever.ts锛?
- [x] 10.2 淇濈暀CONTINUATION_CUE_REGEX甯搁噺
- [x] 10.3 鍦╣etMemoryContext()涓疄鐜版寚浠ｈ瘝妫€娴?
- [x] 10.4 鍦╞uildEnhancedQuery()涓姞鍏rofile anchors
- [x] 10.5 鍦╮eranker璋冪敤涓紶閫抍ontinuation metadata
- [x] 10.6 瀹炵幇鍞竴楂樼浉鍏虫€ц蹇嗙殑浼樺厛鎺掑簭閫昏緫

## Phase 5: 鐜版湁浠ｇ爜鏀归€?

### Task 11: 鏀归€爎etriever.ts

- [x] 11.1 澶囦唤鐜版湁 `src/lib/memory/retriever.ts`
- [x] 11.2 閲嶆瀯getMemoryContext()浣跨敤MemoryGateway
- [x] 11.3 绉婚櫎鐩存帴鐨勬湰鍦癑SON璇诲彇閫昏緫
- [x] 11.4 绉婚櫎鎵嬪姩鐨別mbedding鐩镐技搴﹁绠?
- [x] 11.5 淇濈暀filterConflictingPersonaMemories()璋冪敤
- [x] 11.6 淇濈暀extractQueryAnchors()鍜孋ONTINUATION_CUE_REGEX
- [x] 11.7 楠岃瘉鎺ュ彛鍏煎鎬э紙杈撳叆杈撳嚭涓嶅彉锛?

### Task 12: 鏀归€爈ong-term.ts

- [x] 12.1 澶囦唤鐜版湁 `src/lib/memory/long-term.ts`
- [x] 12.2 閲嶆瀯saveSessionMemories()浣跨敤MemoryGateway
- [x] 12.3 閲嶆瀯createMemory()浣跨敤MemoryGateway
- [x] 12.4 閲嶆瀯updateMemory()浣跨敤MemoryGateway
- [x] 12.5 閲嶆瀯deleteMemory()浣跨敤MemoryGateway
- [x] 12.6 閲嶆瀯listMemories()浣跨敤MemoryGateway
- [x] 12.7 绉婚櫎updateLocalAppStore()璋冪敤
- [ ] 12.8 淇濈暀mergeUniqueStrings()鍜宑reateEmptyProfileData()
- [x] 12.9 楠岃瘉鎺ュ彛鍏煎鎬?

### Task 13: 鏀归€爀mbedding.ts

- [-] 13.1 澶囦唤鐜版湁 `src/lib/memory/embedding.ts`
- [x] 13.2 灏唀mbedText()鏍囪涓篸eprecated
- [x] 13.3 閲嶆瀯embedText()濮旀墭缁橢mbeddingService
- [x] 13.4 淇濈暀cosineSimilarity()宸ュ叿鍑芥暟
- [x] 13.5 绉婚櫎鐩存帴鐨凙PI璋冪敤浠ｇ爜
- [x] 13.6 楠岃瘉鍚戝悗鍏煎鎬?

### Task 14: 楠岃瘉Chat API鍏煎鎬?

- [x] 14.1 璇诲彇 `src/app/api/chat/route.ts`
- [x] 14.2 楠岃瘉getMemoryContext()璋冪敤鏃犻渶淇敼
- [x] 14.3 楠岃瘉saveSessionMemories()璋冪敤鏃犻渶淇敼
- [x] 14.4 杩愯Chat API娴嬭瘯
- [x] 14.5 纭娌℃湁breaking changes

## Phase 6: 鏁版嵁杩佺Щ

### Task 15: 瀹炵幇杩佺Щ鑴氭湰

- [x] 15.1 鍒涘缓 `scripts/migrate-to-mem0.ts`
- [x] 15.2 瀹炵幇readLocalAppStore()璇诲彇閫昏緫
- [x] 15.3 瀹炵幇鑷姩澶囦唤閫昏緫
- [x] 15.4 瀹炵幇memories杩佺Щ閫昏緫锛堥€愭潯杩佺Щ锛?
- [x] 15.5 瀹炵幇user profiles杩佺Щ閫昏緫
- [x] 15.6 瀹炵幇sessions杩佺Щ閫昏緫锛堝鏋滈渶瑕侊級
- [x] 15.7 瀹炵幇杩佺Щ楠岃瘉閫昏緫
- [x] 15.8 鐢熸垚杩佺Щ鎶ュ憡JSON

### Task 16: 瀹炵幇鍥炴粴鑴氭湰

- [x] 16.1 鍒涘缓 `scripts/rollback-migration.ts`
- [x] 16.2 瀹炵幇浠庡浠芥仮澶嶅埌鏈湴鐨勯€昏緫
- [x] 16.3 瀹炵幇娓呯┖Supabase鏁版嵁鐨勯€昏緫锛堝彲閫夛級
- [x] 16.4 娣诲姞鍥炴粴楠岃瘉
- [x] 16.5 鐢熸垚鍥炴粴鎶ュ憡

### Task 17: 鎵ц鏁版嵁杩佺Щ

- [x] 17.1 杩愯杩佺Щ鑴氭湰 (`npm run migrate:mem0`)
- [x] 17.2 楠岃瘉杩佺Щ鎶ュ憡
- [x] 17.3 妫€鏌upabase涓殑鏁版嵁瀹屾暣鎬?
- [x] 17.4 楠岃瘉embedding鍚戦噺宸茬敓鎴?
- [x] 17.5 璁板綍杩佺Щ缁撴灉

## Phase 7: 鎬ц兘鐩戞帶

### Task 18: 瀹炵幇鎬ц兘鐩戞帶

- [x] 18.1 鍒涘缓 `src/lib/memory/metrics.ts`
- [x] 18.2 瀹炵幇MemoryMetrics绫?
- [x] 18.3 瀹炵幇record()鏂规硶
- [x] 18.4 瀹炵幇getStats()鏂规硶
- [x] 18.5 瀹炵幇getAllStats()鏂规硶
- [x] 18.6 娣诲姞鎱㈡煡璇㈣鍛婇€昏緫锛?2绉掞級
- [x] 18.7 鍒涘缓鍏ㄥ眬鍗曚緥memoryMetrics

### Task 19: 瀹炵幇鐩戞帶API

- [x] 19.1 鍒涘缓 `src/app/api/admin/memory-metrics/route.ts`
- [x] 19.2 瀹炵幇GET endpoint杩斿洖鎬ц兘缁熻
- [x] 19.3 娣诲姞璁よ瘉妫€鏌ワ紙浠卆dmin鍙闂級
- [x] 19.4 娴嬭瘯鐩戞帶API

## Phase 8: 娴嬭瘯楠岃瘉

### Task 20: 鍗曞厓娴嬭瘯

- [x] 20.1 鍒涘缓 `src/lib/memory/__tests__/gateway.test.ts`
- [x] 20.2 娴嬭瘯MemoryGateway鎺ュ彛瀹氫箟
- [x] 20.3 鍒涘缓 `src/lib/memory/__tests__/mem0-adapter.test.ts`
- [x] 20.4 娴嬭瘯Mem0Adapter鐨刟dd/search/update/delete鏂规硶
- [x] 20.5 鍒涘缓 `src/lib/memory/__tests__/embedding-service.test.ts`
- [x] 20.6 娴嬭瘯EmbeddingService鐨刦allback閫昏緫
- [x] 20.7 鍒涘缓 `src/lib/memory/__tests__/reranker-service.test.ts`
- [x] 20.8 娴嬭瘯RerankerService鐨勯檷绾ч€昏緫

### Task 21: 闆嗘垚娴嬭瘯

- [x] 21.1 娴嬭瘯瀹屾暣鐨勮蹇嗕繚瀛樻祦绋?
- [x] 21.2 娴嬭瘯瀹屾暣鐨勮蹇嗘绱㈡祦绋?
- [x] 21.3 娴嬭瘯鎸囦唬璇嶅満鏅殑涓婁笅鏂囪鎺?
- [x] 21.4 娴嬭瘯persona杩囨护閫昏緫
- [x] 21.5 娴嬭瘯鎬ц兘鐩戞帶鎸囨爣璁板綍

### Task 22: C绫绘祴璇曢獙璇?

- [x] 22.1 杩愯C01娴嬭瘯鐢ㄤ緥锛?閭ｅ彧鐚粖澶╁張鏉ヤ簡"锛?
- [x] 22.2 杩愯C09娴嬭瘯鐢ㄤ緥锛?鎴戜粖澶╁幓鐪嬩簡閭ｄ釜灞?锛?
- [x] 22.3 杩愯鎵€鏈塁绫绘祴璇曠敤渚?
- [x] 22.4 楠岃瘉閫氳繃鐜囪揪鍒?0%浠ヤ笂
- [x] 22.5 璁板綍娴嬭瘯缁撴灉鍜屾敼鍠勫姣?

### Task 23: 鎬ц兘娴嬭瘯

- [x] 23.1 娴嬭瘯璁板繂妫€绱㈠搷搴旀椂闂达紙鐩爣<2绉掞級
- [x] 23.2 娴嬭瘯embedding API寤惰繜
- [x] 23.3 娴嬭瘯reranker API寤惰繜
- [x] 23.4 娴嬭瘯骞跺彂鍦烘櫙涓嬬殑鎬ц兘
- [x] 23.5 鐢熸垚鎬ц兘娴嬭瘯鎶ュ憡

## Phase 9: 鏂囨。鍜屾竻鐞?

### Task 24: 鏇存柊鏂囨。

- [x] 24.1 鏇存柊README.md锛堟柊鐨勮蹇嗙郴缁熸灦鏋勮鏄庯級
- [x] 24.2 鍒涘缓MEMORY_MIGRATION.md锛堣縼绉绘寚鍗楋級
- [x] 24.3 鏇存柊.env.example锛堟柊鐨勭幆澧冨彉閲忥級
- [x] 24.4 娣诲姞浠ｇ爜娉ㄩ噴鍜孞SDoc
- [x] 24.5 鏇存柊API鏂囨。锛堝鏋滄湁锛?

### Task 25: 浠ｇ爜娓呯悊

- [x] 25.1 绉婚櫎鏈娇鐢ㄧ殑鏃т唬鐮侊紙濡傛灉纭涓嶉渶瑕侊級
- [x] 25.2 娓呯悊console.log璋冭瘯璇彞
- [x] 25.3 杩愯ESLint淇鏍煎紡闂
- [x] 25.4 杩愯TypeScript绫诲瀷妫€鏌?
- [x] 25.5 纭娌℃湁缂栬瘧閿欒

## Phase 10: 閮ㄧ讲鍜岀洃鎺?

### Task 26: 閮ㄧ讲鍑嗗

- [ ] 26.1 鍦ㄧ敓浜х幆澧冮厤缃甋upabase
- [ ] 26.2 鍦ㄧ敓浜х幆澧冮厤缃幆澧冨彉閲?
- [ ] 26.3 杩愯鐢熶骇鐜杩佺Щ鑴氭湰
- [ ] 26.4 楠岃瘉鐢熶骇鐜鏁版嵁瀹屾暣鎬?
- [ ] 26.5 閰嶇疆鎬ц兘鐩戞帶鍛婅

### Task 27: 涓婄嚎鍚庣洃鎺?

- [ ] 27.1 鐩戞帶璁板繂妫€绱㈠搷搴旀椂闂?
- [ ] 27.2 鐩戞帶API閿欒鐜?
- [ ] 27.3 鐩戞帶C绫绘祴璇曢€氳繃鐜?
- [ ] 27.4 鏀堕泦鐢ㄦ埛鍙嶉
- [ ] 27.5 鏍规嵁鐩戞帶鏁版嵁浼樺寲閰嶇疆

## 鍙€変换鍔?

### Task 28: Letta閫傞厤鍣ㄩ鐣?

- [ ]* 28.1 鍒涘缓 `src/lib/memory/adapters/letta-adapter.ts`
- [ ]* 28.2 瀹炵幇LettaAdapter绫伙紙瀹炵幇MemoryGateway鎺ュ彛锛?
- [ ]* 28.3 瀹夎Letta TypeScript SDK
- [ ]* 28.4 瀹炵幇Letta鐨勮蹇嗘搷浣滄柟娉?
- [ ]* 28.5 娣诲姞Letta閰嶇疆鍒癱onfig.ts

### Task 29: 鐭ヨ瘑妫€绱㈡ā鍧楅鐣?

- [ ]* 29.1 鍒涘缓 `src/lib/knowledge/gateway.ts`
- [ ]* 29.2 瀹氫箟KnowledgeGateway鎺ュ彛
- [ ]* 29.3 棰勭暀LangChain.js闆嗘垚鐐?
- [ ]* 29.4 棰勭暀LightRAG闆嗘垚鐐?
- [ ]* 29.5 鍦–hat API涓鐣欑煡璇嗘绱㈣皟鐢ㄧ偣

### Task 30: BGE-M3 Embedding闆嗘垚*

- [ ]* 30.1 鐮旂┒BGE-M3鐨凙PI鎴栨湰鍦伴儴缃叉柟妗?
- [ ]* 30.2 瀹炵幇embedWithBGE()鏂规硶
- [ ]* 30.3 閰嶇疆BGE-M3 API endpoint
- [ ]* 30.4 娴嬭瘯涓枃embedding璐ㄩ噺瀵规瘮
- [ ]* 30.5 鏍规嵁娴嬭瘯缁撴灉鍐冲畾鏄惁鍒囨崲榛樿embedding

### Task 31: Cohere Reranker闆嗘垚*

- [ ]* 31.1 瀹炵幇rerankWithCohere()鏂规硶
- [ ]* 31.2 閰嶇疆Cohere API key
- [ ]* 31.3 娴嬭瘯Cohere vs Jina reranker鏁堟灉
- [ ]* 31.4 鏍规嵁娴嬭瘯缁撴灉閫夋嫨榛樿reranker

## 浠诲姟渚濊禆鍏崇郴

```mermaid
graph TD
    T1[Task 1: 瀹夎渚濊禆] --> T2[Task 2: 鍒涘缓Schema]
    T2 --> T3[Task 3: Gateway鎺ュ彛]
    T3 --> T4[Task 4: 閰嶇疆绠＄悊]
    T4 --> T5[Task 5: 宸ュ巶鍑芥暟]
    
    T5 --> T6[Task 6: EmbeddingService]
    T5 --> T7[Task 7: RerankerService]
    
    T6 --> T8[Task 8: Mem0Adapter鍩虹]
    T7 --> T8
    T8 --> T9[Task 9: Mem0Adapter楂樼骇]
    T9 --> T10[Task 10: 寤剁画涓婁笅鏂囦紭鍖朷
    
    T10 --> T11[Task 11: 鏀归€爎etriever]
    T10 --> T12[Task 12: 鏀归€爈ong-term]
    T10 --> T13[Task 13: 鏀归€爀mbedding]
    
    T11 --> T14[Task 14: 楠岃瘉Chat API]
    T12 --> T14
    T13 --> T14
    
    T14 --> T15[Task 15: 杩佺Щ鑴氭湰]
    T15 --> T16[Task 16: 鍥炴粴鑴氭湰]
    T16 --> T17[Task 17: 鎵ц杩佺Щ]
    
    T17 --> T18[Task 18: 鎬ц兘鐩戞帶]
    T18 --> T19[Task 19: 鐩戞帶API]
    
    T19 --> T20[Task 20: 鍗曞厓娴嬭瘯]
    T20 --> T21[Task 21: 闆嗘垚娴嬭瘯]
    T21 --> T22[Task 22: C绫绘祴璇昡
    T21 --> T23[Task 23: 鎬ц兘娴嬭瘯]
    
    T22 --> T24[Task 24: 鏇存柊鏂囨。]
    T23 --> T24
    T24 --> T25[Task 25: 浠ｇ爜娓呯悊]
    
    T25 --> T26[Task 26: 閮ㄧ讲鍑嗗]
    T26 --> T27[Task 27: 涓婄嚎鐩戞帶]
```

## 棰勪及宸ヤ綔閲?

- **Phase 1-2**: 鍩虹璁炬柦鍜屾娊璞″眰 - 1澶?
- **Phase 3-4**: 鏈嶅姟灞傚拰閫傞厤鍣?- 2-3澶?
- **Phase 5**: 鐜版湁浠ｇ爜鏀归€?- 1-2澶?
- **Phase 6**: 鏁版嵁杩佺Щ - 1澶?
- **Phase 7**: 鎬ц兘鐩戞帶 - 0.5澶?
- **Phase 8**: 娴嬭瘯楠岃瘉 - 1-2澶?
- **Phase 9**: 鏂囨。鍜屾竻鐞?- 0.5澶?
- **Phase 10**: 閮ㄧ讲鍜岀洃鎺?- 1澶?

**鎬昏**: 8-12澶╋紙绾?.5-2鍛級

## 椋庨櫓鍜岀紦瑙ｆ帾鏂?

### 椋庨櫓1: Mem0 API涓嶇ǔ瀹氭垨闄愭祦
- **缂撹В**: 瀹炵幇闄嶇骇鍒版湰鍦癳mbedding + Supabase鐩存帴鏌ヨ
- **缂撹В**: 娣诲姞閲嶈瘯鏈哄埗鍜宔xponential backoff

### 椋庨櫓2: 涓枃embedding鏁堟灉涓嶅棰勬湡
- **缂撹В**: 棰勭暀BGE-M3鍒囨崲鑳藉姏
- **缂撹В**: 閫氳繃C绫绘祴璇曢噺鍖栬瘎浼?

### 椋庨櫓3: 杩佺Щ杩囩▼鏁版嵁涓㈠け
- **缂撹В**: 鑷姩澶囦唤鏈哄埗
- **缂撹В**: 鍥炴粴鑴氭湰
- **缂撹В**: 杩佺Щ楠岃瘉姝ラ

### 椋庨櫓4: 鎬ц兘涓嬮檷锛圓PI璋冪敤寤惰繜锛?
- **缂撹В**: 瀹炵幇缂撳瓨灞?
- **缂撹В**: 鎵归噺鎿嶄綔浼樺寲
- **缂撹В**: 鎬ц兘鐩戞帶鍜屽憡璀?

### 椋庨櫓5: Persona杩囨护閫昏緫澶辨晥
- **缂撹В**: 淇濈暀鎵€鏈夌幇鏈夌殑persona杩囨护浠ｇ爜
- **缂撹В**: 娣诲姞涓撻棬鐨刾ersona涓€鑷存€ф祴璇?
