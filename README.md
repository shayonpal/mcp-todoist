# Todoist MCP Server

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](package.json)

MCP server enabling programmatic Todoist task and project management through an optimized tool set using Todoist REST API v1. Integrates seamlessly with Claude Desktop and other MCP-compatible clients.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Available Tools](#available-tools)
- [Rate Limiting](#rate-limiting)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Features

- **7 Core Tools**: Comprehensive task and project management
  - Tasks (CRUD + complete/uncomplete)
  - Projects (CRUD + archive/unarchive)
  - Sections (organize tasks within projects)
  - Comments (with file attachment support)
  - Filters (custom task queries)
  - Reminders (relative, absolute, location-based)
  - Labels (personal and shared label management)
- **Natural Language Dates**: "tomorrow", "every Monday", "next Friday at 3pm"
- **Deadline Support**: Set completion deadlines distinct from due dates
- **Batch Operations**: Execute up to 100 operations per request via Sync API
- **Smart Rate Limiting**: Token bucket algorithm with automatic retry
- **Type Safety**: Full TypeScript implementation with Zod validation
- **Comprehensive Testing**: Contract and integration test coverage

## Prerequisites

- **Node.js** 18 or higher
- **Todoist account** ([Sign up free](https://todoist.com))
- **Todoist API token** ([Get yours here](https://todoist.com/help/articles/find-your-api-token))
- **MCP client** such as:
  - [Claude Desktop](https://claude.ai/download)
  - [Raycast MCP Extension](https://www.raycast.com/)
  - Any MCP-compatible client

## Installation

1. Clone the repository:
```bash
git clone https://github.com/shayonpal/mcp-todoist.git
cd mcp-todoist
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Configuration

### 1. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` and add your Todoist API token:
```bash
TODOIST_API_TOKEN=your_todoist_api_token_here
```

### 2. Configure your MCP client

#### Claude Desktop

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "todoist": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-todoist/dist/server.js"],
      "env": {
        "TODOIST_API_TOKEN": "your_api_token_here"
      }
    }
  }
}
```

**Note**: Use absolute paths in the configuration.

#### Other MCP Clients

Refer to your MCP client's documentation for configuration instructions. The server uses STDIO transport and follows MCP protocol version 2024-11-05.

## Available Tools

### todoist_tasks
Complete task management with create, get, update, delete, list, complete, and uncomplete actions. Supports natural language dates, deadlines, priorities, labels, and recurring tasks.

**Key parameters**: `action`, `task_id`, `content`, `due_date`, `due_string`, `deadline`, `priority`, `labels`, `project_id`

### todoist_projects
Project management with create, get, update, delete, list, archive, and unarchive actions. Organize work with hierarchical projects and custom views.

**Key parameters**: `action`, `project_id`, `name`, `color`, `is_favorite`, `view_style`

### todoist_sections
Section management within projects for better task organization. Create, get, update, delete, list, and reorder sections.

**Key parameters**: `action`, `section_id`, `project_id`, `name`, `order`

### todoist_comments
Add and manage comments on tasks and projects with file attachment support (up to 15,000 characters).

**Key parameters**: `action`, `comment_id`, `task_id`, `project_id`, `content`, `attachment`

### todoist_filters
Create and manage custom filters for advanced task queries. List, create, update, delete, and query filters.

**Key parameters**: `action`, `filter_id`, `name`, `query`, `color`, `is_favorite`

### todoist_reminders
Set reminders for tasks with three types: relative (X minutes before due), absolute (specific datetime), and location-based (geofenced).

**Key parameters**: `action`, `reminder_id`, `item_id`, `type`, `minute_offset`, `due`, `loc_lat`, `loc_long`

### todoist_labels
Manage personal and shared labels with create, get, update, delete, list, rename, and remove actions. Includes caching for optimal performance.

**Key parameters**: `action`, `label_id`, `name`, `color`, `is_favorite`, `order`

## Rate Limiting

The server implements intelligent rate limiting to respect Todoist API constraints:

- **REST API**: 300 requests/minute (token bucket: 300 capacity, 5 tokens/sec refill)
- **Sync API**: 50 requests/minute (token bucket: 50 capacity, ~0.83 tokens/sec refill)
- **Automatic Retry**: Exponential backoff on 429 responses
- **Batch Operations**: Use for bulk updates to minimize API calls

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Build TypeScript
npm run build

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate test coverage report
npm run test:coverage

# Lint code
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format

# Type-check without emitting
npm run typecheck
```

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

GNU General Public License v3.0 - see [LICENSE](LICENSE) for details.

Copyright (C) 2025 Shayon Pal