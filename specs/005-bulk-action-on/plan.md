# Implementation Plan: Bulk Actions on Tasks

**Branch**: `005-bulk-action-on` | **Date**: 2025-10-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-bulk-action-on/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → SUCCESS: Spec loaded from /specs/005-bulk-action-on/spec.md
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type: Single TypeScript/Node.js MCP server project
   → Structure Decision: Single project with src/ and tests/ structure
3. Fill the Constitution Check section
   → Based on MCP Todoist Server Constitution v1.1.0
4. Evaluate Constitution Check section
   → Initial compliance review in progress
5. Execute Phase 0 → research.md
   → Research Todoist Sync API batch operations
   → Research bulk operation patterns in MCP tools
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   → Define BulkOperation and OperationResult schemas
   → Create MCP tool contract for bulk operations
7. Re-evaluate Constitution Check
   → Post-design constitution compliance verification
8. Plan Phase 2 → Describe task generation approach
9. STOP - Ready for /tasks command
```

## Summary

This feature adds bulk operation capabilities to the MCP Todoist server, enabling users to perform the same action on up to 50 tasks simultaneously. The system will support bulk updates to task fields (excluding content/description/comments), bulk completion/uncomplete operations, and bulk moves across projects/sections. Operations use partial execution mode (continue on errors) with individual task-level feedback, automatic deduplication of task IDs, and respect for Todoist API rate limits. The implementation will leverage Todoist's Sync API for efficient batch operations while maintaining full MCP protocol compliance.

## Technical Context

**Language/Version**: TypeScript 5.x with Node.js 18+
**Primary Dependencies**: @modelcontextprotocol/sdk, axios (Todoist API client), zod (validation), existing TodoistApiService
**Storage**: N/A (stateless operations, audit logging to console/file)
**Testing**: Jest with contract tests, integration tests, unit tests for validation logic
**Target Platform**: Node.js server (stdio transport for MCP communication)
**Project Type**: Single - MCP server with src/ and tests/ structure
**Performance Goals**: <2s for 50-task bulk operations, respect Todoist Sync API rate limits (50 req/min)
**Constraints**: Maximum 50 unique tasks per operation, partial execution with per-task feedback, no pre-validation
**Scale/Scope**: Single new MCP tool (todoist_bulk_tasks), reuse existing TodoistApiService, add Sync API support

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### API-First Architecture
- [x] All features designed around official Todoist API capabilities (Sync API batch operations)
- [x] No undocumented endpoints or scraping approaches
- [x] Rate limiting strategy defined with backoff mechanisms (Sync API: 50 req/min)
- [x] Service layer abstraction for all API interactions (extend TodoistApiService)

### Type Safety & Validation
- [x] TypeScript interfaces defined for all Todoist entities (BulkOperation, OperationResult)
- [x] Input validation at MCP protocol boundaries (Zod schemas for tool parameters)
- [x] Runtime schema validation strategy selected (Zod for MCP inputs, validate Todoist responses)
- [x] No `any` types without explicit documentation

### Test Coverage Standards
- [x] TDD approach planned with test-first implementation (contract tests → integration tests → implementation)
- [x] Mock API responses prepared for testing (Sync API batch responses with success/failure)
- [x] Error cases and edge cases identified (>50 tasks, duplicates, partial failures, rate limits)
- [x] Performance benchmarks defined for API operations (<2s for 50 tasks)

### User Experience Consistency
- [x] Tool naming follows Todoist domain language (todoist_bulk_tasks tool)
- [x] Error message strategy defined (actionable messages: "Maximum 50 tasks allowed, received 75")
- [x] Response structure standardized across tools (individual task results + summary)
- [x] Timezone handling approach documented (leverage existing task update timezone handling)

### Performance & Efficiency
- [x] Batch API operations identified (Todoist Sync API commands array)
- [x] Caching strategy defined (N/A - write operations, but reuse label cache for validation)
- [x] Pagination handling planned (N/A - client provides task IDs, max 50 enforced)
- [x] Memory bounds established (max 50 tasks × avg response size ~2KB = ~100KB peak)

### Security & Privacy
- [x] API token handling security measures defined (reuse existing token management)
- [x] Sensitive data sanitization approach documented (log operation type + count, not task content)
- [x] OAuth2 vs API token decision documented (continue using API token pattern)
- [x] Audit logging strategy for data modifications (log bulk operation with timestamp, user, task count, success/fail counts)

### MCP Protocol Compliance
- [x] Tool definitions follow MCP specifications (todoist_bulk_tasks with action/task_ids/updates params)
- [x] Parameter schemas properly defined (Zod schema with action enum, task_ids array, field updates object)
- [x] Error response format standardized (MCP error codes: INVALID_PARAMS for >50 tasks, INTERNAL_ERROR for API failures)
- [x] Resource URI patterns established (todoist://task/{id} for individual task references in results)

## Project Structure

### Documentation (this feature)
```
specs/005-bulk-action-on/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   ├── mcp-tool-schema.json
│   └── sync-api-batch-examples.json
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
src/
├── tools/
│   └── bulk-tasks.ts          # New: todoist_bulk_tasks MCP tool
├── services/
│   └── todoist-api.ts         # Extend: Add Sync API batch methods
├── schemas/
│   └── validation.ts          # Extend: Add bulk operation schemas
└── server.ts                  # Extend: Register todoist_bulk_tasks tool

