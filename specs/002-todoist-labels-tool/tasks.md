# Tasks: Todoist Labels Tool

**Feature**: `002-todoist-labels-tool`
**Input**: Design documents from `/specs/002-todoist-labels-tool/`
**Prerequisites**: research.md, data-model.md, contracts/todoist_labels_tool.json, quickstart.md

## ⚠️ IMPORTANT: API Documentation Reference

**Before working on ANY task, review the official Todoist API documentation:**
- **Labels API Reference**: https://developer.todoist.com/api/v1#tag/Labels
- This documentation is the authoritative source for endpoint specifications, request/response formats, and error codes

## Execution Flow
```
1. Setup: TypeScript project dependencies, validation schemas
2. Tests First (TDD): Contract tests MUST be written and MUST FAIL before implementation
3. Core Implementation: Tool handler, API integration, error handling
4. Integration: Server registration, caching integration
5. Polish: Unit tests, documentation, manual validation
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

---

## Phase 3.1: Setup

- [x] **T001** Add label validation schemas to `src/schemas/validation.ts`
  - Add `LabelToolInputSchema` with Zod validation
  - Define conditional validation for action-based parameters
  - Add `TodoistLabel` output type if not already present

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

- [x] **T002 [P]** Contract test: create_personal_label in `tests/contract/todoist_labels.test.ts`
  - Test creating new label with name, color, is_favorite
  - Verify response schema matches contract
  - Use in-memory API service mock

- [x] **T003 [P]** Contract test: create_duplicate_label_idempotent in `tests/contract/todoist_labels.test.ts`
  - Test duplicate name returns existing label
  - Verify idempotent behavior (same ID returned)
  - Verify message indicates label already exists

- [x] **T004 [P]** Contract test: get_label_by_id in `tests/contract/todoist_labels.test.ts`
  - Test retrieving label by valid ID
  - Verify all fields returned (id, name, color, order, is_favorite)

- [x] **T005 [P]** Contract test: get_nonexistent_label in `tests/contract/todoist_labels.test.ts`
  - Test invalid label ID returns LABEL_NOT_FOUND
  - Verify error code and retryable=false

- [x] **T006 [P]** Contract test: update_label in `tests/contract/todoist_labels.test.ts`
  - Test updating color and is_favorite
  - Verify name remains unchanged

- [ ] **T007 [P]** Contract test: delete_label in `tests/contract/todoist_labels.test.ts`
  - Test label deletion returns success
  - Verify data is null, message confirms deletion

- [ ] **T008 [P]** Contract test: list_labels_default_pagination in `tests/contract/todoist_labels.test.ts`
  - Test listing labels without limit parameter
  - Verify metadata includes total_count and next_cursor

- [ ] **T009 [P]** Contract test: list_labels_with_pagination in `tests/contract/todoist_labels.test.ts`
  - Test listing with limit=10 and cursor
  - Verify pagination metadata present

- [ ] **T010 [P]** Contract test: list_labels_invalid_limit in `tests/contract/todoist_labels.test.ts`
  - Test limit=250 returns VALIDATION_ERROR
  - Verify error details include field, value, constraint

- [ ] **T011 [P]** Contract test: rename_shared_label in `tests/contract/todoist_labels.test.ts`
  - Test renaming shared label with name and new_name
  - Verify success message mentions "across all tasks"

- [ ] **T012 [P]** Contract test: remove_shared_label in `tests/contract/todoist_labels.test.ts`
  - Test removing shared label by name
  - Verify success message confirms removal from all tasks

- [ ] **T013 [P]** Contract test: rate_limit_exceeded in `tests/contract/todoist_labels.test.ts`
  - Test rate limit error response
  - Verify retryable=true and retry_after field present

- [ ] **T014 [P]** Unit test: label validation in `tests/unit/label-validation.test.ts`
  - Test action enum validation
  - Test name length validation (0, 128, 129 chars)
  - Test limit validation (0, 1, 200, 201)
  - Test conditional required fields per action

---

## Phase 3.3: Core Implementation (ONLY after tests are failing)

- [ ] **T015** Implement TodoistApiService label methods in `src/services/todoist-api.ts`
  - Add `getLabels(cursor?: string, limit?: number)` - GET /api/v1/labels
  - Add `getLabel(labelId: string)` - GET /api/v1/labels/{id}
  - Add `createLabel(params)` - POST /api/v1/labels
  - Add `updateLabel(labelId, params)` - POST /api/v1/labels/{id}
  - Add `deleteLabel(labelId)` - DELETE /api/v1/labels/{id}
  - Add `renameSharedLabel(name, newName)` - Sync API command
  - Add `removeSharedLabel(name)` - Sync API command
  - All methods use existing rate limiter (restRateLimiter for REST, syncRateLimiter for Sync)

- [ ] **T016** Create TodoistLabelsTool in `src/tools/todoist-labels.ts`
  - Implement `getToolDefinition()` returning MCP tool definition from contract
  - Implement `execute(params)` with action routing
  - Implement `handleCreate()` with duplicate name check
  - Implement `handleGet()`
  - Implement `handleUpdate()`
  - Implement `handleDelete()`
  - Implement `handleList()` with pagination
  - Implement `handleRenameShared()` using Sync API
  - Implement `handleRemoveShared()` using Sync API
  - Use `handleToolError()` wrapper for error responses

- [ ] **T017** Add error mapping in `src/utils/error-handler.ts`
  - Map 404 → NotFoundError → "LABEL_NOT_FOUND"
  - Ensure existing rate limit and validation error mappings apply

---

## Phase 3.4: Integration

- [ ] **T018** Register todoist_labels tool in `src/server.ts`
  - Import TodoistLabelsTool
  - Instantiate in `initializeTools()`
  - Add to tools map: `this.tools.set('todoist_labels', labelsTool)`
  - Add tool definition: `this.toolDefinitions.push(TodoistLabelsTool.getToolDefinition())`

- [ ] **T019** Integrate label cache invalidation in `src/services/cache.ts`
  - On create: Add or update cached label
  - On update: Update cached label
  - On delete: Remove from cache
  - On list: Update cache with results
  - On rename_shared/remove_shared: Invalidate entire cache

---

## Phase 3.5: Integration Tests

- [ ] **T020 [P]** Integration test: label lifecycle in `tests/integration/label-workflows.test.ts`
  - Create label → Update color → Delete label
  - Verify each step succeeds

- [ ] **T021 [P]** Integration test: label and task relationship in `tests/integration/label-workflows.test.ts`
  - Create label → Assign to task → Delete label
  - Verify label removed from task.label_names

- [ ] **T022 [P]** Integration test: pagination workflow in `tests/integration/label-workflows.test.ts`
  - Create 150 test labels
  - Page through with limit=50
  - Verify cursor handling and next_cursor=null at end

- [ ] **T023 [P]** Integration test: shared label operations in `tests/integration/label-workflows.test.ts`
  - Create shared label on tasks
  - Rename shared label
  - Verify name changed across tasks
  - Remove shared label
  - Verify removed from all tasks

---

## Phase 3.6: Polish

- [ ] **T024** Update helper mocks in `tests/helpers/inMemoryTodoistApiService.ts`
  - Add in-memory label storage
  - Implement mock label CRUD methods
  - Support duplicate name detection

- [ ] **T025** Update helper mocks in `tests/helpers/mockTodoistApiService.ts`
  - Add Jest mock factory for label methods
  - Support all label actions

- [ ] **T026** Run manual validation from `specs/002-todoist-labels-tool/quickstart.md`
  - Execute all 9 acceptance scenarios
  - Execute all 3 edge case scenarios
  - Verify against real Todoist API
  - Document any deviations

- [ ] **T027 [P]** Update CLAUDE.md with label tool documentation
  - Add todoist_labels to tool list
  - Document action parameter options
  - Add example usage

- [ ] **T028** Verify test coverage ≥80% for label code
  - Run `npm run test:coverage -- --testPathPattern=label`
  - Ensure coverage meets threshold

---

## Dependencies

**Critical Path:**
```
T001 (validation schemas)
  ↓
