# Manual Verification Guide for T067

This guide walks through manual verification of all quickstart.md scenarios with v1 API and reminders feature.

## Step 1: Get Your Todoist API Token

1. Go to https://todoist.com/help/articles/find-your-api-token
2. Log into your Todoist account
3. Navigate to Settings → Integrations → Developer
4. Copy your API token (keep it secure!)

## Step 2: Configure Claude Desktop (or your MCP client)

Edit your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

Add this configuration:

```json
{
  "mcpServers": {
    "todoist": {
      "command": "node",
      "args": ["/Users/shayon/DevProjects/mcp-todoist/dist/server.js"],
      "env": {
        "TODOIST_API_TOKEN": "YOUR_TOKEN_HERE"
      }
    }
  }
}
```

**Important**: Replace `YOUR_TOKEN_HERE` with your actual Todoist API token.

## Step 3: Restart Claude Desktop

After updating the config:
1. Quit Claude Desktop completely (Cmd+Q)
2. Reopen Claude Desktop
3. Start a new conversation

## Verification Scenarios

### Scenario 1: Verify Server Connection (6 Tools)

**What to test**: Confirm all 6 tools are available including the new reminders tool.

**In Claude Desktop, ask:**
```
What Todoist tools are available?
```

**Expected Result**: You should see 6 tools listed:
- ✅ todoist_tasks
- ✅ todoist_projects
- ✅ todoist_sections
- ✅ todoist_comments
- ✅ todoist_filters
- ✅ todoist_reminders ← NEW!

**Verification**: Check that todoist_reminders is listed.

---

### Scenario 2: Test Project Management

**In Claude Desktop, ask:**
```
Create a new Todoist project called "MCP Test Project" with blue color and list view style.
```

**Expected Result**:
- Project created successfully
- You get back a project ID
- Project appears in your Todoist app

**Then ask:**
```
List all my Todoist projects.
```

**Expected Result**: You should see "MCP Test Project" in the list.

**Save the project_id for later scenarios!**

---

### Scenario 3: Test Task Management with Natural Language Due Dates

**In Claude Desktop, ask:**
```
Create a task in the MCP Test Project with:
- Content: "Test MCP integration"
- Priority: 3 (High)
- Due date: "tomorrow"
```

**Expected Result**: Task created with natural language due date parsed correctly.

**Then test more natural language dates:**
```
Create another task with due date "every day"
```

```
Create another task with due date "every 4th"
```

**Expected Result**: All natural language dates should be parsed correctly by the v1 API.

**Then ask:**
```
List all tasks in the MCP Test Project.
```

**Expected Result**: You should see all 3 tasks you just created.

**Save a task_id for later scenarios!**

---

### Scenario 4: Test Section Management

**In Claude Desktop, ask:**
```
Create a section called "In Progress" in the MCP Test Project.
```

**Expected Result**: Section created successfully.

**Then ask:**
```
List all sections in the MCP Test Project.
```

**Expected Result**: You should see the "In Progress" section.

**Save the section_id for later!**

---

### Scenario 5: Test Comment Management

**In Claude Desktop, ask:**
```
Add a comment to task [TASK_ID from Scenario 3] with content: "This is a test comment for MCP integration verification."
```

**Expected Result**: Comment created successfully.

**Then ask:**
```
List all comments on task [TASK_ID].
```

**Expected Result**: You should see your test comment (up to 15,000 chars supported).

---

### Scenario 6: Test Filter Functionality

**In Claude Desktop, ask:**
```
List all my Todoist filters.
```

**Expected Result**: You should see any existing filters in your account.

**Then ask:**
```
Create a new filter called "MCP Test Filter" with query "p3" and green color.
```

**Expected Result**: Filter created successfully (filters high-priority tasks).

---

### Scenario 7: Test Batch Operations

**In Claude Desktop, ask:**
```
Create two tasks in batch:
1. "First batch task" in MCP Test Project
2. "Second batch task" as a subtask of the first one
```

**Expected Result**:
- Batch operation completes successfully
- Both tasks created
- Second task is properly nested as subtask of first
- Temp ID mapping works correctly

---

### Scenario 8: Test Reminders Feature (NEW - v1 API)

**This is a NEW scenario to verify the reminders implementation from Phase 4.2**

**In Claude Desktop, ask:**
```
Create a reminder for task [TASK_ID from Scenario 3] for tomorrow at 9am.
```

**Expected Result**: Reminder created successfully.

**Then ask:**
```
List all reminders for task [TASK_ID].
```

**Expected Result**: You should see the reminder you just created.

**Then ask:**
```
Update the reminder to be for 10am instead.
```

**Expected Result**: Reminder updated successfully.

**Finally ask:**
```
Delete the reminder.
```

**Expected Result**: Reminder deleted successfully.

---

### Scenario 9: Cleanup Test Data

**In Claude Desktop, ask:**
```
Please cleanup my test data:
1. Delete the "MCP Test Filter"
2. Delete all tasks in "MCP Test Project"
3. Delete the "In Progress" section
4. Archive the "MCP Test Project"
```

**Expected Result**: All test data cleaned up successfully.

---

## Verification Checklist

After completing all scenarios, verify:

- [ ] All 6 tools available (including todoist_reminders)
- [ ] Projects: Create, list, archive ✓
- [ ] Tasks: Create with natural language dates ("tomorrow", "every day", "every 4th") ✓
- [ ] Sections: Create, list ✓
- [ ] Comments: Create, list (15K char limit) ✓
- [ ] Filters: List, create, delete ✓
- [ ] Batch: Multiple operations with temp ID management ✓
- [ ] Reminders: Full CRUD (create, read, update, delete) ✓
- [ ] API v1: All operations use v1 endpoints (not v2) ✓
- [ ] Error handling: Proper error messages for invalid operations ✓
- [ ] Performance: Operations complete in <500ms ✓

## Troubleshooting

### Tool Not Available
- Check config file path is correct
- Verify API token is valid
- Restart Claude Desktop completely
- Check server built successfully (`npm run build`)

### API Errors
- Verify token has not expired
- Check internet connectivity
- Verify you're not hitting rate limits (1000/15min for sync)

### Natural Language Dates Not Working
- Ensure using v1 API (check base_url in logs)
- Try different formats: "tomorrow", "next monday", "every day"

### Reminders Not Working
- Verify task exists
- Check task has a due date (required for some reminder types)
- Ensure using v1 API endpoints

## Success Criteria

✅ All 6 tools listed and functional
✅ Natural language due dates working
✅ Reminders CRUD operations working
✅ All test scenarios pass
✅ Using v1 API endpoints (not v2)
✅ Test cleanup successful

---

**Note**: This verification confirms Phase 4.1 (v1 API migration) and Phase 4.2 (reminders implementation) are working correctly in a real MCP client environment.