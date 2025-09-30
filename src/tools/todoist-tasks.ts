import { z } from 'zod';
import { TodoistApiService } from '../services/todoist-api.js';
import { BatchOperationsService } from '../services/batch.js';
import { CacheService } from '../services/cache.js';
import {
  BatchOperationSchema,
  BatchCommandSchema,
} from '../schemas/validation.js';
import {
  TodoistTask,
  TaskWithMetadata,
  APIConfiguration,
} from '../types/todoist.js';
import {
  TodoistAPIError,
  TodoistErrorCode,
  ValidationError,
} from '../types/errors.js';

/**
 * Input schema for the todoist_tasks tool
 * Flattened for MCP client compatibility
 */
const TodoistTasksInputSchema = z.object({
  action: z.enum([
    'create',
    'get',
    'update',
    'delete',
    'list',
    'complete',
    'uncomplete',
    'batch',
  ]),
  // Task ID (for get, update, delete, complete, uncomplete)
  task_id: z.string().optional(),
  // Create/Update fields
  content: z.string().optional(),
  description: z.string().optional(),
  project_id: z.string().optional(),
  section_id: z.string().optional(),
  parent_id: z.string().optional(),
  priority: z.number().int().optional(),
  labels: z.array(z.string()).optional(),
  due_string: z.string().optional(),
  due_date: z.string().optional(),
  due_datetime: z.string().optional(),
  assignee_id: z.string().optional(),
  // List/Query fields
  label_id: z.string().optional(),
  filter: z.string().optional(),
  lang: z.string().optional(),
  // Batch operation fields
  batch_commands: z.array(BatchCommandSchema).optional(),
});

type TodoistTasksInput = z.infer<typeof TodoistTasksInputSchema>;

/**
 * Output schema for the todoist_tasks tool
 */
interface TodoistTasksOutput {
  success: boolean;
  data?:
    | TodoistTask
    | TodoistTask[]
    | TaskWithMetadata
    | TaskWithMetadata[]
    | Record<string, unknown>;
  message?: string;
  metadata?: {
    total_count?: number;
    has_more?: boolean;
    next_cursor?: string;
    operation_time?: number;
    rate_limit_remaining?: number;
    rate_limit_reset?: string;
    completed_commands?: number;
    failed_commands?: number;
    batch_errors?: Array<{
      command_index?: number;
      temp_id?: string;
      error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
        retryable: boolean;
        retry_after?: number;
      };
    }>;
  };
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    retryable: boolean;
    retry_after?: number;
  };
}

/**
 * TodoistTasksTool - Comprehensive task management for Todoist
 *
 * Handles all CRUD operations on tasks including:
 * - Creating tasks with full metadata
 * - Reading individual tasks or lists with filtering
 * - Updating task properties
 * - Deleting tasks
 * - Completing/uncompleting tasks
 * - Batch operations for bulk task management
 */
export class TodoistTasksTool {
  private readonly apiService: TodoistApiService;
  private readonly batchService: BatchOperationsService;
  private readonly cacheService: CacheService;

  constructor(
    apiConfig: APIConfiguration,
    deps: {
      apiService?: TodoistApiService;
      batchService?: BatchOperationsService;
      cacheService?: CacheService;
    } = {}
  ) {
    this.apiService = deps.apiService ?? new TodoistApiService(apiConfig);
    this.batchService =
      deps.batchService ?? new BatchOperationsService(this.apiService);
    this.cacheService = deps.cacheService ?? new CacheService();
  }

  /**
   * Get the MCP tool definition
   */
  static getToolDefinition() {
    return {
      name: 'todoist_tasks',
      description:
        'Comprehensive task management for Todoist - create, read, update, delete, and query tasks with full CRUD operations and batch support',
      inputSchema: TodoistTasksInputSchema,
    };
  }

  /**
   * Validate that required fields are present for each action
   */
  private validateActionRequirements(input: TodoistTasksInput): void {
    switch (input.action) {
      case 'create':
        if (!input.content)
          throw new ValidationError('content is required for create action');
        if (!input.project_id)
          throw new ValidationError('project_id is required for create action');
        break;
      case 'get':
      case 'delete':
      case 'complete':
      case 'uncomplete':
        if (!input.task_id!)
          throw new ValidationError(
            `task_id is required for ${input.action} action`
          );
        break;
      case 'update':
        if (!input.task_id!)
          throw new ValidationError('task_id is required for update action');
        break;
      case 'batch':
        if (!input.batch_commands || input.batch_commands.length === 0)
          throw new ValidationError(
            'batch_commands is required for batch action'
          );
        break;
      case 'list':
        // No required fields for list
        break;
      default:
        throw new ValidationError('Invalid action specified');
    }
  }

