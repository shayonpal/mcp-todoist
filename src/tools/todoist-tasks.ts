import { z } from 'zod';
import { TodoistApiService } from '../services/todoist-api.js';
import { BatchOperationsService } from '../services/batch.js';
import { CacheService } from '../services/cache.js';
import {
  BatchOperationSchema,
  BatchCommandSchema,
  DeadlineParameterSchema,
} from '../schemas/validation.js';
import {
  TodoistTask,
  TaskWithMetadata,
  APIConfiguration,
} from '../types/todoist.js';
import { ValidationError } from '../types/errors.js';
import {
  handleToolError,
  removeUndefinedProperties,
  buildRecurringWarning,
  buildPastDeadlineReminder,
} from '../utils/tool-helpers.js';

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
    'list_completed',
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
  deadline: DeadlineParameterSchema, // T026: Deadline parameter with validation
  // List/Query fields
  label_id: z.string().optional(),
  query: z.string().optional(),
  lang: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().max(200).optional(),
  // Batch operation fields
  batch_commands: z.array(BatchCommandSchema).optional(),
  // Completed tasks query fields (list_completed action)
  completed_query_type: z
    .enum(['by_completion_date', 'by_due_date'])
    .optional(),
  since: z.string().optional(),
  until: z.string().optional(),
  workspace_id: z.number().optional(),
  filter_query: z.string().optional(),
  filter_lang: z.string().optional(),
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
    | { items: TaskWithMetadata[]; next_cursor: string | null }
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
    warnings?: string[]; // Non-blocking advisory messages (e.g., recurring task deadline)
    reminders?: string[]; // Non-blocking informational messages (e.g., past deadline)
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
        'Comprehensive task management for Todoist - create, read, update, delete, and query tasks (including completed tasks) with full CRUD operations and batch support',
      inputSchema: {
        type: 'object' as const,
        properties: {
          action: {
            type: 'string',
            enum: [
              'create',
              'get',
              'update',
              'delete',
              'list',
              'complete',
              'uncomplete',
              'batch',
              'list_completed',
            ],
            description: 'Action to perform',
          },
          task_id: {
            type: 'string',
            description:
              'Task ID (required for get/update/delete/complete/uncomplete)',
          },
          content: { type: 'string', description: 'Task content/title' },
          description: { type: 'string', description: 'Task description' },
          project_id: {
            type: 'string',
            description:
              'Project ID (for create/update/list actions). When listing tasks, use this to filter by project including Inbox. Get project IDs from todoist_projects tool.',
          },
          section_id: { type: 'string', description: 'Section ID' },
          parent_id: { type: 'string', description: 'Parent task ID' },
          priority: { type: 'number', description: 'Priority (1-4)' },
          labels: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Label names (not IDs) - e.g., ["Work", "Important"]. Get available label names from todoist_labels tool.',
          },
          due_string: {
            type: 'string',
            description: 'Natural language due date',
          },
          due_date: { type: 'string', description: 'Due date (YYYY-MM-DD)' },
          due_datetime: {
            type: 'string',
            description: 'Due datetime (ISO 8601)',
          },
          assignee_id: { type: 'string', description: 'Assignee user ID' },
          deadline: {
            type: 'string',
            description:
              'Task completion deadline in YYYY-MM-DD format (e.g., 2025-10-15). When work must be done by, distinct from due_date (when work should start). Use null to remove deadline. Past dates allowed (triggers reminder). Recurring tasks trigger warning (deadline stays static).',
          },
          label_id: {
            type: 'string',
            description: 'Filter by label ID (for list)',
          },
          query: {
            type: 'string',
            description:
              'Filter query string (for list). Examples: "today" (due today), "tomorrow", "p1" (priority 1), "p2" (priority 2), "overdue", "no date", "#ProjectName" (tasks in project), "@LabelName" (tasks with label), "p1 & today" (high priority + due today). For content search use "search:" prefix: "search: meeting" (tasks containing "meeting"), "search: email & today" (tasks with "email" due today). For Inbox tasks, use project_id parameter instead of query.',
          },
          lang: {
            type: 'string',
            description: 'Language code for query parsing (for list)',
          },
          cursor: {
            type: 'string',
            description: 'Pagination cursor for next page (for list)',
          },
          limit: {
            type: 'number',
            description: 'Number of results per page, max 200 (for list)',
          },
          batch_commands: {
            type: 'array',
            description: 'Batch commands (for batch action)',
            items: { type: 'object' },
          },
          // Completed tasks query fields (list_completed action)
          completed_query_type: {
            type: 'string',
            enum: ['by_completion_date', 'by_due_date'],
            description:
              'Query type for completed tasks: by_completion_date (3-month window) or by_due_date (6-week window). Required for list_completed action.',
          },
          since: {
            type: 'string',
            description:
              'Start of time window (ISO 8601 datetime, inclusive). Required for list_completed. Max window: 92 days for completion date, 42 days for due date.',
          },
          until: {
            type: 'string',
            description:
              'End of time window (ISO 8601 datetime, inclusive). Required for list_completed. Must be after since.',
          },
          workspace_id: {
            type: 'number',
            description:
              'Filter by workspace ID (for list_completed). Optional.',
          },
          filter_query: {
            type: 'string',
            description:
              'Advanced filter query using Todoist filter syntax (for list_completed). Examples: "@Work & p1" (Work label + priority 1), "search: meeting" (content search). Optional.',
          },
          filter_lang: {
            type: 'string',
            description:
              'Language code for parsing filter_query (for list_completed). Default: "en". Optional.',
          },
        },
        required: ['action'],
      },
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
        // project_id is optional - if not provided, task goes to Inbox
        break;
      case 'get':
      case 'delete':
      case 'complete':
      case 'uncomplete':
        if (!input.task_id)
          throw new ValidationError(
            `task_id is required for ${input.action} action`
          );
        break;
      case 'update':
        if (!input.task_id)
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
      case 'list_completed':
        // Validation will be done by CompletedTasksInputSchema in handleListCompleted
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
        case 'list_completed':
          result = await this.handleListCompleted(validatedInput);
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
    // T026, T027: Include deadline parameter in task data
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
      deadline: input.deadline, // T026: Add deadline parameter support
    };

    // Remove undefined properties
    const cleanedData = removeUndefinedProperties(taskData);

    const task = await this.apiService.createTask(cleanedData);
    const enrichedTask = await this.enrichTaskWithMetadata(task);

    // T029, T030: Build warnings and reminders
    const warnings: string[] = [];
    const reminders: string[] = [];

    // Check if task is recurring and has a deadline
    if (input.deadline && enrichedTask.due?.is_recurring) {
      const warning = buildRecurringWarning(true);
      if (warning) warnings.push(warning);
    }

    // Check if deadline is in the past
    if (input.deadline && typeof input.deadline === 'string') {
      const reminder = buildPastDeadlineReminder(input.deadline);
      if (reminder) reminders.push(reminder);
    }

    return {
      success: true,
      data: enrichedTask,
      message: 'Task created successfully',
      metadata: {
        ...(warnings.length > 0 && { warnings }),
        ...(reminders.length > 0 && { reminders }),
      },
    };
  }

  /**
   * Get a specific task by ID
   */
  private async handleGet(
    input: TodoistTasksInput
  ): Promise<TodoistTasksOutput> {
    const taskId = input.task_id;
    if (!taskId) {
      throw new ValidationError('task_id is required for get action');
    }

    const task = await this.apiService.getTask(taskId);
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { task_id, ...updateData } = input;

    if (!task_id) {
      throw new ValidationError('task_id is required for update action');
    }

    // T028: Include deadline in update data
    // Separate move fields from update fields
    const moveFields: {
      project_id?: string;
      section_id?: string;
      parent_id?: string;
    } = {};
    const otherFields: Record<string, unknown> = {};

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        if (
          key === 'project_id' ||
          key === 'section_id' ||
          key === 'parent_id'
        ) {
          moveFields[key as keyof typeof moveFields] = value as string;
        } else {
          otherFields[key] = value;
        }
      }
    });

    const hasMoveFields = Object.keys(moveFields).length > 0;
    const hasUpdateFields = Object.keys(otherFields).length > 0;

    // Perform move operation if needed
    if (hasMoveFields) {
      await this.apiService.moveTask(task_id, moveFields);
    }

    // Perform update operation if needed
    if (hasUpdateFields) {
      await this.apiService.updateTask(task_id, otherFields);
    }

    // Fetch the final task state
    const task = await this.apiService.getTask(task_id);
    const enrichedTask = await this.enrichTaskWithMetadata(task);

    // T029, T030: Build warnings and reminders for deadline updates
    const warnings: string[] = [];
    const reminders: string[] = [];

    // Check if deadline was updated and task is recurring
    if (input.deadline && enrichedTask.due?.is_recurring) {
      const warning = buildRecurringWarning(true);
      if (warning) warnings.push(warning);
    }

    // Check if deadline is in the past
    if (input.deadline && typeof input.deadline === 'string') {
      const reminder = buildPastDeadlineReminder(input.deadline);
      if (reminder) reminders.push(reminder);
    }

    const operations = [];
    if (hasMoveFields) operations.push('moved');
    if (hasUpdateFields) operations.push('updated');

    return {
      success: true,
      data: enrichedTask,
      message: `Task ${operations.join(' and ')} successfully`,
      metadata: {
        ...(warnings.length > 0 && { warnings }),
        ...(reminders.length > 0 && { reminders }),
      },
    };
  }

  /**
   * Delete a task
   */
  private async handleDelete(
    input: TodoistTasksInput
  ): Promise<TodoistTasksOutput> {
    const taskId = input.task_id;
    if (!taskId) {
      throw new ValidationError('task_id is required for delete action');
    }

    await this.apiService.deleteTask(taskId);

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
    let response: { results: TodoistTask[]; next_cursor: string | null };

    // Route to appropriate endpoint based on parameters
    if (input.query) {
      // Use /tasks/filter endpoint for query-based filtering
      response = await this.apiService.getTasksByFilter(
        input.query,
        input.lang,
        input.cursor,
        input.limit
      );
    } else {
      // Use /tasks endpoint for project/section/label filtering
      const queryParams: Record<string, string | number> = {};
      if (input.project_id) queryParams.project_id = input.project_id;
      if (input.section_id) queryParams.section_id = input.section_id;
      if (input.label_id) queryParams.label_id = input.label_id;
      if (input.cursor) queryParams.cursor = input.cursor;
      if (input.limit) queryParams.limit = input.limit;

      response = await this.apiService.getTasks(queryParams);
    }

    const enrichedTasks = await Promise.all(
      response.results.map(task => this.enrichTaskWithMetadata(task))
    );

    return {
      success: true,
      data: enrichedTasks,
      message: `Retrieved ${enrichedTasks.length} task(s)`,
      metadata: {
        total_count: enrichedTasks.length,
        has_more: !!response.next_cursor,
        next_cursor: response.next_cursor || undefined,
      },
    };
  }

  /**
   * Complete a task
   */
  private async handleComplete(
    input: TodoistTasksInput
  ): Promise<TodoistTasksOutput> {
    const taskId = input.task_id;
    if (!taskId) {
      throw new ValidationError('task_id is required for complete action');
    }

    await this.apiService.completeTask(taskId);

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
    const taskId = input.task_id;
    if (!taskId) {
      throw new ValidationError('task_id is required for uncomplete action');
    }

    await this.apiService.reopenTask(taskId);

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
    const batchCommands = input.batch_commands;
    if (!batchCommands || batchCommands.length === 0) {
      throw new ValidationError('batch_commands is required for batch action');
    }

    BatchOperationSchema.parse({ batch_commands: batchCommands });

    const commands = batchCommands.map(cmd => ({
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
   * Query completed tasks by completion date or due date
   */
  private async handleListCompleted(
    input: TodoistTasksInput
  ): Promise<TodoistTasksOutput> {
    // Validate with CompletedTasksInputSchema
    const { CompletedTasksInputSchema } = await import(
      '../schemas/validation.js'
    );
    const validatedInput = CompletedTasksInputSchema.parse(input);

    // Dispatch to appropriate API method
    let response: { items: TodoistTask[]; next_cursor: string | null };

    if (validatedInput.completed_query_type === 'by_completion_date') {
      response = await this.apiService.getCompletedTasksByCompletionDate({
        since: validatedInput.since,
        until: validatedInput.until,
        project_id: validatedInput.project_id,
        section_id: validatedInput.section_id,
        workspace_id: validatedInput.workspace_id,
        parent_id: validatedInput.parent_id,
        filter_query: validatedInput.filter_query,
        filter_lang: validatedInput.filter_lang,
        cursor: validatedInput.cursor,
        limit: validatedInput.limit,
      });
    } else {
      response = await this.apiService.getCompletedTasksByDueDate({
        since: validatedInput.since,
        until: validatedInput.until,
        project_id: validatedInput.project_id,
        section_id: validatedInput.section_id,
        workspace_id: validatedInput.workspace_id,
        parent_id: validatedInput.parent_id,
        filter_query: validatedInput.filter_query,
        filter_lang: validatedInput.filter_lang,
        cursor: validatedInput.cursor,
        limit: validatedInput.limit,
      });
    }

    // Enrich tasks with metadata
    const enrichedTasks = await Promise.all(
      response.items.map(task => this.enrichTaskWithMetadata(task))
    );

    return {
      success: true,
      data: {
        items: enrichedTasks,
        next_cursor: response.next_cursor,
      },
      message: `Retrieved ${enrichedTasks.length} completed tasks`,
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
    return handleToolError(error, operationTime) as TodoistTasksOutput;
  }
}
