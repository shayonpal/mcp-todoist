import { z } from 'zod';
import { TodoistApiService } from '../services/todoist-api.js';
import { TodoistComment, APIConfiguration } from '../types/todoist.js';
import {
  TodoistAPIError,
  TodoistErrorCode,
  ValidationError,
} from '../types/errors.js';

/**
 * Input schema for the todoist_comments tool
 */
const TodoistCommentsInputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    content: z.string().max(15000, 'Content must be 15,000 characters or less'),
    task_id: z.string().min(1).optional(),
    project_id: z.string().min(1).optional(),
    attachment: z
      .object({
        resource_type: z.string(),
        file_url: z.string().url(),
        file_name: z.string(),
        file_size: z.number().int().min(0),
        file_type: z.string(),
      })
      .optional(),
  }),
  z.object({
    action: z.literal('get'),
    comment_id: z.string().min(1, 'Comment ID is required'),
  }),
  z.object({
    action: z.literal('update'),
    comment_id: z.string().min(1, 'Comment ID is required'),
    content: z.string().max(15000, 'Content must be 15,000 characters or less'),
  }),
  z.object({
    action: z.literal('delete'),
    comment_id: z.string().min(1, 'Comment ID is required'),
  }),
  z.object({
    action: z.literal('list_by_task'),
    task_id: z.string().min(1),
  }),
  z.object({
    action: z.literal('list_by_project'),
    project_id: z.string().min(1),
  }),
]);

type TodoistCommentsInput = z.infer<typeof TodoistCommentsInputSchema>;

/**
 * Output schema for the todoist_comments tool
 */
interface TodoistCommentsOutput {
  success: boolean;
  data?: TodoistComment | TodoistComment[] | Record<string, unknown>;
  message?: string;
  metadata?: {
    total_count?: number;
    character_count?: number;
    has_attachments?: boolean;
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
 * TodoistCommentsTool - Comment management for Todoist tasks and projects
 *
 * Handles all CRUD operations on comments including:
 * - Creating comments on tasks or projects
 * - Reading individual comments or lists
 * - Updating comment content
 * - Deleting comments
 * - Supporting file attachments (one per comment)
 * - 15,000 character limit enforcement
 */
export class TodoistCommentsTool {
  private readonly apiService: TodoistApiService;

  constructor(apiConfig: APIConfiguration) {
    this.apiService = new TodoistApiService(apiConfig);
  }

  /**
   * Get the MCP tool definition
   */
  static getToolDefinition() {
    return {
      name: 'todoist_comments',
      description:
        'Comment management for Todoist tasks and projects - create, read, update, delete comments with 15,000 character limit and file attachment support',
      inputSchema: TodoistCommentsInputSchema.describe(
        'Comment management operations'
      ),
    };
  }

  /**
   * Execute the tool with the given input
   */
  async execute(input: unknown): Promise<TodoistCommentsOutput> {
    const startTime = Date.now();

    try {
      // Validate input
      const validatedInput = TodoistCommentsInputSchema.parse(input);

      let result: TodoistCommentsOutput;

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
        case 'list_by_task':
        case 'list_by_project':
          result = await this.handleList(validatedInput);
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
   * Create a new comment
   */
  private async handleCreate(
    input: Extract<TodoistCommentsInput, { action: 'create' }>
  ): Promise<TodoistCommentsOutput> {
    // Validate that either task_id or project_id is provided
    if (!input.task_id && !input.project_id) {
      throw new ValidationError(
        'Either task_id or project_id must be provided'
      );
    }

    const commentData = {
      content: input.content,
      task_id: input.task_id,
      project_id: input.project_id,
      attachment: input.attachment,
    };

    // Remove undefined properties
    const cleanedData = Object.fromEntries(
      Object.entries(commentData).filter(([_, value]) => value !== undefined)
    );

    const comment = await this.apiService.createComment(cleanedData);

    return {
      success: true,
      data: comment,
      message: 'Comment created successfully',
      metadata: {
        character_count: comment.content.length,
        has_attachments: !!comment.attachment,
      },
    };
  }

  /**
   * Get a specific comment by ID
   */
  private async handleGet(
    input: Extract<TodoistCommentsInput, { action: 'get' }>
  ): Promise<TodoistCommentsOutput> {
    const comment = await this.apiService.getComment(input.comment_id);

    return {
      success: true,
      data: comment,
      message: 'Comment retrieved successfully',
      metadata: {
        character_count: comment.content.length,
        has_attachments: !!comment.attachment,
      },
    };
  }

  /**
   * Update an existing comment
   */
  private async handleUpdate(
    input: Extract<TodoistCommentsInput, { action: 'update' }>
  ): Promise<TodoistCommentsOutput> {
    const { comment_id, content } = input;

    const comment = await this.apiService.updateComment(comment_id, {
      content,
    });

    return {
      success: true,
      data: comment,
      message: 'Comment updated successfully',
      metadata: {
        character_count: comment.content.length,
        has_attachments: !!comment.attachment,
      },
    };
  }

  /**
   * Delete a comment
   */
  private async handleDelete(
    input: Extract<TodoistCommentsInput, { action: 'delete' }>
  ): Promise<TodoistCommentsOutput> {
    await this.apiService.deleteComment(input.comment_id);

    return {
      success: true,
      message: 'Comment deleted successfully',
    };
  }

  /**
   * List comments for a task or project
   */
  private async handleList(
    input: Extract<TodoistCommentsInput, { action: 'list_by_task' | 'list_by_project' }>
  ): Promise<TodoistCommentsOutput> {
    let comments: TodoistComment[];

    if (input.action === 'list_by_task') {
      comments = await this.apiService.getTaskComments(input.task_id);
    } else if (input.action === 'list_by_project') {
      comments = await this.apiService.getProjectComments(input.project_id);
    } else {
      throw new ValidationError(
        'Invalid list action specified'
      );
    }

    // Calculate metadata
    const totalCharacters = comments.reduce(
      (sum, comment) => sum + comment.content.length,
      0
    );
    const hasAttachments = comments.some(comment => !!comment.attachment);

    return {
      success: true,
      data: comments,
      message: `Retrieved ${comments.length} comment(s)`,
      metadata: {
        total_count: comments.length,
        character_count: totalCharacters,
        has_attachments: hasAttachments,
      },
    };
  }

  /**
   * Handle errors and convert them to standardized output format
   */
  private handleError(
    error: unknown,
    operationTime: number
  ): TodoistCommentsOutput {
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
