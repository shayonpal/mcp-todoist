import { z } from 'zod';
import { TodoistApiService } from '../services/todoist-api.js';
import { CreateFilterSchema } from '../schemas/validation.js';
import {
  TodoistFilter,
  TodoistTask,
  APIConfiguration,
} from '../types/todoist.js';
import {
  TodoistAPIError,
  TodoistErrorCode,
  ValidationError,
} from '../types/errors.js';

/**
 * Input schema for the todoist_filters tool
 */
const TodoistFiltersInputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('list_filters'),
  }),
  z.object({
    action: z.literal('get_filter'),
    filter_id: z.string().min(1, 'Filter ID is required'),
  }),
  z.object({
    action: z.literal('query_filter'),
    filter_id: z.string().min(1, 'Filter ID is required'),
    lang: z.string().default('en'),
  }),
  z.object({
    action: z.literal('create_filter'),
    ...CreateFilterSchema.shape,
  }),
  z.object({
    action: z.literal('update_filter'),
    filter_id: z.string().min(1, 'Filter ID is required'),
    name: z.string().max(120).optional(),
    query: z.string().optional(),
    color: z.string().optional(),
    is_favorite: z.boolean().optional(),
    order: z.number().int().min(1).optional(),
  }),
  z.object({
    action: z.literal('delete_filter'),
    filter_id: z.string().min(1, 'Filter ID is required'),
  }),
]);

type TodoistFiltersInput = z.infer<typeof TodoistFiltersInputSchema>;

/**
 * Output schema for the todoist_filters tool
 */
interface TodoistFiltersOutput {
  success: boolean;
  data?:
    | TodoistFilter
    | TodoistFilter[]
    | {
        filter: TodoistFilter;
        tasks: TodoistTask[];
      }
    | Record<string, unknown>;
  message?: string;
  metadata?: {
    total_filters?: number;
    favorite_filters?: number;
    task_count?: number;
    query_parsed?: string;
    operation_time?: number;
    rate_limit_remaining?: number;
    rate_limit_reset?: string;
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
 * TodoistFiltersTool - Filter management and task querying for Todoist
 *
 * Handles all operations on filters including:
 * - Listing all user filters
 * - Getting individual filter details
 * - Querying tasks using filter criteria
 * - Creating new filters with custom queries
 * - Updating filter properties
 * - Deleting filters
 * - Supporting Todoist query syntax
 */
export class TodoistFiltersTool {
  private readonly apiService: TodoistApiService;

  constructor(apiConfig: APIConfiguration) {
    this.apiService = new TodoistApiService(apiConfig);
  }

  /**
   * Get the MCP tool definition
   */
  static getToolDefinition() {
    return {
      name: 'todoist_filters',
      description:
        'Filter management and task querying for Todoist - query existing filters, retrieve tasks within filters, and manage saved filter criteria',
      inputSchema: TodoistFiltersInputSchema.describe(
        'Filter management and query operations'
      ),
    };
  }

  /**
   * Execute the tool with the given input
   */
  async execute(input: unknown): Promise<TodoistFiltersOutput> {
    const startTime = Date.now();

    try {
      // Validate input
      const validatedInput = TodoistFiltersInputSchema.parse(input);

      let result: TodoistFiltersOutput;

      // Route to appropriate handler based on action
      switch (validatedInput.action) {
        case 'list_filters':
          result = await this.handleListFilters(validatedInput);
          break;
        case 'get_filter':
          result = await this.handleGetFilter(validatedInput);
          break;
        case 'query_filter':
          result = await this.handleQueryFilter(validatedInput);
          break;
        case 'create_filter':
          result = await this.handleCreateFilter(validatedInput);
          break;
        case 'update_filter':
          result = await this.handleUpdateFilter(validatedInput);
          break;
        case 'delete_filter':
          result = await this.handleDeleteFilter(validatedInput);
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
   * List all filters
   */
  private async handleListFilters(
    _input: Extract<TodoistFiltersInput, { action: 'list_filters' }>
  ): Promise<TodoistFiltersOutput> {
    const filters = await this.apiService.getFilters();

    // Calculate metadata
    const favoriteCount = filters.filter(filter => filter.is_favorite).length;

    return {
      success: true,
      data: filters,
      message: `Retrieved ${filters.length} filter(s)`,
      metadata: {
        total_filters: filters.length,
        favorite_filters: favoriteCount,
      },
    };
  }

  /**
   * Get a specific filter by ID
   */
  private async handleGetFilter(
    input: Extract<TodoistFiltersInput, { action: 'get_filter' }>
  ): Promise<TodoistFiltersOutput> {
    const filter = await this.apiService.getFilter(input.filter_id);

    return {
      success: true,
      data: filter,
      message: 'Filter retrieved successfully',
    };
  }

  /**
   * Query tasks using a filter
   */
  private async handleQueryFilter(
    input: Extract<TodoistFiltersInput, { action: 'query_filter' }>
  ): Promise<TodoistFiltersOutput> {
    // First get the filter to get its query
    const filter = await this.apiService.getFilter(input.filter_id);

    // Then query tasks using the filter's query
    const tasks = await this.apiService.getTasks({
      filter: filter.query,
      lang: input.lang,
    });

    return {
      success: true,
      data: {
        filter: {
          id: filter.id,
          name: filter.name,
          query: filter.query,
        },
        tasks,
      },
      message: `Filter query returned ${tasks.length} task(s)`,
      metadata: {
        task_count: tasks.length,
        query_parsed: filter.query,
      },
    };
  }

  /**
   * Create a new filter
   */
  private async handleCreateFilter(
    input: Extract<TodoistFiltersInput, { action: 'create_filter' }>
  ): Promise<TodoistFiltersOutput> {
    const filterData = {
      name: input.name,
      query: input.query,
      color: input.color,
      is_favorite: input.is_favorite,
      order: input.order,
    };

    // Remove undefined properties
    const cleanedData = Object.fromEntries(
      Object.entries(filterData).filter(([_, value]) => value !== undefined)
    );

    const filter = await this.apiService.createFilter(cleanedData);

    return {
      success: true,
      data: filter,
      message: 'Filter created successfully',
    };
  }

  /**
   * Update an existing filter
   */
  private async handleUpdateFilter(
    input: Extract<TodoistFiltersInput, { action: 'update_filter' }>
  ): Promise<TodoistFiltersOutput> {
    const { filter_id, ...updateData } = input;

    // Remove undefined properties
    const cleanedData = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value !== undefined)
    );

    const filter = await this.apiService.updateFilter(filter_id, cleanedData);

    return {
      success: true,
      data: filter,
      message: 'Filter updated successfully',
    };
  }

  /**
   * Delete a filter
   */
  private async handleDeleteFilter(
    input: Extract<TodoistFiltersInput, { action: 'delete_filter' }>
  ): Promise<TodoistFiltersOutput> {
    await this.apiService.deleteFilter(input.filter_id);

    return {
      success: true,
      message: 'Filter deleted successfully',
    };
  }

  /**
   * Handle errors and convert them to standardized output format
   */
  private handleError(
    error: unknown,
    operationTime: number
  ): TodoistFiltersOutput {
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
