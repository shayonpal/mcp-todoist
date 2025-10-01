# Phase 0: Research - Deadline Support

## Overview
This document consolidates research findings for adding deadline field support to the MCP Todoist server. Since the technical context is well-defined with no unknowns, this research focuses on best practices for extending existing architecture.

## Technical Decisions

### 1. Deadline Field Integration Approach

**Decision**: Extend existing TodoistTask interface and tool rather than create separate deadline management

**Rationale**:
- Todoist API treats deadline as a task attribute (part of task object)
- Consistent with existing pattern for due dates, labels, priority
- Minimizes breaking changes and API surface area
- Aligns with MCP Protocol best practice of tool cohesion

**Alternatives Considered**:
- Separate deadline management tool → Rejected: Violates single responsibility, creates API fragmentation
- New deadline-specific endpoints → Rejected: Todoist API doesn't provide separate deadline endpoints

### 2. Validation Strategy for Date Format

**Decision**: Use Zod schema with regex pattern for YYYY-MM-DD format validation

**Rationale**:
- Zod already used throughout codebase for validation
- Regex pattern `/^\d{4}-\d{2}-\d{2}$/` catches format violations
- Can add semantic validation (valid month/day) via `.refine()` if needed
- Consistent with existing due date validation patterns

**Alternatives Considered**:
- Date object parsing → Rejected: Loses precision, timezone complications
- Manual string validation → Rejected: Error-prone, duplicates Zod functionality
- Third-party date library → Rejected: Adds dependency for simple format check

### 3. Warning/Reminder Message Strategy

**Decision**: Add optional `warnings` and `reminders` arrays to tool response metadata

**Rationale**:
- Non-blocking: Operation succeeds but includes advisory messages
- Structured: Array format allows multiple warnings/reminders
- Extensible: Future features can add more warning types
- Consistent with MCP Protocol's metadata field pattern

**Alternatives Considered**:
- Blocking errors → Rejected: User explicitly wants non-blocking behavior
- Single warning string → Rejected: Can't distinguish multiple concerns
- Console logging → Rejected: Doesn't surface to MCP client/user

**Response Structure**:
```typescript
{
  success: true,
  data: { /* task object with deadline */ },
  message: "Task created successfully",
  metadata: {
    warnings: ["Deadline added to recurring task - deadline will not recur"],
    reminders: ["Specified deadline (2025-01-15) is in the past"]
  }
}
```

### 4. Type Safety for Deadline Field

**Decision**: Define `TodoistDeadline` interface matching API specification

**Rationale**:
- Strong typing prevents runtime errors
- Self-documenting code
- Enables IDE autocomplete and type checking
- Matches constitution requirement for strongly typed API schemas

**Type Definition**:
```typescript
interface TodoistDeadline {
  date: string;  // YYYY-MM-DD format
  lang?: string; // Output only, currently unused
}

interface TodoistTask {
  // ... existing fields
  deadline?: TodoistDeadline | null;
}
```

**Alternatives Considered**:
- Inline type (string) → Rejected: Loses API object structure
- Optional lang field → Correct: API returns it but doesn't use for processing

### 5. Test Strategy for Deadline Features

**Decision**: Three-tier test approach (contract, integration, unit)

**Rationale**:
- Contract tests: Verify API request/response schemas match Todoist API
- Integration tests: Test warning/reminder flows (recurring, past dates)
- Unit tests: Validate date format parsing and error messages
- Aligns with constitution's TDD and 80% coverage requirements

**Test Coverage Plan**:
- Contract: Create/update with deadline, invalid format rejection
- Integration: Recurring task warning, past date reminder, valid date acceptance
- Unit: Regex validation, error message formatting, deadline object construction

**Alternatives Considered**:
- E2E tests only → Rejected: Too slow, doesn't isolate validation logic
- Unit tests only → Rejected: Misses integration scenarios (warnings/reminders)

## Best Practices Applied

### TypeScript Patterns
- **Discriminated unions**: Use action-based type narrowing in tool handler
- **Optional chaining**: Handle optional deadline field safely (`task.deadline?.date`)
- **Type guards**: Validate deadline object structure before API calls
- **Readonly arrays**: Prevent mutation of warning/reminder arrays

### Zod Validation Patterns
- **Schema composition**: Extend existing CreateTaskSchema/UpdateTaskSchema
- **Custom refinements**: Add semantic validation if needed (valid date ranges)
- **Error messages**: Provide examples in validation errors (e.g., "Expected YYYY-MM-DD, e.g., 2025-10-15")
- **Transform pipelines**: Parse and normalize deadline input

### MCP Protocol Patterns
- **Tool parameter flattening**: Deadline as optional string parameter (not nested object)
- **Response metadata**: Use metadata field for non-critical information (warnings/reminders)
- **Error codes**: Use standard MCP error codes (INVALID_PARAMS for validation failures)
- **Tool descriptions**: Include format examples in parameter descriptions

### API Service Patterns
- **Payload transformation**: Convert flat parameters to API-expected nested structure
- **Response mapping**: Extract deadline from API response, normalize to interface
- **Error handling**: Map Todoist validation errors to user-friendly messages
- **Rate limiting**: No changes needed - deadline adds minimal payload size

## Implementation Dependencies

### Existing Code to Extend
1. `src/types/todoist.ts` - Add `TodoistDeadline` interface, extend `TodoistTask`
2. `src/schemas/validation.ts` - Add `DeadlineSchema`, extend task schemas
3. `src/services/todoist-api.ts` - Update `createTask()`, `updateTask()` methods
4. `src/tools/todoist-tasks.ts` - Add deadline parameter handling
5. `src/utils/tool-helpers.ts` - Add warning/reminder helper functions

### New Test Files
1. `tests/contract/todoist-tasks.test.ts` - Add deadline test cases
2. `tests/integration/deadline-flows.test.ts` - New file for warning/reminder tests
3. `tests/unit/validation.test.ts` - Add deadline validation test cases

### Documentation Updates
1. Tool description in `todoist_tasks` - Document deadline parameter
2. README examples - Show deadline usage
3. CHANGELOG - Document new deadline support

## Risk Mitigation

### Breaking Changes
**Risk**: Deadline field changes could break existing tool users
**Mitigation**: Deadline is optional, backward compatible with existing usage

### API Compatibility
**Risk**: Todoist API deadline behavior changes
**Mitigation**: Follow API versioning, document API version in constitution

### Validation Complexity
**Risk**: Date validation could become complex (leap years, valid ranges)
**Mitigation**: Start with format validation only, add semantic validation if needed

### Warning Message Proliferation
**Risk**: Too many warnings could overwhelm users
**Mitigation**: Limit to 2 warning types (recurring, past date), use clear language

## Success Criteria

1. ✅ All constitution checks pass (no violations)
2. ✅ No NEEDS CLARIFICATION items remain
3. ✅ Test strategy covers all acceptance scenarios from spec
4. ✅ Type safety maintained throughout feature
5. ✅ Backward compatibility preserved
6. ✅ Warning/reminder mechanism non-blocking
7. ✅ Date format validation clear and helpful

## Next Phase

**Phase 1**: Design & Contracts
- Generate data model from research decisions
- Create API contract specifications
- Generate contract tests (should fail initially)
- Extract test scenarios from user stories
- Update CLAUDE.md with new feature context
