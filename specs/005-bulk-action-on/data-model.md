# Data Model: Bulk Actions on Tasks

**Feature**: 005-bulk-action-on
**Date**: 2025-10-02
**Status**: Complete

## Core Entities

### BulkOperationInput

Input schema for the `todoist_bulk_tasks` MCP tool.

**TypeScript Interface**:
```typescript
interface BulkOperationInput {
  action: 'update' | 'complete' | 'uncomplete' | 'move';
  task_ids: string[]; // 1-50 items, will be deduplicated

  // Optional field updates (for update/move actions only)
  project_id?: string;
  section_id?: string;
  parent_id?: string;
  order?: number;
  labels?: string[];
  priority?: number; // 1-4
  assignee_id?: number;
  due_string?: string; // Natural language: "tomorrow", "every Monday"
  due_date?: string; // YYYY-MM-DD
  due_datetime?: string; // ISO 8601
  due_lang?: string; // Language code: "en", "es", etc.
  duration?: number;
  duration_unit?: 'minute' | 'day';
  deadline_date?: string; // YYYY-MM-DD
}
```

**Validation Rules**:
1. `task_ids` array must contain 1-50 elements (after deduplication)
2. `action` must be one of the four allowed values
3. Field updates only apply to `update` and `move` actions
4. The following fields are **NOT** allowed: `content`, `description`, `comments`
5. Cannot mix different action types in a single request
6. `priority` must be between 1-4 if provided
7. Date fields must follow specified formats

**Zod Schema** (to be implemented in `src/schemas/validation.ts`):
```typescript
import { z } from 'zod';

export const bulkActionEnum = z.enum(['update', 'complete', 'uncomplete', 'move']);

export const bulkOperationInputSchema = z.object({
  action: bulkActionEnum,
  task_ids: z.array(z.string()).min(1).max(50),

  // Optional updates
  project_id: z.string().optional(),
  section_id: z.string().optional(),
  parent_id: z.string().optional(),
  order: z.number().optional(),
  labels: z.array(z.string()).optional(),
  priority: z.number().min(1).max(4).optional(),
  assignee_id: z.number().optional(),
  due_string: z.string().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  due_datetime: z.string().datetime().optional(),
  due_lang: z.string().optional(),
  duration: z.number().optional(),
  duration_unit: z.enum(['minute', 'day']).optional(),
  deadline_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine(
  (data) => {
    // Ensure no disallowed fields
    const disallowed = ['content', 'description', 'comments'];
    return !disallowed.some(field => field in data);
  },
  { message: 'Cannot modify content, description, or comments in bulk operations' }
);
```

---

### OperationResult

Represents the outcome for a single task within a bulk operation.

**TypeScript Interface**:
```typescript
interface OperationResult {
  task_id: string;
  success: boolean;
  error: string | null; // Error message if success=false
  resource_uri: string; // Format: "todoist://task/{id}"
}
```

**Properties**:
- `task_id`: The Todoist task ID that was operated on
- `success`: `true` if operation succeeded, `false` if failed
- `error`: Human-readable error message (null if successful)
- `resource_uri`: MCP-compliant resource URI for the task

**Example Successful Result**:
```json
{
  "task_id": "7654321",
  "success": true,
  "error": null,
  "resource_uri": "todoist://task/7654321"
}
```

**Example Failed Result**:
```json
{
  "task_id": "9999999",
  "success": false,
  "error": "Task not found",
  "resource_uri": "todoist://task/9999999"
}
```

---

### BulkOperationSummary

Aggregated results for an entire bulk operation.

**TypeScript Interface**:
```typescript
interface BulkOperationSummary {
  total_tasks: number; // Count after deduplication
  successful: number;
  failed: number;
  results: OperationResult[];
}
```

**Properties**:
- `total_tasks`: Number of unique tasks processed (after deduplication)
- `successful`: Count of tasks that completed successfully
- `failed`: Count of tasks that failed
- `results`: Array of individual task results (length = total_tasks)

**Invariant**: `successful + failed === total_tasks === results.length`

**Example Response**:
```json
{
  "total_tasks": 20,
  "successful": 18,
  "failed": 2,
  "results": [
    { "task_id": "1", "success": true, "error": null, "resource_uri": "todoist://task/1" },
    { "task_id": "2", "success": false, "error": "Invalid priority value", "resource_uri": "todoist://task/2" },
    // ... 18 more results
  ]
}
```

---

### MCP Tool Response

