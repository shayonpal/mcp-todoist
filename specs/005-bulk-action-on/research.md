# Research: Bulk Actions on Tasks

**Date**: 2025-10-02
**Feature**: 005-bulk-action-on
**Status**: Complete

## Todoist Sync API for Batch Operations

### Decision
Use Todoist Sync API v9 (`POST /sync/v9/sync`) with commands array for bulk operations instead of making multiple REST API calls.

### Rationale
1. **Efficiency**: Single API call for up to 100 commands vs 50 individual REST calls
2. **Atomic batching**: Sync API handles commands sequentially with per-command status
3. **Partial execution**: Built-in support for continuing on individual failures
4. **Rate limit optimization**: Sync API allows 50 req/min, sufficient for bulk operations
5. **Native support**: Todoist designed Sync API specifically for batch operations

### Alternatives Considered
- **Multiple REST API calls**: Rejected due to inefficiency (50 separate calls), rate limit consumption (300/min shared with other operations), and lack of atomicity
- **Custom batching layer**: Rejected as reinventing Todoist's native Sync API capabilities
- **GraphQL mutations**: Not available in Todoist API

### Implementation Details

**Endpoint**: `POST https://api.todoist.com/sync/v9/sync`

**Request Structure**:
```json
{
  "commands": [
    {
      "type": "item_update",
      "uuid": "unique-id-1",
      "args": {
        "id": "task-id-1",
        "due": { "string": "tomorrow" },
        "priority": 2
      }
    },
    {
      "type": "item_complete",
      "uuid": "unique-id-2",
      "args": { "id": "task-id-2" }
    }
  ]
}
```

**Response Structure**:
```json
{
  "sync_status": {
    "unique-id-1": "ok",
    "unique-id-2": { "error": "TASK_NOT_FOUND", "error_message": "Task not found" }
  },
  "temp_id_mapping": {},
  "full_sync": false
}
```

**Command Types**:
- `item_update`: Update task fields (maps to our "update" action)
- `item_move`: Move task to different project/section (maps to our "move" action)
- `item_complete`: Mark task as done (maps to our "complete" action)
- `item_uncomplete`: Mark task as not done (maps to our "uncomplete" action)

**Rate Limits**:
- Sync API: 50 requests/minute
- REST API: 300 requests/minute
- Strategy: Use Sync API exclusively for bulk operations to preserve REST API quota

### Integration Points

**TodoistApiService Extension**:
```typescript
// Add to src/services/todoist-api.ts

interface SyncCommand {
  type: 'item_update' | 'item_move' | 'item_complete' | 'item_uncomplete';
  uuid: string;
  args: Record<string, any>;
}

interface SyncResponse {
  sync_status: Record<string, 'ok' | { error: string; error_message: string }>;
  temp_id_mapping: Record<string, string>;
  full_sync: boolean;
}

async executeBatch(commands: SyncCommand[]): Promise<SyncResponse> {
  // Implementation will use axios with existing rate limiter
  // Add separate rate limiter for Sync API (50 req/min)
}
```

**Error Mapping**:
- `TASK_NOT_FOUND` → Individual task failure in results
- `INVALID_ARGUMENT` → Invalid field value for specific task
- `RATE_LIMIT_EXCEEDED` → Retry with backoff (existing mechanism)
- Network errors → Propagate as MCP INTERNAL_ERROR

---

## Bulk Operation Patterns

### Decision
Implement deduplication, field validation, and partial execution with detailed per-task feedback.

### Rationale
1. **Deduplication**: Prevents duplicate API calls and confusing results
2. **Field validation**: Early rejection of disallowed fields (content/description/comments) prevents wasted API calls
3. **Partial execution**: Aligns with spec requirement (FR-010) and provides better UX than all-or-nothing
4. **Per-task feedback**: Enables users to identify and fix specific failures

### Implementation Pattern

**Deduplication**:
```typescript
function deduplicateTaskIds(taskIds: string[]): string[] {
  return Array.from(new Set(taskIds));
}
```