T002-T014 (all contract/unit tests - PARALLEL)
  ↓
T015 (API service methods)
  ↓
T016 (tool implementation)
  ↓
T017 (error mapping - can be parallel with T016 if no shared files)
  ↓
T018 (server registration)
  ↓
T019 (cache integration)
  ↓
T020-T023 (integration tests - PARALLEL)
  ↓
T024-T025 (test helper updates - PARALLEL)
  ↓
T026-T028 (polish - PARALLEL)
```

**Blocking Rules:**
- T015 blocks T016 (tool needs API methods)
- T016 blocks T018 (can't register tool that doesn't exist)
- T018 blocks T020-T023 (integration tests need registered tool)
- All tests (T002-T014) MUST fail before T015-T016 start

---

## Parallel Execution Examples

### Contract Tests (T002-T013)
```bash
# All contract tests can run in parallel since they use in-memory mocks
# Launch together:
Task: "Contract test create_personal_label in tests/contract/todoist_labels.test.ts"
Task: "Contract test create_duplicate_label_idempotent in tests/contract/todoist_labels.test.ts"
Task: "Contract test get_label_by_id in tests/contract/todoist_labels.test.ts"
Task: "Contract test get_nonexistent_label in tests/contract/todoist_labels.test.ts"
Task: "Contract test update_label in tests/contract/todoist_labels.test.ts"
Task: "Contract test delete_label in tests/contract/todoist_labels.test.ts"
Task: "Contract test list_labels_default_pagination in tests/contract/todoist_labels.test.ts"
Task: "Contract test list_labels_with_pagination in tests/contract/todoist_labels.test.ts"
Task: "Contract test list_labels_invalid_limit in tests/contract/todoist_labels.test.ts"
Task: "Contract test rename_shared_label in tests/contract/todoist_labels.test.ts"
Task: "Contract test remove_shared_label in tests/contract/todoist_labels.test.ts"
Task: "Contract test rate_limit_exceeded in tests/contract/todoist_labels.test.ts"
```

### Integration Tests (T020-T023)
```bash
# Integration tests can run in parallel - different test scenarios
Task: "Integration test label lifecycle in tests/integration/label-workflows.test.ts"
Task: "Integration test label and task relationship in tests/integration/label-workflows.test.ts"
Task: "Integration test pagination workflow in tests/integration/label-workflows.test.ts"
Task: "Integration test shared label operations in tests/integration/label-workflows.test.ts"
```

### Polish Tasks (T024-T028)
```bash
# Polish tasks operate on different files
Task: "Update inMemoryTodoistApiService helper in tests/helpers/"
Task: "Update mockTodoistApiService helper in tests/helpers/"
Task: "Update CLAUDE.md documentation"
```

---

## Notes

- **[P] tasks** = different files, no dependencies, can run in parallel
- **TDD Required**: All contract tests (T002-T014) MUST fail before implementation starts
- **Commit Strategy**: Commit after each task completion
- **Error Handling**: Use existing `handleToolError()` wrapper, no new error classes needed
- **Rate Limiting**: Inherited from TodoistApiService, no new code needed
- **Caching**: Leverage existing cache infrastructure in `src/services/cache.ts`
- **Shared Labels**: Use Sync API commands (already available in `apiService.sync()`)

---

## Validation Checklist
*Verify before marking feature complete*

- [ ] All 12 contract scenarios pass
- [ ] All 4 integration workflows pass
- [ ] Unit tests cover validation edge cases
- [ ] Manual quickstart.md scenarios validated against real API
- [ ] Test coverage ≥80% for label-related code
- [ ] Tool appears in MCP tool list when server starts
- [ ] No duplicate labels created on name collision
- [ ] LABEL_NOT_FOUND error returns proper code
- [ ] Pagination works with cursor handling
- [ ] Rate limit errors include retry_after field
