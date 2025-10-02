# Bulk Operations Quickstart Guide

**Feature**: 005-bulk-action-on
**Date**: 2025-10-02
**Status**: Complete

## Prerequisites

Before starting this quickstart, ensure you have:

1. **MCP Todoist Server Running**
   - Server configured with valid `TODOIST_API_TOKEN`
   - Server accessible via MCP client (e.g., Claude Code, MCP Inspector)

2. **Test Tasks in Todoist**
   - At least 10 active tasks in your Todoist account
   - At least 2 projects (for testing move operations)
   - Tasks should have different states (some with due dates, some without)

3. **Tools to Verify Results**
   - Access to Todoist web/mobile app to verify changes
   - Or use `todoist_tasks` tool with `action: "list"` to check results

## Quick Reference

### Available Actions
- `update` - Modify task fields (due date, priority, labels, etc.)
- `complete` - Mark tasks as done
- `uncomplete` - Reopen completed tasks
- `move` - Change project/section/parent

### Limits
- Maximum 50 unique tasks per operation
- Duplicate task IDs automatically removed
- Partial execution (continues on individual failures)

### Excluded Fields
Cannot bulk modify: `content` (title), `description`, `comments`

---

## Test 1: Bulk Update Due Dates

**Objective**: Update due dates for 5 tasks to "tomorrow"

### Step 1: Get Task IDs

```json
{
  "tool": "todoist_tasks",
  "action": "list",
  "limit": 5
}
```

**Expected Output**: List of 5 tasks with their IDs

**Note the task IDs** - you'll use them in the next step (e.g., `["7654321", "7654322", "7654323", "7654324", "7654325"]`)

### Step 2: Bulk Update

```json
{
  "tool": "todoist_bulk_tasks",
  "action": "update",
  "task_ids": ["7654321", "7654322", "7654323", "7654324", "7654325"],
  "due_string": "tomorrow"
}
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "total_tasks": 5,
    "successful": 5,
    "failed": 0,
    "results": [
      { "task_id": "7654321", "success": true, "error": null, "resource_uri": "todoist://task/7654321" },
      { "task_id": "7654322", "success": true, "error": null, "resource_uri": "todoist://task/7654322" },
      { "task_id": "7654323", "success": true, "error": null, "resource_uri": "todoist://task/7654323" },
      { "task_id": "7654324", "success": true, "error": null, "resource_uri": "todoist://task/7654324" },
      { "task_id": "7654325", "success": true, "error": null, "resource_uri": "todoist://task/7654325" }
    ]
  },
  "metadata": {
    "deduplication_applied": false,
    "original_count": 5,
    "deduplicated_count": 5,
    "execution_time_ms": 842
  }
}
```

### Step 3: Verify

- Open Todoist app
- Check that all 5 tasks now have due date = tomorrow
- Or use `todoist_tasks` tool with `action: "get"` for each task ID

**Success Criteria**: All 5 tasks show tomorrow's date

---

## Test 2: Bulk Complete

**Objective**: Mark 10 tasks as completed

### Step 1: Get Task IDs

```json
{
  "tool": "todoist_tasks",
  "action": "list",
  "limit": 10
}
```

**Note the 10 task IDs**

### Step 2: Bulk Complete

```json
{
  "tool": "todoist_bulk_tasks",
  "action": "complete",
  "task_ids": [
    "7654321", "7654322", "7654323", "7654324", "7654325",
    "7654326", "7654327", "7654328", "7654329", "7654330"
  ]
}
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "total_tasks": 10,
    "successful": 10,
    "failed": 0,
    "results": [ /* 10 successful results */ ]
  }
}
```

### Step 3: Verify

- Check Todoist completed tasks view
- All 10 tasks should appear in completed list
- Verify completion timestamp is recent

**Success Criteria**: All 10 tasks marked as done

---

## Test 3: Bulk Move to Different Project

**Objective**: Move 7 tasks from one project to another

### Step 1: Get Project IDs

