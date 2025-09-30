# Tasks: Todoist MCP Server

**Input**: Design documents from `/specs/001-todoist-mcp-server/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Extract: TypeScript 5.0+, Node.js 18+, @modelcontextprotocol/sdk, axios, zod, dotenv
2. Load optional design documents:
   → data-model.md: 6 entities (Task, Project, Section, Comment, Filter, Label, Reminder)
   → contracts/: 6 MCP tool contract files (added reminders in Phase 4)
   → quickstart.md: 7 verification scenarios
3. Generate tasks by category:
   → Setup: project init, TypeScript config, Jest setup
   → Tests: contract tests for tools, integration scenarios
   → Core: type definitions, service layer, MCP tools
   → Integration: MCP server, error handling, caching
   → Polish: unit tests, performance validation, docs
   → Phase 4: API v2→v1 migration, reminders implementation
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001-T067)
6. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Single project**: `src/`, `tests/` at repository root
- Paths shown below for single TypeScript project structure

## Phase 3.1: Setup
- [x] T001 Create project structure with src/, tests/, and config directories
- [x] T002 Initialize npm project with TypeScript 5.0+ and Node.js 18+ dependencies
- [x] T003 [P] Configure TypeScript with tsconfig.json for MCP server requirements
- [x] T004 [P] Setup Jest configuration in jest.config.js with ts-jest
- [x] T005 [P] Configure ESLint and Prettier for TypeScript code standards
- [x] T006 Create .env.example with TODOIST_API_TOKEN placeholder

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [x] T007 [P] Contract test for todoist_tasks tool in tests/contract/todoist_tasks.test.ts
- [x] T008 [P] Contract test for todoist_projects tool in tests/contract/todoist_projects.test.ts
- [x] T009 [P] Contract test for todoist_sections tool in tests/contract/todoist_sections.test.ts
- [x] T010 [P] Contract test for todoist_comments tool in tests/contract/todoist_comments.test.ts
- [x] T011 [P] Contract test for todoist_filters tool in tests/contract/todoist_filters.test.ts
- [x] T012 [P] Mock Todoist API responses in tests/mocks/todoist-api-responses.ts
- [x] T013 [P] Integration test for project creation and task management in tests/integration/project-workflow.test.ts
- [x] T014 [P] Integration test for batch operations in tests/integration/batch-operations.test.ts
- [x] T015 [P] Integration test for rate limiting behavior in tests/integration/rate-limiting.test.ts
- [x] T016 [P] Validation test suite for Zod schemas in tests/unit/validation.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)
- [x] T017 [P] TodoistTask type definition in src/types/todoist.ts
- [x] T018 [P] TodoistProject type definition in src/types/todoist.ts
- [x] T019 [P] TodoistSection type definition in src/types/todoist.ts
- [x] T020 [P] TodoistComment type definition in src/types/todoist.ts
- [x] T021 [P] TodoistFilter and TodoistLabel types in src/types/todoist.ts
- [x] T022 [P] Zod validation schemas for all input types in src/schemas/validation.ts
- [x] T023 [P] Error type definitions and MCP error mapping in src/types/errors.ts
- [x] T024 TodoistApiService with rate limiting in src/services/todoist-api.ts
- [x] T025 Cache service for projects and labels in src/services/cache.ts
- [x] T026 Batch operations handler with temp ID management in src/services/batch.ts
- [x] T027 TodoistTasksTool implementation in src/tools/todoist-tasks.ts
- [x] T028 TodoistProjectsTool implementation in src/tools/todoist-projects.ts
- [x] T029 TodoistSectionsTool implementation in src/tools/todoist-sections.ts
- [x] T030 TodoistCommentsTool implementation in src/tools/todoist-comments.ts
- [x] T031 TodoistFiltersTool implementation in src/tools/todoist-filters.ts

## Phase 3.4: Integration
- [x] T032 MCP server initialization in src/server.ts with tool registration
- [x] T033 Configuration management with dotenv in src/config/index.ts
- [x] T034 Structured error handling middleware in src/middleware/error-handler.ts
- [x] T035 Request logging with correlation IDs in src/middleware/logging.ts
- [x] T036 Health check endpoint for API connectivity in src/server.ts

## Phase 3.5: Polish
- [x] T037 [P] Unit tests for TodoistApiService methods in tests/unit/todoist-api.test.ts
- [x] T038 [P] Unit tests for cache service in tests/unit/cache.test.ts
- [x] T039 [P] Performance tests validating <500ms response times in tests/performance/response-time.test.ts
- [x] T040 [P] Update README.md with setup and usage documentation
- [x] T041 Run quickstart.md verification scenarios manually

## Phase 3.6: Test Infrastructure Fixes
**Context**: T037-T040 implemented but tests need configuration fixes to run properly
- [x] T043 Fix Jest configuration for ES module imports with .js extensions (moduleNameMapping property name issue)
- [x] T044 Fix remaining type mismatches in mock data for all test files (null vs undefined, view_style literal types)
- [x] T045 [P] Ensure all unit tests pass without configuration warnings (axios-mock-adapter setup)
- [x] T046 [P] Ensure all integration tests pass with proper module resolution (existing test imports need .js extension fixes)
- [x] T047 [P] Ensure all performance tests execute correctly (performance.now() timing validation)
- [x] T048 Verify test coverage meets project requirements (>80% coverage for core services)

## Phase 4: API Version Migration & Reminders Implementation
**Context**: Audit revealed critical API version mismatch (v2 → v1) and missing reminders feature (FR-011)
**Documentation**: All implementations MUST follow [docs/todoist-api-v1-documentation.md](../../../docs/todoist-api-v1-documentation.md) specifications

### Phase 4.1: Critical API Version Fix (BLOCKING)
**CRITICAL: All API calls currently use deprecated v2 endpoints**
- [x] T049 [P] Update base_url from v2 to v1 in src/services/todoist-api.ts (line 139: `https://api.todoist.com/rest/v1`)
- [x] T050 [P] Update base_url type comment and default in src/types/todoist.ts (line 111: change comment to v1)
- [x] T051 [P] Update TODOIST_API_BASE_URL in src/config/index.ts (line 12: `https://api.todoist.com/rest/v1`)
- [x] T052 [P] Update base_url validation default in src/schemas/validation.ts (line 238: `https://api.todoist.com/rest/v1`)
- [x] T053 Verify and fix sync endpoint path in src/services/todoist-api.ts (confirm uses `/api/v1/sync` not `/rest/v1/sync`)
- [x] T054 Update all test files to use v1 endpoints in tests/contract/ and tests/integration/ (9 files total)
- [x] T055 Verify rate limit values match v1 API specifications in src/services/todoist-api.ts (lines 145-146)

