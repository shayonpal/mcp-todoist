
# Implementation Plan: Todoist Labels Management

**Branch**: `002-todoist-labels-tool` | **Date**: 2025-10-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-todoist-labels-tool/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from file system structure or context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Implement `todoist_labels` MCP tool to enable complete label management in the Todoist MCP server. This fills a critical gap where users can reference labels on tasks but cannot create or manage the labels themselves through the MCP interface. The tool provides full CRUD operations for personal labels (create, read, update, delete, list with pagination) and bulk operations for shared labels (rename, remove across all tasks). Implementation follows existing tool patterns in `src/tools/` and leverages the existing Todoist API service layer which already contains label operation methods.

## Technical Context
**Language/Version**: TypeScript 5.3+, Node.js 18+
**Primary Dependencies**: @modelcontextprotocol/sdk ^1.18.2, axios ^1.6.2, zod ^3.22.4
**Storage**: N/A (stateless MCP server, all data in Todoist API)
**Testing**: Jest 29.7+ with ts-jest, contract/integration/unit test structure
**Target Platform**: Node.js server (stdio transport for MCP communication)
**Project Type**: Single project (MCP server with modular tool architecture)
**Performance Goals**: Sub-second response for single operations, cursor-based pagination for 50-200 labels per page
**Constraints**: Todoist REST API rate limits (1000 req/15min), exponential backoff on 429, no automatic retry
**Scale/Scope**: 6 MCP tools total (5 existing + 1 new todoist_labels tool), ~300-400 LOC for new tool following existing patterns

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### API-First Architecture
- [x] All features designed around official Todoist API v1 capabilities (GET/POST/DELETE /labels endpoints)
- [x] No undocumented endpoints or scraping approaches (using documented REST API only)
- [x] Rate limiting strategy defined with backoff mechanisms (inherits existing TokenBucketRateLimiter, exponential backoff 1s-30s)
- [x] Service layer abstraction for all API interactions (TodoistApiService methods already exist: getLabels, getLabel, createLabel, updateLabel, deleteLabel)

### Type Safety & Validation
- [x] TypeScript interfaces defined for all Todoist entities (TodoistLabel already exists in src/types/todoist.ts)
- [x] Input validation at MCP protocol boundaries (will use Zod schemas as in other tools)
- [x] Runtime schema validation strategy selected (Zod, consistent with existing tools)
- [x] No `any` types without explicit documentation (strict TypeScript, following existing patterns)

### Test Coverage Standards
- [x] TDD approach planned with test-first implementation (contract tests first, then implementation)
- [x] Mock API responses prepared for testing (will use InMemoryTodoistApiService pattern from existing tests)
- [x] Error cases and edge cases identified (duplicate names, non-existent IDs, rate limiting, pagination)
- [x] Performance benchmarks defined for API operations (sub-second single ops, cursor pagination 50-200/page)

### User Experience Consistency
- [x] Tool naming follows Todoist domain language (todoist_labels, consistent with todoist_tasks, todoist_projects)
- [x] Error message strategy defined (handleToolError pattern, user-friendly messages per FR-015/FR-016)
- [x] Response structure standardized across tools (success/data/message/metadata format matching other tools)
- [x] Timezone handling approach documented (N/A for labels - no datetime fields)

### Performance & Efficiency
- [x] Batch API operations identified where applicable (shared label operations via Sync API if needed)
- [x] Caching strategy defined for read operations (existing label cache in src/services/cache.ts can be leveraged)
- [x] Pagination handling planned for large datasets (cursor-based pagination, default 50, max 200 per FR-005)
- [x] Memory bounds established for API responses (pagination prevents unbounded responses)

### Security & Privacy
- [x] API token handling security measures defined (inherits existing secure token management, no logging)
- [x] Sensitive data sanitization approach documented (follows existing patterns, no PII in labels)
- [x] OAuth2 vs API token decision documented (using API token consistent with existing implementation)
- [x] Audit logging strategy for data modifications (rate limit metadata in responses per FR-014)

