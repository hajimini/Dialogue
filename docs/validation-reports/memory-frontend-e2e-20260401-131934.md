# Memory Frontend E2E

- Generated at: 2026-04-01T05:18:37.262Z
- Base URL: http://localhost:3000

| Flow | Result | Notes |
| --- | --- | --- |
| unauthenticated /api/memories | PASS | status=401 |
| user login | PASS | ok |
| admin login | PASS | ok |
| character create | PASS | memory-e2e-a-mnflible, memory-e2e-b-mnflible |
| session create + bind role | PASS | sessionA=9db54eff-1193-4787-9a2a-73841a534568 sessionB=a10ae047-374e-4f4d-9f61-645650741384 |
| chat -> backend/db | PASS | messages=2 character_id=308237bb-5c09-4a8f-abcc-707253001cb1 |
| admin create memory -> list by character | PASS | A=1 B=0 |
| admin search by character_id | PASS | A=2 B=0 |
| transcript import -> immediate memory rows | PASS | session=92bd5567-2f59-427a-9811-856cbbef7f75 marker_hits=1 |
| first post-import recall | PASS | memory_context=3 |
| profile + session summary visible | PASS | profile=yes summary=yes |
| admin logs by character_id | PASS | logs=20 total=20 |
| character isolation | PASS | memoriesB=0 searchB=0 |
