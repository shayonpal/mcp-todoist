import { z } from 'zod';
import { TodoistApiService } from '../services/todoist-api.js';
import { CacheService } from '../services/cache.js';
import { TodoistLabel, APIConfiguration } from '../types/todoist.js';
import { ValidationError } from '../types/errors.js';
import {
  handleToolError,
  removeUndefinedProperties,
} from '../utils/tool-helpers.js';

/**
 * Input schema for the todoist_labels tool
 * Flattened for MCP client compatibility
 */
const TodoistLabelsInputSchema = z.object({
  action: z.enum([
    'create',
    'get',
    'update',
    'delete',
    'list',
    'rename_shared',
    'remove_shared',
  ]),
  // Label ID (for get, update, delete)
  label_id: z.string().optional(),
  // Label name (for create, rename_shared, remove_shared)
  name: z.string().max(128).optional(),
  // New name (for rename_shared)
  new_name: z.string().max(128).optional(),
  // Label properties
  color: z.string().optional(),
  order: z.number().optional(),
  is_favorite: z.boolean().optional(),
  // Pagination (for list)
  cursor: z.string().optional(),
  limit: z.number().min(1).max(200).optional(),
});

type TodoistLabelsInput = z.infer<typeof TodoistLabelsInputSchema>;

/**
 * Output schema for the todoist_labels tool
 */
