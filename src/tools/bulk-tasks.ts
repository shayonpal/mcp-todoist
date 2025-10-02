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
import { APIConfiguration, TodoistTask } from '../types/todoist.js';
import { ValidationError } from '../types/errors.js';
import { z as zodLib } from 'zod';

/**
 * T016: Bulk operation input schema
 * Matches contracts/mcp-tool-schema.json specification
 */
const BulkOperationInputSchema = z
  .object({
    action: z.enum(['update', 'complete', 'uncomplete', 'move', 'delete']),
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
  .passthrough()
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
        'Perform bulk operations on up to 50 Todoist tasks. Supports update, complete, uncomplete, move, and delete operations. Automatically deduplicates task IDs. Uses partial execution mode (continues on individual task failures). Returns individual results for each task with success/failure status.',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['update', 'complete', 'uncomplete', 'move', 'delete'],
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
        case 'delete':
          summary = await this.handleDeleteAction(uniqueTaskIds);
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
   * Uses hybrid approach: Sync API for most fields, REST API for deadline updates
   */
  private async handleUpdateAction(
    taskIds: string[],
    params: BulkOperationInput
  ): Promise<BulkOperationSummary> {
    // Build update arguments from params (excluding deadline)
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

    // Hybrid approach: Process Sync API updates first, then deadline via REST API
    let syncResponse: SyncResponse | null = null;

    // Step 1: Execute Sync API batch if there are non-deadline updates
    if (Object.keys(updateArgs).length > 0) {
      const commands: SyncCommand[] = taskIds.map((taskId, index) => ({
        type: 'item_update',
        uuid: `cmd-${index}-task-${taskId}`,
        args: {
          id: taskId,
          ...updateArgs,
        },
      }));

      syncResponse = await this.apiService.executeBatch(commands);
    } else {
      // No Sync API updates needed, create a synthetic success response
      syncResponse = {
        sync_status: Object.fromEntries(
          taskIds.map((taskId, index) => [`cmd-${index}-task-${taskId}`, 'ok'])
        ),
        temp_id_mapping: {},
        full_sync: false,
      };
    }

    // Step 2: Execute deadline updates via REST API (one by one)
    const deadlineResults: Map<string, { success: boolean; error?: string }> =
      new Map();

    if (params.deadline_date !== undefined) {
      await Promise.all(
        taskIds.map(async taskId => {
          try {
            // API service accepts deadline as string and transforms it to deadline_date
            // Type assertion needed because TodoistTask.deadline is typed as TodoistDeadline interface
            // but updateTask method runtime code accepts string (see todoist-api.ts:503-505)
            await this.apiService.updateTask(taskId, {
              deadline: params.deadline_date,
            } as Partial<TodoistTask>);
            deadlineResults.set(taskId, { success: true });
          } catch (error) {
            deadlineResults.set(taskId, {
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'Deadline update failed',
            });
          }
        })
      );
    }

    // Step 3: Merge results from Sync API and REST API deadline updates
    const mergedSummary = this.mergeSyncAndDeadlineResults(
      syncResponse,
      taskIds,
      deadlineResults
    );

    // Fetch actual task values for verification
    const summary = await this.buildBulkOperationSummaryWithVerification(
      mergedSummary,
      taskIds,
      params
    );
    return summary;
  }

  /**
   * Merge results from Sync API batch and REST API deadline updates
   * A task is only successful if BOTH operations succeeded
   */
  private mergeSyncAndDeadlineResults(
    syncResponse: SyncResponse,
    taskIds: string[],
    deadlineResults: Map<string, { success: boolean; error?: string }>
  ): SyncResponse {
    // If no deadline updates were made, return Sync API response as-is
    if (deadlineResults.size === 0) {
      return syncResponse;
    }

    // Merge Sync API and deadline update results
    const mergedStatus: Record<string, 'ok' | SyncError> = {};

    taskIds.forEach((taskId, index) => {
      const uuid = `cmd-${index}-task-${taskId}`;
      const syncStatus = syncResponse.sync_status[uuid];
      const deadlineStatus = deadlineResults.get(taskId);

      // Both operations must succeed for overall success
      if (syncStatus === 'ok' && deadlineStatus?.success) {
        mergedStatus[uuid] = 'ok';
      } else if (syncStatus !== 'ok') {
        // Sync API failed
        mergedStatus[uuid] = syncStatus as SyncError;
      } else if (deadlineStatus && !deadlineStatus.success) {
        // Deadline update failed
        mergedStatus[uuid] = {
          error: 'DEADLINE_UPDATE_FAILED',
          error_message: deadlineStatus.error || 'Failed to update deadline',
        };
      }
    });

    return {
      ...syncResponse,
      sync_status: mergedStatus,
    };
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
   * Uses individual moveTask calls (Sync API per task) since bulk Sync and REST update don't work
   */
  private async handleMoveAction(
    taskIds: string[],
    params: BulkOperationInput
  ): Promise<BulkOperationSummary> {
    // Build destination object - only one destination allowed per Todoist API
    const destination: {
      project_id?: string;
      section_id?: string;
      parent_id?: string;
    } = {};

    if (params.project_id !== undefined)
      destination.project_id = params.project_id;
    if (params.section_id !== undefined)
      destination.section_id = params.section_id;
    if (params.parent_id !== undefined)
      destination.parent_id = params.parent_id;

    // Execute move operations using moveTask (one by one, each uses Sync API)
    const moveResults = await Promise.all(
      taskIds.map(async taskId => {
        try {
          await this.apiService.moveTask(taskId, destination);
          return {
            task_id: taskId,
            success: true,
            error: null,
            resource_uri: `todoist://task/${taskId}`,
          };
        } catch (error) {
          return {
            task_id: taskId,
            success: false,
            error:
              error instanceof Error ? error.message : 'Move operation failed',
            resource_uri: `todoist://task/${taskId}`,
          };
        }
      })
    );

    // Build summary from individual results
    const successful = moveResults.filter(r => r.success).length;
    const failed = moveResults.filter(r => !r.success).length;

    return {
      total_tasks: taskIds.length,
      successful,
      failed,
      results: moveResults,
    };
  }

  /**
   * Handle delete action
   * Uses individual deleteTask calls (REST API per task) for reliable deletion
   * Returns individual results for each task to support partial execution mode
   */
  private async handleDeleteAction(
    taskIds: string[]
  ): Promise<BulkOperationSummary> {
    // Execute delete operations using deleteTask (one by one)
    const deleteResults = await Promise.all(
      taskIds.map(async taskId => {
        try {
          await this.apiService.deleteTask(taskId);
          return {
            task_id: taskId,
            success: true,
            error: null,
            resource_uri: `todoist://task/${taskId}`,
          };
        } catch (error) {
          return {
            task_id: taskId,
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Delete operation failed',
            resource_uri: `todoist://task/${taskId}`,
          };
        }
      })
    );

    // Build summary from individual results
    const successful = deleteResults.filter(r => r.success).length;
    const failed = deleteResults.filter(r => !r.success).length;

    return {
      total_tasks: taskIds.length,
      successful,
      failed,
      results: deleteResults,
    };
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

  /**
   * Build summary with verification by fetching actual task values
   * This helps confirm that updates were actually applied
   */
  private async buildBulkOperationSummaryWithVerification(
    syncResponse: SyncResponse,
    taskIds: string[],
    params: BulkOperationInput
  ): Promise<BulkOperationSummary> {
    // First build the basic summary
    const baseSummary = this.buildBulkOperationSummary(syncResponse, taskIds);

    // For successful operations, fetch actual task values for verification
    const verifiedResults = await Promise.all(
      baseSummary.results.map(async result => {
        if (!result.success) {
          return result; // Don't verify failed operations
        }

        try {
          // Fetch the actual task from Todoist
          const task = await this.apiService.getTask(result.task_id);

          // Build verified_values object with requested fields
          const verifiedValues: Record<string, unknown> = {};

          if (params.due_string || params.due_date || params.due_datetime) {
            verifiedValues.due = task.due;
          }
          if (params.deadline_date !== undefined) {
            verifiedValues.deadline = task.deadline;
          }
          if (params.priority !== undefined) {
            verifiedValues.priority = task.priority;
          }
          if (params.labels !== undefined) {
            verifiedValues.labels = task.labels;
          }
          if (params.project_id !== undefined) {
            verifiedValues.project_id = task.project_id;
          }
          if (params.section_id !== undefined) {
            verifiedValues.section_id = task.section_id;
          }
          if (params.parent_id !== undefined) {
            verifiedValues.parent_id = task.parent_id;
          }
          if (params.duration !== undefined) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            verifiedValues.duration = (task as any).duration;
          }

          return {
            ...result,
            verified_values: verifiedValues,
          };
        } catch (error) {
          // If verification fails, return original result (silently)
          // Error is logged for debugging but doesn't affect the response
          return result;
        }
      })
    );

    return {
      ...baseSummary,
      results: verifiedResults,
    };
  }
}
