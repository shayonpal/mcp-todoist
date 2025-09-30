/**
 * Zod validation schemas for all input types
 * Based on data-model.md validation rules and Todoist API constraints
 */

import { z } from 'zod';

/**
 * Task-related validation schemas
 */
export const CreateTaskSchema = z.object({
  content: z
    .string()
    .min(1, 'Content is required')
    .max(500, 'Content must be 500 characters or less'),
  description: z
    .string()
    .max(16384, 'Description must be 16384 characters or less')
    .optional(),
  project_id: z.string().min(1, 'Project ID is required'),
  section_id: z.string().min(1, 'Section ID must not be empty').optional(),
  parent_id: z.string().min(1, 'Parent ID must not be empty').optional(),
  priority: z.number().int().min(1).max(4).default(1),
  labels: z
    .array(z.string())
    .max(100, 'Maximum 100 labels allowed')
    .default([]),
  due_string: z.string().optional(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format')
    .optional(),
  due_datetime: z
    .string()
    .datetime('Due datetime must be in ISO 8601 format')
    .optional(),
  assignee_id: z.string().min(1, 'Assignee ID must not be empty').optional(),
});

export const UpdateTaskSchema = CreateTaskSchema.partial().extend({
  task_id: z.string().min(1, 'Task ID is required'),
});

export const TaskQuerySchema = z.object({
  project_id: z.string().optional(),
  section_id: z.string().optional(),
  label_id: z.string().optional(),
  filter: z.string().optional(),
  lang: z.string().default('en'),
});

export const CompleteTaskSchema = z.object({
  id: z.string().min(1, 'Task ID is required'),
});

export const DeleteTaskSchema = z.object({
  id: z.string().min(1, 'Task ID is required'),
});

/**
 * Project-related validation schemas
 */
export const CreateProjectSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(120, 'Project name must be 120 characters or less'),
  parent_id: z.string().min(1, 'Parent ID must not be empty').optional(),
  color: z.string().min(1, 'Color is required'),
  is_favorite: z.boolean().default(false),
  view_style: z.enum(['list', 'board']).default('list'),
});

export const UpdateProjectSchema = CreateProjectSchema.partial().extend({
  id: z.string().min(1, 'Project ID is required'),
});

export const ArchiveProjectSchema = z.object({
  id: z.string().min(1, 'Project ID is required'),
});

export const DeleteProjectSchema = z.object({
  id: z.string().min(1, 'Project ID is required'),
});

/**
 * Section-related validation schemas
 */
export const CreateSectionSchema = z.object({
  name: z
    .string()
    .min(1, 'Section name is required')
    .max(120, 'Section name must be 120 characters or less'),
  project_id: z.string().min(1, 'Project ID is required'),
  order: z.number().int().min(1).optional(),
});

export const UpdateSectionSchema = z.object({
  id: z.string().min(1, 'Section ID is required'),
  name: z
    .string()
    .min(1, 'Section name is required')
    .max(120, 'Section name must be 120 characters or less'),
});

export const DeleteSectionSchema = z.object({
  id: z.string().min(1, 'Section ID is required'),
});

export const ReorderSectionSchema = z.object({
  id: z.string().min(1, 'Section ID is required'),
  order: z.number().int().min(1, 'Order must be positive'),
});

/**
 * Comment-related validation schemas
 */
export const CreateCommentSchema = z
  .object({
    content: z
      .string()
      .min(1, 'Comment content is required')
      .max(15000, 'Comment must be 15,000 characters or less'),
    task_id: z.string().min(1, 'Task ID must not be empty').optional(),
    project_id: z.string().min(1, 'Project ID must not be empty').optional(),
    attachment: z
      .object({
        file_url: z.string().url('File URL must be valid'),
        file_name: z.string().min(1, 'File name is required'),
        file_type: z.string().min(1, 'File type is required'),
        file_size: z.number().int().min(0, 'File size must be non-negative'),
      })
      .strict()
      .optional(),
  })
  .refine(data => data.task_id || data.project_id, {
    message: 'Either task_id or project_id is required',
    path: ['task_id', 'project_id'],
  })
  .refine(data => !(data.task_id && data.project_id), {
    message: 'Cannot specify both task_id and project_id, only one is allowed',
    path: ['task_id', 'project_id'],
  });