interface TodoistLabelsOutput {
  success: boolean;
  data?: TodoistLabel | TodoistLabel[] | null;
  message?: string;
  metadata?: {
    total_count?: number;
    next_cursor?: string | null;
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
 * TodoistLabelsTool - Complete label management for Todoist
 *
 * Handles all CRUD operations on labels including:
 * - Creating personal labels with full metadata
 * - Reading individual labels or lists with pagination
 * - Updating label properties
 * - Deleting labels (removes from all tasks)
 * - Listing labels with cursor-based pagination
 * - Renaming shared labels across all tasks
 * - Removing shared labels from all tasks
 */
export class TodoistLabelsTool {
  private readonly apiService: TodoistApiService;
  private readonly cacheService: CacheService;

  constructor(
    apiConfig: APIConfiguration,
    deps: {
      apiService?: TodoistApiService;
      cacheService?: CacheService;
    } = {}
  ) {
    this.apiService = deps.apiService ?? new TodoistApiService(apiConfig);
    this.cacheService = deps.cacheService ?? new CacheService();
  }

  /**
   * Get the MCP tool definition
   */
  static getToolDefinition() {
    return {
      name: 'todoist_labels',
      description:
        'label management for Todoist - create, read, update, delete labels with full CRUD operations',
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
              'rename_shared',
              'remove_shared',
            ],
            description: 'Action to perform on labels',
          },
          label_id: {
            type: 'string',
            description: 'Label ID (required for get, update, delete)',
          },
          name: {
            type: 'string',
            description: 'Label name (required for create, rename_shared)',
          },
          new_name: {
            type: 'string',
            description: 'New label name (required for rename_shared)',
          },
          color: {
            type: 'string',
            description: 'Predefined color ID',
          },
          order: {
            type: 'number',
            description: 'Display order',
          },
          is_favorite: {
            type: 'boolean',
            description: 'Mark as favorite',
          },
          cursor: {
            type: 'string',
            description: 'Pagination cursor (for list action)',
          },
          limit: {
            type: 'number',
            description: 'Page size (for list action, default 50, max 200)',
          },
        },
        required: ['action'],
      },
    };
  }

  /**
   * Validate that required fields are present for each action
   */
  private validateActionRequirements(input: TodoistLabelsInput): void {
    switch (input.action) {
      case 'create':
        if (!input.name)
          throw new ValidationError('name is required for create action');
        break;
      case 'get':
      case 'update':
      case 'delete':
        if (!input.label_id)
          throw new ValidationError(
            `label_id is required for ${input.action} action`
          );
        break;
      case 'rename_shared':
        if (!input.name)
          throw new ValidationError(
            'name is required for rename_shared action'
          );
        if (!input.new_name)
          throw new ValidationError(
            'new_name is required for rename_shared action'
          );
        break;
      case 'remove_shared':
        if (!input.name)
          throw new ValidationError(
            'name is required for remove_shared action'
          );
        break;
      case 'list':
        // Validate limit if provided
        if (input.limit !== undefined && (input.limit < 1 || input.limit > 200))
          throw new ValidationError('limit must be between 1 and 200');
        break;
      default:
        throw new ValidationError('Invalid action specified');
    }
  }

  /**
   * Execute the tool with the given input
   */
  async execute(input: unknown): Promise<TodoistLabelsOutput> {
    const startTime = Date.now();

    try {
      // Validate input
      const validatedInput = TodoistLabelsInputSchema.parse(input);

      // Validate action-specific required fields
      this.validateActionRequirements(validatedInput);

      let result: TodoistLabelsOutput;

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
        case 'rename_shared':
          result = await this.handleRenameShared(validatedInput);
          break;
        case 'remove_shared':
          result = await this.handleRemoveShared(validatedInput);
          break;
        default:
          throw new ValidationError('Invalid action specified');
      }

      // Add operation metadata
      const operationTime = Date.now() - startTime;
      const rateLimitStatus = this.apiService.getRateLimitStatus();

      // Use sync rate limiter stats for shared label operations
      const useSync =
        validatedInput.action === 'rename_shared' ||
        validatedInput.action === 'remove_shared';
      const rateLimit = useSync ? rateLimitStatus.sync : rateLimitStatus.rest;

      result.metadata = {
        ...result.metadata,
        operation_time: operationTime,
        rate_limit_remaining: rateLimit.remaining,
        rate_limit_reset: new Date(rateLimit.resetTime).toISOString(),
      };

      return result;
    } catch (error) {
      return this.handleError(error, Date.now() - startTime);
    }
  }

  /**
   * Create a new label (with duplicate check for idempotency)
   */
  private async handleCreate(
    input: TodoistLabelsInput
  ): Promise<TodoistLabelsOutput> {
    // Pre-flight check: Look for existing label with same name
    const existingLabels = await this.apiService.getLabels();
    const existingLabel = existingLabels.results.find(
      label => label.name === input.name
    );

    if (existingLabel) {
      // Return existing label (idempotent behavior)
      return {
        success: true,
        data: existingLabel,
        message: 'Label already exists',
      };
    }

    const labelData = {
      name: input.name,
      color: input.color,
      order: input.order,
      is_favorite: input.is_favorite,
    };

    // Remove undefined properties
    const cleanedData = removeUndefinedProperties(labelData);

    const label = await this.apiService.createLabel(cleanedData);

    // Invalidate labels cache to refresh on next request
    this.cacheService.invalidateLabels();

    return {
      success: true,
      data: label,
      message: 'Label created successfully',
    };
  }

  /**
   * Get a specific label by ID
   */
  private async handleGet(
    input: TodoistLabelsInput
  ): Promise<TodoistLabelsOutput> {
    const labelId = input.label_id;
    if (!labelId) {
      throw new ValidationError('label_id is required for get action');
    }

    const label = await this.apiService.getLabel(labelId);

    return {
      success: true,
      data: label,
      message: 'Label retrieved successfully',
    };
  }

  /**
   * Update label properties
   */
  private async handleUpdate(
    input: TodoistLabelsInput
  ): Promise<TodoistLabelsOutput> {
    const labelData = {
      name: input.name,
      color: input.color,
      order: input.order,
      is_favorite: input.is_favorite,
    };

    // Remove undefined properties
    const cleanedData = removeUndefinedProperties(labelData);

    const labelId = input.label_id;
    if (!labelId) {
      throw new ValidationError('label_id is required for update action');
    }

    const label = await this.apiService.updateLabel(labelId, cleanedData);

    // Invalidate labels cache to refresh on next request
    this.cacheService.invalidateLabels();

    return {
      success: true,
      data: label,
      message: 'Label updated successfully',
    };
  }

  /**
   * Delete a label (removes from all tasks)
   */
  private async handleDelete(
    input: TodoistLabelsInput
  ): Promise<TodoistLabelsOutput> {
    const labelId = input.label_id;
    if (!labelId) {
      throw new ValidationError('label_id is required for delete action');
    }

    await this.apiService.deleteLabel(labelId);

    // Invalidate labels cache to refresh on next request
    this.cacheService.invalidateLabels();

    return {
      success: true,
      data: null,
      message: 'Label deleted successfully',
    };
  }

  /**
   * List all labels with pagination
   */
  private async handleList(
    input: TodoistLabelsInput
  ): Promise<TodoistLabelsOutput> {
    const limit = input.limit || 50; // Default to 50
    const response = await this.apiService.getLabels(input.cursor, limit);

    return {
      success: true,
      data: response.results,
      message: 'Labels retrieved successfully',
      metadata: {
        total_count: response.results.length,
        next_cursor: response.next_cursor,
      },
    };
  }

  /**
   * Rename a shared label across all tasks
   */
  private async handleRenameShared(
    input: TodoistLabelsInput
  ): Promise<TodoistLabelsOutput> {
    const { name, new_name } = input;
    if (!name) {
      throw new ValidationError('name is required for rename_shared action');
    }
    if (!new_name) {
      throw new ValidationError(
        'new_name is required for rename_shared action'
      );
    }

    await this.apiService.renameSharedLabel(name, new_name);

    // Invalidate labels cache since multiple labels may be affected
    this.cacheService.invalidateLabels();

    return {
      success: true,
      data: null,
      message: 'Shared label renamed successfully across all tasks',
    };
  }

  /**
   * Remove a shared label from all tasks
   */
  private async handleRemoveShared(
    input: TodoistLabelsInput
  ): Promise<TodoistLabelsOutput> {
    const { name } = input;
    if (!name) {
      throw new ValidationError('name is required for remove_shared action');
    }

    await this.apiService.removeSharedLabel(name);

    // Invalidate labels cache since multiple labels may be affected
    this.cacheService.invalidateLabels();

    return {
      success: true,
      data: null,
      message: 'Shared label removed successfully from all tasks',
    };
  }

  /**
   * Handle errors and format error response
   */
  private handleError(
    error: unknown,
    operationTime: number
  ): TodoistLabelsOutput {
    const toolError = handleToolError(error, operationTime);
    const rateLimitStatus = this.apiService.getRateLimitStatus();

    // Remap RESOURCE_NOT_FOUND to LABEL_NOT_FOUND for label-specific context
    if (toolError.error?.code === 'RESOURCE_NOT_FOUND') {
      toolError.error.code = 'LABEL_NOT_FOUND';
    }

    return {
      ...toolError,
      metadata: {
        ...toolError.metadata,
        rate_limit_remaining: rateLimitStatus.rest.remaining,
        rate_limit_reset: new Date(
          rateLimitStatus.rest.resetTime
        ).toISOString(),
      },
    } as TodoistLabelsOutput;
  }
}
