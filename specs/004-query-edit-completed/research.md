# Phase 0: Research & Technical Decisions

## Overview
This document captures research findings and technical decisions for implementing completed task querying and reopening capabilities in the MCP Todoist server.

## API Endpoint Research

### Decision: Use Todoist REST API v1 Completed Tasks Endpoints
**Rationale**:
- Two dedicated endpoints available:
  - `GET /api/v1/tasks/completed/by_completion_date` - Query by when task was completed (3-month window)
  - `GET /api/v1/tasks/completed/by_due_date` - Query by when task was due (6-week window)
- Both endpoints support cursor-based pagination with configurable limit
- Full filter support: project_id, section_id, workspace_id, parent_id, filter_query, filter_lang
- Response format matches active task format with addition of `completed_at` timestamp

**Alternatives Considered**:
1. **Sync API `/sync/v9/completed/get_all`** - Rejected because:
   - Sync API is deprecated (v9 is final version)
   - Documentation redirects to unified API v1
   - Less flexible filtering options

2. **Cache all completions locally** - Rejected because:
   - Violates API-First Architecture principle
   - Increases complexity and memory requirements
   - Stale data risk

### Decision: Reopen via Existing REST API Uncomplete Endpoint
**Rationale**:
- Existing `POST /api/v1/tasks/{id}/reopen` endpoint already implemented in TodoistApiService
- Returns reopened task with updated state
- Handles recurring tasks correctly (calculates next occurrence)
- No new endpoint integration needed

**Implementation Note**: Reopen functionality already exists in the codebase (`TodoistApiService.reopenTask` and `TodoistTasksTool` uncomplete action). This feature only adds query capability.

##

 Time Window Validation Research

### Decision: Client-Side Validation Before API Call
**Rationale**:
- API returns 400 Bad Request for invalid windows, but client-side validation provides better UX
- Validation rules:
  - Completion date queries: max 3 months (92 days)
  - Due date queries: max 6 weeks (42 days)
- Implement as Zod refinement in schema validation
- Calculate duration using date-fns or built-in Date math

**Calculation Approach**:
```typescript
// Pseudo-logic for validation
const daysDiff = Math.ceil((until - since) / (1000 * 60 * 60 * 24));
if (queryType === 'by_completion_date' && daysDiff > 92) {
  throw new ValidationError('...');
}
if (queryType === 'by_due_date' && daysDiff > 42) {
  throw new ValidationError('...');
}
```

## Tool Design Pattern Research

### Decision: Extend todoist_tasks Tool with list_completed Action
**Rationale**:
- Maintains consistency with existing tool architecture
- Completed tasks are still tasks - logical extension of tasks tool
- Reuses existing task enrichment logic (priority names, metadata)
- Follows pattern: single tool per Todoist resource type

**Alternatives Considered**:
1. **New `todoist_completed_tasks` tool** - Rejected because:
   - Violates DRY (duplicate task handling logic)
   - Adds cognitive load (two tools for tasks)
   - Response format identical to regular tasks

2. **Separate query tool from reopen** - Rejected because:
   - Reopen already exists in todoist_tasks
   - Query results need same task structure

### Action Parameter Design
Add to existing TodoistTasksInput schema:
- `action: 'list_completed'` - new enum value
- `completed_query_type: 'by_completion_date' | 'by_due_date'` - required for list_completed
- `since: string` (ISO 8601) - required for list_completed
- `until: string` (ISO 8601) - required for list_completed
- Reuse existing filter params: `project_id`, `section_id`, `workspace_id`, `parent_id`, `filter_query`, `filter_lang`, `cursor`, `limit`

## Pagination Strategy Research

### Decision: Cursor-Based Pagination (API Native)
**Rationale**:
- API provides `next_cursor` in response
- More reliable than offset pagination for dynamic data
- No manual cursor generation needed - pass through from API
- Consistent with existing pagination patterns in codebase

**Implementation**:
- Accept optional `cursor` parameter in tool input
- Return `next_cursor` in tool response metadata
- Document cursor usage in tool description

## Testing Strategy Research

