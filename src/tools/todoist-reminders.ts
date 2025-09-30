import { z } from 'zod';
import { TodoistApiService } from '../services/todoist-api.js';
import { TodoistReminder, APIConfiguration } from '../types/todoist.js';
import {
  TodoistAPIError,
  TodoistErrorCode,
  ValidationError,
} from '../types/errors.js';
import { handleToolError } from '../utils/tool-helpers.js';

/**
 * Input schema for the todoist_reminders tool
 * Flattened for MCP client compatibility
 */
const TodoistRemindersInputSchema = z.object({
  action: z.enum(['create', 'get', 'update', 'delete', 'list']),
  // Reminder type (for create/update actions)
  type: z.enum(['relative', 'absolute', 'location']).optional(),
  // Item/Reminder IDs
  item_id: z.string().optional(),
  reminder_id: z.string().optional(),
  // Relative reminder fields
  minute_offset: z.number().int().optional(),
  // Absolute reminder fields
  due: z
    .object({
      date: z.string().optional(),
      string: z.string().optional(),
      timezone: z.string().nullable().optional(),
      is_recurring: z.boolean().optional(),
      lang: z.string().optional(),
    })
    .optional(),
  // Location reminder fields
  name: z.string().optional(),
  loc_lat: z.string().optional(),
  loc_long: z.string().optional(),
  loc_trigger: z.enum(['on_enter', 'on_leave']).optional(),
  radius: z.number().int().optional(),
  // Common fields
  notify_uid: z.string().optional(),
});

type TodoistRemindersInput = z.infer<typeof TodoistRemindersInputSchema>;

/**
 * Output schema for the todoist_reminders tool
 */
