# Implementation Plan: Query & Reopen Completed Tasks

**Branch**: `004-query-edit-completed` | **Date**: 2025-10-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-query-edit-completed/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path ✓
   → Specification loaded successfully
2. Fill Technical Context ✓
   → No NEEDS CLARIFICATION markers (all resolved in research phase)
   → Project Type: Single (Node.js/TypeScript MCP server)
3. Fill the Constitution Check section ✓
4. Evaluate Constitution Check section ✓
   → No violations detected
   → Update Progress Tracking: Initial Constitution Check PASS
5. Execute Phase 0 → research.md ✓
   → All unknowns resolved
   → API endpoints documented
   → Tool design pattern selected
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md ✓
   → Contracts defined in /contracts/todoist-api-contracts.md
   → Data model documented
   → Quickstart guide created
   → Agent context updated
7. Re-evaluate Constitution Check section ✓
   → No new violations after design
   → Update Progress Tracking: Post-Design Constitution Check PASS
8. Plan Phase 2 → Describe task generation approach ✓
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 9. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

Add completed task querying capability to the MCP Todoist server, allowing users to retrieve completed tasks within time-bounded windows (by completion date or due date) and reopen them for editing. Technical approach extends the existing `todoist_tasks` tool with a new `list_completed` action that calls Todoist REST API v1 completed task endpoints with comprehensive filtering, pagination, and time window validation.

## Technical Context
**Language/Version**: TypeScript 5.3.2 / Node.js 18+
**Primary Dependencies**: @modelcontextprotocol/sdk ^1.18.2, axios ^1.6.2, zod ^3.22.4
**Storage**: Stateless (API pass-through, no local storage)
**Testing**: Jest 29.7.0 with ts-jest, contract/integration/unit test structure
**Target Platform**: Node.js server (stdio transport for MCP protocol)
**Project Type**: Single (monorepo structure with src/, tests/, specs/)
**Performance Goals**: <500ms per query (API latency dependent), <100MB memory footprint
**Constraints**: Todoist API rate limits (300 req/min REST), time windows (3 months completion, 6 weeks due date), cursor-based pagination only
**Scale/Scope**: Existing codebase ~2500 LOC, adding ~400 LOC (2 API methods, 1 tool action handler, validation schemas)

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### API-First Architecture
- [x] All features designed around official Todoist API capabilities
  - Uses documented `/api/v1/tasks/completed/by_completion_date` and `by_due_date` endpoints
- [x] No undocumented endpoints or scraping approaches
  - Only official REST API v1 endpoints
- [x] Rate limiting strategy defined with backoff mechanisms
  - Reuses existing REST rate limiter (300 req/min, token bucket with retry)
- [x] Service layer abstraction for all API interactions
  - New methods in TodoistApiService class: `getCompletedTasksByCompletionDate()`, `getCompletedTasksByDueDate()`

### Type Safety & Validation
- [x] TypeScript interfaces defined for all Todoist entities
  - Extended Task interface with optional `completed_at: string` field
  - Created CompletedQueryType enum
- [x] Input validation at MCP protocol boundaries
  - Zod schema with refinements for time window validation
- [x] Runtime schema validation strategy selected (e.g., Zod)
  - Existing Zod validation extended with new CompletedTasksInputSchema
- [x] No `any` types without explicit documentation
  - All new code uses strict typing

### Test Coverage Standards
- [x] TDD approach planned with test-first implementation
  - Contract tests written before implementation
  - 10 test cases per endpoint defined
- [x] Mock API responses prepared for testing
  - Fixture data defined in contracts document
- [x] Error cases and edge cases identified
  - 5 error scenarios + 6 edge cases documented
- [x] Performance benchmarks defined for API operations
  - Target <500ms per query

### User Experience Consistency
- [x] Tool naming follows Todoist domain language
  - `list_completed` action matches Todoist terminology
- [x] Error message strategy defined (user-friendly, actionable)
  - Custom error messages for each validation failure
  - Examples: "Time window exceeds 92 days maximum for completion date queries"
- [x] Response structure standardized across tools
  - Reuses existing tool response format: {success, data, message, metadata}
