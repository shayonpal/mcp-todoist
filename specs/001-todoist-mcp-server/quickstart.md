# Quickstart: Todoist MCP Server

## Overview
This guide walks through setting up and testing the Todoist MCP server with its 5 core tools. Complete this guide to verify full functionality.

## Prerequisites
- Node.js 18+ installed
- Todoist account with API token
- MCP client (Claude Desktop, VSCode with MCP extension, or custom client)

## 1. Installation & Setup

### Install Dependencies
```bash
npm install
```

### Configure API Token
Add your Todoist API token to your MCP client configuration:

**Claude Desktop (~/.claude/settings.json)**:
```json
{
  "mcpServers": {
    "todoist": {
      "transport": {
        "type": "http",
        "url": "https://todoist.uverfolks.ca/mcp"
      }
    }
  }
}
```

For local development:
```json
{
  "mcpServers": {
    "todoist": {
      "transport": {
        "type": "http",
        "url": "http://localhost:3000/mcp"
      }
    }
  }
}
```

### Local Development Server
```bash
vercel dev
```

Server runs at `http://localhost:3000/mcp` when using Vercel dev locally.

## 2. Verification Steps

### Step 1: Verify Server Connection
```bash
# Check if server responds to MCP protocol
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'
```

**Expected Result**: List of 5 tools (todoist_tasks, todoist_projects, todoist_sections, todoist_comments, todoist_filters)

### Step 2: Test Project Management
```javascript
// Create a test project
{
  "tool": "todoist_projects",
  "parameters": {
    "action": "create",
    "name": "MCP Test Project",
    "color": "blue",
    "view_style": "list"
  }
}
```

**Expected Result**: New project created with ID returned

```javascript
// List all projects
{
  "tool": "todoist_projects",
  "parameters": {
    "action": "list"
  }
}
```

**Expected Result**: Array including your test project

### Step 3: Test Task Management
```javascript
// Create a test task (use project_id from Step 2)
{
  "tool": "todoist_tasks",
  "parameters": {
    "action": "create",
    "content": "Test MCP integration",
    "project_id": "PROJECT_ID_FROM_STEP_2",
    "priority": 3,
    "due_string": "tomorrow"
  }
}
```

**Expected Result**: New task created with ID returned

```javascript
// Query tasks in project
{
  "tool": "todoist_tasks",
  "parameters": {
    "action": "list",
    "filter": "PROJECT_ID_FROM_STEP_2"
  }
}
```

**Expected Result**: Array including your test task

### Step 4: Test Section Management
```javascript
// Create a section in the test project
{
  "tool": "todoist_sections",
  "parameters": {
    "action": "create",
    "name": "In Progress",
    "project_id": "PROJECT_ID_FROM_STEP_2"
  }
}
```

**Expected Result**: New section created

```javascript
// List sections in project
{
  "tool": "todoist_sections",
  "parameters": {
    "action": "list",
    "project_id": "PROJECT_ID_FROM_STEP_2"
  }
}
```

**Expected Result**: Array including your test section

### Step 5: Test Comment Management
```javascript
// Add a comment to the test task
{
  "tool": "todoist_comments",
  "parameters": {
    "action": "create",
    "task_id": "TASK_ID_FROM_STEP_3",
    "content": "This is a test comment for MCP integration verification."
  }
}
```

**Expected Result**: New comment created

```javascript
// List comments on task
{
  "tool": "todoist_comments",
  "parameters": {
    "action": "list",
    "task_id": "TASK_ID_FROM_STEP_3"
  }
}
```

**Expected Result**: Array including your test comment

### Step 6: Test Filter Functionality
```javascript
// List existing filters
{
  "tool": "todoist_filters",
  "parameters": {
    "action": "list_filters"
  }
}
```

**Expected Result**: Array of user's existing filters

```javascript
// Create a test filter
{
  "tool": "todoist_filters",
  "parameters": {
    "action": "create_filter",
    "name": "MCP Test Filter",
    "query": "p3",
    "color": "green"
  }
}
```

**Expected Result**: New filter created

### Step 7: Test Batch Operations
```javascript
// Create multiple tasks in batch
{
  "tool": "todoist_tasks",
  "parameters": {
    "action": "batch",
    "batch_commands": [
      {
        "type": "item_add",
        "temp_id": "temp_1",
        "args": {
          "content": "First batch task",
          "project_id": "PROJECT_ID_FROM_STEP_2"
        }
      },
      {
        "type": "item_add",
        "temp_id": "temp_2",
        "args": {
          "content": "Second batch task",
          "project_id": "PROJECT_ID_FROM_STEP_2",
          "parent_id": "temp_1"
        }
      }
    ]
  }
}
```

**Expected Result**: Batch operation success with temp_id mapping

## 3. Performance Verification

### Response Time Check
All operations should complete within 500ms under normal conditions:
- Single operations: < 200ms
- Batch operations: < 2s for 100 items
- List operations: < 300ms

### Rate Limit Verification
Server should handle rate limits gracefully:
- Sync operations: 1000 per 15 minutes
- REST operations: Within acceptable limits

### Error Handling Check
Test error scenarios:
```javascript
// Test invalid token
{
  "tool": "todoist_tasks",
  "parameters": {
    "action": "get",
    "task_id": "invalid_id"
  }
}
```

**Expected Result**: Proper error response with MCP-compliant format

## 4. Cleanup

### Remove Test Data
```javascript
// Delete test task
{
  "tool": "todoist_tasks",
  "parameters": {
    "action": "delete",
    "task_id": "TASK_ID_FROM_STEP_3"
  }
}

// Delete test section
{
  "tool": "todoist_sections",
  "parameters": {
    "action": "delete",
    "section_id": "SECTION_ID_FROM_STEP_4"
  }
}

// Delete test filter
{
  "tool": "todoist_filters",
  "parameters": {
    "action": "delete_filter",
    "filter_id": "FILTER_ID_FROM_STEP_6"
  }
}

// Archive test project
{
  "tool": "todoist_projects",
  "parameters": {
    "action": "archive",
    "project_id": "PROJECT_ID_FROM_STEP_2"
  }
}
```

## 5. Troubleshooting

### Common Issues

**Server won't start**:
- Check Node.js version (18+ required)
- Verify all dependencies installed
- Check API token is valid

**Tools not appearing in MCP client**:
- Verify server is running on correct port
- Check MCP client configuration
- Restart MCP client after config changes

**API errors**:
- Verify Todoist API token is valid
- Check internet connectivity
- Monitor rate limit headers in responses

**Performance issues**:
- Check network latency to Todoist API
- Monitor memory usage during batch operations
- Verify caching is working for projects/labels

### Debug Mode
Enable debug logging:
```bash
DEBUG=todoist:* npm start
```

### Health Check
```bash
curl http://localhost:3000/health
```

## Success Criteria

✅ All 5 tools are available in MCP client
✅ All CRUD operations work for each entity type
✅ Batch operations handle up to 100 commands
✅ Error responses are properly formatted
✅ Rate limiting is respected
✅ Response times meet performance targets
✅ Cleanup operations complete successfully

If all verification steps pass, your Todoist MCP server is ready for production use!