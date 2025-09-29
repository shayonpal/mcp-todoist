# Tasks: Todoist MCP Server

**Input**: Design documents from `/specs/001-todoist-mcp-server/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Extract: TypeScript 5.0+, Node.js 18+, @modelcontextprotocol/sdk, axios, zod, dotenv
2. Load optional design documents:
   → data-model.md: 6 entities (Task, Project, Section, Comment, Filter, Label)
   → contracts/: 5 MCP tool contract files
   → quickstart.md: 7 verification scenarios
3. Generate tasks by category:
   → Setup: project init, TypeScript config, Jest setup
   → Tests: contract tests for 5 tools, integration scenarios
   → Core: type definitions, service layer, MCP tools
   → Integration: MCP server, error handling, caching
   → Polish: unit tests, performance validation, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001-T040)
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
- [ ] T037 [P] Unit tests for TodoistApiService methods in tests/unit/todoist-api.test.ts
- [ ] T038 [P] Unit tests for cache service in tests/unit/cache.test.ts
- [ ] T039 [P] Performance tests validating <500ms response times in tests/performance/response-time.test.ts
- [ ] T040 [P] Update README.md with setup and usage documentation
- [ ] T041 Run quickstart.md verification scenarios manually
- [ ] T042 Cleanup and remove code duplication across tool implementations

## Dependencies
- Setup (T001-T006) must complete first
- Tests (T007-T016) before implementation (T017-T031)
- Type definitions (T017-T023) before services (T024-T026)
- Services (T024-T026) before tools (T027-T031)
- Tools before integration (T032-T036)
- Implementation before polish (T037-T042)

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

## Notes
- [P] tasks = different files, no shared dependencies
- Verify all tests fail before implementing (TDD approach)
- Commit after each task completion
- Use exact file paths from task descriptions
- Batch operations support up to 100 commands
- Cache TTL: 30 min for projects/labels, 15 min for sections
- Rate limits: 1000 partial sync/15min, 100 full sync/15min

## Validation Checklist
*GATE: Verified before execution*

- [x] All 5 MCP tool contracts have corresponding test tasks
- [x] All 6 entities from data-model.md have type definition tasks
- [x] All tests (T007-T016) come before implementation (T017-T031)
- [x] Parallel tasks operate on different files
- [x] Each task specifies exact file path
- [x] No [P] tasks modify the same file
- [x] Quickstart scenarios covered in integration tests
- [x] Performance requirements (<500ms) have test coverage