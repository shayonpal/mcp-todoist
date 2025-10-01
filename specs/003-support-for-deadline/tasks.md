# Tasks: Deadline Support

**Input**: Design documents from `/specs/003-support-for-deadline/`
**Prerequisites**: research.md, data-model.md, quickstart.md

## Phase 3.1: Setup
- [x] T001 Review existing codebase patterns for deadline integration approach
- [x] T002 Validate TypeScript and Zod versions support required features

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests
- [x] T003 [P] Contract test: Create task with deadline in `tests/contract/todoist_tasks.test.ts`
- [x] T004 [P] Contract test: Update task to add deadline in `tests/contract/todoist_tasks.test.ts`
- [x] T005 [P] Contract test: Update task to remove deadline (null) in `tests/contract/todoist_tasks.test.ts`
- [x] T006 [P] Contract test: Get task with deadline field in `tests/contract/todoist_tasks.test.ts`
- [x] T007 [P] Contract test: Create task with both due_date and deadline in `tests/contract/todoist_tasks.test.ts`
- [x] T008 [P] Contract test: Invalid deadline format rejection in `tests/contract/todoist_tasks.test.ts`

### Integration Tests
- [x] T009 [P] Integration test: Recurring task deadline warning in `tests/integration/deadline-workflows.test.ts`
- [x] T010 [P] Integration test: Past deadline reminder in `tests/integration/deadline-workflows.test.ts`
- [x] T011 [P] Integration test: Valid future deadline (no warnings) in `tests/integration/deadline-workflows.test.ts`
- [x] T012 [P] Integration test: Deadline with due date independence in `tests/integration/deadline-workflows.test.ts`

### Unit Tests
- [x] T013 [P] Unit test: Deadline format validation (YYYY-MM-DD regex) in `tests/unit/validation.test.ts`
- [x] T014 [P] Unit test: DeadlineSchema error messages in `tests/unit/validation.test.ts`
- [x] T015 [P] Unit test: Warning helper function for recurring tasks in `tests/unit/tool-helpers.test.ts`
- [x] T016 [P] Unit test: Reminder helper function for past dates in `tests/unit/tool-helpers.test.ts`

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Type Definitions
- [x] T017 Add `TodoistDeadline` interface to `src/types/todoist.ts`
- [x] T018 Extend `TodoistTask` interface with optional deadline field in `src/types/todoist.ts`

### Validation Schemas
- [x] T019 Create `DeadlineSchema` with regex validation in `src/schemas/validation.ts`
- [x] T020 Create `DeadlineParameterSchema` for optional deadline input in `src/schemas/validation.ts`
- [x] T021 Extend `CreateTaskSchema` with deadline parameter in `src/schemas/validation.ts`
- [x] T022 Extend `UpdateTaskSchema` with deadline parameter in `src/schemas/validation.ts`

### API Service
- [x] T023 Update `createTask()` to transform deadline parameter to API format in `src/services/todoist-api.ts`
- [x] T024 Update `updateTask()` to handle deadline parameter (add/update/remove) in `src/services/todoist-api.ts`
- [x] T025 Add deadline field mapping in API response handlers in `src/services/todoist-api.ts`

### Tool Handlers
- [x] T026 Update `TodoistTasksTool` to accept deadline parameter in `src/tools/todoist-tasks.ts`
- [x] T027 Add deadline validation in create action handler in `src/tools/todoist-tasks.ts`
- [x] T028 Add deadline validation in update action handler in `src/tools/todoist-tasks.ts`
- [x] T029 Implement recurring task warning logic in `src/tools/todoist-tasks.ts`
- [x] T030 Implement past date reminder logic in `src/tools/todoist-tasks.ts`

### Helper Utilities
- [x] T031 [P] Create `buildRecurringWarning()` helper in `src/utils/tool-helpers.ts`
- [x] T032 [P] Create `buildPastDeadlineReminder()` helper in `src/utils/tool-helpers.ts`
- [x] T033 [P] Update `ToolResponseMetadata` type with warnings/reminders arrays in `src/utils/tool-helpers.ts`

## Phase 3.4: Integration
- [x] T034 Update tool registration to reflect deadline parameter in MCP schema in `src/tools/todoist-tasks.ts`
- [x] T035 Verify deadline field appears in tool description/documentation in `src/tools/todoist-tasks.ts`

## Phase 3.5: Polish

### Documentation
- [x] T036 [P] Add deadline usage examples to CLAUDE.md
- [x] T037 [P] Update README with deadline feature section
- [x] T038 [P] Create CHANGELOG entry for deadline support

### Validation & Testing
- [x] T039 Run all contract tests (verify 100% pass rate)
- [x] T040 Run all integration tests (verify deadline workflows pass)
- [x] T041 Run all unit tests (verify validation and helpers pass)
- [ ] T042 Run manual quickstart scenarios from `quickstart.md`
- [x] T043 Verify type coverage (no `any` types for deadline code)
- [x] T044 Run linting and formatting checks
- [x] T045 Verify backward compatibility (existing tests still pass)

## Dependencies

### Setup Dependencies
```
T001 → (blocks all tasks)
T002 → T003-T016
```

### Test Dependencies (Phase 3.2)
```
All T003-T016 are parallel [P] and independent
Must complete before T017-T033 (implementation)
```