### Decision: Three-Layer Test Approach
**Rationale**: Matches existing test structure in `tests/` directory

1. **Contract Tests** (`tests/contract/`):
   - Verify tool schema validation
   - Test time window validation logic
   - Mock TodoistApiService responses
   - No actual API calls

2. **Integration Tests** (`tests/integration/`):
   - Test full workflow: query → paginate → filter
   - Verify API service integration
   - Use test Todoist account or mocks
   - Cover edge cases (invalid cursors, permission errors)

3. **Unit Tests** (`tests/unit/`):
   - Date math for time window calculation
   - Schema refinement logic
   - Error message generation

**Mock Data Strategy**:
- Create fixture files with sample completed task responses
- Include various filter scenarios (project, labels, search)
- Cover edge cases (no due date, recurring tasks)

## TypeScript Type Updates

### Decision: Extend Existing Task Types
**Rationale**:
- Completed tasks share same structure as active tasks
- Add `completed_at` field to Task interface
- No new types needed

**Type Additions**:
```typescript
// In src/types/todoist.ts
export interface Task {
  // ... existing fields
  completed_at?: string; // ISO 8601 datetime when task was completed
}

// In src/schemas/validation.ts
export const CompletedQueryTypeSchema = z.enum(['by_completion_date', 'by_due_date']);
export type CompletedQueryType = z.infer<typeof CompletedQueryTypeSchema>;
```

## Performance Considerations

### Decision: No Additional Caching for Completed Tasks
**Rationale**:
- Completed tasks are immutable (cannot change once completed)
- However, users may complete new tasks between queries
- API pagination handles large result sets efficiently
- Caching would require invalidation on any task completion
- Keep it simple: direct API pass-through

**Rate Limiting**:
- Use existing REST rate limiter (300 req/min shared across all endpoints)
- No special rate limiting needed for completed task queries

## Error Handling Strategy

### Decision: Comprehensive Error Mapping
**Rationale**: Provide actionable error messages for all failure modes

**Error Scenarios**:
1. Time window too large → `VALIDATION_ERROR` with specific limit
2. Invalid datetime format → `VALIDATION_ERROR` with ISO 8601 example
3. Missing required params → `VALIDATION_ERROR` listing missing fields
4. Both query types specified → `VALIDATION_ERROR` explaining mutual exclusivity
5. Invalid cursor → `INVALID_CURSOR` from API
6. Permission denied → `FORBIDDEN` from API
7. Rate limit exceeded → `RATE_LIMIT_EXCEEDED` with retry guidance

## Acceptance Criteria Validation

### How Each FR Maps to Implementation:

**Query Requirements (FR-001 to FR-014)**:
- FR-001, FR-002: Enforced by Zod schema refinement
- FR-003: Custom error messages in validation
- FR-004-008, FR-011, FR-013: Pass-through parameters to API
- FR-009, FR-010: Pagination logic in tool handler
- FR-012: API response includes all metadata
- FR-014: Schema validation prevents both query types

**Reopen Requirements (FR-015 to FR-018)**:
- Already implemented via existing `uncomplete` action
- FR-018 enforced by API limitation (no in-place edit endpoints)

**Data Requirements (FR-019 to FR-022)**:
- FR-019: Zod datetime validation
- FR-020: ISO 8601 format via Zod
- FR-021, FR-022: API response structure

**Error Requirements (FR-023 to FR-028)**:
- All mapped to specific ValidationError instances with clear messages

## Open Questions Resolved

1. **Q: How to handle tasks with no due date in due_date queries?**
   A: API excludes them automatically - document in tool description

2. **Q: Should we support both query types simultaneously?**
   A: No - FR-014 makes them mutually exclusive, validated in schema

3. **Q: What happens if user completes tasks during pagination?**
   A: Cursor-based pagination handles this gracefully - new tasks won't appear in current sequence

## Next Steps

Phase 1 will:
1. Define data model for CompletedTaskQuery entity
2. Create API contracts for the two endpoints
3. Generate contract tests
4. Update tool definition and schema
5. Create quickstart guide with example queries
