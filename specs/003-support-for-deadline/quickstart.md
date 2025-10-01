# Quickstart: Deadline Support

This quickstart validates the deadline feature end-to-end through the user acceptance scenarios defined in the spec.

## Prerequisites

- MCP Todoist server running with deadline support
- Valid Todoist API token configured
- Test project available in Todoist account

## Test Scenario 1: Create Task with Deadline

**Given**: User wants to create a task with a deadline
**When**: Create task with deadline parameter
**Then**: Task is created with deadline field populated

```bash
# Using MCP tool (example via Claude Code or other MCP client)
{
  "action": "create",
  "content": "Submit quarterly report",
  "deadline": "2025-12-31",
  "project_id": "YOUR_PROJECT_ID"
}
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "content": "Submit quarterly report",
    "deadline": {
      "date": "2025-12-31",
      "lang": "en"
    }
  },
  "message": "Task created successfully",
  "metadata": {}
}
```

**Validation**:
- ✅ Response has `success: true`
- ✅ Task data includes `deadline` field
- ✅ `deadline.date` matches input "2025-12-31"
- ✅ No errors in response

## Test Scenario 2: Create Task with Due Date and Deadline

**Given**: User wants to differentiate start date from completion date
**When**: Create task with both due_date and deadline
**Then**: Task stores both dates independently

```bash
{
  "action": "create",
  "content": "Review PR #123",
  "due_date": "2025-10-10",
  "deadline": "2025-10-15",
  "project_id": "YOUR_PROJECT_ID"
}
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "content": "Review PR #123",
    "due": {
      "date": "2025-10-10"
    },
    "deadline": {
      "date": "2025-10-15"
    }
  },
  "message": "Task created successfully"
}
```

**Validation**:
- ✅ Both `due` and `deadline` fields present
- ✅ Due date is 2025-10-10
- ✅ Deadline is 2025-10-15
- ✅ Both dates stored correctly

## Test Scenario 3: Update Task to Add Deadline

**Given**: Task exists without a deadline
**When**: Update task to add deadline
**Then**: Deadline is added, other fields unchanged

```bash
# First, create task without deadline
{
  "action": "create",
  "content": "Update documentation",
  "project_id": "YOUR_PROJECT_ID"
}

# Then, update to add deadline (use task_id from previous response)
{
  "action": "update",
  "task_id": "TASK_ID_FROM_ABOVE",
  "deadline": "2025-11-30"
}
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "content": "Update documentation",
    "deadline": {
      "date": "2025-11-30",
      "lang": "en"
    }
  },
  "message": "Task updated successfully"
}
```

**Validation**:
- ✅ Task content unchanged
- ✅ Deadline field now populated
- ✅ Deadline date is 2025-11-30

## Test Scenario 4: Remove Deadline from Task

**Given**: Task has a deadline
**When**: Update task with deadline=null
**Then**: Deadline is removed, task remains

```bash
{
  "action": "update",
  "task_id": "TASK_ID_WITH_DEADLINE",
  "deadline": null
}
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "deadline": null
  },
  "message": "Task updated successfully"
}
```

**Validation**:
- ✅ `deadline` field is null
- ✅ Task still exists
- ✅ Other task fields unchanged

## Test Scenario 5: Recurring Task Warning

**Given**: User creates/updates a recurring task
**When**: Add deadline to recurring task
**Then**: Warning message returned (non-blocking)

```bash
{
  "action": "create",
  "content": "Weekly status update",
  "due_string": "every Monday",
  "deadline": "2025-12-31",
  "project_id": "YOUR_PROJECT_ID"
}
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "content": "Weekly status update",
    "due": {
      "is_recurring": true,
      "string": "every Monday"
    },
    "deadline": {
      "date": "2025-12-31",
      "lang": "en"
    }
  },
  "message": "Task created successfully",
  "metadata": {
    "warnings": [
      "Deadline added to recurring task - deadline will not recur and will remain static"
    ]
  }
}
```

**Validation**:
- ✅ Task created successfully
- ✅ `success: true`
- ✅ Warning message in `metadata.warnings`
- ✅ Both due (recurring) and deadline (static) present

## Test Scenario 6: Past Deadline Reminder

**Given**: User specifies a deadline in the past
**When**: Create/update task with past deadline
**Then**: Reminder message returned (non-blocking)

```bash
{
  "action": "create",
  "content": "Overdue item",
  "deadline": "2025-01-15",
  "project_id": "YOUR_PROJECT_ID"
}
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "content": "Overdue item",
    "deadline": {
      "date": "2025-01-15",
      "lang": "en"
    }
  },
  "message": "Task created successfully",
  "metadata": {
    "reminders": [
      "Specified deadline (2025-01-15) is in the past"
    ]
  }
}
```

**Validation**:
- ✅ Task created successfully
- ✅ `success: true`
- ✅ Reminder message in `metadata.reminders`
- ✅ Past deadline accepted

## Test Scenario 7: Invalid Format Error

**Given**: User provides invalid deadline format
**When**: Create/update task with wrong format
**Then**: Validation error with helpful message

```bash
{
  "action": "create",
  "content": "Test task",
  "deadline": "10/15/2025",
  "project_id": "YOUR_PROJECT_ID"
}
```

**Expected Response**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMS",
    "message": "Invalid deadline format. Expected YYYY-MM-DD (e.g., 2025-10-15)"
  }
}
```

**Validation**:
- ✅ Request rejected (`success: false`)
- ✅ Error code is `INVALID_PARAMS`
- ✅ Error message includes format example
- ✅ No task created

## Test Scenario 8: Task Retrieval with Deadline

**Given**: Task with deadline exists
**When**: Retrieve task by ID
**Then**: Deadline field included in response

```bash
{
  "action": "get",
  "task_id": "TASK_ID_WITH_DEADLINE"
}
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "content": "Task with deadline",
    "deadline": {
      "date": "2025-12-31",
      "lang": "en"
    }
  },
  "message": "Task retrieved successfully"
}
```

**Validation**:
- ✅ Deadline field present in response
- ✅ Deadline date matches stored value
- ✅ `lang` field present (output only)

## Validation Checklist

Run all scenarios above and check:

- [ ] Scenario 1: Create with deadline (PASS)
- [ ] Scenario 2: Create with due date and deadline (PASS)
- [ ] Scenario 3: Add deadline to existing task (PASS)
- [ ] Scenario 4: Remove deadline (PASS)
- [ ] Scenario 5: Recurring task warning (PASS)
- [ ] Scenario 6: Past deadline reminder (PASS)
- [ ] Scenario 7: Invalid format error (PASS)
- [ ] Scenario 8: Retrieve task with deadline (PASS)

## Troubleshooting

### Deadline field not appearing in response
- Check Todoist API version (must be v1)
- Verify deadline parameter is string, not object
- Ensure format is exactly YYYY-MM-DD

### Validation error with valid format
- Check for extra spaces in date string
- Verify year is 4 digits, month/day are 2 digits
- Ensure separators are hyphens, not slashes

### Warning/reminder not appearing
- Check task's `is_recurring` field (for warnings)
- Verify date comparison logic (for past date reminders)
- Ensure metadata field is inspected in response

### Rate limit errors
- Wait for rate limit reset (check `metadata.rate_limit_reset`)
- Reduce test frequency
- Use existing test tasks instead of creating new ones

## Success Criteria

All 8 scenarios pass validation checklist:
- ✅ Create/update/remove operations work correctly
- ✅ Warnings and reminders are non-blocking
- ✅ Validation errors are clear and helpful
- ✅ Deadline field integrates with existing task fields

Feature is ready for production when all scenarios pass consistently.
