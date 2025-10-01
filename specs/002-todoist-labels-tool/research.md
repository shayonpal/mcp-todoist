# Research: Todoist Labels Tool Implementation

**Feature**: `002-todoist-labels-tool`
**Date**: 2025-10-01
**Status**: Complete

## Overview
This document captures research findings and technical decisions for implementing the `todoist_labels` MCP tool. Since the codebase already has established patterns and the Todoist API service layer includes label operations, this research focuses on aligning the new tool with existing patterns rather than investigating new technologies.

## Technical Decisions

### 1. Tool Architecture Pattern
**Decision**: Follow existing tool pattern from `todoist-projects.ts`
**Rationale**:
- Labels and projects share similar CRUD operation structure
- Both support create, read, update, delete, list operations
- Projects tool already implements action-based routing with Zod validation
- Consistency reduces cognitive load and maintenance burden

**Alternatives Considered**:
- Tasks tool pattern: Rejected - tasks have more complex operations (move, complete, reopen) not applicable to labels
- Custom pattern: Rejected - violates Constitution principle IV (User Experience Consistency)

**Implementation Notes**:
```typescript
// Pattern from todoist-projects.ts
class TodoistLabelsTool {
  static getToolDefinition(): ToolDefinition
  async execute(params: LabelToolParams): Promise<ToolResponse>
  private async handleCreate(...)
  private async handleGet(...)
  private async handleUpdate(...)
  private async handleDelete(...)
  private async handleList(...)
}
```

### 2. Input Validation Strategy
**Decision**: Use Zod schemas with flattened parameters for MCP compatibility
**Rationale**:
- Zod already used in `src/schemas/validation.ts`
- MCP protocol requires flat parameter structures
- Constitution principle II mandates runtime validation
- Existing tools demonstrate this pattern works well

**Alternatives Considered**:
- io-ts: Rejected - introduces new dependency, team unfamiliar
- Manual validation: Rejected - violates Constitution, error-prone

**Implementation Notes**:
```typescript
const LabelToolInputSchema = z.object({
  action: z.enum(['create', 'get', 'update', 'delete', 'list']),
  label_id: z.string().optional(),
  name: z.string().max(128).optional(),
  color: z.string().optional(),
  order: z.number().optional(),
  is_favorite: z.boolean().optional(),
  cursor: z.string().optional(),
  limit: z.number().min(1).max(200).optional()
});
```

### 3. Shared Label Operations
**Decision**: Implement shared label rename/remove using Todoist Sync API commands
**Rationale**:
- Per clarification session: shared labels operate across all users/projects
- Todoist API documentation shows shared label operations use Sync API
- Existing `sync()` method in TodoistApiService supports batch commands
- FR-010/FR-011 require bulk operations not available in REST API

**Alternatives Considered**:
- REST API loops: Rejected - inefficient, violates performance principle V
- Skip shared labels: Rejected - incomplete FR coverage

**Implementation Notes**:
```typescript
// Using existing sync method pattern
async handleSharedRename(name: string, newName: string) {
  const command = {
    type: 'shared_label_rename',
    args: { name, new_name: newName }
  };
  await this.apiService.sync([command]);
}
```

### 4. Duplicate Label Handling
**Decision**: Return existing label on duplicate name (idempotent behavior)
**Rationale**:
- Per clarification: "Merge with existing label instead of creating new"
- Requires pre-flight check: list labels, match by name
- Falls back to existing label if found, creates new otherwise
- Aligns with REST principles (PUT idempotency)

**Implementation Notes**:
```typescript
async handleCreate(params) {
  // Pre-flight check for existing label
  const existing = await this.findLabelByName(params.name);
  if (existing) {
    return { success: true, data: existing, message: "Label already exists" };
  }
  return this.apiService.createLabel(params);
}
```

### 5. Error Handling Strategy
**Decision**: Use existing `handleToolError` wrapper with specific error codes
**Rationale**:
- Per FR-016: Return "LABEL_NOT_FOUND" with HTTP 404 for non-existent IDs
- Existing error hierarchy supports this (NotFoundError class exists)
- handleToolError already maps Todoist API errors to MCP error codes
- Constitution principle VII requires proper MCP error format

