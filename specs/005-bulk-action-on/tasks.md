# Tasks: Bulk Actions on Tasks

**Feature**: 005-bulk-action-on
**Input**: Design documents from `/specs/005-bulk-action-on/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/, quickstart.md

## Execution Flow
```
1. Load plan.md → Extract tech stack (TypeScript 5.x, Node.js 18+, Zod, MCP SDK)
2. Load data-model.md → Extract entities (BulkOperationInput, OperationResult, BulkOperationSummary, SyncCommand)
3. Load contracts/ → Extract MCP tool schema and Sync API examples
4. Load quickstart.md → Extract 8 test scenarios
5. Generate tasks:
   → Setup: Zod schemas
   → Tests: Contract tests (7), Integration tests (4)
   → Core: Sync API service methods, MCP tool handler
   → Integration: Server registration
   → Polish: Documentation, quickstart validation
6. Apply TDD: All tests before implementation
7. Mark [P] for tasks in different files
8. Validate: All contracts tested, all entities implemented
9. Return: 20 tasks ready for execution
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Exact file paths included in task descriptions
- TDD approach: Tests MUST fail before implementation

---

## Phase 3.1: Setup & Validation Schemas

- [x] **T001** [P] Create Zod schema for `BulkOperationInput` in `src/schemas/validation.ts`
  - Import existing task field validators
  - Define `bulkActionEnum` with ['update', 'complete', 'uncomplete', 'move']
  - Define `bulkOperationInputSchema` with task_ids (1-50), action, and optional field updates
  - Add refinement to reject disallowed fields: content, description, comments
  - Export schema and inferred TypeScript type

- [x] **T002** [P] Create TypeScript interfaces for response types in `src/types/bulk-operations.ts`
  - Define `OperationResult` interface (task_id, success, error, resource_uri)
  - Define `BulkOperationSummary` interface (total_tasks, successful, failed, results)
  - Define `BulkTasksResponse` interface (success, data, metadata)
  - Define `SyncCommand` interface for Todoist Sync API
  - Define `SyncResponse` and `SyncError` interfaces
  - Export all types

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests (MCP Tool)

- [x] **T003** [P] Contract test: Bulk update 5 tasks with due_string in `tests/contract/bulk-tasks.test.ts`
  - Test: Call todoist_bulk_tasks with action="update", 5 task_ids, due_string="tomorrow"
  - Expect: 5 successful results in response.data.results
  - Use in-memory mock API service
  - Assert: response structure matches BulkTasksResponse schema

- [x] **T004** [P] Contract test: Bulk complete 10 tasks in `tests/contract/bulk-tasks.test.ts`
  - Test: Call todoist_bulk_tasks with action="complete", 10 task_ids
  - Expect: 10 successful results
  - Verify: No field updates sent to API
  - Assert: All results have success=true

- [x] **T005** [P] Contract test: Reject >50 tasks (51 task IDs) in `tests/contract/bulk-tasks.test.ts`
  - Test: Call with 51 unique task_ids
  - Expect: INVALID_PARAMS error before API call
  - Assert: Error message includes "Maximum 50 tasks allowed, received 51"

- [x] **T006** [P] Contract test: Deduplicate task IDs [1,2,1,3] → 3 unique in `tests/contract/bulk-tasks.test.ts`
  - Test: Call with task_ids containing duplicates
  - Expect: 3 unique results (not 4)
  - Assert: metadata.deduplication_applied = true
  - Assert: metadata.original_count = 4, deduplicated_count = 3

- [x] **T007** [P] Contract test: Partial failure (3 valid, 2 invalid IDs) in `tests/contract/bulk-tasks.test.ts`
  - Test: Call with mix of valid and invalid task_ids
  - Expect: 3 successful, 2 failed in results array
  - Assert: summary.successful = 3, summary.failed = 2
  - Assert: Failed results have error messages

- [x] **T008** [P] Contract test: Reject content field update in `tests/contract/bulk-tasks.test.ts`
  - Test: Call with action="update", include "content" field
  - Expect: INVALID_PARAMS error before API call
  - Assert: Error message includes "Cannot modify content, description, or comments"

- [x] **T009** [P] Contract test: Reject mixed actions (not supported) in `tests/contract/bulk-tasks.test.ts`
  - Test: Attempt to mix update and complete actions
  - Expect: INVALID_PARAMS error
  - Assert: Only single action type allowed per request

### Integration Tests (End-to-End Scenarios)

- [x] **T010** [P] Integration test: Bulk reschedule 15 tasks to tomorrow in `tests/integration/bulk-operations.test.ts`
  - Scenario: Get 15 task IDs, bulk update with due_string="tomorrow"
  - Verify: All 15 tasks show tomorrow's due date
  - Assert: Execution time < 2 seconds
  - Use real TodoistApiService (or comprehensive mock)

- [x] **T011** [P] Integration test: Bulk move 7 tasks to different project in `tests/integration/bulk-operations.test.ts`
  - Scenario: Move tasks from Project A to Project B
  - Verify: All 7 tasks now in target project
  - Assert: Source project no longer contains tasks
  - Check: Section and parent_id preserved or updated correctly