### MCP Protocol Compliance
- [x] Tool definitions follow MCP specifications (static getToolDefinition() method as in other tools)
- [x] Parameter schemas properly defined (Zod schemas with action-based routing)
- [x] Error response format standardized (handleToolError wrapper, MCP error codes)
- [x] Resource URI patterns established for Todoist entities (follows todoist://label/{id} pattern)

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
src/
├── tools/
│   ├── todoist-tasks.ts           # Existing tool pattern
│   ├── todoist-projects.ts        # Existing tool pattern
│   ├── todoist-labels.ts          # NEW - Label management tool
│   └── ...                        # Other existing tools
├── services/
│   ├── todoist-api.ts             # API service (label methods already exist)
│   ├── cache.ts                   # Label caching support
│   └── ...
├── types/
│   ├── todoist.ts                 # TodoistLabel interface already defined
│   ├── errors.ts                  # Error types
│   └── ...
├── schemas/
│   └── validation.ts              # Zod schemas for validation
├── utils/
│   └── error-handler.ts           # handleToolError utility
└── server.ts                      # MCP server registration

tests/
├── contract/
│   └── todoist_labels.test.ts     # NEW - Contract tests for label tool
├── integration/
│   └── label-workflows.test.ts    # NEW - Integration tests
├── unit/
│   └── label-validation.test.ts   # NEW - Unit tests for label logic
└── helpers/
    ├── inMemoryTodoistApiService.ts  # Existing mock helper
    └── mockTodoistApiService.ts      # Existing mock factory
```

**Structure Decision**: Single project architecture (Option 1). The feature adds one new tool file (`todoist-labels.ts`) following the established pattern in `src/tools/`. All supporting infrastructure (API service methods, types, error handling, rate limiting) already exists. Test files will be added to existing test directories (contract, integration, unit) maintaining the current test structure.

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh claude`
     **IMPORTANT**: Execute it exactly as specified above. Do not add or remove any arguments.
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
1. **Load base template**: `.specify/templates/tasks-template.md`
2. **Generate from contracts**: Each of 12 contract scenarios → contract test task
   - Personal label CRUD: create, get, update, delete, list (5 tests)
   - Shared label operations: rename, remove (2 tests)
   - Edge cases: duplicate name, nonexistent ID, invalid limit, rate limit (4 tests)
   - Pagination scenario (1 test)
3. **Generate from data model**:
   - Zod schemas for LabelToolParams (1 task)
   - Action routing logic (1 task)
   - Error mapping (1 task)
4. **Generate from quickstart**: Each of 9 acceptance scenarios → integration test task
5. **Implementation tasks** (TDD order - tests first):
   - Create TodoistLabelsTool class structure (1 task)
   - Implement action handlers: create, get, update, delete, list (5 tasks)
   - Implement shared label handlers: rename_shared, remove_shared (2 tasks)
   - Register tool in server.ts (1 task)
   - Implement duplicate name detection (1 task)
   - Integrate with existing cache (1 task)

**Ordering Strategy**:
- **Phase 1** [P]: Contract tests (can run in parallel, all independent)
- **Phase 2** [P]: Unit tests for validation and routing (parallel)
- **Phase 3**: Tool class structure and registration (sequential)
- **Phase 4**: Action handler implementation (sequential, tests guide)
- **Phase 5**: Integration tests (after handlers complete)
- **Phase 6**: Final validation with quickstart scenarios

**Dependency Graph**:
```
Contract Tests [P] → Tool Structure → Action Handlers → Integration Tests
      ↓                    ↓                ↓
Unit Tests [P] ────────→ Registration → Cache Integration
```

**Estimated Task Count**: ~30-35 tasks
- 12 contract test tasks
- 9 integration test tasks (from acceptance scenarios)
- 3 unit test tasks (validation, routing, error mapping)
- 5 personal label handler tasks
- 2 shared label handler tasks
- 3 infrastructure tasks (class, registration, cache)
- 1 duplicate detection task
- 1 final validation task

**Parallel Execution Opportunities**:
- All contract tests can run in parallel [P]
- All unit tests can run in parallel [P]
- Personal label handlers can be implemented in parallel after structure exists [P]
- Shared label handlers can be implemented in parallel [P]

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

**No violations detected.** All constitutional principles satisfied:
- API-First: Uses official Todoist API v1 endpoints only
- Type Safety: TypeScript strict mode, Zod validation, TodoistLabel interface
- Test Coverage: TDD approach with 80%+ coverage target, comprehensive test plan
- UX Consistency: Follows todoist_* naming, standardized responses, handleToolError pattern
- Performance: Pagination, rate limiting, cache integration
- Security: Inherits token handling, no PII exposure
- MCP Compliance: Proper tool definitions, schemas, error codes

**No complexity deviations documented** - feature adds single tool file following established patterns.


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) - research.md created
- [x] Phase 1: Design complete (/plan command) - data-model.md, contracts/, quickstart.md, CLAUDE.md updated
- [x] Phase 2: Task planning complete (/plan command - describe approach only) - 30-35 tasks planned with dependency graph
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS (all principles satisfied)
- [x] Post-Design Constitution Check: PASS (no new violations, patterns maintained)
- [x] All NEEDS CLARIFICATION resolved (no items in Technical Context)
- [x] Complexity deviations documented (none - follows existing patterns)

**Artifacts Generated**:
- ✅ `/specs/002-todoist-labels-tool/research.md` - Technical decisions and pattern analysis
- ✅ `/specs/002-todoist-labels-tool/data-model.md` - Entity definitions, schemas, API mapping
- ✅ `/specs/002-todoist-labels-tool/contracts/todoist_labels_tool.json` - MCP tool contract with 12 test scenarios
- ✅ `/specs/002-todoist-labels-tool/quickstart.md` - Acceptance validation guide with 9 scenarios
- ✅ `/CLAUDE.md` - Updated with feature context

---
*Based on Constitution v1.1.0 - See `.specify/memory/constitution.md`*
