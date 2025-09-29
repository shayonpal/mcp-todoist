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
        resource_type: z.string(),
        file_url: z.string().url('File URL must be valid'),
        file_name: z.string(),
        file_size: z.number().int().min(0),
        file_type: z.string(),
      })
      .optional(),
  })
  .refine(data => data.task_id || data.project_id, {
    message: 'Either task_id or project_id is required',
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
  color: z.string().min(1, 'Color is required'),
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
    .max(120, 'Label name must be 120 characters or less'),
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
 * Batch operation validation schemas
 */
export const BatchCommandSchema = z.object({
  type: z.enum([
    'item_add',
    'item_update',
    'item_delete',
    'item_complete',
    'item_uncomplete',
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

export const BatchOperationSchema = z.object({
  batch_commands: z
    .array(BatchCommandSchema)
    .min(1, 'At least one command is required')
    .max(100, 'Maximum 100 commands allowed'),
});

/**
 * Configuration validation schemas
 */
export const APIConfigurationSchema = z.object({
  token: z.string().min(1, 'API token is required'),
  base_url: z
    .string()
    .url('Base URL must be valid')
    .default('https://api.todoist.com/rest/v2'),
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
export type BatchCommandInput = z.infer<typeof BatchCommandSchema>;
export type BatchOperationInput = z.infer<typeof BatchOperationSchema>;
export type APIConfigurationInput = z.infer<typeof APIConfigurationSchema>;
export type PaginationInput = z.infer<typeof PaginationSchema>;
export type SortInput = z.infer<typeof SortSchema>;
