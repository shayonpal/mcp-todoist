/**
 * T016-T018: Bulk operations tool for todoist_bulk_tasks MCP tool
 * Implements bulk update, complete, uncomplete, and move operations
 */

import { z } from 'zod';
import {
  TodoistApiService,
  SyncCommand,
  SyncResponse,
} from '../services/todoist-api.js';
import {
  OperationResult,
  BulkOperationSummary,
  BulkTasksResponse,
  SyncError,
} from '../types/bulk-operations.js';
import { APIConfiguration } from '../types/todoist.js';
import { ValidationError } from '../types/errors.js';
import { z as zodLib } from 'zod';

/**
 * T016: Bulk operation input schema
 * Matches contracts/mcp-tool-schema.json specification
 */
const BulkOperationInputSchema = z
  .object({
    action: z.enum(['update', 'complete', 'uncomplete', 'move']),
    task_ids: z.array(z.string()).min(1, 'At least one task ID required'),
    // Optional update fields
    project_id: z.string().optional(),
    section_id: z.string().optional(),
    parent_id: z.string().optional(),
    order: z.number().optional(),
    labels: z.array(z.string()).optional(),
    priority: z.number().int().min(1).max(4).optional(),
    assignee_id: z.number().optional(),
    due_string: z.string().optional(),
    due_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    due_datetime: z.string().datetime().optional(),
    due_lang: z.string().optional(),
    duration: z.number().optional(),
    duration_unit: z.enum(['minute', 'day']).optional(),
    deadline_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .refine(
    data => {
      // Ensure no disallowed fields
      const disallowed = ['content', 'description', 'comments'];
      return !disallowed.some(field => field in data);
    },
    {
      message:
        'Cannot modify content, description, or comments in bulk operations',
    }
  );

type BulkOperationInput = z.infer<typeof BulkOperationInputSchema>;

/**
 * T016: Error response structure
 */
interface BulkErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

/**
 * TodoistBulkTasksTool - MCP tool for bulk operations on Todoist tasks
 * T016: Main tool class implementation
 */
export class TodoistBulkTasksTool {
  private apiService: TodoistApiService;

  constructor(
    config: APIConfiguration,
    dependencies?: {
      apiService?: TodoistApiService;
    }
  ) {
    this.apiService = dependencies?.apiService || new TodoistApiService(config);
  }

  /**
   * T016: MCP tool definition
   * Matches contracts/mcp-tool-schema.json
   */
  static getToolDefinition() {
    return {
      name: 'todoist_bulk_tasks',
      description:
        'Perform bulk operations on up to 50 Todoist tasks. Supports update, complete, uncomplete, and move operations. Automatically deduplicates task IDs. Uses partial execution mode (continues on individual task failures). Returns individual results for each task with success/failure status.',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['update', 'complete', 'uncomplete', 'move'],
            description: 'Operation type to perform on all selected tasks',
          },
          task_ids: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Array of Todoist task IDs (1-50 items). Duplicate IDs are automatically removed before processing.',
            minItems: 1,
            maxItems: 50,
          },
          project_id: {
            type: 'string',
            description: 'Project ID for move/update operations',
          },
          section_id: {
            type: 'string',
            description: 'Section ID for move/update operations',
          },
          parent_id: {
            type: 'string',
            description: 'Parent task ID for move/update operations',
          },
          order: {
            type: 'number',
            description: 'Task order for update operations',
          },
          labels: {
            type: 'array',
            items: { type: 'string' },
            description: 'Label names for update operations',
          },
          priority: {
            type: 'number',
            minimum: 1,
            maximum: 4,
            description: 'Priority level for update operations (1-4)',
          },
          assignee_id: {
            type: 'number',
            description: 'User ID for update operations',
          },
          due_string: {
            type: 'string',
            description: 'Natural language due date for update operations',
          },
          due_date: {
            type: 'string',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
            description: 'Due date in YYYY-MM-DD format for update operations',
          },
          due_datetime: {
            type: 'string',
            format: 'date-time',
            description:
              'Due datetime in ISO 8601 format for update operations',
          },
          due_lang: {
            type: 'string',
            description: 'Language code for parsing due_string',
          },
          duration: {
            type: 'number',
            description: 'Task duration value for update operations',
          },
          duration_unit: {
            type: 'string',
            enum: ['minute', 'day'],
            description: 'Duration unit for update operations',
          },
          deadline_date: {
            type: 'string',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
            description:
              'Deadline date in YYYY-MM-DD format for update operations',
          },
        },
        required: ['action', 'task_ids'],
        additionalProperties: false,
      },
    };
  }

  /**
   * T016: Main execution method
   * Validates input, deduplicates task IDs, and dispatches to action handlers
   */
  async execute(
    params: unknown
  ): Promise<BulkTasksResponse | BulkErrorResponse> {
    const startTime = Date.now();

    try {
      // T016: Input validation
      const validated = BulkOperationInputSchema.parse(params);

      // T016: Deduplication logic
      const originalCount = validated.task_ids.length;
      const uniqueTaskIds = Array.from(new Set(validated.task_ids));
      const deduplicatedCount = uniqueTaskIds.length;
      const deduplicationApplied = originalCount !== deduplicatedCount;

      // T016: Pre-validation - max 50 tasks after deduplication
      if (deduplicatedCount > 50) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: `Maximum 50 tasks allowed, received ${deduplicatedCount}`,
          },
        };
      }

      // T016: Dispatch to action handlers
      let summary: BulkOperationSummary;
      switch (validated.action) {
        case 'update':
          summary = await this.handleUpdateAction(uniqueTaskIds, validated);
          break;
        case 'complete':
          summary = await this.handleCompleteAction(uniqueTaskIds);
          break;
        case 'uncomplete':
          summary = await this.handleUncompleteAction(uniqueTaskIds);
          break;
        case 'move':
          summary = await this.handleMoveAction(uniqueTaskIds, validated);
          break;
        default:
          throw new ValidationError(
            `Invalid action: ${(validated as { action: string }).action}`
          );
      }

      const executionTime = Date.now() - startTime;

      // T016: Return formatted response with metadata
      return {
        success: true,
        data: summary,
        metadata: {
          deduplication_applied: deduplicationApplied,
          original_count: originalCount,
          deduplicated_count: deduplicatedCount,
          execution_time_ms: executionTime,
        },
      };
    } catch (error) {
      // Handle validation errors
      if (error instanceof zodLib.ZodError) {
        const firstError = error.errors[0];
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: firstError.message || 'Validation error',
          },
        };
      }

      // Handle validation errors
      if (error instanceof ValidationError) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: error.message,
          },
        };
      }

      // Handle other errors
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message:
            error instanceof Error ? error.message : 'Unknown error occurred',
        },
      };
    }
  }

  /**
   * T017: Handle update action
   * Builds item_update commands with field updates
   */
  private async handleUpdateAction(
    taskIds: string[],
    params: BulkOperationInput
  ): Promise<BulkOperationSummary> {
    // Build update arguments from params
    const updateArgs: Record<string, unknown> = {};

    if (params.project_id !== undefined)
      updateArgs.project_id = params.project_id;
    if (params.section_id !== undefined)
      updateArgs.section_id = params.section_id;
    if (params.parent_id !== undefined) updateArgs.parent_id = params.parent_id;
    if (params.order !== undefined) updateArgs.order = params.order;
    if (params.labels !== undefined) updateArgs.labels = params.labels;
    if (params.priority !== undefined) updateArgs.priority = params.priority;
    if (params.assignee_id !== undefined)
      updateArgs.assignee_id = params.assignee_id;

    // Handle due date fields
    if (
      params.due_string !== undefined ||
      params.due_date !== undefined ||
      params.due_datetime !== undefined
    ) {
      const dueObj: Record<string, unknown> = {};
      if (params.due_string !== undefined) dueObj.string = params.due_string;
      if (params.due_date !== undefined) dueObj.date = params.due_date;
      if (params.due_datetime !== undefined)
        dueObj.datetime = params.due_datetime;
      if (params.due_lang !== undefined) dueObj.lang = params.due_lang;
      updateArgs.due = dueObj;
    }

    // Handle duration
    if (params.duration !== undefined && params.duration_unit !== undefined) {
      updateArgs.duration = {
        amount: params.duration,
        unit: params.duration_unit,
      };
    }

    // Handle deadline
    if (params.deadline_date !== undefined) {
      updateArgs.deadline = {
        date: params.deadline_date,
      };
    }

    // T017: Generate SyncCommand array with unique UUIDs
    const commands: SyncCommand[] = taskIds.map((taskId, index) => ({
      type: 'item_update',
      uuid: `cmd-${index}-task-${taskId}`,
      args: {
        id: taskId,
        ...updateArgs,
      },
    }));

    // T017: Call executeBatch and map results
    const response = await this.apiService.executeBatch(commands);
    return this.buildBulkOperationSummary(response, taskIds);
  }

  /**
   * T017: Handle complete action
   * Builds item_complete commands
   */
  private async handleCompleteAction(
    taskIds: string[]
  ): Promise<BulkOperationSummary> {
    // T017: Generate SyncCommand array (only id in args)
    const commands: SyncCommand[] = taskIds.map((taskId, index) => ({
      type: 'item_complete',
      uuid: `cmd-${index}-task-${taskId}`,
      args: {
        id: taskId,
      },
    }));

    // T017: Call executeBatch and map results
    const response = await this.apiService.executeBatch(commands);
    return this.buildBulkOperationSummary(response, taskIds);
  }

  /**
   * T017: Handle uncomplete action
   * Builds item_uncomplete commands
   */
  private async handleUncompleteAction(
    taskIds: string[]
  ): Promise<BulkOperationSummary> {
    // T017: Generate SyncCommand array (only id in args)
    const commands: SyncCommand[] = taskIds.map((taskId, index) => ({
      type: 'item_uncomplete',
      uuid: `cmd-${index}-task-${taskId}`,
      args: {
        id: taskId,
      },
    }));

    // T017: Call executeBatch and map results
    const response = await this.apiService.executeBatch(commands);
    return this.buildBulkOperationSummary(response, taskIds);
  }

  /**
   * T017: Handle move action
   * Builds item_move commands with project/section/parent
   */
  private async handleMoveAction(
    taskIds: string[],
    params: BulkOperationInput
  ): Promise<BulkOperationSummary> {
    // Build move arguments
    const moveArgs: Record<string, unknown> = {};

    if (params.project_id !== undefined)
      moveArgs.project_id = params.project_id;
    if (params.section_id !== undefined)
      moveArgs.section_id = params.section_id;
    if (params.parent_id !== undefined) moveArgs.parent_id = params.parent_id;

    // T017: Generate SyncCommand array
    const commands: SyncCommand[] = taskIds.map((taskId, index) => ({
      type: 'item_move',
      uuid: `cmd-${index}-task-${taskId}`,
      args: {
        id: taskId,
        ...moveArgs,
      },
    }));

    // T017: Call executeBatch and map results
    const response = await this.apiService.executeBatch(commands);
    return this.buildBulkOperationSummary(response, taskIds);
  }

  /**
   * T018: Map sync_status to OperationResult array and build summary
   * Helper method that maps Todoist Sync API response to our result format
   */
  private buildBulkOperationSummary(
    syncResponse: SyncResponse,
    taskIds: string[]
  ): BulkOperationSummary {
    // T018: Map each task to an OperationResult
    const results: OperationResult[] = taskIds.map((taskId, index) => {
      const uuid = `cmd-${index}-task-${taskId}`;
      const status = syncResponse.sync_status[uuid];

      // T018: Map "ok" to success
      if (status === 'ok') {
        return {
          task_id: taskId,
          success: true,
          error: null,
          resource_uri: `todoist://task/${taskId}`,
        };
      }

      // T018: Map error object to failure
      const errorObj = status as SyncError;
      return {
        task_id: taskId,
        success: false,
        error: errorObj.error_message || errorObj.error || 'Unknown error',
        resource_uri: `todoist://task/${taskId}`,
      };
    });

    // T017: Build summary with counts
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return {
      total_tasks: taskIds.length,
      successful,
      failed,
      results,
    };
  }
}