### Implementation Dependencies (Phase 3.3)
```
Types first:
  T017 → T018 → T019-T022 (schemas depend on types)

Schemas before API:
  T019-T022 → T023-T025 (API uses schemas)

API before Tools:
  T023-T025 → T026-T030 (tools call API)

Helpers parallel:
  T031-T033 are parallel [P] with T026-T030 (used by tools but independent)
```

### Integration Dependencies (Phase 3.4)
```
T026-T030 → T034-T035 (server registration after tool implementation)
```

### Polish Dependencies (Phase 3.5)
```
All implementation (T017-T035) → T036-T045 (polish after implementation)
T036-T038 are parallel [P] (documentation)
T039-T045 run sequentially (testing workflow)
```

## Parallel Execution Examples

### Phase 3.2: All Contract Tests Together
```bash
# Launch all contract tests in parallel (T003-T008)
npm test tests/contract/todoist_tasks.test.ts -- --testNamePattern="deadline"
```

### Phase 3.2: All Integration Tests Together
```bash
# Launch integration tests in parallel (T009-T012)
npm test tests/integration/deadline-workflows.test.ts
```

### Phase 3.2: All Unit Tests Together
```bash
# Launch unit tests in parallel (T013-T016)
npm test tests/unit/validation.test.ts tests/unit/tool-helpers.test.ts
```

### Phase 3.3: Helper Functions in Parallel
```bash
# T031-T033 can be implemented simultaneously by different developers
# File 1: src/utils/tool-helpers.ts (T031, T032)
# File 2: src/types/common.ts (T033)
```

### Phase 3.5: Documentation in Parallel
```bash
# T036-T038 can be written simultaneously
# File 1: CLAUDE.md
# File 2: README.md
# File 3: CHANGELOG.md
```

## Task Execution Notes

### Critical Path
```
T001 → T002 → [T003-T016 parallel] → T017 → T018 → T019-T022 → T023-T025 → T026-T030 → T034-T035 → T039-T045
```

### Estimated Parallel Groups
1. **Test Group** (T003-T016): 14 tasks, ~2-3 hours if parallelized
2. **Schema Group** (T019-T022): 4 tasks, ~30 min sequential
3. **Helper Group** (T031-T033): 3 tasks, ~20 min if parallelized
4. **Doc Group** (T036-T038): 3 tasks, ~30 min if parallelized

### File Modification Summary
**Files Modified** (not parallel - sequential edits):
- `src/types/todoist.ts` (T017, T018)
- `src/schemas/validation.ts` (T019-T022)
- `src/services/todoist-api.ts` (T023-T025)
- `src/tools/todoist-tasks.ts` (T026-T030, T035)
- `src/server.ts` (T034)

**Files Created** (parallel possible):
- `tests/integration/deadline-workflows.test.ts` (T009-T012)
- `tests/unit/tool-helpers.test.ts` (T015-T016, if not exists)

**Files Extended** (test additions - parallel possible):
- `tests/contract/todoist_tasks.test.ts` (T003-T008)
- `tests/unit/validation.test.ts` (T013-T014)

## Validation Checklist

### Before Starting Implementation (Phase 3.3)
- [ ] All contract tests written and failing (T003-T008)
- [ ] All integration tests written and failing (T009-T012)
- [ ] All unit tests written and failing (T013-T016)
- [ ] Test coverage plan includes all quickstart scenarios

### Before Moving to Polish (Phase 3.5)
- [ ] TodoistDeadline interface defined (T017-T018)
- [ ] All schemas extended with deadline (T019-T022)
- [ ] API service handles deadline parameter (T023-T025)
- [ ] Tool handlers validate and process deadline (T026-T030)
- [ ] Helper functions for warnings/reminders (T031-T033)
- [ ] MCP tool schema updated (T034-T035)

### Before Completion
- [ ] All tests pass (T039-T041)
- [ ] Manual scenarios validated (T042)
- [ ] No type errors (T043)
- [ ] Code quality checks pass (T044)
- [ ] Backward compatibility verified (T045)
- [ ] Documentation complete (T036-T038)

## Success Criteria

Feature is complete when:
1. ✅ All 45 tasks marked complete
2. ✅ All 8 quickstart scenarios pass manual validation
3. ✅ Test coverage ≥ 80% for new deadline code
4. ✅ Zero TypeScript errors related to deadline feature
5. ✅ All existing tests still pass (backward compatibility)
6. ✅ CLAUDE.md and README updated with deadline examples
7. ✅ CHANGELOG documents new deadline support

## Notes

### TDD Approach
- **Phase 3.2 is critical**: All tests must be written first and must fail
- Tests define the contract - implementation follows
- If tests don't fail initially, they're not testing the right thing

### Parallel Execution Strategy
- Tasks marked [P] can run in parallel (different files, no dependencies)
- Same file edits must be sequential (T017→T018, T019→T020→T021→T022)
- Test writing (Phase 3.2) is highly parallelizable
- Documentation (T036-T038) can be written simultaneously

### Type Safety
- No `any` types allowed for deadline-related code
- Use strict Zod schemas with clear error messages
- Leverage TypeScript's discriminated unions for action handlers

### Backward Compatibility
- Deadline is optional - existing code unaffected
- All existing tests must continue passing
- No breaking changes to tool parameters or response structure