**Validation Strategy**:
```typescript
// Pre-validation (before API call)
- Check task count ≤ 50 (after deduplication)
- Reject if content/description/comments in updates
- Reject if mixing action types

// During execution (per task)
- Todoist validates task ID existence
- Todoist validates field values
- We collect success/failure per task
```

**Partial Execution**:
```typescript
async function executeBulkOperation(
  action: BulkAction,
  taskIds: string[],
  updates: Record<string, any>
): Promise<BulkOperationSummary> {
  const uniqueIds = deduplicateTaskIds(taskIds);
  const commands = uniqueIds.map(id => createCommand(action, id, updates));

  const response = await todoistApi.executeBatch(commands);

  const results: OperationResult[] = commands.map(cmd => ({
    task_id: cmd.args.id,
    success: response.sync_status[cmd.uuid] === 'ok',
    error: response.sync_status[cmd.uuid] !== 'ok'
      ? response.sync_status[cmd.uuid].error_message
      : null,
    resource_uri: `todoist://task/${cmd.args.id}`
  }));

  return {
    total_tasks: uniqueIds.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results
  };
}
```

**Progress Reporting**:
- No streaming (Sync API returns all results at once)
- Summary counts: total, successful, failed
- Individual task results with error details

### Alternatives Considered
- **Pre-validation of all tasks**: Rejected as requires N additional API calls
- **Atomic execution**: Rejected per spec requirement for partial execution
- **Batch size chunking**: Not needed (our 50 limit < Sync API 100 limit)

---

## MCP Tool Design Patterns

### Decision
Follow existing `todoist_tasks` tool pattern with action-based dispatch and flattened parameters.

### Rationale
1. **Consistency**: Matches established codebase patterns
2. **MCP compatibility**: Flattened parameters work better with JSON schema
3. **Maintainability**: Reuses existing error handling, validation, response formatting
4. **Discoverability**: Users familiar with `todoist_tasks` will understand `todoist_bulk_tasks`

### Tool Interface

**Name**: `todoist_bulk_tasks`

**Parameters** (flattened):
```typescript
{
  action: 'update' | 'complete' | 'uncomplete' | 'move';
  task_ids: string[];
  // Optional field updates (for update/move actions)
  project_id?: string;
  section_id?: string;
  parent_id?: string;
  order?: number;
  labels?: string[];
  priority?: number;
  assignee_id?: number;
  due_string?: string;
  due_date?: string;
  due_datetime?: string;
  due_lang?: string;
  duration?: number;
  duration_unit?: string;
  deadline_date?: string;
}
```

**Response Structure**:
```typescript
{
  success: boolean;
  data: {
    total_tasks: number;
    successful: number;
    failed: number;
    results: Array<{
      task_id: string;
      success: boolean;
      error: string | null;
      resource_uri: string;
    }>;
  };
  metadata: {
    deduplication_applied: boolean;
    original_count: number;
  };
}
```

### Error Handling

**MCP Error Codes**:
- `INVALID_PARAMS`: >50 tasks, disallowed fields, missing required params
- `INTERNAL_ERROR`: Todoist API failures, network errors
- `RATE_LIMIT_EXCEEDED`: Sync API rate limit hit (handled by retry mechanism)

**User-Friendly Messages**:
- `"Maximum 50 tasks allowed, received {count}"`
- `"Cannot modify content, description, or comments in bulk operations"`
- `"Bulk operation processed {successful} of {total} tasks successfully. {failed} tasks failed."`

### Alternatives Considered
- **Nested parameters**: Rejected for MCP schema limitations
- **Separate tools per action**: Rejected to avoid tool proliferation
- **Streaming responses**: Not supported by Sync API

---

## Integration with Existing Codebase

### TodoistApiService Extension

**Add Sync API Support**:
- New method: `executeBatch(commands: SyncCommand[]): Promise<SyncResponse>`
- New rate limiter: `syncApiLimiter` (50 req/min, separate from REST limiter)
- Reuse: Axios instance, token management, error interceptors

**Token Usage**:
```typescript
headers: {
  'Authorization': `Bearer ${this.apiToken}`,
  'Content-Type': 'application/json'
}
```

### Validation Schemas

**Reuse Existing**:
- Task field validators from `src/schemas/validation.ts`
- Priority enum (1-4)
- Date format validators

**Add New**:
```typescript
// src/schemas/validation.ts