**Implementation Notes**:
- 404 from API → NotFoundError → MCP error with code "LABEL_NOT_FOUND"
- 429 from API → RateLimitError → backoff → MCP error with retry-after
- Validation errors → return before API call with actionable message

### 6. Pagination Implementation
**Decision**: Cursor-based pagination with default 50, max 200 labels per page
**Rationale**:
- Per clarification and FR-005: configurable page size
- Todoist API v1 already returns `{ results: [], next_cursor: string | null }`
- Existing `getTasks()` and `getProjects()` demonstrate this pattern
- Constitution principle V requires memory bounds

**Implementation Notes**:
```typescript
async handleList(params: { cursor?: string; limit?: number }) {
  const limit = params.limit || 50; // default
  if (limit > 200) throw ValidationError("limit must be ≤ 200");

  const response = await this.apiService.getLabels();
  return {
    success: true,
    data: response.results,
    metadata: { next_cursor: response.next_cursor }
  };
}
```

### 7. Rate Limiting Integration
**Decision**: Leverage existing TokenBucketRateLimiter, no changes needed
**Rationale**:
- Per clarification: "Keep current: Return error after backoff delay (no retry)"
- Labels use REST API endpoints → restRateLimiter (1000 req/15min)
- Shared labels use Sync API → syncRateLimiter (100 req/15min)
- Constitution principle I mandates rate limit respect

**No implementation needed** - inherited from TodoistApiService

### 8. Tool Registration
**Decision**: Register in `src/server.ts` initializeTools() following existing pattern
**Rationale**:
- All tools registered in same location for discoverability
- Pattern: instantiate → add to map → add to definitions
- Constitution principle VII requires proper tool definitions

**Implementation Notes**:
```typescript
// In server.ts initializeTools()
const labelsTool = new TodoistLabelsTool(this.apiService);
this.tools.set('todoist_labels', labelsTool);
this.toolDefinitions.push(TodoistLabelsTool.getToolDefinition());
```

## Integration Points

### Existing Infrastructure to Leverage
1. **TodoistApiService** (`src/services/todoist-api.ts`)
   - Methods already exist: `getLabels()`, `getLabel()`, `createLabel()`, `updateLabel()`, `deleteLabel()`
   - Rate limiting built-in
   - Error mapping built-in

2. **Type Definitions** (`src/types/todoist.ts`)
   - `TodoistLabel` interface already defined with all required fields
   - No new types needed

3. **Error Handling** (`src/utils/error-handler.ts`)
   - `handleToolError()` utility for consistent error responses
   - Existing error classes cover all scenarios

4. **Validation** (`src/schemas/validation.ts`)
   - Zod library already imported
   - Existing schemas demonstrate patterns

5. **Testing Helpers** (`tests/helpers/`)
   - `inMemoryTodoistApiService.ts` for contract tests
   - `mockTodoistApiService.ts` for mocking API calls

6. **Caching** (`src/services/cache.ts`)
   - Label cache already exists
   - Can be invalidated on create/update/delete operations

## Risk Mitigation

### Known Risks
1. **Shared Label API Behavior**: Sync API for shared labels less documented
   - Mitigation: Test against real Todoist API in integration tests
   - Fallback: Document limitation if Sync API unavailable

2. **Duplicate Name Detection Performance**: Pre-flight check adds latency
   - Mitigation: Use cached labels if available
   - Accept: Trade-off for idempotency (FR-001 requirement)

3. **Pagination Consistency**: Cursor invalidation on concurrent modifications
   - Mitigation: Document behavior in tool description
   - Accept: Todoist API limitation, not under our control

## References
- Todoist API v1 Documentation: `/docs/todoist-api-v1-documentation.md`
- Existing Tool Patterns: `src/tools/todoist-projects.ts`, `src/tools/todoist-tasks.ts`
- Constitution: `.specify/memory/constitution.md` v1.1.0
- Feature Specification: `specs/002-todoist-labels-tool/spec.md`
- Clarification Session: 2025-10-01 (5 questions resolved)

## Conclusion
All technical decisions align with existing patterns and constitutional requirements. No new dependencies, architectural changes, or infrastructure needed. Implementation is straightforward extension of established patterns with primary effort in comprehensive test coverage (TDD approach per Constitution principle III).
