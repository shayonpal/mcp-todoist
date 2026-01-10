# Quickstart: Token Validation Deferral

**Feature**: 006-more-mcp-compliance
**Date**: 2025-10-02
**Purpose**: Validate deferred token validation functionality end-to-end

## Prerequisites

- Node.js 18+ installed
- Repository cloned and dependencies installed (`npm install`)
- TypeScript compiled (`npm run build`)

## Test Scenarios

### Scenario 1: Server Starts Without Token ✅

**Validates**: FR-001, FR-002 (server startup + MCP protocol independent of token)

```bash
# Clear any existing token
unset TODOIST_API_TOKEN

# Start the server
vercel dev

# Expected: Server starts successfully, no error
# Output should show: "MCP Todoist Server initialized"
```

**Validation**:
- Server process starts without crashing
- No error logs about missing TODOIST_API_TOKEN
- Process listens for MCP protocol messages

**Acceptance Criteria**:
- [x] Server initialization completes
- [x] No validation errors in logs
- [x] Process remains running

---

### Scenario 2: MCP Protocol Handshake Without Token ✅

**Validates**: FR-002 (tool discovery works without token)

```bash
# With server running from Scenario 1, send MCP initialize request
# (This would typically be done by an MCP client like Claude Code or Smithery)

# Simulated via test:
npm test -- --testNamePattern="MCP protocol works without token"

# Expected: Test passes, list_tools returns all 7 tools
```

**Validation**:
- `initialize` request succeeds
- `list_tools` request returns:
  - todoist_tasks
  - todoist_projects
  - todoist_sections
  - todoist_comments
  - todoist_filters
  - todoist_reminders
  - todoist_labels

**Acceptance Criteria**:
- [x] Initialize handler executes without error
- [x] list_tools returns 7 tool definitions
- [x] No token validation triggered

---

### Scenario 3: Tool Call Without Token Returns Actionable Error ✅

**Validates**: FR-004, FR-008 (clear error message when token missing)

```bash
# With server running without token, attempt tool call
npm test -- --testNamePattern="Tool call without token"

# Expected: Error with message:
# "Token missing. Set TODOIST_API_TOKEN environment variable"
```

**Validation**:
- Error is thrown before any Todoist API call
- Error message follows "[Category]. [Next step]" format
- Error category is TOKEN_MISSING

**Acceptance Criteria**:
- [x] Tool call fails immediately (<1ms)
- [x] Error message is actionable
- [x] No network request to Todoist API

---

### Scenario 4: Tool Call With Valid Token Succeeds + Caches Validation ✅

**Validates**: FR-003, FR-005, FR-009 (deferred validation + caching)

```bash
# Set valid token
export TODOIST_API_TOKEN="your_real_token_here"

# Restart server
vercel dev

# Call first tool
npm test -- --testNamePattern="First tool call validates token"

# Call second tool (different tool)
npm test -- --testNamePattern="Second tool call uses cached validation"

# Expected:
# - First call: Validation occurs (API call to Todoist)
# - Second call: No validation (cached state reused)
```

**Validation**:
- First tool call makes validation API request
- Subsequent tool calls skip validation
- Test spy/mock verifies validation called exactly once

**Acceptance Criteria**:
- [x] First tool call succeeds
- [x] Validation API call logged
- [x] Second tool call succeeds
- [x] No second validation API call
- [x] Both tools execute normally

---

### Scenario 5: Tool Call With Invalid Token Returns Actionable Error ✅

**Validates**: FR-005, FR-008 (invalid token detection + error format)

```bash
# Set intentionally invalid token
export TODOIST_API_TOKEN="invalid_fake_token_12345"

# Restart server
vercel dev

# Attempt tool call
npm test -- --testNamePattern="Invalid token error"

# Expected: Error with message:
# "Authentication failed. Verify token is valid at Todoist settings"
```

**Validation**:
- Token validation attempted
- Todoist API returns 401
- Error message follows actionable format
- Error category is AUTH_FAILED

**Acceptance Criteria**:
- [x] Tool call fails after validation attempt
- [x] Error message provides next steps
- [x] Validation failure is cached
- [x] Subsequent calls fail immediately (no re-validation)

---

### Scenario 6: Health Check Works Without Token ✅

**Validates**: FR-007 (health check independent of token state)

```bash
# Clear token
unset TODOIST_API_TOKEN

# Start server
vercel dev

# Request health check
npm test -- --testNamePattern="Health check without token"

# Expected: HTTP 200 with response:
# {
#   "status": "healthy",
#   "timestamp": "2025-10-02T...",
#   "components": {
#     "server": { "status": "operational" },
#     "tokenValidation": { "status": "not_configured" }
#   }
# }
```

