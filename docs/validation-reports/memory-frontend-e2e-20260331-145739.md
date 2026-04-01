# Memory Frontend E2E

- Generated at: 2026-03-31T06:57:01.087Z
- Base URL: http://localhost:3000

| Flow | Result | Notes |
| --- | --- | --- |
| unauthenticated /api/memories | PASS | status=401 |
| user login | PASS | ok |
| admin login | PASS | ok |
| admin create memory | FAIL | userId、personaId、characterId、memoryType 和 content 为必填项。 |
| user list memories | FAIL | matches=0 |
| chat memory_context | PASS | memories=1 |
| user submit feedback | FAIL | ok |
| admin memory search | FAIL | results=0 |
| admin get memory config | PASS | ok |
| admin test config connection | PASS | ok |
| admin metrics read | PASS | ok |
| admin logs read | PASS | ok |
| user delete memory | FAIL | ok |
