
# Implementation Plan: Deadline Support for Tasks

**Branch**: `003-support-for-deadline` | **Date**: 2025-10-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-support-for-deadline/spec.md`

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
Add deadline field support to the MCP Todoist server, allowing users to specify task completion deadlines (when work must be done by) separate from due dates (when work should start). Deadlines use YYYY-MM-DD format, work on both recurring and non-recurring tasks (with warnings for recurring), accept past dates (with reminders), and include comprehensive format validation with helpful error messages. Implementation extends existing task creation/update tools with deadline parameter, validation schemas, and user-friendly warning/reminder messages.

## Technical Context
**Language/Version**: TypeScript 5.3.2, Node.js 18+
**Primary Dependencies**: @modelcontextprotocol/sdk, axios (Todoist API), zod (validation)
**Storage**: Stateless (no persistence, all data via Todoist API)
**Testing**: Jest 29.7.0 with ts-jest, contract tests, integration tests, unit tests
**Target Platform**: Node.js server (stdio transport for MCP communication)
**Project Type**: Single project (MCP server)
**Performance Goals**: Sub-second response for single operations, respect 300 req/min rate limit
**Constraints**: <200ms for validation, memory-bounded responses, no persistent storage
**Scale/Scope**: Extends existing 7 MCP tools (tasks, projects, sections, comments, filters, reminders, labels)

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### API-First Architecture
- [x] All features designed around official Todoist API capabilities (deadline field per v1 API)
- [x] No undocumented endpoints or scraping approaches (using documented deadline attribute)
- [x] Rate limiting strategy defined with backoff mechanisms (existing rate limiter continues)
- [x] Service layer abstraction for all API interactions (extend existing TodoistApiService)

### Type Safety & Validation
- [x] TypeScript interfaces defined for all Todoist entities (extend TodoistTask interface)
- [x] Input validation at MCP protocol boundaries (Zod schema for deadline parameter)
- [x] Runtime schema validation strategy selected (Zod for date format validation)
- [x] No `any` types without explicit documentation (all deadline types strongly typed)

### Test Coverage Standards
- [x] TDD approach planned with test-first implementation (contract tests before implementation)
- [x] Mock API responses prepared for testing (deadline field in mock responses)
- [x] Error cases and edge cases identified (invalid format, recurring tasks, past dates)
- [x] Performance benchmarks defined for API operations (no additional API overhead expected)

### User Experience Consistency
- [x] Tool naming follows Todoist domain language (deadline parameter matches Todoist terminology)
- [x] Error message strategy defined (user-friendly format examples, helpful warnings/reminders)
- [x] Response structure standardized across tools (consistent success/warning/reminder structure)
- [x] Timezone handling approach documented (deadline has no timezone - date only per API spec)

### Performance & Efficiency
- [x] Batch API operations identified where applicable (deadline in batch operations via Sync API)
- [x] Caching strategy defined for read operations (no caching needed - field part of task object)
- [x] Pagination handling planned for large datasets (N/A - extends existing task operations)
- [x] Memory bounds established for API responses (deadline adds minimal data - YYYY-MM-DD string)

### Security & Privacy
- [x] API token handling security measures defined (no changes - uses existing secure token handling)
- [x] Sensitive data sanitization approach documented (deadline dates are non-sensitive)
- [x] OAuth2 vs API token decision documented (N/A - extends existing authentication)
- [x] Audit logging strategy for data modifications (deadline changes logged via existing mechanisms)

### MCP Protocol Compliance
- [x] Tool definitions follow MCP specifications (deadline parameter in existing todoist_tasks tool)
- [x] Parameter schemas properly defined (Zod schema with format validation and examples)
- [x] Error response format standardized (consistent MCP error format for validation failures)
- [x] Resource URI patterns established for Todoist entities (N/A - no new resources, extends tasks)

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
├── types/
│   └── todoist.ts              # Extend TodoistTask interface with deadline field
├── schemas/
│   └── validation.ts           # Add deadline validation schemas
├── services/
│   └── todoist-api.ts         # Extend create/update methods for deadline
├── tools/
│   └── todoist-tasks.ts       # Update tool to handle deadline parameter
└── utils/
    └── tool-helpers.ts        # Helper for warning/reminder messages

tests/
├── contract/
│   └── todoist-tasks.test.ts  # Add deadline contract tests
├── integration/
│   └── deadline-flows.test.ts # Test recurring task warnings, past date reminders
└── unit/
    └── validation.test.ts     # Test deadline format validation
```