```json
{
  "tool": "todoist_projects",
  "action": "list"
}
```

**Note two project IDs**: Source project (current) and target project (destination)

### Step 2: Get Tasks from Source Project

```json
{
  "tool": "todoist_tasks",
  "action": "list",
  "project_id": "SOURCE_PROJECT_ID",
  "limit": 7
}
```

**Note the 7 task IDs**

### Step 3: Bulk Move

```json
{
  "tool": "todoist_bulk_tasks",
  "action": "move",
  "task_ids": [
    "7654321", "7654322", "7654323", "7654324",
    "7654325", "7654326", "7654327"
  ],
  "project_id": "TARGET_PROJECT_ID"
}
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "total_tasks": 7,
    "successful": 7,
    "failed": 0,
    "results": [ /* 7 successful results */ ]
  }
}
```

### Step 4: Verify

- Open target project in Todoist
- Verify all 7 tasks now appear in target project
- Check source project - tasks should be gone

**Success Criteria**: All 7 tasks relocated to target project

---

## Test 4: Bulk Update Multiple Fields

**Objective**: Update priority, labels, and deadline for 8 tasks

### Step 1: Get Task IDs

```json
{
  "tool": "todoist_tasks",
  "action": "list",
  "limit": 8
}
```

**Note the 8 task IDs**

### Step 2: Bulk Update

```json
{
  "tool": "todoist_bulk_tasks",
  "action": "update",
  "task_ids": [
    "7654321", "7654322", "7654323", "7654324",
    "7654325", "7654326", "7654327", "7654328"
  ],
  "priority": 2,
  "labels": ["urgent", "work"],
  "deadline_date": "2025-12-31"
}
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "total_tasks": 8,
    "successful": 8,
    "failed": 0,
    "results": [ /* 8 successful results */ ]
  }
}
```

### Step 3: Verify

Check each task has:
- Priority = 2 (high)
- Labels = ["urgent", "work"]
- Deadline = 2025-12-31

**Success Criteria**: All 3 fields updated on all 8 tasks

---

## Test 5: Error Handling - Exceeding 50 Task Limit

**Objective**: Verify system rejects >50 tasks

### Step 1: Attempt Bulk Operation with 75 Tasks

```json
{
  "tool": "todoist_bulk_tasks",
  "action": "update",
  "task_ids": [ /* array of 75 task IDs */ ],
  "due_string": "tomorrow"
}
```

**Expected Response**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMS",
    "message": "Maximum 50 tasks allowed, received 75"
  }
}
```

**Success Criteria**: Operation rejected with clear error message

---

## Test 6: Error Handling - Duplicate Task IDs

**Objective**: Verify deduplication works

### Step 1: Submit Request with Duplicates

```json
{
  "tool": "todoist_bulk_tasks",
  "action": "update",
  "task_ids": ["7654321", "7654322", "7654321", "7654323"],
  "due_string": "next week"
}
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "total_tasks": 3,
    "successful": 3,
    "failed": 0,
    "results": [
      { "task_id": "7654321", "success": true, "error": null, "resource_uri": "todoist://task/7654321" },
      { "task_id": "7654322", "success": true, "error": null, "resource_uri": "todoist://task/7654322" },
      { "task_id": "7654323", "success": true, "error": null, "resource_uri": "todoist://task/7654323" }
    ]
  },
  "metadata": {
    "deduplication_applied": true,
    "original_count": 4,
    "deduplicated_count": 3,
    "execution_time_ms": 678
  }
}
```

**Success Criteria**: Only 3 unique tasks processed, metadata shows deduplication

---

## Test 7: Error Handling - Invalid Task ID

**Objective**: Verify partial execution with individual task failures

### Step 1: Mix Valid and Invalid Task IDs

```json
{
  "tool": "todoist_bulk_tasks",
  "action": "update",
  "task_ids": ["7654321", "9999999", "7654323"],
  "priority": 3
}
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "total_tasks": 3,
    "successful": 2,
    "failed": 1,
    "results": [
      { "task_id": "7654321", "success": true, "error": null, "resource_uri": "todoist://task/7654321" },
      { "task_id": "9999999", "success": false, "error": "Task not found", "resource_uri": "todoist://task/9999999" },
      { "task_id": "7654323", "success": true, "error": null, "resource_uri": "todoist://task/7654323" }
    ]
  }
}
```

**Success Criteria**:
- 2 valid tasks updated successfully
- 1 invalid task shows error in results
- Operation continues despite failure

---

## Test 8: Error Handling - Disallowed Fields

**Objective**: Verify content/description/comments are rejected

### Step 1: Attempt to Update Content

```json
{
  "tool": "todoist_bulk_tasks",
  "action": "update",
  "task_ids": ["7654321", "7654322"],
  "content": "New title"
}
```

**Expected Response**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMS",
    "message": "Cannot modify content, description, or comments in bulk operations"
  }
}
```

