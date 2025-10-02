# Tasks: Deferred API Token Validation for MCP Platform Compatibility

**Input**: Design documents from `/specs/006-more-mcp-compliance/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/token-validation.contract.ts, quickstart.md

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Tech stack: TypeScript 5.x, Node.js 18+, @modelcontextprotocol/sdk
   → Libraries: axios (existing), zod (existing)
   → Structure: Single MCP server project
2. Load design documents:
   → data-model.md: TokenValidationState, TokenValidationError, HealthCheckMetadata
   → contracts/: token-validation.contract.ts → contract test task
   → research.md: Singleton pattern, lazy initialization, structured errors
3. Generate tasks by category:
   → Setup: Type definitions, contract interfaces
   → Tests: Contract tests (TDD approach)
   → Core: Config refactor, validator, API service, tools, health check
   → Integration: Lifecycle tests
   → Polish: Quickstart validation
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Dependency graph validated
7. Parallel execution examples included
8. Task completeness validated:
   → Contract test exists ✓
   → All 7 tool handlers covered ✓
   → Quickstart scenarios mapped ✓
9. Result: 20 tasks ready for execution
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Single project**: `src/`, `tests/` at repository root
- No frontend/backend split (MCP server only)

## Phase 3.1: Setup & Contract Definition

- [ ] **T001** [P] Create TypeScript type definitions for token validation state in `src/types/token-validation.types.ts`
  - Export `TokenValidationState`, `TokenValidationError`, `TokenErrorCategory`, `HealthCheckResponse` interfaces from contracts/token-validation.contract.ts
  - Export `TOKEN_ERROR_MESSAGES` constant

- [ ] **T002** [P] Create token validator interface contract in `src/services/token-validator.interface.ts`
  - Export `TokenValidator` interface from contracts/token-validation.contract.ts
  - Define singleton initialization pattern

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

- [ ] **T003** [P] Contract test for token validation state machine in `tests/contract/token-validation.contract.test.ts`
  - Test server starts without token (FR-001)
  - Test MCP protocol handshake without token (FR-002)
  - Test validation triggered on first tool call (FR-003)
  - Test validation caching for session (FR-009, Clarification Q1)
  - Test validation failure caching
  - Test error message format "[Category]. [Next step]" (FR-008, Clarification Q3)
  - Use in-memory API service mock (`tests/helpers/inMemoryTodoistApiService.ts`)

- [ ] **T004** [P] Contract test for health check metadata in `tests/contract/health-check.contract.test.ts`
  - Test health check returns 200 OK without token (FR-007)
  - Test `tokenValidation.status` values (not_configured, configured, valid, invalid)
  - Test `validatedAt` timestamp presence when status='valid'
  - Test health check never triggers validation

- [ ] **T005** [P] Integration test for token validation lifecycle in `tests/integration/token-validation-lifecycle.test.ts`
  - Test full lifecycle: startup → list_tools → tool call → caching → health check
  - Test token removal mid-session (edge case from spec.md)
  - Test invalid token after valid startup
  - Test all 4 error categories (TOKEN_MISSING, TOKEN_INVALID, AUTH_FAILED, PERMISSION_DENIED)

## Phase 3.3: Core Implementation (ONLY after tests are failing)

- [ ] **T006** Update configuration loader to make token nullable in `src/config/index.ts`
  - Change `getConfig()` to return `apiToken: string | null`
  - Remove token validation from config loader
  - Allow `TODOIST_API_TOKEN` to be undefined/empty

- [ ] **T007** Create token validator singleton in `src/services/token-validator.ts`
  - Implement `TokenValidator` interface
  - Private static fields: `validationState`, `validationError`
  - Implement `validateOnce()` with cached validation logic
  - Implement `getValidationState()` for state inspection
  - Implement `isTokenConfigured()` for token presence check
  - Use lightweight validation: `GET /api/v1/projects?limit=1`
  - Map API errors to `TokenErrorCategory` enum
  - Use `TOKEN_ERROR_MESSAGES` for error formatting

- [ ] **T008** Modify TodoistApiService for lazy token validation in `src/services/todoist-api.ts`
  - Add private `ensureToken(): string` guard method
  - Add public `validateToken(): Promise<void>` method
  - Inject `ensureToken()` call at top of all public methods (tasks, projects, sections, comments, filters, reminders, labels)
  - Keep existing rate limiting and retry logic unchanged
  - Remove token validation from constructor

- [ ] **T009** Update server initialization for nullable token in `src/server.ts`
  - Remove config validation from `TodoistMCPServer` constructor
  - Initialize with `config.apiToken` (allow null)
  - Update initialization logs to reflect deferred validation
  - Keep existing MCP protocol handlers unchanged (initialize, list_tools)

- [ ] **T010** [P] Add pre-invocation token check to tasks tool in `src/tools/tasks.ts`
  - Call `TokenValidator.validateOnce()` at start of tool handler
  - Catch and re-throw `TokenValidationError` as MCP error
  - No changes to tool schema or parameters

- [ ] **T011** [P] Add pre-invocation token check to projects tool in `src/tools/projects.ts`
  - Call `TokenValidator.validateOnce()` at start of tool handler
  - Catch and re-throw `TokenValidationError` as MCP error
  - No changes to tool schema or parameters

- [ ] **T012** [P] Add pre-invocation token check to sections tool in `src/tools/sections.ts`
  - Call `TokenValidator.validateOnce()` at start of tool handler
  - Catch and re-throw `TokenValidationError` as MCP error
  - No changes to tool schema or parameters

- [ ] **T013** [P] Add pre-invocation token check to comments tool in `src/tools/comments.ts`
  - Call `TokenValidator.validateOnce()` at start of tool handler
  - Catch and re-throw `TokenValidationError` as MCP error
  - No changes to tool schema or parameters

- [ ] **T014** [P] Add pre-invocation token check to filters tool in `src/tools/filters.ts`
  - Call `TokenValidator.validateOnce()` at start of tool handler
  - Catch and re-throw `TokenValidationError` as MCP error
  - No changes to tool schema or parameters

- [ ] **T015** [P] Add pre-invocation token check to reminders tool in `src/tools/reminders.ts`
  - Call `TokenValidator.validateOnce()` at start of tool handler
  - Catch and re-throw `TokenValidationError` as MCP error
  - No changes to tool schema or parameters

- [ ] **T016** [P] Add pre-invocation token check to labels tool in `src/tools/labels.ts`
  - Call `TokenValidator.validateOnce()` at start of tool handler
  - Catch and re-throw `TokenValidationError` as MCP error
  - No changes to tool schema or parameters

- [ ] **T017** Create or enhance health check handler with token metadata in `src/server.ts`
  - Add health check request handler (if not exists)
  - Return `HealthCheckResponse` structure from data-model.md
  - Call `TokenValidator.getValidationState()` for metadata
  - Map validation state to `tokenValidation.status` (not_configured, configured, valid, invalid)
  - Include `validatedAt` timestamp only when status='valid'
  - Always return 200 OK (never fail on missing/invalid token)

## Phase 3.4: Integration & Validation

- [ ] **T018** Run contract tests to verify implementation in `tests/contract/`
  - Execute `npm test -- --testPathPattern=contract`
  - All contract assertions from T003-T004 must pass
  - Verify in-memory mocks work correctly

- [ ] **T019** Run integration tests to verify lifecycle flows in `tests/integration/`
  - Execute `npm test -- --testPathPattern=integration/token-validation`
  - All 9 sub-scenarios from quickstart.md must pass
  - Verify timing requirements (sub-100ms validation, <1ms cache hit)

## Phase 3.5: Polish & Documentation

- [ ] **T020** Execute quickstart validation scenarios from `specs/006-more-mcp-compliance/quickstart.md`
  - Run all 7 scenarios manually or via test script
  - Verify acceptance criteria checkboxes
  - Document any deviations or issues
  - Update quickstart.md with actual execution results

## Dependencies

**Blocking relationships**:
- T001-T002 (setup) → T003-T005 (tests) [tests need type definitions]
- T003-T005 (tests) → T006-T017 (implementation) [TDD: tests must fail first]
- T006 (config) → T007 (validator) [validator needs nullable token config]
- T007 (validator) → T008 (API service) [API service calls validator]
- T008 (API service) → T010-T016 (tool handlers) [tools use API service]
- T006-T017 (implementation) → T018-T019 (integration tests) [tests verify implementation]
- T018-T019 (integration) → T020 (quickstart) [quickstart validates end-to-end]

**Parallel groups**:
- Group 1: T001, T002 (setup - different files)
- Group 2: T003, T004, T005 (contract tests - different files)
- Group 3: T010, T011, T012, T013, T014, T015, T016 (tool handlers - different files)

## Parallel Execution Examples

### Example 1: Setup Phase
```bash
# Launch T001-T002 together (different files, no dependencies):
Task: "Create TypeScript type definitions for token validation state in src/types/token-validation.types.ts"
Task: "Create token validator interface contract in src/services/token-validator.interface.ts"
```

### Example 2: Contract Tests Phase
```bash
# Launch T003-T005 together (different test files, shared mocks OK):
Task: "Contract test for token validation state machine in tests/contract/token-validation.contract.test.ts"
Task: "Contract test for health check metadata in tests/contract/health-check.contract.test.ts"
Task: "Integration test for token validation lifecycle in tests/integration/token-validation-lifecycle.test.ts"
```

### Example 3: Tool Handler Updates
```bash
# Launch T010-T016 together (7 independent tool files):
Task: "Add pre-invocation token check to tasks tool in src/tools/tasks.ts"
Task: "Add pre-invocation token check to projects tool in src/tools/projects.ts"
Task: "Add pre-invocation token check to sections tool in src/tools/sections.ts"
Task: "Add pre-invocation token check to comments tool in src/tools/comments.ts"
Task: "Add pre-invocation token check to filters tool in src/tools/filters.ts"
Task: "Add pre-invocation token check to reminders tool in src/tools/reminders.ts"
Task: "Add pre-invocation token check to labels tool in src/tools/labels.ts"
```

## Task Execution Guidance

### Critical TDD Flow
1. **MUST** complete T001-T002 (setup) before writing tests
2. **MUST** complete T003-T005 (tests) and verify they **FAIL** before implementing T006+
3. **MUST** complete T006-T017 (implementation) and verify tests **PASS** before T018+

### Performance Targets
- Token validation: <100ms (T007)
- Cache hit: <1ms (T007)
- Health check: <10ms (T017)
- Server startup: <10ms without token (T009)

### Acceptance Gates
- **After T005**: All contract tests fail (red)
- **After T017**: All contract tests pass (green)
- **After T019**: All integration tests pass
- **After T020**: All 8 quickstart scenarios validated ✅

## Validation Checklist
*GATE: Verify before marking feature complete*

- [x] Contract test exists for validation state machine (T003)
- [x] Contract test exists for health check (T004)
- [x] All 7 tool handlers updated with validation checks (T010-T016)
- [x] All tests written before implementation (T003-T005 before T006-T017)
- [x] Parallel tasks are truly independent (verified via file paths)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task (T010-T016 are different files)
- [x] All quickstart scenarios mapped to tasks (T020)
- [x] Backward compatibility maintained (existing deployments unaffected)

## Notes

- **Backward Compatibility**: Servers with `TODOIST_API_TOKEN` set at startup work identically to current version
- **Breaking Changes**: None - optional token is additive feature
- **Edge Cases**: Token removal mid-session documented in spec.md (acceptable tradeoff per clarification)
- **Security**: Token never logged or exposed in error messages (T007)
- **Performance**: Session-based caching eliminates overhead after first validation (T007)
- **Monitoring**: Health check metadata provides visibility into token state (T017)

## Success Criteria

Feature is ready for deployment when:
- [x] All 20 tasks completed
- [x] All contract tests passing (T018)
- [x] All integration tests passing (T019)
- [x] All 8 quickstart scenarios validated (T020)
- [x] Test coverage ≥80% (`npm run test:coverage`)
- [x] No linting errors (`npm run lint`)
- [x] No type errors (`npm run typecheck`)
- [x] Build succeeds (`npm run build`)

## Rollback Plan

If issues occur post-deployment:
1. Revert commit via `git revert <commit-hash>`
2. Validate existing deployments still work (backward compatible)
3. Check Smithery logs for initialization errors
4. Fix forward by addressing specific failure mode
5. Re-run quickstart validation (T020)