  /**
   * Execute the tool with the given input
   */
  async execute(input: unknown): Promise<TodoistTasksOutput> {
    const startTime = Date.now();

    try {
      // Validate input
      const validatedInput = TodoistTasksInputSchema.parse(input);

      // Validate action-specific required fields
      this.validateActionRequirements(validatedInput);

      let result: TodoistTasksOutput;

      // Route to appropriate handler based on action
      switch (validatedInput.action) {
        case 'create':
          result = await this.handleCreate(validatedInput);
          break;
        case 'get':
          result = await this.handleGet(validatedInput);
          break;
        case 'update':
          result = await this.handleUpdate(validatedInput);
          break;
        case 'delete':
          result = await this.handleDelete(validatedInput);
          break;
        case 'list':
          result = await this.handleList(validatedInput);
          break;
        case 'complete':
          result = await this.handleComplete(validatedInput);
          break;
        case 'uncomplete':
          result = await this.handleUncomplete(validatedInput);
          break;
        case 'batch':
          result = await this.handleBatch(validatedInput);
          break;
        default:
          throw new ValidationError('Invalid action specified');
      }

      // Add operation metadata
      const operationTime = Date.now() - startTime;
      const rateLimitStatus = this.apiService.getRateLimitStatus();

      result.metadata = {
        ...result.metadata,
        operation_time: operationTime,
        rate_limit_remaining: rateLimitStatus.rest.remaining,
        rate_limit_reset: new Date(
          rateLimitStatus.rest.resetTime
        ).toISOString(),
      };

      return result;
    } catch (error) {
      return this.handleError(error, Date.now() - startTime);
    }
  }

  /**
   * Create a new task
   */
  private async handleCreate(
    input: TodoistTasksInput
  ): Promise<TodoistTasksOutput> {
    const taskData = {
      content: input.content,
      description: input.description,
      project_id: input.project_id,
      section_id: input.section_id,
      parent_id: input.parent_id,
      priority: input.priority,
      labels: input.labels,
      due_string: input.due_string,
      due_date: input.due_date,
      due_datetime: input.due_datetime,
      assignee_id: input.assignee_id,
    };

    // Remove undefined properties
    const cleanedData = Object.fromEntries(
      Object.entries(taskData).filter(([_, value]) => value !== undefined)
    );

    const task = await this.apiService.createTask(cleanedData);
    const enrichedTask = await this.enrichTaskWithMetadata(task);

    return {
      success: true,
      data: enrichedTask,
      message: 'Task created successfully',
    };
  }

  /**
   * Get a specific task by ID
   */
  private async handleGet(
    input: TodoistTasksInput
  ): Promise<TodoistTasksOutput> {
    const task = await this.apiService.getTask(input.task_id!);
    const enrichedTask = await this.enrichTaskWithMetadata(task);

    return {
      success: true,
      data: enrichedTask,
      message: 'Task retrieved successfully',
    };
  }

