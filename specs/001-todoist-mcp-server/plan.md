
# Implementation Plan: Todoist MCP Server

**Branch**: `001-todoist-mcp-server` | **Date**: 2025-09-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-todoist-mcp-server/spec.md`

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
MCP server enabling programmatic Todoist task and project management through optimized tool set. Primary requirement: Create minimal, non-duplicative MCP tools for comprehensive Todoist operations including tasks, projects, sections, comments, and filters via Todoist API v1. Technical approach: TypeScript-based server with 5 consolidated tools, efficient API batching, and comprehensive error handling.

## Technical Context
**Language/Version**: TypeScript 5.0+ / Node.js 18+
**Primary Dependencies**: @modelcontextprotocol/sdk, axios, zod (validation), dotenv
**Storage**: N/A (stateless server, API token via MCP client configuration)
**Testing**: Jest with supertest for integration testing
**Target Platform**: Cross-platform Node.js server (Linux, macOS, Windows)
**Project Type**: single (MCP server library)
**Performance Goals**: <500ms response time per tool call, support for 100 batch operations
**Constraints**: Todoist API rate limits (1000 partial sync/15min, 100 full sync/15min), 15K char comment limit
**Scale/Scope**: Single-user Todoist account access, 5 core tools, comprehensive CRUD operations

**User Guidance**: Ultrathink tool consolidation - minimize tool count while maximizing functionality. Focus on avoiding duplication between task, project, section, comment, and filter operations.

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### API-First Architecture
- [x] All features designed around official Todoist API capabilities
- [x] No undocumented endpoints or scraping approaches
- [x] Rate limiting strategy defined with backoff mechanisms
- [x] Service layer abstraction for all API interactions

### Type Safety & Validation
- [x] TypeScript interfaces defined for all Todoist entities
- [x] Input validation at MCP protocol boundaries
- [x] Runtime schema validation strategy selected (Zod)
- [x] No `any` types without explicit documentation

### Test Coverage Standards
- [x] TDD approach planned with test-first implementation
- [x] Mock API responses prepared for testing
- [x] Error cases and edge cases identified
- [x] Performance benchmarks defined for API operations

### User Experience Consistency
- [x] Tool naming follows Todoist domain language
- [x] Error message strategy defined (user-friendly, actionable)
- [x] Response structure standardized across tools
- [x] Timezone handling approach documented

### Performance & Efficiency
- [x] Batch API operations identified where applicable
- [x] Caching strategy defined for read operations
- [x] Pagination handling planned for large datasets
- [x] Memory bounds established for API responses

### Security & Privacy
- [x] API token handling security measures defined
- [x] Sensitive data sanitization approach documented
- [x] OAuth2 vs API token decision documented
- [x] Audit logging strategy for data modifications

### MCP Protocol Compliance
- [x] Tool definitions follow MCP specifications
- [x] Parameter schemas properly defined
- [x] Error response format standardized
- [x] Resource URI patterns established for Todoist entities

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
├── types/              # TypeScript interfaces for Todoist entities
├── services/           # Todoist API service layer with rate limiting
├── tools/              # MCP tool implementations (5 core tools)
├── utils/              # Shared utilities (validation, error handling)
├── server.ts           # MCP server entry point
└── index.ts            # Main export

tests/
├── contract/           # API contract tests against Todoist
├── integration/        # MCP tool integration tests
├── unit/               # Unit tests for services and utilities
└── mocks/              # Mock Todoist API responses

package.json            # Dependencies and scripts
tsconfig.json           # TypeScript configuration
jest.config.js          # Test configuration
README.md               # Setup and usage documentation
```

**Structure Decision**: Single TypeScript project optimized for MCP server architecture. The `tools/` directory contains our 5 consolidated MCP tools (tasks, projects, sections, comments, filters), while `services/` provides the API abstraction layer respecting Todoist rate limits and batching capabilities.

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
- Follow TDD approach with test-first implementation
- Group tasks by functional area (setup, types, services, tools, testing)

**Task Categories & Dependencies**:

1. **Project Setup Tasks** [P]:
   - Package.json and dependencies setup
   - TypeScript configuration
   - Jest test configuration
   - Directory structure creation

2. **Type Definition Tasks** [P]:
   - Todoist entity TypeScript interfaces (Task, Project, Section, Comment, Filter)
   - Zod validation schemas for all input types
   - Error type definitions and MCP error mapping
   - Configuration and API types

3. **Service Layer Tasks** (depends on types):
   - Todoist API client with rate limiting
   - Authentication service for token handling
   - Cache service for projects/labels/sections
   - Retry logic and error handling utilities

4. **MCP Tool Implementation Tasks** (depends on services):
   - todoist_tasks tool with all CRUD operations
   - todoist_projects tool with archive functionality
   - todoist_sections tool with reorder capability
   - todoist_comments tool with file attachment support
   - todoist_filters tool with query functionality

5. **Testing Tasks** [P]:
   - Mock Todoist API responses for all endpoints
   - Unit tests for each service layer component
   - Integration tests for each MCP tool
   - Contract tests validating tool schemas
   - Performance benchmark tests

6. **Server Infrastructure Tasks** (depends on tools):
   - MCP server setup and tool registration
   - Health check endpoint implementation
   - Logging and monitoring setup
   - Configuration management

**Ordering Strategy**:
- Setup tasks first (foundation)
- Types and validation schemas (enables everything else)
- Service layer (core business logic)
- Tool implementations (user-facing functionality)
- Testing throughout (TDD approach)
- Server infrastructure last (integration)

**Batch Operation Handling**:
- Dedicated batch operation logic in task tool
- Temp ID management for dependent operations
- Partial failure handling and rollback strategies
- Performance optimization for large batches

**Testing Strategy**:
- Each service gets comprehensive unit tests
- Each tool gets integration tests with mocked API
- Contract tests verify all tool schemas match implementations
- Performance tests ensure sub-500ms response times
- Error scenario tests for all failure modes

**Estimated Output**: 35-40 numbered, ordered tasks covering:
- 4 setup tasks
- 8 type definition tasks
- 6 service layer tasks
- 10 tool implementation tasks
- 8 testing infrastructure tasks
- 4 server setup tasks

**Success Criteria for /tasks execution**:
- All generated tasks are actionable and testable
- Dependencies are clearly ordered
- Parallel tasks are properly marked [P]
- Each task includes acceptance criteria
- Implementation follows constitutional principles

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
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [x] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [ ] Complexity deviations documented (None required)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