**Success Criteria**: Request rejected at validation layer (before API call)

---

## Performance Test

**Objective**: Verify 50-task operation completes in <2 seconds

### Step 1: Get 50 Task IDs

```json
{
  "tool": "todoist_tasks",
  "action": "list",
  "limit": 50
}
```

### Step 2: Bulk Update 50 Tasks

```json
{
  "tool": "todoist_bulk_tasks",
  "action": "update",
  "task_ids": [ /* 50 task IDs */ ],
  "due_string": "tomorrow"
}
```

### Step 3: Check Execution Time

**Expected Response** includes:
```json
{
  "metadata": {
    "execution_time_ms": 1456
  }
}
```

**Success Criteria**: `execution_time_ms` < 2000

---

## Cleanup

After completing tests:

1. **Uncomplete Test Tasks**:
   ```json
   {
     "tool": "todoist_bulk_tasks",
     "action": "uncomplete",
     "task_ids": [ /* completed task IDs from Test 2 */ ]
   }
   ```

2. **Move Tasks Back** (if needed):
   ```json
   {
     "tool": "todoist_bulk_tasks",
     "action": "move",
     "task_ids": [ /* moved task IDs from Test 3 */ ],
     "project_id": "ORIGINAL_PROJECT_ID"
   }
   ```

3. **Reset Due Dates** (if needed):
   ```json
   {
     "tool": "todoist_bulk_tasks",
     "action": "update",
     "task_ids": [ /* all modified task IDs */ ],
     "due_date": null
   }
   ```

---

## Troubleshooting

### Error: "Rate limit exceeded"

**Cause**: Exceeded 50 Sync API requests/minute

**Solution**: Wait 60 seconds and retry

### Error: "Task not found"

**Possible Causes**:
- Task was deleted
- Wrong task ID
- Insufficient permissions

**Solution**: Verify task exists with `todoist_tasks` tool

### Error: "Invalid field value"

**Possible Causes**:
- Priority not 1-4
- Invalid date format
- Invalid enum value

**Solution**: Check field value constraints in error message

### Partial Failures

**Normal Behavior**: System continues processing remaining tasks

**Action**: Review `results` array to identify failed tasks and reasons

---

## Summary

You've completed all quickstart tests:

✓ Test 1: Bulk update due dates (5 tasks)
✓ Test 2: Bulk complete (10 tasks)
✓ Test 3: Bulk move to project (7 tasks)
✓ Test 4: Bulk update multiple fields (8 tasks)
✓ Test 5: Error handling - >50 tasks limit
✓ Test 6: Error handling - deduplication
✓ Test 7: Error handling - partial failures
✓ Test 8: Error handling - disallowed fields
✓ Performance: 50-task operation <2s

**Next Steps**:
- Integrate bulk operations into your workflows
- Use for recurring batch updates (weekly planning, project cleanup)
- Combine with `todoist_filters` to bulk-act on filtered task lists

**Feedback**: Report issues at https://github.com/anthropics/mcp-todoist/issues