export const UpdateCommentSchema = z.object({
  id: z.string().min(1, 'Comment ID is required'),
  content: z
    .string()
    .min(1, 'Comment content is required')
    .max(15000, 'Comment must be 15,000 characters or less'),
});

export const DeleteCommentSchema = z.object({
  id: z.string().min(1, 'Comment ID is required'),
});

/**
 * Filter-related validation schemas
 */
export const CreateFilterSchema = z.object({
  name: z
    .string()
    .min(1, 'Filter name is required')
    .max(120, 'Filter name must be 120 characters or less'),
  query: z.string().min(1, 'Query is required'),
  color: z.string().min(1, 'Color is required').optional(),
  order: z.number().int().min(1).optional(),
  is_favorite: z.boolean().default(false),
});

export const UpdateFilterSchema = CreateFilterSchema.partial().extend({
  id: z.string().min(1, 'Filter ID is required'),
});

export const DeleteFilterSchema = z.object({
  id: z.string().min(1, 'Filter ID is required'),
});

export const QueryFilterSchema = z.object({
  filter_id: z.string().min(1, 'Filter ID is required'),
});

/**
 * Label-related validation schemas
 */
export const CreateLabelSchema = z.object({
  name: z
    .string()
    .min(1, 'Label name is required')
    .max(120, 'Label name must be 120 characters or less')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Label name can only contain alphanumeric characters, hyphens, and underscores'
    ),
  order: z.number().int().min(1).optional(),
  color: z.string().min(1, 'Color is required'),
  is_favorite: z.boolean().default(false),
});

export const UpdateLabelSchema = CreateLabelSchema.partial().extend({
  id: z.string().min(1, 'Label ID is required'),
});

export const DeleteLabelSchema = z.object({
  id: z.string().min(1, 'Label ID is required'),
});

/**
 * Reminder-related validation schemas
 */
// Due date schema for reminders (must include time)
const ReminderDueSchema = z.object({
  date: z.string().optional(), // ISO 8601 datetime
  string: z.string().optional(), // Natural language (e.g., "tomorrow at 10:00", "every day at 9am")
  timezone: z.string().nullable().optional(),
  is_recurring: z.boolean().default(false),
  lang: z.string().default('en'),
});

// Base reminder create schema with discriminated union for types
export const CreateReminderSchema = z.discriminatedUnion('type', [
  // Relative reminder: minutes before task due date
  z.object({
    type: z.literal('relative'),
    item_id: z.string().min(1, 'Task ID is required'),
    minute_offset: z
      .number()
      .int()
      .min(0, 'Minute offset must be non-negative')
      .max(43200, 'Minute offset cannot exceed 30 days (43200 minutes)'), // Max 30 days
    notify_uid: z.string().optional(),
  }),
  // Absolute reminder: specific date and time
  z.object({
    type: z.literal('absolute'),
    item_id: z.string().min(1, 'Task ID is required'),
    due: ReminderDueSchema,
    notify_uid: z.string().optional(),
  }),
  // Location reminder: geofenced
  z.object({
    type: z.literal('location'),
    item_id: z.string().min(1, 'Task ID is required'),
    name: z.string().min(1, 'Location name is required'),
    loc_lat: z.string().min(1, 'Latitude is required'),
    loc_long: z.string().min(1, 'Longitude is required'),
    loc_trigger: z.enum(['on_enter', 'on_leave']),
    radius: z
      .number()
      .int()
      .min(1, 'Radius must be at least 1 meter')
      .max(5000, 'Radius cannot exceed 5000 meters'),
    notify_uid: z.string().optional(),
  }),
]);

