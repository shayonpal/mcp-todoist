# Quickstart: Querying & Reopening Completed Tasks

## Overview

This guide demonstrates how to use the MCP Todoist server to query completed tasks and reopen them when needed.

## Prerequisites

- MCP Todoist server installed and configured
- Valid Todoist API token in environment variables
- At least one completed task in your Todoist account

## Basic Usage

### 1. Query Completed Tasks by Completion Date

Retrieve tasks completed in the last 7 days:

```json
{
  "action": "list_completed",
  "completed_query_type": "by_completion_date",
  "since": "2025-09-25T00:00:00Z",
  "until": "2025-10-02T23:59:59Z"
}
```

**Expected Result**:
- Success response with array of completed tasks
- Each task includes `completed_at` timestamp
- Metadata shows operation time and rate limits

### 2. Query Completed Tasks by Due Date

Retrieve tasks that were due in September and have been completed:

```json
{
  "action": "list_completed",
  "completed_query_type": "by_due_date",
  "since": "2025-09-01T00:00:00Z",
  "until": "2025-09-30T23:59:59Z"
}
```

**Expected Result**:
- Only tasks with a due date in September range
- Tasks with no due date are excluded
- Max 6-week window enforced

### 3. Filter by Project

Get completed tasks from your "Work" project:

```json
{
  "action": "list_completed",
  "completed_query_type": "by_completion_date",
  "since": "2025-09-01T00:00:00Z",
  "until": "2025-10-02T23:59:59Z",
  "project_id": "2345678901"
}
```

**Expected Result**:
- All returned tasks belong to the specified project
- Other filters still apply

### 4. Filter by Labels and Priority

Get high-priority work tasks completed this month:

```json
{
  "action": "list_completed",
  "completed_query_type": "by_completion_date",
  "since": "2025-10-01T00:00:00Z",
  "until": "2025-10-02T23:59:59Z",
  "filter_query": "@Work & p1"
}
```

**Expected Result**:
- Tasks have "Work" label AND priority 4 (p1 = highest)
- Demonstrates Todoist filter syntax support

### 5. Search Completed Tasks

Find completed tasks containing "meeting notes":

```json
{
  "action": "list_completed",
  "completed_query_type": "by_completion_date",
  "since": "2025-09-01T00:00:00Z",
  "until": "2025-10-02T23:59:59Z",
  "filter_query": "search: meeting notes"
}
```

**Expected Result**:
- Tasks with "meeting notes" in content or description
- Case-insensitive search

### 6. Paginate Through Results

First page (10 results):

```json
{
  "action": "list_completed",
  "completed_query_type": "by_completion_date",
  "since": "2025-09-01T00:00:00Z",
  "until": "2025-10-02T23:59:59Z",
  "limit": 10
}
```

**Expected Result**:
- Up to 10 tasks returned
- `next_cursor` present in response if more results available

Second page (using cursor):

```json
{
  "action": "list_completed",
  "completed_query_type": "by_completion_date",
  "since": "2025-09-01T00:00:00Z",
  "until": "2025-10-02T23:59:59Z",
  "limit": 10,
  "cursor": "eyJwYWdlIjoyLCJsYXN0X2lkIjoiODc2NTQzMjEwOSJ9"
}
```

**Expected Result**:
- Next 10 tasks returned
- Different task IDs than first page

### 7. Reopen a Completed Task

First, query to find the task, then reopen it:

```json
{
  "action": "uncomplete",
  "task_id": "8765432109"
}
```

**Expected Result**:
- Task returns to active status
- `completed_at` timestamp removed
- Task no longer appears in completed queries
- Can now edit using `update` action

### 8. Edit a Completed Task (Reopen → Edit → Recomplete)

Complete workflow:

**Step 1: Reopen**
```json
{
  "action": "uncomplete",
  "task_id": "8765432109"
}
```