Standard MCP response structure for the `todoist_bulk_tasks` tool.

**TypeScript Interface**:
```typescript
interface BulkTasksResponse {
  success: boolean; // Overall operation status
  data: BulkOperationSummary;
  metadata?: {
    deduplication_applied: boolean;
    original_count: number; // Before deduplication
    deduplicated_count: number; // After deduplication
    execution_time_ms: number;
  };
}
```

**Success Condition**: Operation completes (even with partial failures)
**Failure Condition**: Pre-validation errors (>50 tasks, disallowed fields, etc.)

**Example Full Success**:
```json
{
  "success": true,
  "data": {
    "total_tasks": 5,
    "successful": 5,
    "failed": 0,
    "results": [ /* 5 successful results */ ]
  },
  "metadata": {
    "deduplication_applied": false,
    "original_count": 5,
    "deduplicated_count": 5,
    "execution_time_ms": 842
  }
}
```

**Example Partial Success**:
```json
{
  "success": true,
  "data": {
    "total_tasks": 20,
    "successful": 17,
    "failed": 3,
    "results": [ /* 17 successful + 3 failed results */ ]
  },
  "metadata": {
    "deduplication_applied": true,
    "original_count": 22,
    "deduplicated_count": 20,
    "execution_time_ms": 1456
  }
}
```

**Example Pre-Validation Failure**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMS",
    "message": "Maximum 50 tasks allowed, received 75"
  }
}
```

---

## Todoist Sync API Entities

### SyncCommand

Command object sent to Todoist Sync API.

**TypeScript Interface**:
```typescript
interface SyncCommand {
  type: 'item_update' | 'item_move' | 'item_complete' | 'item_uncomplete';
  uuid: string; // Unique identifier for tracking
  args: Record<string, any>; // Command-specific arguments
  temp_id?: string; // For creating new items (not used in bulk ops)
}
```

**Command Type Mapping**:
- `update` action → `item_update` command
- `move` action → `item_move` command (can also be `item_update` with project/section)
- `complete` action → `item_complete` command
- `uncomplete` action → `item_uncomplete` command

**Example item_update Command**:
```json
{
  "type": "item_update",
  "uuid": "cmd-1-task-7654321",
  "args": {
    "id": "7654321",
    "due": { "string": "tomorrow" },
    "priority": 2,
    "labels": ["urgent", "work"]
  }
}
```

**Example item_complete Command**:
```json
{
  "type": "item_complete",
  "uuid": "cmd-2-task-7654322",
  "args": {
    "id": "7654322"
  }
}
```

---

### SyncResponse

Response from Todoist Sync API.

**TypeScript Interface**:
```typescript
interface SyncResponse {
  sync_status: Record<string, 'ok' | SyncError>;
  temp_id_mapping: Record<string, string>; // Not used for bulk ops
  full_sync: boolean; // Always false for command-only requests
}

interface SyncError {
  error: string; // Error code: "TASK_NOT_FOUND", "INVALID_ARGUMENT", etc.
  error_message: string; // Human-readable error
  error_code?: number; // HTTP-style error code
}
```

**Example Success Response**:
```json
{
  "sync_status": {
    "cmd-1-task-7654321": "ok",
    "cmd-2-task-7654322": "ok",
    "cmd-3-task-7654323": "ok"
  },
  "temp_id_mapping": {},
  "full_sync": false
}
```

**Example Partial Failure Response**:
```json
{
  "sync_status": {
    "cmd-1-task-7654321": "ok",
    "cmd-2-task-9999999": {
      "error": "TASK_NOT_FOUND",
      "error_message": "Task not found",
      "error_code": 404
    },
    "cmd-3-task-7654323": "ok"
  },
  "temp_id_mapping": {},
  "full_sync": false
}
```

---

## State Transitions

### Bulk Operation Lifecycle

```
1. INPUT VALIDATION
   ↓
   Pre-validate input schema
   ├─ Invalid → Reject with INVALID_PARAMS
   └─ Valid → Continue
      ↓
2. DEDUPLICATION
   ↓
   Remove duplicate task IDs
   ├─ After dedup: >50 tasks → Reject
   └─ ≤50 tasks → Continue
      ↓
3. COMMAND GENERATION
   ↓
   Generate Sync API commands
      ↓
4. API EXECUTION
   ↓
   Call Todoist Sync API
   ├─ Network error → Retry (up to 3x)
   ├─ 429 Rate limit → Backoff and retry
   └─ Success → Parse response
      ↓
