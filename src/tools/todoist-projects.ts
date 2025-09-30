import { z } from 'zod';
import { TodoistApiService } from '../services/todoist-api.js';
import { CacheService } from '../services/cache.js';
import { TodoistProject, APIConfiguration } from '../types/todoist.js';
import { ValidationError } from '../types/errors.js';
import {
  handleToolError,
  removeUndefinedProperties,
} from '../utils/tool-helpers.js';

/**
 * Input schema for the todoist_projects tool
 * Flattened for MCP client compatibility
 */
const TodoistProjectsInputSchema = z.object({
  action: z.enum([
    'create',
    'get',
    'update',
    'delete',
    'list',
    'archive',
    'unarchive',
  ]),
  // Project ID (for get, update, delete, archive, unarchive)
  project_id: z.string().optional(),
  // Create/Update fields
  name: z.string().optional(),
  parent_id: z.string().optional(),
  color: z.string().optional(),
  is_favorite: z.boolean().optional(),
  view_style: z.enum(['list', 'board']).optional(),
  // List fields
  include_archived: z.boolean().optional(),
});

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
      name: 'todoist_projects',
      description:
        'Complete project management for Todoist - create, read, update, archive, and query projects with metadata support',
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
              'archive',
              'unarchive',
            ],
            description: 'Action to perform',
          },
          project_id: {
            type: 'string',
            description:
              'Project ID (required for get/update/delete/archive/unarchive)',
          },
          name: { type: 'string', description: 'Project name' },
          parent_id: { type: 'string', description: 'Parent project ID' },
          color: { type: 'string', description: 'Project color' },
          is_favorite: { type: 'boolean', description: 'Mark as favorite' },
          view_style: {
            type: 'string',
            enum: ['list', 'board'],
            description: 'View style',
          },
          include_archived: {
            type: 'boolean',
            description: 'Include archived projects (for list)',
          },
        },
        required: ['action'],
      },
    };
  }

  /**
   * Validate that required fields are present for each action
   */
  private validateActionRequirements(input: TodoistProjectsInput): void {
    switch (input.action) {
      case 'create':
        if (!input.name)
          throw new ValidationError('name is required for create action');
        if (!input.color)
          throw new ValidationError('color is required for create action');
        break;
      case 'get':
      case 'delete':
      case 'archive':
      case 'unarchive':
        if (!input.project_id!)
          throw new ValidationError(
            `project_id is required for ${input.action} action`
          );
        break;
      case 'update':
        if (!input.project_id!)
          throw new ValidationError('project_id is required for update action');
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
  async execute(input: unknown): Promise<TodoistProjectsOutput> {
    const startTime = Date.now();

    try {
      // Validate input
      const validatedInput = TodoistProjectsInputSchema.parse(input);

      // Validate action-specific required fields
      this.validateActionRequirements(validatedInput);

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
    input: TodoistProjectsInput
  ): Promise<TodoistProjectsOutput> {
    const projectData = {
      name: input.name,
      parent_id: input.parent_id,
      color: input.color,
      is_favorite: input.is_favorite,
      view_style: input.view_style,
    };

    // Remove undefined properties
    const cleanedData = removeUndefinedProperties(projectData);

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
    input: TodoistProjectsInput
  ): Promise<TodoistProjectsOutput> {
    const project = await this.apiService.getProject(input.project_id!);

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
    input: TodoistProjectsInput
  ): Promise<TodoistProjectsOutput> {
    const { project_id, ...updateData } = input;

    // Remove undefined properties
    const cleanedData = removeUndefinedProperties(updateData);

    const project = await this.apiService.updateProject(
      project_id!,
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
    input: TodoistProjectsInput
  ): Promise<TodoistProjectsOutput> {
    await this.apiService.deleteProject(input.project_id!);

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
    input: TodoistProjectsInput
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
    input: TodoistProjectsInput
  ): Promise<TodoistProjectsOutput> {
    await this.apiService.archiveProject(input.project_id!);

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
    input: TodoistProjectsInput
  ): Promise<TodoistProjectsOutput> {
    await this.apiService.unarchiveProject(input.project_id!);

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
    return handleToolError(error, operationTime) as TodoistProjectsOutput;
  }
}