- [x] Timezone handling approach documented
  - Uses ISO 8601 datetime strings, respects user's Todoist timezone settings

### Performance & Efficiency
- [x] Batch API operations identified where applicable
  - Not applicable - single queries only (no batch completed task retrieval in API)
- [x] Caching strategy defined for read operations
  - No caching (completed tasks are immutable but new completions create invalidation complexity)
- [x] Pagination handling planned for large datasets
  - Cursor-based pagination with configurable limit (1-200, default 50)
- [x] Memory bounds established for API responses
  - Max 200 items per page, streamed processing

### Security & Privacy
- [x] API token handling security measures defined
  - Reuses existing token management (env vars, never logged)
- [x] Sensitive data sanitization approach documented
  - Task content not logged, only metadata
- [x] OAuth2 vs API token decision documented
  - API token (OAuth2 not supported by Todoist for this use case)
- [x] Audit logging strategy for data modifications
  - Reopen operations logged (existing audit log from uncomplete action)

### MCP Protocol Compliance
- [x] Tool definitions follow MCP specifications
  - Extended existing todoist_tasks tool definition with new action
- [x] Parameter schemas properly defined
  - Zod schemas map to MCP tool input schema
- [x] Error response format standardized
  - MCP error codes: VALIDATION_ERROR, API_ERROR, RATE_LIMIT_EXCEEDED
- [x] Resource URI patterns established for Todoist entities
  - Reuses existing `todoist://task/{id}` pattern

### Code Quality Gates
- [x] Lint, typecheck, and test commands must pass
  - All new code follows existing ESLint/Prettier config
  - TypeScript strict mode enabled
  - Pre-commit hooks enforce quality gates
- [x] No new violations introduced
  - Extends existing patterns (no new architectural decisions)

## Project Structure

### Documentation (this feature)
```
specs/004-query-edit-completed/
├── spec.md                           # Feature specification (complete)
├── plan.md                           # This file (/plan command output)
├── research.md                       # Phase 0 output (complete)
├── data-model.md                     # Phase 1 output (complete)
├── quickstart.md                     # Phase 1 output (complete)
├── contracts/
│   └── todoist-api-contracts.md      # API & tool contracts (complete)
└── tasks.md                          # Phase 2 output (/tasks command - NOT YET CREATED)
```

### Source Code (repository root)
```
src/
├── services/
│   └── todoist-api.ts               # ADD: getCompletedTasksByCompletionDate(), getCompletedTasksByDueDate()
├── tools/
│   └── todoist-tasks.ts             # MODIFY: Add list_completed action handler
├── schemas/
│   └── validation.ts                # MODIFY: Add CompletedTasksInputSchema with time window refinements
└── types/
    └── todoist.ts                   # MODIFY: Add completed_at field to Task interface

tests/
├── contract/
│   └── todoist-tasks-completed.test.ts  # ADD: Contract tests for list_completed action
├── integration/
│   └── completed-tasks-workflow.test.ts # ADD: End-to-end workflow tests
└── unit/
    └── time-window-validation.test.ts   # ADD: Unit tests for time window calculation

CLAUDE.md                             # UPDATED: Added completed tasks context
```

**Structure Decision**: Single project (default) - MCP server with standard src/tests layout. No frontend/backend split needed. All code in TypeScript following existing monorepo pattern.

## Phase 0: Outline & Research ✓

**Status**: Complete

**Output**: [research.md](./research.md)

**Key Decisions**:
1. Use Todoist REST API v1 endpoints (not deprecated Sync API)
2. Extend existing todoist_tasks tool (not create new tool)
3. Client-side time window validation with Zod refinements
4. Cursor-based pagination (API native)
5. No caching for completed tasks
6. Three-layer testing (contract/integration/unit)

**Unknowns Resolved**:
- ✓ API endpoint selection
- ✓ Time window validation approach
- ✓ Tool design pattern
- ✓ Pagination strategy
- ✓ Testing strategy
- ✓ TypeScript type updates
- ✓ Performance considerations
- ✓ Error handling strategy

## Phase 1: Design & Contracts ✓