### Phase 4.2: Reminders Feature Implementation (FR-011)
**Spec Requirement**: FR-011 - System MUST provide ability to manage reminders for tasks
**Note**: Natural language due dates ("every day", "day after tomorrow", "every sept 7") supported via due_string parameter
- [x] T056 [P] Contract test for todoist_reminders tool in tests/contract/todoist_reminders.test.ts (TDD - must fail before implementation)
- [x] T057 Add TodoistReminder type definition in src/types/todoist.ts with all v1 API fields
- [x] T058 Add reminder validation schemas (CreateReminderSchema, UpdateReminderSchema) in src/schemas/validation.ts
- [x] T059 Add reminder CRUD methods to TodoistApiService in src/services/todoist-api.ts (getReminders, createReminder, updateReminder, deleteReminder)
- [x] T060 Implement TodoistRemindersTool with full CRUD operations in src/tools/todoist-reminders.ts
- [x] T061 Register todoist_reminders tool in MCP server in src/server.ts
- [x] T062 Add integration test for reminder lifecycle in tests/integration/reminder-workflow.test.ts

### Phase 4.3: Validation & Documentation
- [x] T063 Verify natural language due date support works correctly (test "every day", "tomorrow", "every 4th", "day after tomorrow")
- [x] T064 Run full test suite and verify all tests pass with v1 API endpoints

