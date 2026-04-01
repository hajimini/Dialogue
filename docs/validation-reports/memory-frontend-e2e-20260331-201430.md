# Memory Frontend E2E

- Generated at: 2026-03-31T12:13:27.376Z
- Base URL: http://localhost:3000

| Flow | Result | Notes |
| --- | --- | --- |
| unauthenticated /api/memories | PASS | status=401 |
| user login | PASS | ok |
| admin login | PASS | ok |
| character create | PASS | memory-e2e-a-mnekw0tx, memory-e2e-b-mnekw0tx |
| session create + bind role | PASS | sessionA=a273b65f-4962-46cb-9ce8-5c5d6eedeea5 sessionB=59148fa3-2a00-443c-91d1-046e5c70845c |
| chat -> backend/db | PASS | messages=2 character_id=e996956a-5a62-4325-b881-9c53cb10d031 |
| admin create memory -> list by character | PASS | A=1 B=0 |
| admin search by character_id | PASS | A=2 B=0 |
| transcript import -> immediate memory rows | PASS | session=c19c9253-737a-4569-9891-1e7e4a557879 marker_hits=1 |
| first post-import recall | PASS | memory_context=3 |
| profile + session summary visible | PASS | profile=yes summary=yes |
| admin logs by character_id | PASS | logs=19 total=19 |
| character isolation | PASS | memoriesB=0 searchB=0 |