- [x] **T012** [P] Integration test: Bulk complete 20 tasks with 3 failures in `tests/integration/bulk-operations.test.ts`
  - Scenario: Complete 17 valid + 3 invalid task IDs
  - Verify: 17 marked as done, 3 show errors
  - Assert: Partial execution completed (not rolled back)
  - Check: Error messages actionable (e.g., "Task not found")

- [x] **T013** [P] Integration test: Rate limit handling (mock 429 response) in `tests/integration/bulk-operations.test.ts`
  - Scenario: Trigger rate limit during bulk operation
  - Mock: 429 response with Retry-After header
  - Verify: System waits and retries
  - Assert: Operation eventually succeeds after backoff

---

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Service Layer (Todoist Sync API)

- [x] **T014** [P] Extend `TodoistApiService` with Sync API rate limiter in `src/services/todoist-api.ts`
  - Add second rate limiter for Sync API: 50 requests/minute
  - Token bucket implementation (~0.83 tokens/sec refill)
  - Separate from existing REST API limiter (300 req/min)
  - Export `getSyncApiRateLimitStatus()` method

- [x] **T015** Implement `executeBatch()` method in `src/services/todoist-api.ts`
  - Accept: `commands: SyncCommand[]` parameter
  - Call: `POST /sync/v9/sync` with commands array
  - Handle: Rate limiting with Sync API limiter
  - Parse: `sync_status` from response
  - Map: Each command UUID to success/error result
  - Return: Mapped results array
  - Retry: On 429 with Retry-After header, on 500-level errors (up to 3 attempts)

### MCP Tool Handler

- [x] **T016** Create `todoist_bulk_tasks` tool handler in `src/tools/bulk-tasks.ts`
  - Import: `bulkOperationInputSchema` from validation
  - Import: `BulkTasksResponse` types
  - Import: `TodoistApiService`
  - Define: Tool schema matching contracts/mcp-tool-schema.json
  - Implement: Input validation with Zod schema
  - Implement: Deduplication logic using `Set<string>`
  - Implement: Pre-validation checks (max 50 tasks, disallowed fields)
  - Dispatch: To action handlers based on `action` field
  - Return: Formatted `BulkTasksResponse` with metadata
  - Error handling: Use `handleToolError()` wrapper

- [x] **T017** Implement action handlers in `src/tools/bulk-tasks.ts`
  - **handleUpdateAction()**: Build item_update commands with field updates
  - **handleCompleteAction()**: Build item_complete commands
  - **handleUncompleteAction()**: Build item_uncomplete commands
  - **handleMoveAction()**: Build item_move commands with project/section/parent
  - Each handler:
    - Generate SyncCommand array with unique UUIDs (format: `cmd-{index}-task-{task_id}`)
    - Call `todoistApiService.executeBatch(commands)`
    - Map response sync_status to OperationResult[]
    - Build BulkOperationSummary with counts
    - Return formatted response

- [x] **T018** Implement result mapping helper in `src/tools/bulk-tasks.ts`
  - Function: `mapSyncStatusToResults(sync_status, task_ids)`
  - Parse: Todoist sync_status object
  - Map: "ok" → `{ success: true, error: null }`
  - Map: Error object → `{ success: false, error: error_message }`
  - Generate: resource_uri as `todoist://task/{id}`
  - Return: `OperationResult[]` array

### Server Integration

- [ ] **T019** Register `todoist_bulk_tasks` tool in `src/server.ts`
  - Import: `bulkTasksTool` from tools/bulk-tasks
  - Add: Tool to `initializeTools()` method
  - Ensure: Tool appears in list_tools response
  - Verify: Tool callable via call_tool handler

---

## Phase 3.4: Integration & Error Handling

- [ ] **T020** Add error mapping for Sync API errors in `src/server.ts`
  - Extend: `mapTodoistErrorToMCP()` function
  - Map: TASK_NOT_FOUND (404) → "Task not found"
  - Map: INVALID_ARGUMENT (400) → "Invalid field value: {details}"
  - Map: FORBIDDEN (403) → "Insufficient permissions"
  - Map: INTERNAL_ERROR (500) → "Todoist service error"
  - Map: RATE_LIMIT_EXCEEDED (429) → "Rate limit exceeded"
  - Return: MCP error codes (INVALID_PARAMS, INTERNAL_ERROR)

---

## Phase 3.5: Polish & Validation

- [ ] **T021** [P] Add unit tests for deduplication logic in `tests/unit/bulk-validation.test.ts`
  - Test: Deduplicate([1,2,1,3]) → [1,2,3]
  - Test: Deduplicate([1]) → [1] (single item)
  - Test: Deduplicate([]) → reject (empty array)
  - Test: 50 unique after dedup → pass
  - Test: 51 unique after dedup → reject

- [ ] **T022** [P] Add unit tests for field validation in `tests/unit/bulk-validation.test.ts`
  - Test: Reject content field
  - Test: Reject description field
  - Test: Reject comments field
  - Test: Allow all supported fields (project_id, section_id, labels, priority, due_string, etc.)
  - Test: Priority range (1-4 valid, 0 and 5 invalid)

