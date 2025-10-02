#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { APIConfiguration } from './types/todoist.js';
import { TodoistTasksTool } from './tools/todoist-tasks.js';
import { TodoistProjectsTool } from './tools/todoist-projects.js';
import { TodoistSectionsTool } from './tools/todoist-sections.js';
import { TodoistCommentsTool } from './tools/todoist-comments.js';
import { TodoistFiltersTool } from './tools/todoist-filters.js';
import { TodoistRemindersTool } from './tools/todoist-reminders.js';
import { TodoistLabelsTool } from './tools/todoist-labels.js';
import { TodoistBulkTasksTool } from './tools/bulk-tasks.js';
import { getConfig } from './config/index.js';
import { logger } from './middleware/logging.js';
import { TodoistAPIError, TodoistErrorCode } from './types/errors.js';

interface ToolExecutionResult {
  success: boolean;
}

interface MCPExecutableTool {
  execute(args: unknown): Promise<ToolExecutionResult>;
}

export class TodoistMCPServer {
  private server: Server;
  private readonly tools: Map<string, MCPExecutableTool> = new Map();
  private config: APIConfiguration;

  constructor() {
    this.server = new Server(
      {
        name: 'todoist-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.config = getConfig();
    this.initializeTools();
    this.setupHandlers();
  }

  /**
   * Initialize all tool instances
   */
  private initializeTools(): void {
    try {
      // Create tool instances with shared API configuration
      const tasksTools = new TodoistTasksTool(this.config);
      const projectsTool = new TodoistProjectsTool(this.config);
      const sectionsTool = new TodoistSectionsTool(this.config);
      const commentsTool = new TodoistCommentsTool(this.config);
      const filtersTool = new TodoistFiltersTool(this.config);
      const remindersTool = new TodoistRemindersTool(this.config);
      const labelsTool = new TodoistLabelsTool(this.config);
      const bulkTasksTool = new TodoistBulkTasksTool(this.config);

      // Register tools in the map
      this.tools.set('todoist_tasks', tasksTools);
      this.tools.set('todoist_projects', projectsTool);
      this.tools.set('todoist_sections', sectionsTool);
      this.tools.set('todoist_comments', commentsTool);
      this.tools.set('todoist_filters', filtersTool);
      this.tools.set('todoist_reminders', remindersTool);
      this.tools.set('todoist_labels', labelsTool);
      this.tools.set('todoist_bulk_tasks', bulkTasksTool);

      logger.info('All tools initialized successfully', {
        toolCount: this.tools.size,
        tools: Array.from(this.tools.keys()),
      });
    } catch (error) {
      logger.error('Failed to initialize tools', { error });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to initialize tools: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Setup MCP protocol handlers
   */
  private setupHandlers(): void {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.debug('Received list tools request');

      const toolDefinitions = [
        TodoistTasksTool.getToolDefinition(),
        TodoistProjectsTool.getToolDefinition(),
        TodoistSectionsTool.getToolDefinition(),
        TodoistCommentsTool.getToolDefinition(),
        TodoistFiltersTool.getToolDefinition(),
        TodoistRemindersTool.getToolDefinition(),
        TodoistLabelsTool.getToolDefinition(),
        TodoistBulkTasksTool.getToolDefinition(),
      ];

      logger.info('Returning tool definitions', {
        toolCount: toolDefinitions.length,
        tools: toolDefinitions.map(tool => tool.name),
      });

      return {
        tools: toolDefinitions,
      };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async request => {
      const { name, arguments: args } = request.params;
      const correlationId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      logger.info('Received tool call', {
        correlationId,
        toolName: name,
        hasArguments: !!args,
      });

      try {
        // Validate tool exists
        const tool = this.tools.get(name);
        if (!tool) {
          logger.error('Unknown tool requested', {
            correlationId,
            toolName: name,
            availableTools: Array.from(this.tools.keys()),
          });
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }

        // Execute the tool
        const startTime = Date.now();
        const result = await tool.execute(args || {});
        const executionTime = Date.now() - startTime;

        logger.info('Tool execution completed', {
          correlationId,
          toolName: name,
          success: result.success,
          executionTime,
        });

        // Return the result in MCP format
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Tool execution failed', {
          correlationId,
          toolName: name,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        });

        // Handle different error types
        if (error instanceof McpError) {
          throw error;
        }

        if (error instanceof TodoistAPIError) {
          const todoistError = error.toTodoistError();
          throw new McpError(
            this.mapTodoistErrorToMCP(todoistError.code),
            todoistError.message
          );
        }

        // Generic error fallback
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });
  }

  /**
   * Map Todoist error codes to MCP error codes
   */
  private mapTodoistErrorToMCP(todoistErrorCode: TodoistErrorCode): ErrorCode {
    switch (todoistErrorCode) {
      case TodoistErrorCode.INVALID_TOKEN:
        return ErrorCode.InvalidRequest;
      case TodoistErrorCode.RATE_LIMIT_EXCEEDED:
        return ErrorCode.InternalError;
      case TodoistErrorCode.RESOURCE_NOT_FOUND:
        return ErrorCode.InvalidRequest;
      case TodoistErrorCode.VALIDATION_ERROR:
        return ErrorCode.InvalidParams;
      case TodoistErrorCode.SYNC_ERROR:
        return ErrorCode.InternalError;
      case TodoistErrorCode.BATCH_PARTIAL_FAILURE:
        return ErrorCode.InternalError;
      default:
        return ErrorCode.InternalError;
    }
  }

  /**
   * Health check endpoint for API connectivity
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    checks: {
      server: 'ok' | 'error';
      api: 'ok' | 'error' | 'unknown';
      tools: 'ok' | 'error';
    };
    timestamp: string;
    version: string;
  }> {
    const timestamp = new Date().toISOString();
    const checks: {
      server: 'ok' | 'error';
      api: 'ok' | 'error' | 'unknown';
      tools: 'ok' | 'error';
    } = {
      server: 'ok',
      api: 'unknown',
      tools: 'ok',
    };

    try {
      // Check if tools are properly initialized
      if (this.tools.size !== 6) {
        checks.tools = 'error';
      }

      // Test API connectivity by making a lightweight call
      try {
        const tasksTool = this.tools.get('todoist_tasks');
        if (tasksTool instanceof TodoistTasksTool) {
          // Attempt to list tasks with minimal parameters to test API
          await tasksTool.execute({ action: 'list', lang: 'en' });
          checks.api = 'ok';
        }
      } catch (error) {
        logger.warn('Health check API test failed', { error });
        checks.api = 'error';
      }

      const status = Object.values(checks).every(check => check === 'ok')
        ? 'healthy'
        : 'unhealthy';

      logger.info('Health check completed', {
        status,
        checks,
        timestamp,
      });

      return {
        status,
        checks,
        timestamp,
        version: '1.0.0',
      };
    } catch (error) {
      logger.error('Health check failed', { error });

      const errorChecks: {
        server: 'ok' | 'error';
        api: 'ok' | 'error' | 'unknown';
        tools: 'ok' | 'error';
      } = {
        server: 'error',
        api: 'error',
        tools: 'error',
      };

      return {
        status: 'unhealthy',
        checks: errorChecks,
        timestamp,
        version: '1.0.0',
      };
    }
  }

  /**
   * Start the MCP server
   */
  async run(): Promise<void> {
    const transport = new StdioServerTransport();

    logger.info('Starting Todoist MCP Server', {
      version: '1.0.0',
      toolCount: this.tools.size,
      tools: Array.from(this.tools.keys()),
    });

    try {
      await this.server.connect(transport);
      logger.info('Todoist MCP Server started successfully');
    } catch (error) {
      logger.error('Failed to start MCP server', { error });
      throw error;
    }
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    try {
      await this.server.close();
      logger.info('Todoist MCP Server stopped');
    } catch (error) {
      logger.error('Error stopping MCP server', { error });
      throw error;
    }
  }
}

// Create and export server instance
export const server = new TodoistMCPServer();

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  server.run().catch(error => {
    logger.error('Failed to start server via direct execution', { error });
    process.exit(1);
  });
}
