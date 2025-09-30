# Todoist MCP Server

MCP server enabling programmatic Todoist task and project management through optimized tool set.

## Features

- **5 Core Tools**: Tasks, Projects, Sections, Comments, and Filters management
- **Batch Operations**: Support for up to 100 operations per request
- **Rate Limiting**: Respects Todoist API limits with retry logic
- **Type Safety**: Full TypeScript implementation with Zod validation
- **Testing**: Comprehensive test suite with contract and integration tests

## Prerequisites

- Node.js 18+
- Todoist account with API token
- MCP client (Claude Desktop, VSCode with MCP extension, etc.)

## Installation

```bash
npm install
```

## Configuration

1. Copy the environment template:
```bash
cp .env.example .env
```

2. Get your Todoist API token from [Todoist Settings](https://todoist.com/help/articles/find-your-api-token) and add it to `.env`:
```
TODOIST_API_TOKEN=your_token_here
```

## Development

```bash
# Build the project
npm run build

# Run in development mode
npm run dev

# Run tests
npm test

# Run linting
npm run lint

# Run type checking
npm run typecheck
```

## Usage

Add to your MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "todoist": {
      "command": "node",
      "args": ["/path/to/mcp-todoist/dist/server.js"],
      "env": {
        "TODOIST_API_TOKEN": "your_api_token_here"
      }
    }
  }
}
```

## Available Tools

- `todoist_tasks` - Complete task management (create, update, delete, list, complete)
- `todoist_projects` - Project management with archiving support
- `todoist_sections` - Section management within projects
- `todoist_comments` - Comment management with file attachments
- `todoist_filters` - Filter management for custom task queries

## License

GPL 3.0