  /**
   * Update an existing task
   */
  private async handleUpdate(
    input: TodoistTasksInput
  ): Promise<TodoistTasksOutput> {
    const { task_id, ...updateData } = input;

    // Remove undefined properties
    const cleanedData = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value !== undefined)
    );

    const task = await this.apiService.updateTask(task_id!, cleanedData);
    const enrichedTask = await this.enrichTaskWithMetadata(task);

    return {
      success: true,
      data: enrichedTask,
      message: 'Task updated successfully',
    };
  }

  /**
   * Delete a task
   */
  private async handleDelete(
    input: TodoistTasksInput
  ): Promise<TodoistTasksOutput> {
    await this.apiService.deleteTask(input.task_id!);

    return {
      success: true,
      message: 'Task deleted successfully',
    };
  }

  /**
   * List tasks with optional filtering
   */
  private async handleList(
    input: TodoistTasksInput
  ): Promise<TodoistTasksOutput> {
    const queryParams: Record<string, string> = {};

    if (input.project_id) queryParams.project_id = input.project_id;
    if (input.section_id) queryParams.section_id = input.section_id;
    if (input.label_id) queryParams.label_id = input.label_id;
    if (input.filter) queryParams.filter = input.filter;
    if (input.lang) queryParams.lang = input.lang;

    const tasks = await this.apiService.getTasks(queryParams);
    const enrichedTasks = await Promise.all(
      tasks.map(task => this.enrichTaskWithMetadata(task))
    );

    return {
      success: true,
      data: enrichedTasks,
      message: `Retrieved ${enrichedTasks.length} task(s)`,
      metadata: {
        total_count: enrichedTasks.length,
        has_more: false, // Todoist API doesn't provide pagination info for this endpoint
      },
    };
  }

  /**
   * Complete a task
   */
  private async handleComplete(
    input: TodoistTasksInput
  ): Promise<TodoistTasksOutput> {
    await this.apiService.completeTask(input.task_id!);

    return {
      success: true,
      message: 'Task completed successfully',
    };
  }

  /**
   * Uncomplete (reopen) a task
   */
  private async handleUncomplete(
    input: TodoistTasksInput
  ): Promise<TodoistTasksOutput> {
    await this.apiService.reopenTask(input.task_id!);

    return {
      success: true,
      message: 'Task reopened successfully',
    };
  }

  /**
   * Execute batch operations
   */
  private async handleBatch(
    input: TodoistTasksInput
  ): Promise<TodoistTasksOutput> {
    BatchOperationSchema.parse({ batch_commands: input.batch_commands });

    // Convert input commands to proper BatchCommand format
    const commands = input.batch_commands!.map(cmd => ({
      ...cmd,
      uuid: cmd.uuid || `${Date.now()}-${Math.random()}`,
    }));

    const batchResult = await this.batchService.executeBatch({
      commands,
      options: {
        continueOnError: true, // Continue processing even if some commands fail
      },
    });

    // Build sync_status for ALL commands (successful and failed)
    const syncStatus: Record<string, string> = {};

    // Mark all commands as successful initially
    commands.forEach(cmd => {
      if (cmd.temp_id) {
        syncStatus[cmd.temp_id] = 'ok';
      }
    });

    // Override with error status for failed commands
    batchResult.errors.forEach(error => {
      if (error.temp_id) {
        syncStatus[error.temp_id] = 'error';
      }
    });

    return {
      success: batchResult.success,
      data: {
        sync_status: syncStatus,
        temp_id_mapping: batchResult.temp_id_mapping,
        full_sync: false,
      },
      message: batchResult.success
        ? 'Batch operation completed successfully'
        : `Batch operation completed with ${batchResult.failed_commands} failures`,
      metadata: {
        completed_commands: batchResult.completed_commands,
        failed_commands: batchResult.failed_commands,
        batch_errors: batchResult.errors,
      },
    };
  }

  /**
   * Enrich task with metadata like project name, section name, label names, etc.
   */
  private async enrichTaskWithMetadata(
    task: TodoistTask
  ): Promise<TaskWithMetadata> {
    let projectName: string | undefined;
    let sectionName: string | undefined;
    let labelNames: string[] = [];
    let isOverdue = false;
    let isToday = false;
    let isUpcoming = false;

    try {
      // Get project name
      if (task.project_id) {
        const projects = await this.cacheService.getProjects();
        const project = projects?.find(p => p.id === task.project_id);
        projectName = project?.name;
      }

      // Get section name
      if (task.section_id) {
        const sections = await this.cacheService.getSections(task.project_id);
        const section = sections?.find(s => s.id === task.section_id);
        sectionName = section?.name;
      }

      // Get label names
      if (task.labels && task.labels.length > 0) {
        const labels = await this.cacheService.getLabels();
        labelNames = task.labels
          .map(labelId => labels?.find(l => l.id === labelId)?.name)
          .filter(Boolean) as string[];
      }

      // Calculate date flags
      if (task.due?.date || task.due?.datetime) {
        const now = new Date();
        const today = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );
        const dueDate = new Date(task.due.datetime || task.due.date);

        isOverdue = dueDate < now && !task.completed;
        isToday = dueDate.toDateString() === today.toDateString();
        isUpcoming =
          dueDate > today &&
          dueDate <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
    } catch (error) {
      // If enrichment fails, return the base task
      // This ensures the core functionality works even if metadata lookup fails
      // eslint-disable-next-line no-console
      console.warn('Failed to enrich task metadata:', error);
    }

    const enriched: TaskWithMetadata = {
      ...task,
      project_name: projectName,
      section_name: sectionName,
      label_names: labelNames,
      is_overdue: isOverdue,
      is_today: isToday,
      is_upcoming: isUpcoming,
      priority_name: this.getPriorityName(task.priority),
    };

    return enriched;
  }

  /**
   * Convert priority number to human-readable name
   */
  private getPriorityName(
    priority: number
  ): 'Low' | 'Normal' | 'High' | 'Urgent' {
    switch (priority) {
      case 1:
        return 'Low';
      case 2:
        return 'Normal';
      case 3:
        return 'High';
      case 4:
        return 'Urgent';
      default:
        return 'Normal';
    }
  }

  /**
   * Handle errors and convert them to standardized output format
   */
  private handleError(
    error: unknown,
    operationTime: number
  ): TodoistTasksOutput {
    let todoistError;

    if (error instanceof TodoistAPIError) {
      todoistError = error.toTodoistError();
    } else if (error instanceof z.ZodError) {
      todoistError = {
        code: TodoistErrorCode.VALIDATION_ERROR,
        message: 'Invalid input parameters',
        details: { validationErrors: error.errors },
        retryable: false,
      };
    } else {
      todoistError = {
        code: TodoistErrorCode.UNKNOWN_ERROR,
        message: (error as Error).message || 'An unexpected error occurred',
        details: { originalError: error },
        retryable: false,
      };
    }

    return {
      success: false,
      error: todoistError,
      metadata: {
        operation_time: operationTime,
      },
    };
  }
}
