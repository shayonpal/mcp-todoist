import { z } from 'zod';
import { TodoistApiService } from '../services/todoist-api.js';
import {
  TodoistFilter,
  TodoistTask,
  APIConfiguration,
} from '../types/todoist.js';
import { ValidationError } from '../types/errors.js';
import { handleToolError } from '../utils/tool-helpers.js';

/**
 * Input schema for the todoist_filters tool
 * Flattened for MCP client compatibility
 */
const TodoistFiltersInputSchema = z.object({
  action: z.enum([
    'list_filters',
    'get_filter',
    'query_filter',
    'create_filter',
    'update_filter',
    'delete_filter',
  ]),
  // Filter ID (for get_filter, query_filter, update_filter, delete_filter)
  filter_id: z.string().optional(),
  // Create/Update fields
  name: z.string().optional(),
  query: z.string().optional(),
  color: z.string().optional(),
  is_favorite: z.boolean().optional(),
  order: z.number().int().optional(),
  // Query fields
  lang: z.string().optional(),
});

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

  constructor(
    apiConfig: APIConfiguration,
    deps: { apiService?: TodoistApiService } = {}
  ) {
    this.apiService = deps.apiService ?? new TodoistApiService(apiConfig);
  }

  /**
   * Get the MCP tool definition
   */
  static getToolDefinition() {
    return {
      name: 'todoist_filters',
      description:
        'Filter management and task querying for Todoist - query existing filters, retrieve tasks within filters, and manage saved filter criteria',
      inputSchema: {
        type: 'object' as const,
        properties: {
          action: {
            type: 'string',
            enum: [
              'list_filters',
              'get_filter',
              'query_filter',
              'create_filter',
              'update_filter',
              'delete_filter',
            ],
            description: 'Action to perform',
          },
          filter_id: {
            type: 'string',
            description:
              'Filter ID (required for get_filter/query_filter/update_filter/delete_filter)',
          },
          name: { type: 'string', description: 'Filter name' },
          query: {
            type: 'string',
            description: 'Filter query (Todoist query syntax)',
          },
          color: { type: 'string', description: 'Filter color' },
          is_favorite: { type: 'boolean', description: 'Mark as favorite' },
          order: { type: 'number', description: 'Filter order' },
          lang: {
            type: 'string',
            description: 'Language code for query parsing',
          },
        },
        required: ['action'],
      },
    };
  }

  /**
   * Validate that required fields are present for each action
   */
  private validateActionRequirements(input: TodoistFiltersInput): void {
    switch (input.action) {
      case 'create_filter':
        if (!input.name)
          throw new ValidationError(
            'name is required for create_filter action'
          );
        if (!input.query)
          throw new ValidationError(
            'query is required for create_filter action'
          );
        break;
      case 'get_filter':
      case 'query_filter':
      case 'update_filter':
      case 'delete_filter':
        if (!input.filter_id!)
          throw new ValidationError(
            `filter_id is required for ${input.action} action`
          );
        break;
      case 'list_filters':
        // No required fields for list_filters
        break;
      default:
        throw new ValidationError('Invalid action specified');
    }
  }

  /**
   * Execute the tool with the given input
   */
  async execute(input: unknown): Promise<TodoistFiltersOutput> {
    const startTime = Date.now();

    try {
      // Validate input
      const validatedInput = TodoistFiltersInputSchema.parse(input);

      // Validate action-specific required fields
      this.validateActionRequirements(validatedInput);

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
    _input: TodoistFiltersInput
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
    input: TodoistFiltersInput
  ): Promise<TodoistFiltersOutput> {
    const filter = await this.apiService.getFilter(input.filter_id!);

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
    input: TodoistFiltersInput
  ): Promise<TodoistFiltersOutput> {
    // First get the filter to get its query
    const filter = await this.apiService.getFilter(input.filter_id!);

    // Then query tasks using the filter's query
    const response = await this.apiService.getTasks({
      query: filter.query,
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
        tasks: response.results,
      },
      message: `Filter query returned ${response.results.length} task(s)`,
      metadata: {
        task_count: response.results.length,
        query_parsed: filter.query,
      },
    };
  }

  /**
   * Create a new filter
   */
  private async handleCreateFilter(
    input: TodoistFiltersInput
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
    input: TodoistFiltersInput
  ): Promise<TodoistFiltersOutput> {
    const { filter_id, ...updateData } = input;

    // Remove undefined properties
    const cleanedData = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value !== undefined)
    );

    const filter = await this.apiService.updateFilter(filter_id!, cleanedData);

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
    input: TodoistFiltersInput
  ): Promise<TodoistFiltersOutput> {
    await this.apiService.deleteFilter(input.filter_id!);

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
    return handleToolError(error, operationTime) as TodoistFiltersOutput;
  }
}