tests/
├── contract/
│   └── bulk-tasks.test.ts     # New: Contract tests for bulk tool
├── integration/
│   └── bulk-operations.test.ts # New: End-to-end bulk scenarios
└── unit/
    └── bulk-validation.test.ts # New: Input validation tests
```

**Structure Decision**: Single project structure (Option 1). This is an MCP server project with standard src/ and tests/ layout. The bulk operations feature adds one new tool file, extends the existing API service layer, and adds corresponding test files following the established pattern.

## Phase 0: Outline & Research

1. **Research Todoist Sync API Batch Operations**:
   - Endpoint: `POST /sync/v9/sync` with commands array
   - Command types: `item_update`, `item_complete`, `item_uncomplete`, `item_move`
   - Batch limits: Max 100 commands per request (our limit: 50 tasks)
   - Response format: `sync_status` with per-command success/error
   - Rate limits: 50 requests/minute (vs REST API 300/min)
   - Error handling: Partial execution supported, temp_id mapping for failed commands

2. **Research Best Practices for Bulk Operations**:
   - Deduplication strategy: Set<string> before processing
   - Validation timing: Pre-validate count (50 limit), validate fields during execution
   - Partial execution patterns: Collect results array, continue on individual failures
   - Progress reporting: Return individual task status + summary counts
   - Idempotency: Todoist handles task ID validation, we handle deduplication

3. **Research MCP Tool Patterns for Complex Operations**:
   - Action-based dispatch (existing pattern in todoist_tasks tool)
   - Flattened parameter schema (no nested objects for MCP compatibility)
   - Error mapping: Todoist errors → MCP error codes
   - Response structure: `{ success: boolean, data: results[], metadata: summary }`

4. **Integration with Existing Codebase**:
   - Reuse TodoistApiService class, add `executeBatch()` method
   - Reuse existing Zod schemas for task field validation
   - Reuse error mapping utilities (`mapTodoistErrorToMCP()`)
   - Reuse rate limiter (add Sync API limiter: 50 req/min)

**Output**: research.md with Sync API documentation, batch operation patterns, integration points

## Phase 1: Design & Contracts

1. **Data Model** (`data-model.md`):

   **BulkOperation**:
   - `action`: "update" | "complete" | "uncomplete" | "move"
   - `task_ids`: string[] (1-50 unique IDs, auto-deduplicated)
   - `updates`: Record<string, any> (field updates to apply)
   - Validation: No content/description/comments in updates, single action type per request

   **OperationResult**:
   - `task_id`: string
   - `success`: boolean
   - `error`: string | null (reason if failed)
   - `resource_uri`: string (todoist://task/{id})

   **BulkOperationSummary**:
   - `total_tasks`: number (unique count after deduplication)
   - `successful`: number
   - `failed`: number
   - `results`: OperationResult[]

2. **MCP Tool Contract** (`contracts/mcp-tool-schema.json`):

   ```json
   {
     "name": "todoist_bulk_tasks",
     "description": "Perform bulk operations on up to 50 tasks. Supports update, complete, uncomplete, move operations with partial execution.",
     "inputSchema": {
       "type": "object",
       "properties": {
         "action": {
           "type": "string",
           "enum": ["update", "complete", "uncomplete", "move"],
           "description": "Operation type to perform on all tasks"
         },
         "task_ids": {
           "type": "array",
           "items": { "type": "string" },
           "description": "Task IDs (1-50). Duplicates auto-removed.",
           "minItems": 1,
           "maxItems": 50
         },
         "project_id": { "type": "string", "description": "For move/update" },
         "section_id": { "type": "string", "description": "For move/update" },
         "parent_id": { "type": "string", "description": "For move/update" },
         "labels": { "type": "array", "items": {"type": "string"}, "description": "For update" },
         "priority": { "type": "number", "minimum": 1, "maximum": 4, "description": "For update" },
         "due_string": { "type": "string", "description": "For update" },
         "deadline_date": { "type": "string", "description": "For update (YYYY-MM-DD)" }
       },
       "required": ["action", "task_ids"]
     }
   }
   ```

3. **Sync API Examples** (`contracts/sync-api-batch-examples.json`):
   - Example request: 3 task updates with different fields
   - Example response: 2 successful, 1 failed (invalid task ID)
   - Example rate limit response: 429 with Retry-After

4. **Contract Tests** (`tests/contract/bulk-tasks.test.ts`):
   - Test: Bulk update 5 tasks with due_string → expect 5 success results
   - Test: Bulk complete 10 tasks → expect 10 success results
   - Test: 51 task IDs → expect INVALID_PARAMS error
   - Test: Duplicate task IDs [1,2,1,3] → expect 3 unique results
   - Test: Partial failure (3 valid, 2 invalid IDs) → expect 3 success, 2 failed
   - Test: Mixing actions → expect INVALID_PARAMS error
   - Test: Updates with content field → expect INVALID_PARAMS error
   - All tests use in-memory mock, assert on response structure

5. **Integration Test Scenarios** (`tests/integration/bulk-operations.test.ts`):
   - Scenario: Bulk reschedule 15 tasks to tomorrow
   - Scenario: Bulk move 7 tasks to different project
   - Scenario: Bulk complete 20 tasks with 3 failures
   - Scenario: Rate limit handling (mock 429 response)

6. **Quickstart** (`quickstart.md`):
   ```markdown
   # Bulk Operations Quickstart

   ## Prerequisites
   - MCP server running with Todoist API token
   - At least 5 test tasks in your Todoist account

   ## Test 1: Bulk Update Due Dates
   1. Get 5 task IDs: `todoist_tasks list`
   2. Bulk update: `todoist_bulk_tasks { action: "update", task_ids: [...], due_string: "tomorrow" }`
   3. Verify: All 5 tasks have tomorrow's due date

   ## Test 2: Bulk Complete
   1. Bulk complete: `todoist_bulk_tasks { action: "complete", task_ids: [...] }`
   2. Verify: All tasks marked as done

   ## Test 3: Error Handling
   1. Try 51 tasks → expect "Maximum 50 tasks" error
   2. Try duplicate IDs → expect deduplication
   3. Try invalid task ID → expect partial success with error detail
   ```

7. **Update CLAUDE.md** (incremental update):
   ```bash
   .specify/scripts/bash/update-agent-context.sh claude
   ```
   - Add: Todoist Sync API batch operations to Active Technologies
   - Add: `todoist_bulk_tasks` tool to Commands section
   - Add: Bulk operations pattern to Code Style
   - Update: Recent Changes with feature 005

**Output**: data-model.md, contracts/, failing contract tests, quickstart.md, updated CLAUDE.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate from Phase 1 artifacts:
  - Contract test tasks (1 per test case from bulk-tasks.test.ts)
  - Data model tasks (Zod schemas for BulkOperation, OperationResult)
  - Service layer tasks (Sync API methods in TodoistApiService)
  - Tool implementation tasks (bulk-tasks.ts with action dispatch)
  - Integration test tasks (1 per acceptance scenario)
  - Documentation tasks (update README, add bulk operations guide)

**Ordering Strategy**:
1. Zod schemas (data-model.md) [P]
2. Contract tests (write failing tests first) [P]
3. Extend TodoistApiService with Sync API [P]
4. Implement bulk-tasks.ts tool (make tests pass)
5. Integration tests (acceptance scenarios)
6. Update CLAUDE.md and README
7. Quickstart validation

**Estimated Output**: 18-22 numbered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation following TDD approach (red → green → refactor)
**Phase 5**: Validation (run all tests, execute quickstart.md, verify 50-task performance)

## Complexity Tracking
*No constitutional violations requiring justification*

This feature aligns with all constitutional principles:
- Uses official Todoist Sync API (API-First)
- Full TypeScript typing with Zod validation (Type Safety)
- TDD approach with comprehensive test coverage (Test Standards)
- Consistent tool naming and error messages (UX Consistency)
- Batch operations for efficiency (Performance)
- Secure token handling, audit logging (Security)
- MCP protocol compliance (MCP Protocol)

## Progress Tracking

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) - research.md created
- [x] Phase 1: Design complete (/plan command) - data-model.md, contracts/, quickstart.md, CLAUDE.md updated
- [x] Phase 2: Task planning complete (/plan command - approach described, ready for /tasks)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS (all constitutional principles satisfied)
- [x] All NEEDS CLARIFICATION resolved (N/A - spec fully clarified)
- [x] Complexity deviations documented (N/A - no deviations)

**Artifacts Generated**:
- ✓ plan.md (this file)
- ✓ research.md (Phase 0)
- ✓ data-model.md (Phase 1)
- ✓ contracts/mcp-tool-schema.json (Phase 1)
- ✓ contracts/sync-api-batch-examples.json (Phase 1)
- ✓ quickstart.md (Phase 1)
- ✓ CLAUDE.md updated (Phase 1)

---
*Based on Constitution v1.1.0 - See `.specify/memory/constitution.md`*