**Step 2: Edit (now that it's active)**
```json
{
  "action": "update",
  "task_id": "8765432109",
  "content": "Updated task title",
  "labels": ["Work", "Updated"]
}
```

**Step 3: Recomplete (optional)**
```json
{
  "action": "complete",
  "task_id": "8765432109"
}
```

## Error Scenarios

### Time Window Too Large (Completion Date)

```json
{
  "action": "list_completed",
  "completed_query_type": "by_completion_date",
  "since": "2025-06-01T00:00:00Z",
  "until": "2025-10-02T23:59:59Z"
}
```

**Expected Error**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Time window exceeds 92 days maximum for completion date queries"
  }
}
```

### Time Window Too Large (Due Date)

```json
{
  "action": "list_completed",
  "completed_query_type": "by_due_date",
  "since": "2025-08-01T00:00:00Z",
  "until": "2025-10-02T23:59:59Z"
}
```

**Expected Error**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Time window exceeds 42 days maximum for due date queries"
  }
}
```

### Invalid Datetime Format

```json
{
  "action": "list_completed",
  "completed_query_type": "by_completion_date",
  "since": "2025-09-01",
  "until": "2025-10-02"
}
```

**Expected Error**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Datetime must be in ISO 8601 format (e.g., 2025-10-01T00:00:00Z)"
  }
}
```

### Missing Required Parameter

```json
{
  "action": "list_completed",
  "completed_query_type": "by_completion_date",
  "since": "2025-09-01T00:00:00Z"
}
```

**Expected Error**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Missing required parameter: until"
  }
}
```

## Performance Tips

1. **Use Appropriate Time Windows**
   - Smaller windows = faster queries
   - Default to last 7-30 days for common use cases

2. **Leverage Pagination**
   - Use `limit` to control result set size
   - Process pages incrementally rather than fetching all at once

3. **Combine Filters Effectively**
   - `project_id` + `filter_query` narrows results efficiently
   - Reduces data transfer and processing time

4. **Cache Immutable Results**
   - Completed tasks don't change (unless reopened)
   - Safe to cache query results locally

## Common Use Cases

### Weekly Productivity Report

```json
{
  "action": "list_completed",
  "completed_query_type": "by_completion_date",
  "since": "2025-09-25T00:00:00Z",
  "until": "2025-10-02T23:59:59Z",
  "filter_query": "!@Personal"
}
```

Returns all work-related tasks completed this week.

### Overdue Tasks That Were Eventually Completed

```json
{
  "action": "list_completed",
  "completed_query_type": "by_due_date",
  "since": "2025-09-01T00:00:00Z",
  "until": "2025-09-15T23:59:59Z"
}
```

Compare `due.date` with `completed_at` to identify late completions.

### Project Retrospective

```json
{
  "action": "list_completed",
  "completed_query_type": "by_completion_date",
  "since": "2025-07-01T00:00:00Z",
  "until": "2025-09-30T23:59:59Z",
  "project_id": "2345678901"
}
```

Review all tasks completed in a project over Q3.

## Validation Checklist

After implementing, verify:

- [ ] Can query completed tasks by completion date (7-day window)
- [ ] Can query completed tasks by due date (6-week window)
- [ ] Time window validation rejects 4-month completion date query
- [ ] Time window validation rejects 8-week due date query
- [ ] Project filter returns only matching project tasks
- [ ] Label filter (@Work) returns only labeled tasks
- [ ] Search filter finds tasks by content
- [ ] Pagination returns different results per page
- [ ] Cursor advances through multi-page results
- [ ] Can reopen a completed task
- [ ] Reopened task no longer in completed queries
- [ ] Can edit reopened task
- [ ] Invalid datetime format returns clear error
- [ ] Missing required param returns clear error
- [ ] Rate limit exceeded returns retry guidance

## Next Steps

- Implement scheduled queries for daily/weekly reports
- Build analytics dashboard from completed task data
- Create automated task cleanup workflows
- Integrate with time tracking systems