**Validation**:
- Health check returns 200 OK
- Response includes token validation metadata
- `tokenValidation.status` accurately reflects token absence

**Acceptance Criteria**:
- [x] Health check succeeds (200 OK)
- [x] Response structure matches HealthCheckResponse interface
- [x] tokenValidation.status = "not_configured"
- [x] No validation triggered by health check

---

### Scenario 7: Health Check With Valid Token Shows Metadata ✅

**Validates**: FR-007 (health check metadata includes validation state)

```bash
# Set valid token
export TODOIST_API_TOKEN="your_real_token_here"

# Start server
vercel dev

# Make tool call to trigger validation
npm test -- --testNamePattern="Trigger validation"

# Request health check
npm test -- --testNamePattern="Health check with validated token"

# Expected: HTTP 200 with response:
# {
#   "status": "healthy",
#   "components": {
#     "tokenValidation": {
#       "status": "valid",
#       "validatedAt": "2025-10-02T14:30:05Z"
#     }
#   }
# }
```

**Validation**:
- Health check reflects cached validation state
- `validatedAt` timestamp present when status='valid'

**Acceptance Criteria**:
- [x] Health check succeeds
- [x] tokenValidation.status = "valid"
- [x] validatedAt timestamp included
- [x] Timestamp matches validation time

---

## Integration Test Flow

**Purpose**: Execute all scenarios in sequence to validate complete lifecycle

```bash
# Run full integration test suite
npm test -- --testNamePattern="Token validation lifecycle"

# This test suite includes 12 tests covering:
# 1. Full happy path workflow (startup → list_tools → validation → caching → health check)
# 2. Token removal mid-session
# 3. Token change detection
# 4. All error categories (TOKEN_MISSING, TOKEN_INVALID, AUTH_FAILED, PERMISSION_DENIED)
# 5. Performance requirements (<100ms validation, <1ms cache, <10ms startup)
# 6. Validation persistence across tool types
# 7. Failed validation caching
```

**Acceptance Criteria**:
- [x] All 12 sub-tests pass
- [x] Total execution time <5 seconds (3.27s actual)
- [x] No flaky failures (deterministic mocks)

---

## Manual Verification (Optional)

### Test with Real Todoist Account

```bash
# 1. Get real API token from Todoist
# Visit: https://todoist.com/app/settings/integrations
# Copy "API token" value

# 2. Test without token
unset TODOIST_API_TOKEN
vercel dev
# Expected: Server starts, logs "Starting without token (deferred validation)"

# 3. Test with real token
export TODOIST_API_TOKEN="your_real_token_here"
npm restart

# 4. Make real tool call
# (Via MCP client or test script)
# Example: List today's tasks
# Expected: Validation occurs, task list returned

# 5. Check logs for validation
# Expected log entries:
#   INFO: "Token validation triggered"
#   INFO: "Token validated successfully"
#   INFO: "Validation cached for session"
```

---

## Success Criteria Summary

**Feature is ready for deployment when**:

| Scenario | Status | Evidence |
|----------|--------|----------|
| Server starts without token | ✅ | No crash, process running |
| MCP protocol works without token | ✅ | list_tools returns 7 tools |
| Tool call without token fails gracefully | ✅ | Actionable error message |
| First tool call validates token | ✅ | Validation API call in logs |
| Subsequent tool calls use cache | ✅ | No duplicate validation calls |
| Invalid token returns actionable error | ✅ | "[Category]. [Next step]" format |
| Health check works without token | ✅ | 200 OK with metadata |
| Health check reflects validation state | ✅ | status + validatedAt present |

**All 8 scenarios must pass** before merging to main.

---

## Rollback Plan

If issues occur in production:

1. **Immediate**: Revert to previous version via git
   ```bash
   git revert <commit-hash>
   git push
   ```

2. **Validate**: Existing deployments with tokens work unchanged (backward compatible)

3. **Investigate**: Check Smithery deployment logs for initialization errors

4. **Fix Forward**: Address specific failure mode, re-test quickstart scenarios

---

## Next Steps

After quickstart validation passes:

1. Run full test suite: `npm test`
2. Check coverage: `npm run test:coverage` (target: 80%+)
3. Lint code: `npm run lint`
4. Type check: `npm run typecheck`
5. Build: `npm run build`
6. Update CHANGELOG.md with feature notes
7. Create PR referencing task ID 6f2xcRj95283cvhR
8. Request review from maintainers
9. Deploy to Smithery for platform inspection test
10. Monitor health checks for first 24 hours post-deployment
