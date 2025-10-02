
# Implementation Plan: Deferred API Token Validation for MCP Platform Compatibility

**Branch**: `006-more-mcp-compliance` | **Date**: 2025-10-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-more-mcp-compliance/spec.md`

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
Make TODOIST_API_TOKEN optional at MCP server startup to enable platform inspection (Smithery deployment). Token validation is deferred until first actual Todoist API tool invocation, with session-based caching of successful validation. Server initialization, protocol handshakes, and health checks operate independently of token state. Error messages provide actionable guidance distinguishing between missing, invalid, and failed authentication states.

## Technical Context
**Language/Version**: TypeScript 5.x with Node.js 18+
**Primary Dependencies**: @modelcontextprotocol/sdk, existing TodoistApiService (axios-based)
**Storage**: In-memory state (token validation cache, no persistent storage required)
**Testing**: Jest with contract tests (in-memory API mocks), integration tests for lifecycle flows
**Target Platform**: Node.js server (stdio transport for MCP communication)
**Project Type**: Single (MCP server application)
**Performance Goals**: Sub-100ms token validation check, zero-latency health checks without token
**Constraints**: Must not modify existing tool schemas/behavior, backward compatible with current deployments
**Scale/Scope**: Server initialization refactor affecting config loading, API service initialization, and all 7 MCP tools

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### API-First Architecture
- [x] All features designed around official Todoist API capabilities (no API changes, only initialization timing)
- [x] No undocumented endpoints or scraping approaches (N/A - infrastructure change)
- [x] Rate limiting strategy defined with backoff mechanisms (existing strategy unchanged)
- [x] Service layer abstraction for all API interactions (existing TodoistApiService unchanged)

### Type Safety & Validation
- [x] TypeScript interfaces defined for all Todoist entities (existing interfaces unchanged)
- [x] Input validation at MCP protocol boundaries (existing validation unchanged)
- [x] Runtime schema validation strategy selected (existing Zod schemas unchanged)
- [x] No `any` types without explicit documentation (token validation state uses strict types)

### Test Coverage Standards
- [x] TDD approach planned with test-first implementation (contract tests for initialization flows)
- [x] Mock API responses prepared for testing (in-memory mocks for token validation)
- [x] Error cases and edge cases identified (7 acceptance scenarios + 4 edge cases documented)
- [x] Performance benchmarks defined for API operations (sub-100ms validation check requirement)

### User Experience Consistency
- [x] Tool naming follows Todoist domain language (no tool naming changes)
- [x] Error message strategy defined (user-friendly, actionable - "[Category]. [Next step]" format)
- [x] Response structure standardized across tools (existing response structure unchanged)
- [x] Timezone handling approach documented (N/A - no datetime changes)

### Performance & Efficiency
- [x] Batch API operations identified where applicable (N/A - initialization feature)
- [x] Caching strategy defined for read operations (session-based token validation cache)
- [x] Pagination handling planned for large datasets (N/A - no data operations)
- [x] Memory bounds established for API responses (single boolean validation state in memory)

### Security & Privacy
- [x] API token handling security measures defined (deferred validation, never logged/exposed)
- [x] Sensitive data sanitization approach documented (existing sanitization preserved)
- [x] OAuth2 vs API token decision documented (existing API token approach unchanged)
- [x] Audit logging strategy for data modifications (N/A - no data modifications)

### MCP Protocol Compliance
- [x] Tool definitions follow MCP specifications (existing tool definitions unchanged)
- [x] Parameter schemas properly defined (no parameter changes)
- [x] Error response format standardized (enhanced with actionable guidance)
- [x] Resource URI patterns established for Todoist entities (existing patterns unchanged)

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
├── config/              # Configuration management (MODIFY: token validation logic)
├── server.ts            # Main MCP server (MODIFY: initialization flow)
├── services/
│   └── todoist-api.ts   # API service wrapper (MODIFY: lazy token validation)
├── tools/               # MCP tool implementations (MODIFY: pre-call token checks)
│   ├── tasks.ts
│   ├── projects.ts
│   ├── sections.ts
│   ├── comments.ts
│   ├── filters.ts
│   ├── reminders.ts
│   └── labels.ts
└── schemas/
    └── validation.ts    # Zod schemas (potential new schemas for validation state)

tests/
├── contract/            # Tool schema validation (ADD: initialization flow tests)
├── integration/         # Cross-feature workflows (ADD: token lifecycle tests)
└── unit/                # Validation schemas (ADD: validation state tests)
```

**Structure Decision**: Single-project MCP server structure. Primary modifications in `src/config/`, `src/server.ts`, and `src/services/todoist-api.ts` for deferred validation. All 7 tools in `src/tools/` require minimal changes (pre-invocation token check). Test additions focus on initialization flows and token validation lifecycle in contract and integration test suites.

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
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Contract tests first (token-validation.contract.test.ts) [P]
- Configuration refactor (make token nullable)
- Token validator implementation (singleton with caching)
- API service modification (lazy validation guards)
- Tool handler updates (pre-call validation checks)
- Health check enhancement (add metadata)
- Integration tests for lifecycle flows
- Quickstart validation execution

**Ordering Strategy**:
- TDD order: Contract tests → implementation → integration tests
- Dependency order:
  1. Contract definition (interfaces, types)
  2. Configuration layer (nullable token support)
  3. Token validator (state management)
  4. API service (validation integration)
  5. Tool handlers (validation triggers)
  6. Health check (metadata response)
  7. Integration tests (full lifecycle)
  8. Quickstart validation
- Mark [P] for parallel execution where files are independent
  - Contract tests can run parallel with type definitions
  - Tool handler updates are independent (7 files)

**Estimated Output**: 18-22 numbered, ordered tasks in tasks.md

**Task Categories**:
1. **Setup** (1-2 tasks): Type definitions, contract interfaces
2. **Core Implementation** (8-10 tasks): Config, validator, API service, tools, health check
3. **Testing** (6-8 tasks): Contract tests, unit tests, integration tests
4. **Validation** (2-3 tasks): Quickstart scenarios, full test suite

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) - research.md generated
- [x] Phase 1: Design complete (/plan command) - data-model.md, contracts/, quickstart.md, CLAUDE.md updated
- [x] Phase 2: Task planning complete (/plan command - describe approach only) - Strategy documented
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS - All checks aligned with existing patterns
- [x] Post-Design Constitution Check: PASS - No new violations introduced
- [x] All NEEDS CLARIFICATION resolved - Technical context fully specified
- [x] Complexity deviations documented - None (infrastructure change, no architectural complexity)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
