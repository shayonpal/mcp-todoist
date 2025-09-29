import { z } from 'zod';
import { TodoistApiService } from '../services/todoist-api.js';
import { CacheService } from '../services/cache.js';
import { CreateProjectSchema } from '../schemas/validation.js';
import { TodoistProject, APIConfiguration } from '../types/todoist.js';
import {
  TodoistAPIError,
  TodoistErrorCode,
  ValidationError,
} from '../types/errors.js';

/**
 * Input schema for the todoist_projects tool
 */
const TodoistProjectsInputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    ...CreateProjectSchema.shape,
  }),
  z.object({
    action: z.literal('get'),
    project_id: z.string().min(1, 'Project ID is required'),
  }),
  z.object({
    action: z.literal('update'),
    project_id: z.string().min(1, 'Project ID is required'),
    name: z.string().max(120).optional(),
    parent_id: z.string().optional(),
    color: z.string().optional(),
    is_favorite: z.boolean().optional(),
    view_style: z.enum(['list', 'board']).optional(),
  }),
  z.object({
    action: z.literal('delete'),
    project_id: z.string().min(1, 'Project ID is required'),
  }),
  z.object({
    action: z.literal('list'),
    include_archived: z.boolean().default(false),
  }),
  z.object({
    action: z.literal('archive'),
    project_id: z.string().min(1, 'Project ID is required'),
  }),
  z.object({
    action: z.literal('unarchive'),
    project_id: z.string().min(1, 'Project ID is required'),
  }),
]);

type TodoistProjectsInput = z.infer<typeof TodoistProjectsInputSchema>;

/**
 * Output schema for the todoist_projects tool
 */
interface TodoistProjectsOutput {
  success: boolean;
  data?: TodoistProject | TodoistProject[] | Record<string, unknown>;
  message?: string;
  metadata?: {
    total_count?: number;
    active_count?: number;
    archived_count?: number;
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
 * TodoistProjectsTool - Complete project management for Todoist
 *
 * Handles all CRUD operations on projects including:
 * - Creating projects with full metadata
 * - Reading individual projects or lists
 * - Updating project properties
 * - Deleting projects
 * - Archiving/unarchiving projects
 * - Querying projects with optional archived inclusion
 */
export class TodoistProjectsTool {
  private readonly apiService: TodoistApiService;
  private readonly cacheService: CacheService;

  constructor(apiConfig: APIConfiguration) {
    this.apiService = new TodoistApiService(apiConfig);
    this.cacheService = new CacheService();
  }

  /**
   * Get the MCP tool definition
   */
  static getToolDefinition() {
    return {
      name: 'todoist_projects',
      description:
        'Complete project management for Todoist - create, read, update, archive, and query projects with metadata support',
      inputSchema: TodoistProjectsInputSchema.describe(
        'Project management operations'
      ),
    };
  }

  /**
   * Execute the tool with the given input
   */
  async execute(input: unknown): Promise<TodoistProjectsOutput> {
    const startTime = Date.now();

    try {
      // Validate input
      const validatedInput = TodoistProjectsInputSchema.parse(input);

      let result: TodoistProjectsOutput;

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
        case 'archive':
          result = await this.handleArchive(validatedInput);
          break;
        case 'unarchive':
          result = await this.handleUnarchive(validatedInput);
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
   * Create a new project
   */
  private async handleCreate(
    input: Extract<TodoistProjectsInput, { action: 'create' }>
  ): Promise<TodoistProjectsOutput> {
    const projectData = {
      name: input.name,
      parent_id: input.parent_id,
      color: input.color,
      is_favorite: input.is_favorite,
      view_style: input.view_style,
    };

    // Remove undefined properties
    const cleanedData = Object.fromEntries(
      Object.entries(projectData).filter(([_, value]) => value !== undefined)
    );

    const project = await this.apiService.createProject(cleanedData);

    // Invalidate projects cache since we added a new project
    this.cacheService.invalidateProjects();

    return {
      success: true,
      data: project,
      message: 'Project created successfully',
    };
  }

  /**
   * Get a specific project by ID
   */
  private async handleGet(
    input: Extract<TodoistProjectsInput, { action: 'get' }>
  ): Promise<TodoistProjectsOutput> {
    const project = await this.apiService.getProject(input.project_id);

    return {
      success: true,
      data: project,
      message: 'Project retrieved successfully',
    };
  }

  /**
   * Update an existing project
   */
  private async handleUpdate(
    input: Extract<TodoistProjectsInput, { action: 'update' }>
  ): Promise<TodoistProjectsOutput> {
    const { project_id, ...updateData } = input;

    // Remove undefined properties
    const cleanedData = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value !== undefined)
    );

    const project = await this.apiService.updateProject(
      project_id,
      cleanedData
    );

    // Invalidate projects cache since we updated a project
    this.cacheService.invalidateProjects();

    return {
      success: true,
      data: project,
      message: 'Project updated successfully',
    };
  }

  /**
   * Delete a project
   */
  private async handleDelete(
    input: Extract<TodoistProjectsInput, { action: 'delete' }>
  ): Promise<TodoistProjectsOutput> {
    await this.apiService.deleteProject(input.project_id);

    // Invalidate projects cache since we deleted a project
    this.cacheService.invalidateProjects();

    return {
      success: true,
      message: 'Project deleted successfully',
    };
  }

  /**
   * List projects with optional archived inclusion
   */
  private async handleList(
    input: Extract<TodoistProjectsInput, { action: 'list' }>
  ): Promise<TodoistProjectsOutput> {
    const projects = await this.apiService.getProjects();

    // Filter projects based on archived status
    const filteredProjects = input.include_archived
      ? projects
      : projects.filter(project => !project.is_archived);

    // Calculate counts
    const activeCount = projects.filter(p => !p.is_archived).length;
    const archivedCount = projects.filter(p => p.is_archived).length;

    return {
      success: true,
      data: filteredProjects,
      message: `Retrieved ${filteredProjects.length} project(s)`,
      metadata: {
        total_count: filteredProjects.length,
        active_count: activeCount,
        archived_count: archivedCount,
      },
    };
  }

  /**
   * Archive a project
   */
  private async handleArchive(
    input: Extract<TodoistProjectsInput, { action: 'archive' }>
  ): Promise<TodoistProjectsOutput> {
    await this.apiService.archiveProject(input.project_id);

    // Invalidate projects cache since we archived a project
    this.cacheService.invalidateProjects();

    return {
      success: true,
      message: 'Project archived successfully',
    };
  }

  /**
   * Unarchive a project
   */
  private async handleUnarchive(
    input: Extract<TodoistProjectsInput, { action: 'unarchive' }>
  ): Promise<TodoistProjectsOutput> {
    await this.apiService.unarchiveProject(input.project_id);

    // Invalidate projects cache since we unarchived a project
    this.cacheService.invalidateProjects();

    return {
      success: true,
      message: 'Project unarchived successfully',
    };
  }

  /**
   * Handle errors and convert them to standardized output format
   */
  private handleError(
    error: unknown,
    operationTime: number
  ): TodoistProjectsOutput {
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