export const bulkActionSchema = z.enum(['update', 'complete', 'uncomplete', 'move']);

export const bulkOperationInputSchema = z.object({
  action: bulkActionSchema,
  task_ids: z.array(z.string()).min(1).max(50),
  // Field updates (all optional)
  project_id: z.string().optional(),
  section_id: z.string().optional(),
  // ... other fields
}).refine(
  (data) => {
    // Validation: no content/description/comments
    const disallowed = ['content', 'description'];
    return !disallowed.some(field => field in data);
  },
  { message: 'Cannot modify content, description, or comments in bulk' }
);
```

### Error Mapping

**Reuse `mapTodoistErrorToMCP()`**:
- Existing: 400 → INVALID_PARAMS, 429 → retry, 500 → INTERNAL_ERROR
- Add: Sync API specific errors (TASK_NOT_FOUND, INVALID_ARGUMENT)

### Test Infrastructure

**Reuse**:
- `InMemoryTodoistApiService` from `tests/helpers/` (extend with `executeBatch` mock)
- Test utilities for creating mock tasks, projects
- Assertion helpers for MCP response structure

**Add**:
- Mock Sync API responses (success, partial failure, rate limit)
- Bulk operation test fixtures (5, 20, 50 tasks)

---

## Performance Considerations

### Benchmarks

**Target**: <2 seconds for 50-task bulk operation

**Breakdown**:
- Network latency: ~100-300ms (typical API RTT)
- Sync API processing: ~1-1.5s (Todoist server-side batch execution)
- Our processing: <100ms (deduplication, command generation, result mapping)
- Total: ~1.2-1.9s (within target)

**Monitoring**:
- Log execution time per bulk operation
- Track Sync API response times
- Alert if p95 > 2s

### Memory Bounds

**Calculation**:
- 50 tasks × ~2KB per result = ~100KB peak
- Command generation: 50 × ~500 bytes = ~25KB
- Total: ~125KB (negligible for Node.js)

**No streaming needed**: Response size well within memory limits

### Rate Limit Strategy

**Sync API Limiter**:
- Capacity: 50 tokens
- Refill: ~0.83 tokens/second (50/60)
- Separate from REST API limiter (300/min)

**Handling 429**:
- Retry with exponential backoff (existing mechanism)
- Max retries: 3
- Backoff: 1s, 2s, 4s

---

## Security & Audit

### Token Handling
- Reuse existing `process.env.TODOIST_API_TOKEN` management
- No token in logs (existing sanitization applies)

### Audit Logging

**Log Format**:
```typescript
{
  timestamp: '2025-10-02T10:30:00Z',
  operation: 'bulk_operation',
  action: 'update',
  task_count: 25,
  successful: 23,
  failed: 2,
  user: 'system', // MCP server has no user context
  execution_time_ms: 1234
}
```

**What NOT to Log**:
- Task content/titles
- Full task payloads
- User data beyond operation counts

---

## Summary

All research questions resolved. Implementation approach:

1. **Use Todoist Sync API** for efficient batch operations (1 call vs 50)
2. **Extend TodoistApiService** with `executeBatch()` method
3. **Follow existing patterns** from `todoist_tasks` tool (action dispatch, flattened params)
4. **Implement deduplication** and partial execution per spec requirements
5. **Reuse validation** schemas and error mapping from existing codebase
6. **Add separate rate limiter** for Sync API (50 req/min)
7. **Comprehensive testing** with contract, integration, and unit tests

**No blocking unknowns remain**. Ready for Phase 1: Design & Contracts.