#### Phase 4.3.1: Test Assertion Fixes (Before Documentation)
**Context**: T064 revealed 6 failing tests due to assertion mismatches, not API issues. Must fix before documentation.
- [x] T064a [P] Fix comment schema validation test in tests/unit/validation.test.ts (content length, task_id/project_id exclusivity, attachment structure)
- [x] T064b [P] Fix filter query syntax validation test in tests/unit/validation.test.ts (basic query validation expectations)
- [x] T064c [P] Fix label name format validation test in tests/unit/validation.test.ts (name format rules)
- [x] T064d [P] Fix batch operation command type validation in tests/unit/validation.test.ts (command type enum)
- [x] T064e [P] Fix batch operation temp_id uniqueness validation in tests/unit/validation.test.ts (temp_id uniqueness check)
- [x] T064f Update contract tests to use getToolDefinition() for schema inspection instead of instance properties
- [x] T064g Introduce per-suite mock factory helpers (e.g., `createTasksApiMock`) with precise `jest.Mock<Promise<TodoistTask>, [...]>` signatures
- [x] T064h Alternatively expose targeted helper builders (`withTasksMocks`, `withFilterMocks`, etc.) that return only required mock methods
- [ ] T064i ~~Gradually remove `// @ts-nocheck` from contract/integration tests by tightening mocks~~ → **MOVED TO TODOIST** (Task ID: 6f2QGXc6M2p8cpg2 in "Todoist MCP" project) - Will be completed later as technical debt cleanup
- [x] T065 [P] Update README.md to explicitly mention v1 API usage and add reminders to feature list
- [x] T066 [P] Update .env.example if it contains API URL references
- [x] T067 Manual verification of all 7 quickstart.md scenarios with v1 endpoints and reminders

### Phase 4.4: Code Quality & Cleanup
- [x] T042 Cleanup and remove code duplication across tool implementations (migrated from Phase 3.5)

## Dependencies
- Setup (T001-T006) must complete first
- Tests (T007-T016) before implementation (T017-T031)
- Type definitions (T017-T023) before services (T024-T026)
- Services (T024-T026) before tools (T027-T031)
- Tools before integration (T032-T036)
- Implementation before polish (T037-T041)
- Polish before test infrastructure fixes (T043-T048)
- Test infrastructure before Phase 4 (T049-T067, T042)
- Phase 4.1 API version fix (T049-T055) before Phase 4.2 reminders (T056-T062)
- Reminders implementation before Phase 4.3 validation (T063-T064)
- Phase 4.3 main validation (T063-T064) before Phase 4.3.1 test fixes (T064a-T064f)
- Phase 4.3.1 test fixes before Phase 4.3 documentation (T065-T067)
- Phase 4.3 complete before Phase 4.4 cleanup (T042)

## Parallel Execution Examples

### Test Phase (Launch T007-T011 together):
```bash
Task: "Write contract test for todoist_tasks tool with create/update/delete/list/complete actions"
Task: "Write contract test for todoist_projects tool with create/update/delete/list/archive actions"
Task: "Write contract test for todoist_sections tool with create/update/delete/list/reorder actions"
Task: "Write contract test for todoist_comments tool with create/update/delete/list actions"
Task: "Write contract test for todoist_filters tool with create/update/delete/list/query actions"
```

### Type Definition Phase (Launch T017-T021 together):
```bash
Task: "Define TodoistTask interface with all fields from data-model.md"
Task: "Define TodoistProject interface with nested project support"
Task: "Define TodoistSection interface with project relationship"
Task: "Define TodoistComment interface with attachment support"
Task: "Define TodoistFilter and TodoistLabel interfaces"
```