**Status**: Complete

**Outputs**:
- [data-model.md](./data-model.md) - Entity definitions, validation rules, schema
- [contracts/todoist-api-contracts.md](./contracts/todoist-api-contracts.md) - API contracts with 10 test cases per endpoint
- [quickstart.md](./quickstart.md) - User guide with examples and validation checklist
- [CLAUDE.md](/Users/shayon/DevProjects/mcp-todoist/CLAUDE.md) - Updated agent context

**Key Artifacts**:

1. **Data Model Entities**:
   - CompletedTaskQuery (input entity)
   - CompletedTask (extends Task with completed_at)
   - CompletedTaskResponse (pagination wrapper)
   - TimeWindow (validation helper)

2. **API Contracts**:
   - GET /api/v1/tasks/completed/by_completion_date
   - GET /api/v1/tasks/completed/by_due_date
   - 10 contract tests per endpoint (20 total)
   - MCP tool contract with 10 tool-level tests

3. **Validation Rules**:
   - Time window: ≤92 days (completion), ≤42 days (due)
   - DateTime: ISO 8601 format required
   - Query type: Mutually exclusive
   - Pagination: 1-200 limit range

4. **Integration Points**:
   - TodoistApiService: +2 methods
   - TodoistTasksTool: +1 action handler
   - TodoistTasksInputSchema: +10 fields
   - Task interface: +1 field

## Phase 2: Task Planning Approach

**This section describes what the /tasks command will do - DO NOT execute during /plan**

**Task Generation Strategy**:

1. **Load Task Template**:
   - Use `.specify/templates/tasks-template.md` as base
   - Generate dependency-ordered task list

2. **Test-First Task Generation**:
   - Contract tests (from contracts/todoist-api-contracts.md)
     - 10 tests for by_completion_date endpoint [P]
     - 10 tests for by_due_date endpoint [P]
     - 10 tests for MCP tool action [P]
   - Unit tests (from data-model.md)
     - Time window validation logic [P]
     - DateTime parsing [P]
     - Error message generation [P]
   - Integration tests (from quickstart.md)
     - Full query workflow
     - Pagination sequence
     - Reopen → edit → recomplete workflow

3. **Implementation Task Generation**:
   - Type definitions (src/types/todoist.ts)
     - Add completed_at field to Task interface [P]
   - Schema updates (src/schemas/validation.ts)
     - Create CompletedTasksInputSchema with refinements [P]
     - Add CompletedQueryType enum [P]
   - API service (src/services/todoist-api.ts)
     - Implement getCompletedTasksByCompletionDate() [depends on types]
     - Implement getCompletedTasksByDueDate() [depends on types]
   - Tool handler (src/tools/todoist-tasks.ts)
     - Add list_completed case to execute() [depends on API service]
     - Implement handleListCompleted() method [depends on schema]
   - Tool definition update
     - Add list_completed to action enum
     - Add parameters to inputSchema
     - Update tool description

4. **Verification Tasks**:
   - Run full test suite (contract + integration + unit)
   - Execute quickstart validation checklist
   - Verify lint/typecheck/test gates pass

**Ordering Strategy**:
1. Types first (no dependencies)
2. Schemas (depends on types)
3. Tests (depend on types/schemas, can run in parallel)
4. API methods (depend on types)
5. Tool handler (depends on API + schemas)
6. Integration verification

**Parallel Execution Markers [P]**:
- Type updates [P] - independent file
- Schema updates [P] - independent sections
- All test files [P] - independent test suites

**Estimated Output**: 28-32 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*No violations - table not needed*

No constitutional violations detected. Implementation follows existing patterns:
- Extends existing tool (no new tool)
- Reuses existing rate limiter and error handling
- Follows established service/tool/schema layering
- Maintains test coverage standards

## Progress Tracking

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (N/A - none)

**Artifact Status**:
- [x] research.md created
- [x] data-model.md created
- [x] contracts/todoist-api-contracts.md created
- [x] quickstart.md created
- [x] CLAUDE.md updated

---
*Based on Constitution v1.1.0 - See `.specify/memory/constitution.md`*
