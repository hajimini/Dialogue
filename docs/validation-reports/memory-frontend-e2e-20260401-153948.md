# Memory Frontend E2E

- Generated at: 2026-04-01T07:38:44.058Z
- Base URL: http://localhost:3000

| Flow | Result | Notes |
| --- | --- | --- |
| unauthenticated /api/memories | PASS | status=401 |
| user login | PASS | ok |
| admin login | PASS | ok |
| character create | PASS | memory-e2e-a-mnfqiin8, memory-e2e-b-mnfqiin8 |
| session create + bind role | PASS | sessionA=55869fa5-3b73-46ec-94e5-f3bdf40e97c6 sessionB=237a17fd-e410-4505-bf6b-09c78a259b40 |
| chat -> backend/db | PASS | messages=2 character_id=25e608ce-3424-4eee-8065-d8b919ff60f9 |
| admin create memory -> list by character | PASS | A=1 B=0 |
| admin search by character_id | PASS | A=1 B=0 |
| transcript import -> immediate memory rows | PASS | session=171340d6-057d-4bae-9eac-760412ee9c7c marker_hits=1 |
| first post-import recall | PASS | memory_context=3 |
| profile + session summary visible | PASS | profile=yes summary=yes |
| admin logs by character_id | PASS | logs=19 total=19 |
| character isolation | PASS | memoriesB=0 searchB=0 |