// Update reminder schema allows partial updates
export const UpdateReminderSchema = z.object({
  id: z.string().min(1, 'Reminder ID is required'),
  type: z.enum(['relative', 'absolute', 'location']).optional(),
  notify_uid: z.string().optional(),
  due: ReminderDueSchema.optional(),
  minute_offset: z.number().int().min(0).max(43200).optional(),
  name: z.string().optional(),
  loc_lat: z.string().optional(),
  loc_long: z.string().optional(),
  loc_trigger: z.enum(['on_enter', 'on_leave']).optional(),
  radius: z.number().int().min(1).max(5000).optional(),
});

export const DeleteReminderSchema = z.object({
  id: z.string().min(1, 'Reminder ID is required'),
});

export const GetReminderSchema = z.object({
  id: z.string().min(1, 'Reminder ID is required'),
});

export const ListRemindersSchema = z.object({
  item_id: z.string().optional(), // Filter by task ID
});

/**
 * Batch operation validation schemas
 */
export const BatchCommandSchema = z.object({
  type: z.enum([
    'item_add',
    'item_update',
    'item_delete',
    'item_complete',
    'item_uncomplete',
    'item_move',
    'project_add',
    'project_update',
    'project_delete',
    'project_archive',
    'section_add',
    'section_update',
    'section_delete',
  ]),
  temp_id: z.string().optional(),
  uuid: z.string().optional(),
  args: z.record(z.any()),
});

export const BatchOperationObjectSchema = z.object({
  batch_commands: z
    .array(BatchCommandSchema)
    .min(1, 'At least one command is required')
    .max(100, 'Maximum 100 commands allowed'),
});

export const BatchOperationSchema = BatchOperationObjectSchema.refine(
  data => {
    // Check temp_id uniqueness
    const tempIds = data.batch_commands
      .map(cmd => cmd.temp_id)
      .filter((id): id is string => id !== undefined && id !== null);

    if (tempIds.length === 0) return true; // No temp_ids to validate

    const uniqueTempIds = new Set(tempIds);
    return uniqueTempIds.size === tempIds.length;
  },
  {
    message: 'All temp_id values must be unique within the batch',
    path: ['batch_commands'],
  }
);

/**
 * Configuration validation schemas
 */
export const APIConfigurationSchema = z.object({
  token: z.string().min(1, 'API token is required'),
  base_url: z
    .string()
    .url('Base URL must be valid')
    .default('https://api.todoist.com/rest/v1'),
  timeout: z.number().int().min(1000).max(60000).default(10000),
  retry_attempts: z.number().int().min(0).max(10).default(3),
});

/**
 * Common schemas
 */
export const PaginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(30),
  offset: z.number().int().min(0).default(0),
});

export const SortSchema = z.object({
  sort_by: z
    .enum(['created', 'updated', 'priority', 'order', 'name'])
    .default('order'),
  sort_order: z.enum(['asc', 'desc']).default('asc'),
});

/**
 * Type exports for use in other modules
 */
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type TaskQueryInput = z.infer<typeof TaskQuerySchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
export type CreateSectionInput = z.infer<typeof CreateSectionSchema>;
export type UpdateSectionInput = z.infer<typeof UpdateSectionSchema>;
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;
export type UpdateCommentInput = z.infer<typeof UpdateCommentSchema>;
export type CreateFilterInput = z.infer<typeof CreateFilterSchema>;
export type UpdateFilterInput = z.infer<typeof UpdateFilterSchema>;
export type CreateLabelInput = z.infer<typeof CreateLabelSchema>;
export type UpdateLabelInput = z.infer<typeof UpdateLabelSchema>;
export type CreateReminderInput = z.infer<typeof CreateReminderSchema>;
export type UpdateReminderInput = z.infer<typeof UpdateReminderSchema>;
export type BatchCommandInput = z.infer<typeof BatchCommandSchema>;
export type BatchOperationInput = z.infer<typeof BatchOperationSchema>;
export type APIConfigurationInput = z.infer<typeof APIConfigurationSchema>;
export type PaginationInput = z.infer<typeof PaginationSchema>;
export type SortInput = z.infer<typeof SortSchema>;
