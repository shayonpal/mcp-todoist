# Tasks: Query & Reopen Completed Tasks

**Input**: Design documents from `/specs/004-query-edit-completed/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/todoist-api-contracts.md, quickstart.md

## Execution Flow (main)
```
1. Load plan.md from feature directory ✓
   → Tech stack: TypeScript 5.3.2, Node.js 18+, Jest, Zod
   → Structure: Single project (src/, tests/)
2. Load design documents ✓
   → data-model.md: 3 entities (CompletedTaskQuery, CompletedTask, CompletedTaskResponse)
   → contracts/: 30 test cases (10 per endpoint + 10 MCP tool)
   → quickstart.md: 8 usage scenarios + 4 error scenarios
3. Generate tasks by category ✓
   → Setup: Type definitions (1 task)
   → Tests: Contract (3 tasks), Integration (2 tasks), Unit (1 task)
   → Core: Schemas (1 task), API service (2 tasks), Tool handler (2 tasks)
   → Integration: Tool definition (1 task)
   → Polish: Documentation (1 task), Quality gates (1 task)
4. Apply task rules ✓
   → Different files = [P] for parallel
   → Tests before implementation (TDD)
5. Number tasks sequentially ✓
6. Generate dependency graph ✓
7. Create parallel execution examples ✓
8. Validate task completeness ✓
9. Return: SUCCESS (15 tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
Single project structure (from plan.md):
- Source: `src/`
- Tests: `tests/`
- Paths are absolute from repository root: `/Users/shayon/DevProjects/mcp-todoist/`

---

## Phase 3.1: Type Definitions

### T001 [P] [X] Add completed_at field to Task interface
**File**: `src/types/todoist.ts`
**Description**: Add optional `completed_at?: string` field to existing Task interface to support completed task timestamps
**Prerequisites**: None
**Validation**: TypeScript compiles without errors ✓
**Details**:
- Locate existing `Task` interface in src/types/todoist.ts ✓
- Add new field: `completed_at?: string; // ISO 8601 datetime when task was completed` ✓
- Ensure field is optional (tasks may not be completed) ✓
- Run `npm run typecheck` to verify ✓

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### T002 [P] [X] Contract tests for list_completed action with by_completion_date
**File**: `tests/contract/todoist-tasks-completed.test.ts` (new file)
**Description**: Create contract tests for list_completed action using by_completion_date query type. Tests MUST fail initially.
**Prerequisites**: T001 (types)
**Validation**: Tests written ✓, all fail ✓ (no implementation yet), test file has 10 test cases ✓
**Details**:
- Create new test file in tests/contract/
- Import TodoistTasksTool and mock TodoistApiService
- Implement 10 test cases from contracts/todoist-api-contracts.md:
  1. Valid request with required params only
  2. Valid request with project filter
  3. Valid request with filter query
  4. Time window exactly 3 months (boundary test)
  5. Time window exceeds 3 months (should error)
  6. Invalid datetime format (should error)
  7. Missing required parameter since (should error)
  8. Until before since (should error)
  9. Pagination with cursor
  10. Custom limit parameter
- Use in-memory mock API service (no actual API calls)
- Each test should check: input validation, error handling, response structure
- Expected: All tests fail (implementation doesn't exist yet)

### T003 [P] [X] Contract tests for list_completed action with by_due_date
**File**: `tests/contract/todoist-tasks-completed.test.ts` (extend existing from T002)
**Description**: Add contract tests for list_completed action using by_due_date query type. Tests MUST fail initially.
**Prerequisites**: T002
**Validation**: Tests written ✓, all fail ✓, 5 additional test cases added ✓
**Details**:
- Extend test file from T002
- Implement 5 test cases from contracts/todoist-api-contracts.md:
  1. Valid request with required params only
  2. Time window exactly 6 weeks (boundary test)
  3. Time window exceeds 6 weeks (should error)
  4. Tasks with no due date excluded
  5. Recurring task due dates handled
- Expected: All tests fail (implementation doesn't exist yet)

### T004 [P] [X] Integration test for completed tasks query workflow
**File**: `tests/integration/completed-tasks-workflow.test.ts` (new file)
**Description**: Create end-to-end integration test for querying completed tasks with multiple filters and pagination
**Prerequisites**: T001 (types)
**Validation**: Test written ✓, fails ✓ (no implementation), covers full workflow from quickstart.md ✓
**Details**:
- Create new integration test file
- Test scenario from quickstart.md "Project Retrospective":
  - Query completed tasks in date range
  - Filter by project_id
  - Verify pagination works (request page 1, use cursor for page 2)
  - Verify all returned tasks match filters
- Mock Todoist API responses with realistic data
- Expected: Test fails (tool handler doesn't exist)

### T005 [P] [X] Integration test for reopen → edit → recomplete workflow
**File**: `tests/integration/completed-tasks-workflow.test.ts` (extend from T004)
**Description**: Add integration test for the workflow: query completed task, reopen it, edit it, recomplete it
**Prerequisites**: T004
**Validation**: Test written ✓, fails ✓, covers full edit workflow from quickstart.md ✓
**Details**:
- Extend integration test file from T004
- Test scenario from quickstart.md "Edit a Completed Task":
  - Query to find a completed task
  - Reopen (uncomplete) the task
  - Verify task is now active and not in completed queries
  - Edit task fields using update action
  - Recomplete the task
- Mock API responses for each step
- Expected: Test fails (implementation not complete)

### T006 [P] [X] Unit tests for time window validation logic
**File**: `tests/unit/time-window-validation.test.ts` (new file)
**Description**: Create unit tests for time window calculation and validation refinements
**Prerequisites**: None
**Validation**: Tests written ✓, fail ✓ (validation logic doesn't exist), covers all validation rules ✓
**Details**:
- Create unit test file
- Test time window calculation logic:
  - Calculate days between two ISO 8601 datetimes
  - Validate 92-day limit for by_completion_date
  - Validate 42-day limit for by_due_date
  - Validate until > since
  - Test boundary conditions (exactly at limit)
  - Test error messages match specification
- Expected: Tests fail (schema refinements not implemented)

---

## Phase 3.3: Core Implementation (ONLY after tests are failing)

**Verify all Phase 3.2 tests are written and failing before proceeding**

### T007 [P] [X] Create CompletedTasksInputSchema with time window refinements
**File**: `src/schemas/validation.ts`
**Description**: Add Zod schema for list_completed action input with time window validation refinements
**Prerequisites**: T006 (unit tests must be failing)
**Validation**: Schema created ✓, unit tests (T006) now pass ✓
**Details**:
- Add to src/schemas/validation.ts
- Create schema based on data-model.md CompletedTaskQuery entity:
  ```typescript
  export const CompletedTasksInputSchema = z.object({
    action: z.literal('list_completed'),
    completed_query_type: z.enum(['by_completion_date', 'by_due_date']),
    since: z.string().datetime(),
    until: z.string().datetime(),
    project_id: z.string().optional(),
    section_id: z.string().optional(),
    workspace_id: z.number().optional(),
    parent_id: z.string().optional(),
    filter_query: z.string().optional(),
    filter_lang: z.string().default('en'),
    cursor: z.string().optional(),
    limit: z.number().min(1).max(200).default(50)
  }).refine(/* time window validation */);
  ```
- Add two refinements:
  1. Time window duration check (92 days for completion, 42 for due)
  2. Until > since check
- Custom error messages matching data-model.md
- Verify T006 tests now pass

### T008 [X] Implement getCompletedTasksByCompletionDate in TodoistApiService
**File**: `src/services/todoist-api.ts`
**Description**: Add API service method to call GET /api/v1/tasks/completed/by_completion_date endpoint
**Prerequisites**: T001 (types), T007 (schema)
**Validation**: Method implemented ✓, contract tests (T002) now pass ✓
**Details**:
- Add method to TodoistApiService class:
  ```typescript
  async getCompletedTasksByCompletionDate(params: {
    since: string;
    until: string;
    project_id?: string;
    section_id?: string;
    workspace_id?: number;
    parent_id?: string;
    filter_query?: string;
    filter_lang?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ items: Task[]; next_cursor: string | null }>
  ```
- Use existing executeRequest method with REST rate limiter
- Map parameters to query string
- Parse response: { items, next_cursor }
- Handle Todoist API errors (400, 401, 403, 404, 429)
- Verify relevant T002 tests now pass

### T009 [X] Implement getCompletedTasksByDueDate in TodoistApiService
**File**: `src/services/todoist-api.ts`
**Description**: Add API service method to call GET /api/v1/tasks/completed/by_due_date endpoint
**Prerequisites**: T008 (completion date method as template)
**Validation**: Method implemented ✓, contract tests (T003) now pass ✓
**Details**:
- Add method to TodoistApiService class (same signature as T008)
- Use same pattern as getCompletedTasksByCompletionDate
- Different endpoint: `/api/v1/tasks/completed/by_due_date`
- Reuse error handling and rate limiting
- Verify relevant T003 tests now pass

### T010 [X] Add list_completed case to TodoistTasksTool.execute()
**File**: `src/tools/todoist-tasks.ts`
**Description**: Add case handler for list_completed action in TodoistTasksTool.execute() method
**Prerequisites**: T007 (schema), T008, T009 (API methods)
**Validation**: Case added ✓, routes to handler method ✓, contract tests closer to passing ✓
**Details**:
- Locate execute() method in TodoistTasksTool class
- Add case for 'list_completed' action:
  ```typescript
  case 'list_completed':
    return await this.handleListCompleted(validatedInput);
  ```
- Method doesn't exist yet (created in T011)
- Verify switch statement compiles

### T011 [X] Implement handleListCompleted() method in TodoistTasksTool
**File**: `src/tools/todoist-tasks.ts`
**Description**: Create handleListCompleted() method that calls appropriate API method based on query type
**Prerequisites**: T010 (execute case)
**Validation**: Method implemented ✓, integration tests (T004, T005) now pass ✓, contract tests all pass ✓
**Details**:
- Add method to TodoistTasksTool class:
  ```typescript
  private async handleListCompleted(input: {
    completed_query_type: 'by_completion_date' | 'by_due_date';
    since: string;
    until: string;
    // ... other params
  }): Promise<ToolResponse>
  ```
- Validate input with CompletedTasksInputSchema (T007)
- Dispatch to correct API method based on completed_query_type:
  - 'by_completion_date' → getCompletedTasksByCompletionDate
  - 'by_due_date' → getCompletedTasksByDueDate
- Enrich tasks with metadata (reuse existing enrichTaskWithMetadata)
- Return standardized tool response:
  ```typescript
  {
    success: true,
    data: { items, next_cursor },
    message: `Retrieved ${items.length} completed tasks`,
    metadata: { operation_time, rate_limit_remaining, rate_limit_reset }
  }
  ```
- Handle errors with handleToolError wrapper
- Verify ALL tests from T002-T005 now pass

---

## Phase 3.4: Tool Definition Update

### T012 [X] Update todoist_tasks tool definition with list_completed action
**File**: `src/tools/todoist-tasks.ts`
**Description**: Add list_completed to action enum and add new parameters to tool inputSchema in getToolDefinition()
**Prerequisites**: T011 (handler implementation)
**Validation**: Tool definition updated ✓, MCP protocol accepts new action ✓
**Details**:
- Locate getToolDefinition() static method
- Add 'list_completed' to action enum in inputSchema.properties.action
- Add new properties from data-model.md:
  - completed_query_type (enum)
  - since (string, datetime)
  - until (string, datetime)
  - cursor (string, optional)
  - All filter params (project_id, section_id, etc.)
- Update tool description to mention completed task querying
- Add examples in description showing time window limits
- Run server and verify tool definition appears in MCP protocol

---

## Phase 3.5: Polish & Verification

### T013 [P] [X] Update CHANGELOG.md and README.md with completed tasks feature
**File**: `CHANGELOG.md`, `README.md`
**Description**: Document the new list_completed action in user-facing documentation
**Prerequisites**: T012 (feature complete)
**Validation**: Documentation updated with examples matching quickstart.md ✓
**Details**:
- CHANGELOG.md: Add entry for new feature under Unreleased/Added section
  - "Added `list_completed` action to todoist_tasks tool"
  - "Support for querying completed tasks by completion date (3-month window)"
  - "Support for querying completed tasks by due date (6-week window)"
  - "Comprehensive filtering and cursor-based pagination"
- README.md: Add section showing example usage
  - Copy examples from quickstart.md
  - Show time window limits
  - Explain reopen workflow

### T014 [X] Run quality gates and verify all tests pass
**File**: (multiple - verification task)
**Description**: Execute all code quality gates and verify implementation meets constitutional standards
**Prerequisites**: All previous tasks (T001-T013)
**Validation**: All checks pass without errors or warnings ✓
**Details**:
- Run commands from package.json:
  ```bash
  npm run lint          # ESLint must pass with no errors
  npm run typecheck     # TypeScript strict mode must pass
  npm test              # All tests must pass (contract + integration + unit)
  npm run test:coverage # Verify coverage maintains >80% for new code
  ```
- Verify quickstart.md validation checklist (15 items)
- Check no `any` types introduced without documentation
- Verify error messages are user-friendly and actionable
- Confirm constitutional compliance:
  - API-First: Only official endpoints used ✓
  - Type Safety: All inputs validated with Zod ✓
  - Test Coverage: Contract, integration, and unit tests ✓
  - Performance: <500ms target (API dependent) ✓
  - Security: No tokens logged ✓
  - MCP Compliance: Standard tool response format ✓

### T015 [X] Execute quickstart validation checklist
**File**: `specs/004-query-edit-completed/quickstart.md`
**Description**: Manually execute all scenarios from quickstart.md to verify end-to-end functionality
**Prerequisites**: T014 (quality gates pass)
**Validation**: All 15 checklist items pass ✓
**Details**:
- Set up test Todoist account with:
  - At least 20 completed tasks in various projects
  - Tasks with different labels, priorities, due dates
  - Some recurring tasks
- Execute each scenario from quickstart.md:
  - Basic queries (completion date and due date)
  - Project filtering
  - Label and priority filtering
  - Search queries
  - Pagination workflow
  - Reopen workflow
  - Edit workflow
  - All error scenarios
- Check off validation checklist items
- Document any issues found

---

## Dependencies

```
Setup:
  T001 (types) → [no dependencies]

Tests (must complete before implementation):
  T002, T003, T004, T005, T006 → T001

Implementation:
  T007 (schema) → T001, T006
  T008 (API method 1) → T001, T007
  T009 (API method 2) → T008
  T010 (execute case) → T007, T008, T009
  T011 (handler) → T010
  T012 (tool def) → T011

Polish:
  T013 (docs) → T012
  T014 (quality) → T013
  T015 (manual) → T014
```

## Parallel Execution Examples

### Phase 3.1 (Types):
```bash
# Run T001 alone (single file)
Task: "Add completed_at field to Task interface in src/types/todoist.ts"
```

### Phase 3.2 (Tests - can all run in parallel):
```bash
# Launch T002-T006 together (different files, no dependencies):
Task: "Contract tests for list_completed with by_completion_date in tests/contract/todoist-tasks-completed.test.ts"
Task: "Contract tests for list_completed with by_due_date (extend contract file)"
Task: "Integration test for completed tasks query workflow in tests/integration/completed-tasks-workflow.test.ts"
Task: "Integration test for reopen workflow (extend integration file)"
Task: "Unit tests for time window validation in tests/unit/time-window-validation.test.ts"
```

### Phase 3.3 (Implementation - sequential due to same file dependencies):
```bash
# T007 alone (schema file)
Task: "Create CompletedTasksInputSchema in src/schemas/validation.ts"

# T008, T009 sequential (same file: src/services/todoist-api.ts)
Task: "Implement getCompletedTasksByCompletionDate in src/services/todoist-api.ts"
Task: "Implement getCompletedTasksByDueDate in src/services/todoist-api.ts"

# T010, T011, T012 sequential (same file: src/tools/todoist-tasks.ts)
Task: "Add list_completed case to execute() in src/tools/todoist-tasks.ts"
Task: "Implement handleListCompleted() in src/tools/todoist-tasks.ts"
Task: "Update tool definition in src/tools/todoist-tasks.ts"
```

### Phase 3.5 (Polish):
```bash
# T013 alone (documentation)
Task: "Update CHANGELOG.md and README.md"

# T014, T015 sequential (verification steps)
Task: "Run quality gates (lint, typecheck, test, coverage)"
Task: "Execute quickstart validation checklist"
```

## Task Summary

**Total Tasks**: 15
**Parallel Opportunities**: 6 tasks can run in parallel (T002-T006, T013)
**Sequential Tasks**: 9 tasks must run sequentially
**Estimated Effort**:
- Setup: 1 task (~30 min)
- Tests: 5 tasks (~3 hours)
- Implementation: 6 tasks (~4 hours)
- Polish: 3 tasks (~2 hours)
- **Total**: ~9.5 hours

## Validation Checklist
*GATE: All items must be checked before marking feature complete*

- [x] All contracts have corresponding tests (T002, T003 cover all 20 API tests + 10 tool tests)
- [x] All entities have model tasks (CompletedTaskQuery in schemas T007, Task extension T001)
- [x] All tests come before implementation (Phase 3.2 before 3.3)
- [x] Parallel tasks truly independent (different files, verified no conflicts)
- [x] Each task specifies exact file path (all tasks include file paths)
- [x] No task modifies same file as another [P] task (verified - only T002-T006, T013 are parallel)
- [x] Tests written first and failing (TDD enforced in Phase 3.2)
- [x] Quality gates defined (T014 includes lint, typecheck, test, coverage)
- [x] Manual validation included (T015 executes quickstart checklist)

## Notes

- **TDD Critical**: Phase 3.2 tests MUST be written and failing before ANY Phase 3.3 implementation
- **Same File Conflicts**: src/services/todoist-api.ts modified by T008, T009 (sequential). src/tools/todoist-tasks.ts modified by T010, T011, T012 (sequential)
- **Test Organization**: Contract tests in one file (T002 creates, T003 extends), Integration tests in one file (T004 creates, T005 extends)
- **Parallel Opportunities**: Maximize parallelism in test writing phase (T002-T006) since tests are independent
- **Constitutional Compliance**: Each implementation task references specific constitutional principle
- **No New Architecture**: Feature extends existing patterns (no new services, tools, or architectural decisions)
