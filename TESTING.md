# SITE1 — Running the tests

Playwright smoke + core-flow tests live in `/tests`.

## Run against the live site (all 11 tests)
```
export PATH="/opt/homebrew/bin:$PATH"
SITE1_TEST_EMAIL=tester@site1demo.com \
SITE1_TEST_PASSWORD=<tester password> \
SITE1_URL=https://site1-zeta-one.vercel.app \
npm test
```

## Run against local code (auto-starts the dev server)
```
SITE1_TEST_EMAIL=... SITE1_TEST_PASSWORD=... npm test
```

Without the EMAIL/PASSWORD env vars, the authenticated tests skip and only the
public smoke tests run.

## What's covered
- App loads to the login screen; forgot-password opens
- Login succeeds and lands on a dashboard
- Builder dashboard + projects list
- Supervisor project dashboard tile grid
- Create a task end-to-end
- Attendance muster opens
- Photos gallery opens
- Overview loads
- Worker on-site indicator
- Client progress view

## Note
The "create a task" test makes a real task ("PW test task <timestamp>") in the
live database each run — harmless test data, delete occasionally.