**Structure Decision**: Single project structure. Deadline feature extends existing task management capabilities by modifying types, validation schemas, API service, and the todoist_tasks tool. All changes are additive to existing files except for new test files.

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
1. **Type Definition Tasks** (from data-model.md):
   - Add TodoistDeadline interface to types/todoist.ts
   - Extend TodoistTask interface with optional deadline field
   - Add ToolResponseMetadata types for warnings/reminders

2. **Validation Schema Tasks** (from data-model.md + contracts):
   - Create DeadlineSchema in schemas/validation.ts
   - Extend CreateTaskSchema with deadline parameter
   - Extend UpdateTaskSchema with deadline parameter
   - Add deadline format validation with helpful error messages

3. **Contract Test Tasks** (from contracts/*.json) - [P]:
   - Test create task with valid deadline
   - Test create task with invalid deadline format (error cases)
   - Test update task to add deadline
   - Test update task to remove deadline (null)
   - Test update task to change deadline

4. **API Service Tasks** (from data-model.md):
   - Extend createTask() in todoist-api.ts to accept deadline parameter
   - Extend updateTask() in todoist-api.ts to accept deadline parameter
   - Add payload transformation (string → {date: string} object)
   - Add response mapping (API deadline → interface)

5. **Tool Handler Tasks** (from quickstart.md scenarios):
   - Add deadline parameter to todoist_tasks tool definition
   - Handle deadline in create action
   - Handle deadline in update action (including null for removal)
   - Add tool description with deadline format examples

6. **Warning/Reminder Logic Tasks** (from spec requirements):
   - Create helper function to detect recurring tasks
   - Create helper function to detect past dates
   - Add warning generation for recurring tasks with deadlines
   - Add reminder generation for past deadlines
   - Integrate warnings/reminders into tool response metadata

7. **Integration Test Tasks** (from quickstart.md) - [P]:
   - Test recurring task warning flow
   - Test past deadline reminder flow
   - Test deadline with due date coexistence
   - Test deadline removal (update to null)

8. **Unit Test Tasks** (from contracts) - [P]:
   - Test DeadlineSchema validation (valid formats)
   - Test DeadlineSchema rejection (invalid formats)
   - Test error message formatting
   - Test warning/reminder helper functions

9. **Documentation Tasks**:
   - Update tool description in tool definition
   - Add deadline examples to tool documentation
   - Update README with deadline feature

**Ordering Strategy**:
- **Phase 1**: Type definitions (foundational)
- **Phase 2**: Validation schemas (depends on types)
- **Phase 3**: Contract tests [P] (defines expected behavior)
- **Phase 4**: API service extension (depends on types + schemas)
- **Phase 5**: Tool handler updates (depends on API service)
- **Phase 6**: Warning/reminder logic (depends on tool handler)
- **Phase 7**: Integration tests [P] (depends on full implementation)
- **Phase 8**: Unit tests [P] (can run in parallel with integration)
- **Phase 9**: Documentation (after implementation complete)

**Dependency Graph**:
```
Types → Schemas → {Contract Tests [P], API Service} → Tool Handler → Warnings/Reminders
                                                      ↓
                                              {Integration Tests [P], Unit Tests [P]} → Docs
```

**Estimated Output**: ~20-25 numbered tasks in tasks.md
- 3 type definition tasks
- 4 validation schema tasks
- 5 contract test tasks [P]
- 4 API service tasks
- 4 tool handler tasks
- 4 warning/reminder tasks
- 3 integration test tasks [P]
- 4 unit test tasks [P]
- 1 documentation task

**Parallel Execution Opportunities**:
- Contract tests can run in parallel (independent test files)
- Integration tests can run in parallel
- Unit tests can run in parallel
- Estimated 40% parallelizable work

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
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved (no unknowns in Technical Context)
- [x] Complexity deviations documented (none - extends existing architecture)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
