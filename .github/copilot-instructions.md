# Copilot Agent Instructions

These instructions apply to all AI coding agents working on this repository.

---

## 1. README Updates

**ALWAYS** update `README.md` when making changes that affect:

- Features, behaviour, or configuration options
- Architecture or technology choices
- Development / testing / deployment instructions
- The UI (in this case screenshots must be updated too — see §3)

Keep the README accurate and up-to-date at all times.

---

## 2. PR Conflict Resolution

When working on a PR that has merge conflicts:

1. **ALWAYS** resolve conflicts automatically — do not ask the user to do it.
2. Fetch and merge the target branch locally:
   ```bash
   git fetch origin main
   git merge origin/main
   ```
3. For each conflict:
   - **Code files** — merge both sets of changes, preserving all functionality from both sides.
   - **`pom.xml` / `package.json`** — keep newer dependency versions; merge all dependency additions.
   - **`README.md`** — merge both sets of documentation, keeping everything relevant.
   - **CI workflow files** — merge jobs and steps; never drop existing jobs.
4. After resolving, run the full test suite to confirm nothing is broken:
   ```bash
   cd backend && mvn test -q
   cd ../frontend && npm test -- --run
   ```
5. Use `report_progress` to commit the resolution.

---

## 3. Screenshots

Screenshots live in `docs/screenshots/` and are embedded in `README.md`.

| File | Content |
|---|---|
| `welcome-light.png` | Welcome / join screen in light theme |
| `welcome-dark.png` | Welcome / join screen in dark theme |
| `voting-room.png` | Active voting room with multiple participants |
| `revealed-results.png` | Room after cards are revealed with statistics visible |

**When to regenerate screenshots**: any time the UI changes (new components, restyling, layout changes).

**How to regenerate screenshots**:

```bash
# 1. Build and start the full app in Docker
docker build -t scrumpoker:screenshots .
docker run -d --name sp-screenshots -p 8080:8080 scrumpoker:screenshots

# 2. Wait for it to be ready
timeout 60 bash -c 'until curl -sf http://localhost:8080/health; do sleep 2; done'

# 3. Run the screenshot tests (the "README screenshots" suite in room.spec.ts)
npm ci
npx playwright install chromium
BASE_URL=http://localhost:8080 npx playwright test --grep "README screenshots"

# 4. Commit the updated screenshots
# docs/screenshots/*.png will be updated

# 5. Clean up
docker stop sp-screenshots
```

The `README screenshots` test group in `e2e/room.spec.ts` automatically writes PNG files to
`docs/screenshots/` when it runs. Commit those files alongside your code changes.

---

## 4. Architecture Principles

- **Vertical slice architecture**: keep all code for a feature together.
  - Backend: `backend/src/main/java/com/scrumpoker/{health,room}/`
  - Frontend: `frontend/src/features/{welcome,room}/`
- **100% test coverage target** for all new functionality.
- **WebSocket protocol**: STOMP at `/ws`; room updates on `/topic/room/{roomId}`.
- **User identity**: the frontend-generated `clientId` (UUID stored in `localStorage`) is the
  public user identifier in all `RoomUpdateMessage` payloads. The Spring session ID is an
  internal implementation detail only.

---

## 5. Testing Checklist

After any change, verify:

```bash
# Backend unit + integration tests
cd backend && mvn test

# Frontend unit tests
cd frontend && npm test -- --run

# E2E tests (requires running Docker container — see §3 for startup commands)
BASE_URL=http://localhost:8080 npm run test:e2e
```

CI runs all three suites automatically on every push and pull-request.

---

## 6. Commit Messages

Use concise imperative sentences:

```
fix: host controls not shown due to clientId/sessionId mismatch
feat: add round history export
test: add e2e coverage for observer mode
docs: update README screenshots after redesign
```
