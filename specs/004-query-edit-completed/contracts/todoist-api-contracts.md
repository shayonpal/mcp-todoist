# Todoist API Contracts for Completed Tasks

## Endpoint 1: Get Completed Tasks by Completion Date

### Request

**Method**: `GET`
**Path**: `/api/v1/tasks/completed/by_completion_date`
**Base URL**: `https://api.todoist.com`

#### Query Parameters

| Parameter | Type | Required | Format | Description |
|-----------|------|----------|--------|-------------|
| `since` | string | Yes | ISO 8601 datetime | Start of time window (inclusive) |
| `until` | string | Yes | ISO 8601 datetime | End of time window (inclusive), max 3 months from `since` |
| `project_id` | string | No | Todoist project ID | Filter to specific project |
| `section_id` | string | No | Todoist section ID | Filter to specific section |
| `workspace_id` | integer | No | Workspace ID | Filter to specific workspace |
| `parent_id` | string | No | Task ID | Filter to subtasks of parent |
| `filter_query` | string | No | Todoist filter syntax | Advanced filter (e.g., "@Work & p1") |
| `filter_lang` | string | No | Language code | Language for parsing filter (default: "en") |
| `cursor` | string | No | Opaque token | Pagination cursor from previous response |
| `limit` | integer | No | 1-200 | Results per page (default: 50) |

#### Headers

```http
Authorization: Bearer {TODOIST_API_TOKEN}
Content-Type: application/json
```

### Response

#### Success (200 OK)

```json
{
  "items": [
    {
      "user_id": "string",
      "id": "string",
      "project_id": "string",
      "section_id": "string" | null,
      "parent_id": "string" | null,
      "added_by_uid": "string",
      "assigned_by_uid": "string" | null,
      "responsible_uid": "string" | null,
      "labels": ["string"],
      "deadline": { "property1": "string", "property2": "string" } | null,
      "duration": { "property1": 0, "property2": 0 } | null,
      "checked": true,
      "is_deleted": false,
      "added_at": "string (ISO 8601)",
      "completed_at": "string (ISO 8601)",
      "updated_at": "string (ISO 8601)",
      "due": { /* due date object */ } | null,
      "priority": 1 | 2 | 3 | 4,
      "child_order": 0,
      "content": "string",
      "description": "string",
      "note_count": 0,
      "day_order": -1,
      "is_collapsed": false
    }
  ],
  "next_cursor": "string" | null
}
```

#### Error Responses

**400 Bad Request** - Invalid parameters
```json
{
  "error": "Bad Request",
  "message": "Time window exceeds 3 months limit"
}
```

**401 Unauthorized** - Invalid or missing API token
```json
{
  "error": "Unauthorized"
}
```

**403 Forbidden** - Access denied to resource
```json
{
  "error": "Forbidden",
  "message": "You don't have permission to access this project"
}
```

**404 Not Found** - Resource not found
```json
{
  "error": "Not Found",
  "message": "Project not found"
}
```

**429 Too Many Requests** - Rate limit exceeded
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded"
}
```

### Contract Tests

1. **Valid request with required params only**
   - Given: since="2025-09-01T00:00:00Z", until="2025-10-01T23:59:59Z"
   - Expected: 200 response with items array and optional next_cursor

2. **Valid request with project filter**
   - Given: Required params + project_id
   - Expected: 200 response, all items have matching project_id

3. **Valid request with filter query**
   - Given: Required params + filter_query="@Work"
   - Expected: 200 response, all items have "Work" label

4. **Time window exactly 3 months**
   - Given: since="2025-07-01T00:00:00Z", until="2025-10-01T00:00:00Z"
   - Expected: 200 response (at boundary)

5. **Time window exceeds 3 months**
   - Given: since="2025-06-01T00:00:00Z", until="2025-10-01T00:00:00Z"
   - Expected: 400 Bad Request

6. **Invalid datetime format**
   - Given: since="2025-09-01", until="2025-10-01"
   - Expected: 400 Bad Request

7. **Missing required parameter (since)**
   - Given: until="2025-10-01T00:00:00Z" only
   - Expected: 400 Bad Request

8. **Until before since**
   - Given: since="2025-10-01T00:00:00Z", until="2025-09-01T00:00:00Z"
   - Expected: 400 Bad Request

9. **Pagination with cursor**
   - Given: Valid params + cursor from previous response
   - Expected: 200 response with next page of results

10. **Custom limit**
    - Given: Valid params + limit=10
    - Expected: 200 response with max 10 items

---

## Endpoint 2: Get Completed Tasks by Due Date

### Request

**Method**: `GET`
**Path**: `/api/v1/tasks/completed/by_due_date`
**Base URL**: `https://api.todoist.com`

#### Query Parameters