interface TodoistRemindersOutput {
  success: boolean;
  data?: TodoistReminder | TodoistReminder[] | Record<string, unknown>;
  message?: string;
  metadata?: {
    total_count?: number;
    reminder_type?: 'relative' | 'absolute' | 'location';
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
 * TodoistRemindersTool - Reminder management for Todoist tasks
 *
 * Handles all CRUD operations on reminders including:
 * - Creating relative reminders (minutes before task due)
 * - Creating absolute reminders (specific date/time)
 * - Creating location reminders (geofenced)
 * - Reading individual reminders or lists
 * - Updating reminder properties
 * - Deleting reminders
 * - Supporting natural language due dates (e.g., "tomorrow at 10:00", "every day at 9am")
 */
export class TodoistRemindersTool {
  public readonly name = 'todoist_reminders';
  public readonly description =
    'Manage reminders for Todoist tasks. Supports three reminder types: relative (minutes before task due date), absolute (specific date and time), and location (geofenced area). Natural language due dates supported (e.g., "tomorrow at 10:00", "every day", "every 4th").';
  public readonly inputSchema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['create', 'get', 'update', 'delete', 'list'],
        description: 'Action to perform on reminders',
      },
      type: {
        type: 'string',
        enum: ['relative', 'absolute', 'location'],
        description:
          'Type of reminder: relative (minutes before due), absolute (specific datetime), location (geofenced)',
      },
      item_id: {
        type: 'string',
        description: 'Task ID for which the reminder is set',
      },
      reminder_id: {
        type: 'string',
        description: 'Reminder ID for get/update/delete operations',
      },
      minute_offset: {
        type: 'number',
        description:
          'Minutes before task due date (relative reminders only, max 43200 = 30 days)',
      },
      due: {
        type: 'object',
        description:
          'Due date object for absolute reminders (supports natural language)',
        properties: {
          date: { type: 'string', description: 'ISO 8601 datetime' },
          string: {
            type: 'string',
            description:
              'Natural language date (e.g., "tomorrow at 10:00", "every day at 9am")',
          },
          timezone: { type: 'string', description: 'Timezone for due date' },
          is_recurring: {
            type: 'boolean',
            description: 'Whether reminder repeats',
          },
          lang: {
            type: 'string',
            description: 'Language for parsing (default: en)',
          },
        },
      },
      name: {
        type: 'string',
        description: 'Location name (location reminders only)',
      },
      loc_lat: {
        type: 'string',
        description: 'Latitude (location reminders only)',
      },
      loc_long: {
        type: 'string',
        description: 'Longitude (location reminders only)',
      },
      loc_trigger: {
        type: 'string',
        enum: ['on_enter', 'on_leave'],
        description: 'Trigger type for location reminders',
      },
      radius: {
        type: 'number',
        description: 'Radius in meters (location reminders only, max 5000)',
      },
      notify_uid: {
        type: 'string',
        description: 'User ID to notify (optional)',
      },
    },
    required: ['action'],
  };

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
      name: 'todoist_reminders',
      description:
        'Manage reminders for Todoist tasks. Supports three reminder types: relative (minutes before task due date), absolute (specific date and time), and location (geofenced area). Natural language due dates supported (e.g., "tomorrow at 10:00", "every day", "every 4th").',
      inputSchema: {
        type: 'object' as const,
        properties: {
          action: {
            type: 'string',
            enum: ['create', 'get', 'update', 'delete', 'list'],
            description: 'Action to perform on reminders',
          },
          type: {
            type: 'string',
            enum: ['relative', 'absolute', 'location'],
            description:
              'Type of reminder: relative (minutes before due), absolute (specific datetime), location (geofenced)',
          },
          item_id: {
            type: 'string',
            description: 'Task ID for which the reminder is set',
          },
          reminder_id: {
            type: 'string',
            description: 'Reminder ID for get/update/delete operations',
          },
          minute_offset: {
            type: 'number',
            description:
              'Minutes before task due date (relative reminders only, max 43200 = 30 days)',
          },
          due: {
            type: 'object',
            description:
              'Due date object for absolute reminders (supports natural language)',
            properties: {
              date: { type: 'string', description: 'ISO 8601 datetime' },
              string: { type: 'string', description: 'Natural language date' },
              timezone: {
                type: 'string',
                description: 'Timezone for due date',
              },
              is_recurring: {
                type: 'boolean',
                description: 'Whether reminder repeats',
              },
              lang: {
                type: 'string',
                description: 'Language for parsing (default: en)',
              },
            },
          },
          name: {
            type: 'string',
            description: 'Location name (location reminders only)',
          },
          loc_lat: {
            type: 'string',
            description: 'Latitude (location reminders only)',
          },
          loc_long: {
            type: 'string',
            description: 'Longitude (location reminders only)',
          },
          loc_trigger: {
            type: 'string',
            enum: ['on_enter', 'on_leave'],
            description: 'Trigger type for location reminders',
          },
          radius: {
            type: 'number',
            description: 'Radius in meters (location reminders only, max 5000)',
          },
          notify_uid: {
            type: 'string',
            description: 'User ID to notify (optional)',
          },
        },
        required: ['action'],
      },
    };
  }

  /**
   * Validate that required fields are present for each action
   */
  private validateActionRequirements(input: TodoistRemindersInput): void {
    switch (input.action) {
      case 'create':
        if (!input.item_id!)
          throw new ValidationError('item_id is required for create action');
        if (!input.type)
          throw new ValidationError('type is required for create action');

        // Type-specific validation
        if (input.type === 'relative') {
          if (input.minute_offset === undefined)
            throw new ValidationError(
              'minute_offset is required for relative reminders'
            );
        } else if (input.type === 'absolute') {
          if (!input.due)
            throw new ValidationError('due is required for absolute reminders');
        } else if (input.type === 'location') {
          if (!input.name)
            throw new ValidationError(
              'name is required for location reminders'
            );
          if (!input.loc_lat)
            throw new ValidationError(
              'loc_lat is required for location reminders'
            );
          if (!input.loc_long)
            throw new ValidationError(
              'loc_long is required for location reminders'
            );
          if (!input.loc_trigger)
            throw new ValidationError(
              'loc_trigger is required for location reminders'
            );
          if (!input.radius)
            throw new ValidationError(
              'radius is required for location reminders'
            );
        }
        break;
      case 'get':
      case 'delete':
        if (!input.reminder_id!)
          throw new ValidationError(
            `reminder_id is required for ${input.action} action`
          );
        break;
      case 'update':
        if (!input.reminder_id!)
          throw new ValidationError(
            'reminder_id is required for update action'
          );
        break;
      case 'list':
        // No required fields for list (item_id is optional filter)
        break;
      default:
        throw new ValidationError('Invalid action specified');
    }
  }

  /**
   * Execute a reminder operation
   */
  async execute(params: unknown): Promise<TodoistRemindersOutput> {
    const startTime = Date.now();

    try {
      // Validate input parameters
      const validatedParams = TodoistRemindersInputSchema.parse(params);

      // Validate action-specific required fields
      this.validateActionRequirements(validatedParams);

      let result: TodoistRemindersOutput;

      switch (validatedParams.action) {
        case 'create':
          result = await this.handleCreate(validatedParams);
          break;
        case 'get':
          result = await this.handleGet(validatedParams);
          break;
        case 'update':
          result = await this.handleUpdate(validatedParams);
          break;
        case 'delete':
          result = await this.handleDelete(validatedParams);
          break;
        case 'list':
          result = await this.handleList(validatedParams);
          break;
        default:
          throw new ValidationError('Invalid action specified');
      }

      // Add operation time to metadata
      if (result.metadata) {
        result.metadata.operation_time = Date.now() - startTime;
      } else {
        result.metadata = {
          operation_time: Date.now() - startTime,
        };
      }

      return result;
    } catch (error) {
      return handleToolError(
        error,
        Date.now() - startTime
      ) as TodoistRemindersOutput;
    }
  }

  /**
   * Handle create reminder action
   */
  private async handleCreate(
    params: TodoistRemindersInput
  ): Promise<TodoistRemindersOutput> {
    const reminderData: Partial<TodoistReminder> = {
      item_id: params.item_id,
      type: params.type,
    };

    if (params.type === 'relative') {
      reminderData.minute_offset = params.minute_offset;
    } else if (params.type === 'absolute') {
      // Ensure defaults for required fields
      reminderData.due = {
        ...params.due!,
        is_recurring: params.due!.is_recurring ?? false,
        lang: params.due!.lang ?? 'en',
      };
    } else if (params.type === 'location') {
      reminderData.name = params.name;
      reminderData.loc_lat = params.loc_lat;
      reminderData.loc_long = params.loc_long;
      reminderData.loc_trigger = params.loc_trigger;
      reminderData.radius = params.radius;
    }

    if (params.notify_uid) {
      reminderData.notify_uid = params.notify_uid;
    }

    const reminder = await this.apiService.createReminder(reminderData);

    return {
      success: true,
      data: reminder,
      message: `Reminder created successfully (type: ${params.type})`,
      metadata: {
        reminder_type: params.type,
      },
    };
  }

  /**
   * Handle get reminder action
   */
  private async handleGet(
    params: TodoistRemindersInput
  ): Promise<TodoistRemindersOutput> {
    const reminders = await this.apiService.getReminders();
    const reminder = reminders.find(r => r.id === params.reminder_id);

    if (!reminder) {
      throw new TodoistAPIError(
        TodoistErrorCode.NOT_FOUND,
        'Reminder not found',
        undefined,
        false,
        undefined,
        404
      );
    }

    return {
      success: true,
      data: reminder,
      message: 'Reminder retrieved successfully',
      metadata: {
        reminder_type: reminder.type,
      },
    };
  }

  /**
   * Handle update reminder action
   */
  private async handleUpdate(
    params: TodoistRemindersInput
  ): Promise<TodoistRemindersOutput> {
    const updateData: Partial<TodoistReminder> = {};

    if (params.type) updateData.type = params.type;
    if (params.notify_uid) updateData.notify_uid = params.notify_uid;
    if (params.due) {
      // Ensure defaults for required fields
      updateData.due = {
        ...params.due,
        is_recurring: params.due.is_recurring ?? false,
        lang: params.due.lang ?? 'en',
      };
    }
    if (params.minute_offset !== undefined)
      updateData.minute_offset = params.minute_offset;
    if (params.name) updateData.name = params.name;
    if (params.loc_lat) updateData.loc_lat = params.loc_lat;
    if (params.loc_long) updateData.loc_long = params.loc_long;
    if (params.loc_trigger) updateData.loc_trigger = params.loc_trigger;
    if (params.radius !== undefined) updateData.radius = params.radius;

    const reminder = await this.apiService.updateReminder(
      params.reminder_id!,
      updateData
    );

    return {
      success: true,
      data: reminder,
      message: 'Reminder updated successfully',
      metadata: {
        reminder_type: reminder.type,
      },
    };
  }

  /**
   * Handle delete reminder action
   */
  private async handleDelete(
    params: TodoistRemindersInput
  ): Promise<TodoistRemindersOutput> {
    await this.apiService.deleteReminder(params.reminder_id!);

    return {
      success: true,
      message: 'Reminder deleted successfully',
    };
  }

  /**
   * Handle list reminders action
   */
  private async handleList(
    params: TodoistRemindersInput
  ): Promise<TodoistRemindersOutput> {
    const reminders = await this.apiService.getReminders(params.item_id);

    return {
      success: true,
      data: reminders,
      message: params.item_id
        ? `Retrieved ${reminders.length} reminder(s) for task ${params.item_id}`
        : `Retrieved ${reminders.length} total reminder(s)`,
      metadata: {
        total_count: reminders.length,
      },
    };
  }
}
