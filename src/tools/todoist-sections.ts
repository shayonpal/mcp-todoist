import { z } from 'zod';
import { TodoistApiService } from '../services/todoist-api.js';
import { CacheService } from '../services/cache.js';
import { CreateSectionSchema } from '../schemas/validation.js';
import { TodoistSection, APIConfiguration } from '../types/todoist.js';
import {
  TodoistAPIError,
  TodoistErrorCode,
  ValidationError,
} from '../types/errors.js';

/**
 * Input schema for the todoist_sections tool
 */
const TodoistSectionsInputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    ...CreateSectionSchema.shape,
  }),
  z.object({
    action: z.literal('get'),
    section_id: z.string().min(1, 'Section ID is required'),
  }),
  z.object({
    action: z.literal('update'),
    section_id: z.string().min(1, 'Section ID is required'),
    name: z.string().max(120).optional(),
    order: z.number().int().min(1).optional(),
  }),
  z.object({
    action: z.literal('delete'),
    section_id: z.string().min(1, 'Section ID is required'),
  }),
  z.object({
    action: z.literal('list'),
    project_id: z.string().min(1, 'Project ID is required'),
  }),
  z.object({
    action: z.literal('reorder'),
    project_id: z.string().min(1, 'Project ID is required'),
    section_orders: z
      .array(
        z.object({
          id: z.string().min(1),
          order: z.number().int().min(1),
        })
      )
      .min(1, 'At least one section order must be provided'),
  }),
]);

type TodoistSectionsInput = z.infer<typeof TodoistSectionsInputSchema>;

/**
 * Output schema for the todoist_sections tool
 */
interface TodoistSectionsOutput {
  success: boolean;
  data?: TodoistSection | TodoistSection[] | Record<string, unknown>;
  message?: string;
  metadata?: {
    total_count?: number;
    project_name?: string;
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
 * TodoistSectionsTool - Section management within Todoist projects
 *
 * Handles all CRUD operations on sections including:
 * - Creating sections within projects
 * - Reading individual sections or lists by project
 * - Updating section properties
 * - Deleting sections
 * - Reordering sections within a project
 */
export class TodoistSectionsTool {
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
      name: 'todoist_sections',
      description:
        'Section management within Todoist projects - create, read, update, delete, and reorder sections for better task organization',
      inputSchema: TodoistSectionsInputSchema.describe(
        'Section management operations'
      ),
    };
  }

  /**
   * Execute the tool with the given input
   */
  async execute(input: unknown): Promise<TodoistSectionsOutput> {
    const startTime = Date.now();

    try {
      // Validate input
      const validatedInput = TodoistSectionsInputSchema.parse(input);

      let result: TodoistSectionsOutput;

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
        case 'reorder':
          result = await this.handleReorder(validatedInput);
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
   * Create a new section
   */
  private async handleCreate(
    input: Extract<TodoistSectionsInput, { action: 'create' }>
  ): Promise<TodoistSectionsOutput> {
    const sectionData = {
      name: input.name,
      project_id: input.project_id,
      order: input.order,
    };

    // Remove undefined properties
    const cleanedData = Object.fromEntries(
      Object.entries(sectionData).filter(([_, value]) => value !== undefined)
    );

    const section = await this.apiService.createSection(cleanedData);

    // Invalidate sections cache for this project
    this.cacheService.invalidateSections(input.project_id);

    return {
      success: true,
      data: section,
      message: 'Section created successfully',
    };
  }

  /**
   * Get a specific section by ID
   */
  private async handleGet(
    input: Extract<TodoistSectionsInput, { action: 'get' }>
  ): Promise<TodoistSectionsOutput> {
    const section = await this.apiService.getSection(input.section_id);

    // Try to get project name for metadata
    let projectName: string | undefined;
    try {
      const projects = await this.cacheService.getProjects();
      const project = projects?.find(p => p.id === section.project_id);
      projectName = project?.name;
    } catch (error) {
      // Ignore errors in getting project name
    }

    return {
      success: true,
      data: section,
      message: 'Section retrieved successfully',
      metadata: {
        project_name: projectName,
      },
    };
  }

  /**
   * Update an existing section
   */
  private async handleUpdate(
    input: Extract<TodoistSectionsInput, { action: 'update' }>
  ): Promise<TodoistSectionsOutput> {
    const { section_id, ...updateData } = input;

    // Remove undefined properties
    const cleanedData = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value !== undefined)
    );

    const section = await this.apiService.updateSection(
      section_id,
      cleanedData
    );

    // Invalidate sections cache for this project
    this.cacheService.invalidateSections(section.project_id);

    return {
      success: true,
      data: section,
      message: 'Section updated successfully',
    };
  }

  /**
   * Delete a section
   */
  private async handleDelete(
    input: Extract<TodoistSectionsInput, { action: 'delete' }>
  ): Promise<TodoistSectionsOutput> {
    // Get section first to know which project cache to invalidate
    let projectId: string | undefined;
    try {
      const section = await this.apiService.getSection(input.section_id);
      projectId = section.project_id;
    } catch (error) {
      // Ignore errors - we'll proceed with deletion
    }

    await this.apiService.deleteSection(input.section_id);

    // Invalidate sections cache for this project if we know the project ID
    if (projectId) {
      this.cacheService.invalidateSections(projectId);
    }

    return {
      success: true,
      message: 'Section deleted successfully',
    };
  }

  /**
   * List sections in a project
   */
  private async handleList(
    input: Extract<TodoistSectionsInput, { action: 'list' }>
  ): Promise<TodoistSectionsOutput> {
    const sections = await this.apiService.getSections(input.project_id);

    // Try to get project name for metadata
    let projectName: string | undefined;
    try {
      const projects = await this.cacheService.getProjects();
      const project = projects?.find(p => p.id === input.project_id);
      projectName = project?.name;
    } catch (error) {
      // Ignore errors in getting project name
    }

    return {
      success: true,
      data: sections,
      message: `Retrieved ${sections.length} section(s)`,
      metadata: {
        total_count: sections.length,
        project_name: projectName,
      },
    };
  }

  /**
   * Reorder sections within a project
   */
  private async handleReorder(
    input: Extract<TodoistSectionsInput, { action: 'reorder' }>
  ): Promise<TodoistSectionsOutput> {
    // Validate that all section IDs exist and belong to the specified project
    try {
      const existingSections = await this.apiService.getSections(
        input.project_id
      );
      const existingSectionIds = new Set(existingSections.map(s => s.id));

      const invalidSectionIds = input.section_orders
        .map(so => so.id)
        .filter(id => !existingSectionIds.has(id));

      if (invalidSectionIds.length > 0) {
        throw new ValidationError(
          `Invalid section IDs: ${invalidSectionIds.join(', ')}`
        );
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      // If we can't validate, proceed - API will handle invalid IDs
    }

    // Execute reorder operations sequentially to avoid conflicts
    for (const sectionOrder of input.section_orders) {
      await this.apiService.updateSection(sectionOrder.id, {
        order: sectionOrder.order,
      });
    }

    // Invalidate sections cache for this project
    this.cacheService.invalidateSections(input.project_id);

    return {
      success: true,
      message: 'Sections reordered successfully',
      metadata: {
        total_count: input.section_orders.length,
      },
    };
  }

  /**
   * Handle errors and convert them to standardized output format
   */
  private handleError(
    error: unknown,
    operationTime: number
  ): TodoistSectionsOutput {
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