| Parameter | Type | Required | Format | Description |
|-----------|------|----------|--------|-------------|
| `since` | string | Yes | ISO 8601 datetime | Start of time window (inclusive) |
| `until` | string | Yes | ISO 8601 datetime | End of time window (inclusive), max 6 weeks from `since` |
| `project_id` | string | No | Todoist project ID | Filter to specific project |
| `section_id` | string | No | Todoist section ID | Filter to specific section |
| `workspace_id` | integer | No | Workspace ID | Filter to specific workspace |
| `parent_id` | string | No | Task ID | Filter to subtasks of parent |
| `filter_query` | string | No | Todoist filter syntax | Advanced filter (e.g., "@Work & p1") |
| `filter_lang` | string | No | Language code | Language for parsing filter (default: "en") |
| `cursor` | string | No | Opaque token | Pagination cursor from previous response |
| `limit` | integer | No | 1-200 | Results per page (default: 50) |

#### Headers

```http
Authorization: Bearer {TODOIST_API_TOKEN}
Content-Type: application/json
```

### Response

#### Success (200 OK)

Same format as completion date endpoint above.

#### Error Responses

Same error codes and formats as completion date endpoint, except:

**400 Bad Request** - Time window specific message
```json
{
  "error": "Bad Request",
  "message": "Time window exceeds 6 weeks limit"
}
```

### Contract Tests

1. **Valid request with required params only**
   - Given: since="2025-09-15T00:00:00Z", until="2025-10-01T23:59:59Z"
   - Expected: 200 response with items array

2. **Time window exactly 6 weeks**
   - Given: since="2025-08-20T00:00:00Z", until="2025-10-01T00:00:00Z"
   - Expected: 200 response (at boundary)

3. **Time window exceeds 6 weeks**
   - Given: since="2025-08-01T00:00:00Z", until="2025-10-01T00:00:00Z"
   - Expected: 400 Bad Request

4. **Tasks with no due date excluded**
   - Given: Valid params for query
   - Expected: 200 response, no tasks with due=null

5. **Recurring task due dates handled**
   - Given: Valid params including recurring completed tasks
   - Expected: 200 response, tasks show original due date

---

## MCP Tool Contract

### Tool Name: todoist_tasks

### Action: list_completed

#### Input Schema

```json
{
  "action": "list_completed",
  "completed_query_type": "by_completion_date" | "by_due_date",
  "since": "ISO 8601 datetime string",
  "until": "ISO 8601 datetime string",
  "project_id": "string (optional)",
  "section_id": "string (optional)",
  "workspace_id": "number (optional)",
  "parent_id": "string (optional)",
  "filter_query": "string (optional)",
  "filter_lang": "string (optional, default: en)",
  "cursor": "string (optional)",
  "limit": "number (optional, 1-200, default: 50)"
}
```

#### Output Schema

```json
{
  "success": true,
  "data": {
    "items": [/* CompletedTask[] */],
    "next_cursor": "string | null"
  },
  "message": "Retrieved N completed tasks",
  "metadata": {
    "operation_time": 123,
    "rate_limit_remaining": 999,
    "rate_limit_reset": "ISO 8601 datetime"
  }
}
```

#### Error Schema

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR | API_ERROR | RATE_LIMIT_EXCEEDED",
    "message": "Human-readable error message",
    "details": { /* context-specific error details */ }
  }
}
```

### Tool Contract Tests

1. **list_completed with completion_date query**
   - Input: {action: "list_completed", completed_query_type: "by_completion_date", since: "...", until: "..."}
   - Expected: success=true, items array returned

2. **list_completed with due_date query**
   - Input: {action: "list_completed", completed_query_type: "by_due_date", since: "...", until: "..."}
   - Expected: success=true, items array returned

3. **Time window validation for completion_date (>92 days)**
   - Input: 4-month window with by_completion_date
   - Expected: success=false, VALIDATION_ERROR, message mentions "3 months"

4. **Time window validation for due_date (>42 days)**
   - Input: 8-week window with by_due_date
   - Expected: success=false, VALIDATION_ERROR, message mentions "6 weeks"

5. **Missing required parameter**
   - Input: action without since parameter
   - Expected: success=false, VALIDATION_ERROR listing missing field

6. **Invalid datetime format**
   - Input: since="2025-09-01" (missing time)
   - Expected: success=false, VALIDATION_ERROR with ISO 8601 example

7. **Pagination workflow**
   - Input: First call with limit=10
   - Expected: success=true, next_cursor present if more results
   - Input: Second call with cursor from first response
   - Expected: success=true, different items

8. **Filter combinations**
   - Input: project_id + filter_query
   - Expected: success=true, all results match both filters

9. **Empty results**
   - Input: Valid params with no matching tasks
   - Expected: success=true, items=[], next_cursor=null

10. **Rate limit exceeded**
    - Input: After exhausting rate limit
    - Expected: success=false, RATE_LIMIT_EXCEEDED, metadata.rate_limit_reset present