5. RESULT MAPPING
   ↓
   Map sync_status to OperationResults
   ├─ "ok" → success: true
   └─ Error object → success: false, error: message
      ↓
6. RESPONSE CONSTRUCTION
   ↓
   Build BulkOperationSummary
   Calculate counts (successful/failed)
   Add metadata
   Return to MCP client
```

### Task State Transitions (per action)

**Update Action**:
- Task state: Any → Same state (only fields updated)
- Allowed for: Active tasks, completed tasks (some fields)

**Complete Action**:
- Task state: Active → Completed
- Idempotent: Completing already-completed task = no-op

**Uncomplete Action**:
- Task state: Completed → Active
- Reopens previously completed task

**Move Action**:
- Task state: Same state
- Changes: project_id, section_id, and/or parent_id

---

## Error Taxonomy

### Pre-Validation Errors (MCP Layer)

| Error Code | Condition | Message |
|------------|-----------|---------|
| INVALID_PARAMS | >50 unique tasks | "Maximum 50 tasks allowed, received {count}" |
| INVALID_PARAMS | Disallowed field | "Cannot modify content, description, or comments in bulk operations" |
| INVALID_PARAMS | Empty task_ids | "At least one task ID required" |
| INVALID_PARAMS | Invalid action | "Action must be one of: update, complete, uncomplete, move" |
| INVALID_PARAMS | Invalid priority | "Priority must be between 1-4" |

### Execution Errors (Todoist API)

| Todoist Error | HTTP Code | Maps to OperationResult.error |
|---------------|-----------|-------------------------------|
| TASK_NOT_FOUND | 404 | "Task not found" |
| INVALID_ARGUMENT | 400 | "Invalid field value: {details}" |
| FORBIDDEN | 403 | "Insufficient permissions for this task" |
| INTERNAL_ERROR | 500 | "Todoist service error" |

### System Errors (Network/Infrastructure)

| Scenario | Handling |
|----------|----------|
| Network timeout | Retry up to 3 times with exponential backoff |
| 429 Rate limit | Retry with Retry-After header delay |
| 500/502/503 | Retry up to 3 times |
| Other 5xx | Return INTERNAL_ERROR after retries exhausted |

---

## Validation Rules Summary

### Input Validation (Pre-API Call)

1. **Task Count**: 1 ≤ unique task_ids ≤ 50
2. **Action Type**: Must be valid enum value
3. **Field Exclusions**: No content, description, or comments
4. **Single Action**: All tasks get same action type
5. **Field Applicability**: Update fields only for update/move actions
6. **Priority Range**: 1-4 if provided
7. **Date Formats**: YYYY-MM-DD for date fields, ISO 8601 for datetime

### Runtime Validation (During Execution)

1. **Task Existence**: Todoist validates task ID
2. **Field Values**: Todoist validates field-specific rules
3. **Permissions**: Todoist checks user can modify task
4. **Deduplication**: System removes duplicate IDs before API call

---

## Performance Characteristics

### Memory Footprint

- **Input**: 50 tasks × ~100 bytes/ID = ~5 KB
- **Commands**: 50 × ~500 bytes = ~25 KB
- **Response**: 50 × ~2 KB = ~100 KB
- **Total Peak**: ~130 KB (negligible)

### Latency Budget

- **Deduplication**: O(n) with Set, ~1ms for 50 items
- **Command generation**: O(n), ~5ms for 50 items
- **API call**: ~1-1.5s (network + Todoist processing)
- **Result mapping**: O(n), ~10ms for 50 items
- **Total**: ~1.5-2s for 50 tasks (within target)

### Scalability

- **Horizontal**: N/A (stateless operation, no data persistence)
- **Vertical**: Memory-bounded at ~130 KB, CPU negligible
- **Rate Limits**: 50 Sync API calls/min = 2500 tasks/min theoretical max

---

## Summary

Three core entities define the bulk operations data model:

1. **BulkOperationInput**: MCP tool input with action, task IDs, and field updates
2. **OperationResult**: Per-task outcome with success/failure and error details
3. **BulkOperationSummary**: Aggregated results with counts and full result list

Additional internal entities:

4. **SyncCommand**: Todoist Sync API command format
5. **SyncResponse**: Todoist Sync API response with per-command status

Validation occurs in two phases: pre-validation (count, disallowed fields) and runtime (Todoist validates task existence and field values). Partial execution is supported with per-task error tracking.

All entities use TypeScript interfaces with Zod schemas for runtime validation.