### Polish Phase (Launch T037-T040 together):
```bash
Task: "Write unit tests for TodoistApiService rate limiting and retry logic"
Task: "Write unit tests for cache service TTL and invalidation"
Task: "Write performance tests ensuring <500ms for single operations"
Task: "Update README.md with installation, configuration, and usage examples"
```

### Phase 4.1: API Version Fix (Launch T049-T052 together):
```bash
Task: "Update base_url from v2 to v1 in src/services/todoist-api.ts"
Task: "Update base_url type comment in src/types/todoist.ts"
Task: "Update TODOIST_API_BASE_URL in src/config/index.ts"
Task: "Update base_url validation default in src/schemas/validation.ts"
```

### Phase 4.3.1: Test Assertion Fixes (Launch T064a-T064e together):
```bash
Task: "Fix comment schema validation test expectations in tests/unit/validation.test.ts"
Task: "Fix filter query syntax validation test expectations in tests/unit/validation.test.ts"
Task: "Fix label name format validation test expectations in tests/unit/validation.test.ts"
Task: "Fix batch operation command type validation in tests/unit/validation.test.ts"
Task: "Fix batch operation temp_id uniqueness validation in tests/unit/validation.test.ts"
```

### Phase 4.3: Documentation Update (Launch T065-T066 together):
```bash
Task: "Update README.md to mention v1 API and add reminders feature"
Task: "Update .env.example if it contains API URL references"
```

## Notes
- [P] tasks = different files, no shared dependencies
- Verify all tests fail before implementing (TDD approach)
- Commit after each task completion
- Use exact file paths from task descriptions
- Batch operations support up to 100 commands
- Cache TTL: 30 min for projects/labels, 15 min for sections
- Rate limits: 1000 partial sync/15min, 100 full sync/15min
- **API Version**: Migrating from deprecated v2 to v1 (Phase 4.1 - CRITICAL)
- **Natural Language Due Dates**: Supported via due_string parameter (e.g., "every day", "tomorrow", "every 4th", "day after tomorrow", "every sept 7")
- **Reminders**: New feature implementation in Phase 4.2 (FR-011 requirement)

## Current Status (as of Phase 4.4)
- ✅ Phase 3.1-3.6: Complete (T001-T048)
- ✅ Phase 4.1: API version migration complete (v2 → v1) - T049-T055
- ✅ Phase 4.2: Reminders feature implemented (FR-011) - T056-T062
- ✅ Phase 4.3: Main validation complete - T063-T067
- ✅ Phase 4.3.1: Test assertion fixes complete - T064a-T064h
- ✅ Phase 4.4: Code quality cleanup complete - T042
- 📋 Total tasks: 73 (72 complete, 1 remaining: T064i type safety deferred to Todoist backlog)

## Validation Checklist
*GATE: Verified before execution*

### Phase 3 Validation (Complete)
- [x] All 5 MCP tool contracts have corresponding test tasks
- [x] All 6 entities from data-model.md have type definition tasks
- [x] All tests (T007-T016) come before implementation (T017-T031)
- [x] Parallel tasks operate on different files
- [x] Each task specifies exact file path
- [x] No [P] tasks modify the same file
- [x] Quickstart scenarios covered in integration tests
- [x] Performance requirements (<500ms) have test coverage

### Phase 4 Validation (In Progress)
- [x] API version migration from v2 to v1 in all files (T049-T055)
- [x] Reminders tool has contract test before implementation (T056 before T057-T061)
- [x] All FR-011 requirements covered by reminders implementation
- [x] Natural language due dates verified with real-world examples (T063)
- [x] All test files updated to use v1 endpoints (T054)
- [x] Test suite compiles and runs with v1 API (T064)
- [x] All test assertions fixed (T064a-T064h) - test fixes complete
- [x] Documentation updated to reflect v1 API and reminders feature (T065-T067)