- [ ] **T023** [P] Update README.md with bulk operations section
  - Add: Tool name `todoist_bulk_tasks`
  - Add: Supported actions (update, complete, uncomplete, move)
  - Add: Usage examples from contracts/mcp-tool-schema.json
  - Add: Limitations (max 50 tasks, no content/description/comments)
  - Add: Performance note (<2s for 50 tasks)

- [ ] **T024** Execute quickstart.md validation scenarios
  - Run: All 8 test scenarios from quickstart.md
  - Test 1: Bulk update due dates (5 tasks)
  - Test 2: Bulk complete (10 tasks)
  - Test 3: Bulk move to project (7 tasks)
  - Test 4: Bulk update multiple fields (8 tasks)
  - Test 5: Error handling (>50 tasks)
  - Test 6: Error handling (deduplication)
  - Test 7: Error handling (partial failures)
  - Test 8: Error handling (disallowed fields)
  - Verify: All tests pass, performance <2s for 50 tasks

---

## Dependencies

**Strict Ordering**:
1. **Setup (T001-T002)** → Must complete before any tests or implementation
2. **Tests (T003-T013)** → Must complete and FAIL before implementation starts
3. **Service Layer (T014-T015)** → Must complete before tool handler
4. **Tool Handler (T016-T018)** → Depends on T014-T015
5. **Integration (T019-T020)** → Depends on T016-T018
6. **Polish (T021-T024)** → After all implementation complete

**Blocking Dependencies**:
- T001 blocks T003-T009 (contract tests need schema)
- T002 blocks T003-T013 (tests need type definitions)
- T014 blocks T015 (Sync API limiter before executeBatch)
- T015 blocks T016-T018 (tool needs Sync API methods)
- T016-T018 block T019 (server registration needs tool)
- All tests (T003-T013) must fail before T014-T020 start

---

## Parallel Execution Examples

### Phase 3.1 (Setup)
```bash
# Run T001 and T002 in parallel (different files):
/task T001: Create Zod schema for BulkOperationInput in src/schemas/validation.ts
/task T002: Create TypeScript interfaces in src/types/bulk-operations.ts
```

### Phase 3.2 (Contract Tests)
```bash
# Run T003-T009 in parallel (all in same file but independent test cases):
# Note: Since they're in the same file, run sequentially or use test framework parallelism
/task T003: Contract test bulk update 5 tasks
/task T004: Contract test bulk complete 10 tasks
/task T005: Contract test reject >50 tasks
/task T006: Contract test deduplication
/task T007: Contract test partial failure
/task T008: Contract test reject content field
/task T009: Contract test reject mixed actions
```

### Phase 3.2 (Integration Tests)
```bash
# Run T010-T013 in parallel (same file but independent scenarios):
/task T010: Integration test bulk reschedule 15 tasks
/task T011: Integration test bulk move 7 tasks
/task T012: Integration test bulk complete with failures
/task T013: Integration test rate limit handling
```

### Phase 3.5 (Polish)
```bash
# Run T021, T022, T023 in parallel (different files):
/task T021: Unit tests for deduplication in tests/unit/bulk-validation.test.ts
/task T022: Unit tests for field validation in tests/unit/bulk-validation.test.ts
/task T023: Update README.md with bulk operations section
```

---

## Notes

- **[P] Tasks**: Different files or truly independent test cases
- **TDD Critical**: All tests (T003-T013) MUST be written and MUST FAIL before starting T014
- **Commit Strategy**: Commit after each task completion
- **File Conflicts**: T003-T009 share same test file - run sequentially or rely on test framework
- **Performance Target**: <2 seconds for 50-task bulk operations (validate in T024)
- **Constitution Compliance**: All tasks align with MCP Todoist Server Constitution v1.1.0

---

## Validation Checklist
*GATE: Must verify before marking feature complete*

- [ ] All contract tests (T003-T009) passing
- [ ] All integration tests (T010-T013) passing
- [ ] All unit tests (T021-T022) passing
- [ ] Quickstart scenarios (T024) validated
- [ ] Performance benchmark met (<2s for 50 tasks)
- [ ] README.md updated with bulk operations documentation
- [ ] No regression in existing MCP tools
- [ ] Constitutional compliance verified:
  - [x] API-First: Uses Todoist Sync API v9
  - [x] Type Safety: Full TypeScript + Zod validation
  - [x] Test Coverage: 13 tests (7 contract + 4 integration + 2 unit)
  - [x] UX Consistency: Follows todoist_tasks tool pattern
  - [x] Performance: <2s target for 50 tasks
  - [x] Security: Audit logging, no sensitive data in logs
  - [x] MCP Protocol: Tool schema, error codes, resource URIs
  - [x] Code Quality: TDD approach, no duplication

---

**Total Tasks**: 24
**Estimated Completion**: 3-4 days (TDD approach with comprehensive testing)
**Ready for Execution**: Yes - all tasks have clear file paths and acceptance criteria
