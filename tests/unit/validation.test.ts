/**
 * Unit tests for Zod validation schemas
 * Tests the input validation for all MCP tool parameters
 * Tests MUST FAIL until the actual schemas are implemented
 */

import { describe, test, expect, beforeEach } from '@jest/globals';

// Mock validation schemas - will fail until implemented
let validationSchemas: any;

describe('Zod Schema Validation Tests', () => {
  beforeEach(() => {
    // This will fail until the actual schemas are implemented
    try {
      validationSchemas = require('../../src/schemas/validation.js');
    } catch (error) {
      validationSchemas = null;
    }
  });

  describe('Task Schema Validation', () => {
    test('should validate task creation parameters', () => {
      expect(validationSchemas).toBeDefined();
      expect(validationSchemas.CreateTaskSchema).toBeDefined();

      const validTaskData = {
        content: 'Valid task content',
        project_id: '220474322',
        priority: 2,
        due_string: 'tomorrow',
        labels: ['urgent', 'work'],
      };

      const result =
        validationSchemas.CreateTaskSchema.safeParse(validTaskData);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validTaskData);
    });

    test('should reject task creation with missing required fields', () => {
      const invalidTaskData = {
        // Missing content and project_id
        priority: 2,
      };

      const result =
        validationSchemas.CreateTaskSchema.safeParse(invalidTaskData);
      expect(result.success).toBe(false);
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['content'],
            message: 'Required',
          }),
          expect.objectContaining({
            path: ['project_id'],
            message: 'Required',
          }),
        ])
      );
    });

    test('should validate content length constraints', () => {
      const longContentTask = {
        content: 'a'.repeat(501), // Exceeds 500 char limit
        project_id: '220474322',
      };

      const result =
        validationSchemas.CreateTaskSchema.safeParse(longContentTask);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('500');
    });

    test('should validate priority range', () => {
      const invalidPriorityTask = {
        content: 'Test task',
        project_id: '220474322',
        priority: 5, // Invalid: must be 1-4
      };

      const result =
        validationSchemas.CreateTaskSchema.safeParse(invalidPriorityTask);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('4');
    });

    test('should validate labels array constraints', () => {
      const tooManyLabelsTask = {
        content: 'Test task',
        project_id: '220474322',
        labels: Array.from({ length: 101 }, (_, i) => `label_${i}`), // Exceeds 100 limit
      };

      const result =
        validationSchemas.CreateTaskSchema.safeParse(tooManyLabelsTask);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('100');
    });

    test('should validate due date formats', () => {
      const validDueDates = [
        { due_date: '2023-12-01' },
        { due_datetime: '2023-12-01T12:00:00.000Z' },
        { due_string: 'tomorrow' },
        { due_string: 'next friday at 2pm' },
      ];

      validDueDates.forEach(dateData => {
        const taskData = {
          content: 'Test task',
          project_id: '220474322',
          ...dateData,
        };

        const result = validationSchemas.CreateTaskSchema.safeParse(taskData);
        expect(result.success).toBe(true);
      });

      // Invalid date format
      const invalidDateTask = {
        content: 'Test task',
        project_id: '220474322',
        due_date: 'invalid-date-format',
      };

      const result =
        validationSchemas.CreateTaskSchema.safeParse(invalidDateTask);
      expect(result.success).toBe(false);
    });

    test('should validate task update parameters', () => {
      expect(validationSchemas.UpdateTaskSchema).toBeDefined();

      const validUpdateData = {
        task_id: '2995104339',
        content: 'Updated task content',
        priority: 3,
        section_id: '7025',
      };

      const result =
        validationSchemas.UpdateTaskSchema.safeParse(validUpdateData);
      expect(result.success).toBe(true);

      // Should require task ID
      const noIdUpdate = {
        content: 'Updated content',
      };

      const noIdResult =
        validationSchemas.UpdateTaskSchema.safeParse(noIdUpdate);
      expect(noIdResult.success).toBe(false);
      expect(noIdResult.error.issues[0].path).toEqual(['task_id']);
    });

    test('should validate task query parameters', () => {
      expect(validationSchemas.TaskQuerySchema).toBeDefined();

      const validQueryData = {
        project_id: '220474322',
        section_id: '7025',
        label_id: '2156154810',
        filter: 'today',
        lang: 'en',
      };

      const result =
        validationSchemas.TaskQuerySchema.safeParse(validQueryData);
      expect(result.success).toBe(true);

      // All parameters should be optional
      const emptyQuery = {};
      const emptyResult =
        validationSchemas.TaskQuerySchema.safeParse(emptyQuery);
      expect(emptyResult.success).toBe(true);
      expect(emptyResult.data.lang).toBe('en'); // Default value
    });
  });

  describe('Project Schema Validation', () => {
    test('should validate project creation parameters', () => {
      expect(validationSchemas.CreateProjectSchema).toBeDefined();

      const validProjectData = {
        name: 'Test Project',
        color: 'blue',
        view_style: 'list',
        is_favorite: true,
        parent_id: '220474322',
      };

      const result =
        validationSchemas.CreateProjectSchema.safeParse(validProjectData);
      expect(result.success).toBe(true);
    });

    test('should validate project name constraints', () => {
      // Missing name
      const noNameProject = {
        color: 'blue',
      };

      const noNameResult =
        validationSchemas.CreateProjectSchema.safeParse(noNameProject);
      expect(noNameResult.success).toBe(false);
      expect(noNameResult.error.issues[0].path).toEqual(['name']);

      // Name too long
      const longNameProject = {
        name: 'a'.repeat(121), // Exceeds 120 char limit
      };

      const longNameResult =
        validationSchemas.CreateProjectSchema.safeParse(longNameProject);
      expect(longNameResult.success).toBe(false);
      expect(longNameResult.error.issues[0].message).toContain('120');
    });

    test('should validate view_style enum', () => {
      const validViewStyles = ['list', 'board'];

      validViewStyles.forEach(style => {
        const projectData = {
          name: 'Test Project',
          color: 'blue',
          view_style: style,
        };

        const result =
          validationSchemas.CreateProjectSchema.safeParse(projectData);
        expect(result.success).toBe(true);
      });

      // Invalid view style
      const invalidStyleProject = {
        name: 'Test Project',
        color: 'blue',
        view_style: 'invalid_style',
      };

      const result =
        validationSchemas.CreateProjectSchema.safeParse(invalidStyleProject);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('list');
      expect(result.error.issues[0].message).toContain('board');
    });

    test('should validate boolean fields', () => {
      const booleanFields = ['is_favorite'];

      booleanFields.forEach(field => {
        const projectData = {
          name: 'Test Project',
          color: 'blue',
          [field]: 'not_boolean', // Invalid boolean
        };

        const result =
          validationSchemas.CreateProjectSchema.safeParse(projectData);
        expect(result.success).toBe(false);
        expect(result.error.issues[0].path).toEqual([field]);
      });
    });
  });

  describe('Section Schema Validation', () => {
    test('should validate section creation parameters', () => {
      expect(validationSchemas.CreateSectionSchema).toBeDefined();

      const validSectionData = {
        name: 'Test Section',
        project_id: '220474322',
        order: 5,
      };

      const result =
        validationSchemas.CreateSectionSchema.safeParse(validSectionData);
      expect(result.success).toBe(true);
    });

    test('should require name and project_id', () => {
      const incompleteSectionData = {
        order: 1,
        // Missing name and project_id
      };

      const result = validationSchemas.CreateSectionSchema.safeParse(
        incompleteSectionData
      );
      expect(result.success).toBe(false);

      const missingFields = result.error.issues.map((issue: any) => issue.path[0]);
      expect(missingFields).toContain('name');
      expect(missingFields).toContain('project_id');
    });

    test('should validate section name length', () => {
      const longNameSection = {
        name: 'a'.repeat(121), // Exceeds 120 char limit
        project_id: '220474322',
      };

      const result =
        validationSchemas.CreateSectionSchema.safeParse(longNameSection);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('120');
    });

    test('should validate order as positive integer', () => {
      const invalidOrders = [0, -1, 1.5, 'not_number'];

      invalidOrders.forEach(order => {
        const sectionData = {
          name: 'Test Section',
          project_id: '220474322',
          order,
        };

        const result =
          validationSchemas.CreateSectionSchema.safeParse(sectionData);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Comment Schema Validation', () => {
    test('should validate comment creation parameters', () => {
      expect(validationSchemas.CreateCommentSchema).toBeDefined();

      const validCommentData = {
        content: 'This is a test comment',
        task_id: '2995104339',
      };

      const result =
        validationSchemas.CreateCommentSchema.safeParse(validCommentData);
      expect(result.success).toBe(true);
    });

    test('should validate content length constraints', () => {
      const longContentComment = {
        content: 'a'.repeat(15001), // Exceeds 15000 char limit
        task_id: '2995104339',
      };

      const result =
        validationSchemas.CreateCommentSchema.safeParse(longContentComment);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toMatch(/15[,]?000/);
    });

    test('should require either task_id or project_id', () => {
      // Missing both
      const noTargetComment = {
        content: 'Comment without target',
      };

      const result =
        validationSchemas.CreateCommentSchema.safeParse(noTargetComment);
      expect(result.success).toBe(false);

      // Should have custom validation for either/or requirement
      expect(result.error.issues[0].message).toContain('task_id or project_id');
    });

    test('should reject both task_id and project_id', () => {
      const bothTargetsComment = {
        content: 'Comment with both targets',
        task_id: '2995104339',
        project_id: '220474322',
      };

      const result =
        validationSchemas.CreateCommentSchema.safeParse(bothTargetsComment);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('only one');
    });

    test('should validate attachment structure', () => {
      const validAttachment = {
        content: 'Comment with attachment',
        task_id: '2995104339',
        attachment: {
          file_url: 'https://example.com/file.pdf',
          file_name: 'document.pdf',
          file_type: 'application/pdf',
          file_size: 1024768,
        },
      };

      const result =
        validationSchemas.CreateCommentSchema.safeParse(validAttachment);
      expect(result.success).toBe(true);

      // Invalid attachment structure
      const invalidAttachment = {
        content: 'Comment with invalid attachment',
        task_id: '2995104339',
        attachment: 'invalid_attachment_format',
      };

      const invalidResult =
        validationSchemas.CreateCommentSchema.safeParse(invalidAttachment);
      expect(invalidResult.success).toBe(false);
    });
  });

  describe('Filter Schema Validation', () => {
    test('should validate filter creation parameters', () => {
      expect(validationSchemas.CreateFilterSchema).toBeDefined();

      const validFilterData = {
        name: 'Test Filter',
        query: 'p1 & @urgent',
        color: 'red',
        order: 3,
        is_favorite: true,
      };

      const result =
        validationSchemas.CreateFilterSchema.safeParse(validFilterData);
      expect(result.success).toBe(true);
    });

    test('should require name and query', () => {
      const incompleteFilterData = {
        color: 'blue',
        // Missing name and query
      };

      const result =
        validationSchemas.CreateFilterSchema.safeParse(incompleteFilterData);
      expect(result.success).toBe(false);

      const missingFields = result.error.issues.map((issue: any) => issue.path[0]);
      expect(missingFields).toContain('name');
      expect(missingFields).toContain('query');
    });

    test('should validate filter name length', () => {
      const longNameFilter = {
        name: 'a'.repeat(121), // Exceeds 120 char limit
        query: 'today',
      };

      const result =
        validationSchemas.CreateFilterSchema.safeParse(longNameFilter);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('120');
    });

    test('should validate query syntax (basic validation)', () => {
      // This would require more complex validation in practice
      const validQueries = [
        'today',
        'p1',
        '@urgent',
        '#Work',
        'due before: tomorrow',
        '(today | overdue) & p1',
      ];

      validQueries.forEach(query => {
        const filterData = {
          name: 'Test Filter',
          query,
        };

        const result =
          validationSchemas.CreateFilterSchema.safeParse(filterData);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Label Schema Validation', () => {
    test('should validate label creation parameters', () => {
      expect(validationSchemas.CreateLabelSchema).toBeDefined();

      const validLabelData = {
        name: 'test-label',
        color: 'green',
        order: 2,
        is_favorite: false,
      };

      const result =
        validationSchemas.CreateLabelSchema.safeParse(validLabelData);
      expect(result.success).toBe(true);
    });

    test('should validate label name constraints', () => {
      // Name too long
      const longNameLabel = {
        name: 'a'.repeat(121), // Exceeds 120 char limit
        color: 'blue',
      };

      const result =
        validationSchemas.CreateLabelSchema.safeParse(longNameLabel);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('120');

      // Empty name
      const emptyNameLabel = {
        name: '',
        color: 'blue',
      };

      const emptyResult =
        validationSchemas.CreateLabelSchema.safeParse(emptyNameLabel);
      expect(emptyResult.success).toBe(false);
    });

    test('should validate label name format', () => {
      // Labels should follow certain naming conventions
      const validNames = [
        'urgent',
        'work-project',
        'home_tasks',
        'meeting123',
        'high-priority',
      ];

      validNames.forEach(name => {
        const labelData = {
          name,
          color: 'blue',
        };

        const result = validationSchemas.CreateLabelSchema.safeParse(labelData);
        expect(result.success).toBe(true);
      });

      // Invalid characters
      const invalidNames = [
        'label with spaces',
        'label@symbol',
        'label#hash',
        'label/slash',
      ];

      invalidNames.forEach(name => {
        const labelData = {
          name,
          color: 'blue',
        };

        const result = validationSchemas.CreateLabelSchema.safeParse(labelData);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Batch Operation Schema Validation', () => {
    test('should validate batch command structure', () => {
      expect(validationSchemas.BatchOperationSchema).toBeDefined();

      const validBatchData = {
        batch_commands: [
          {
            type: 'item_add',
            temp_id: 'temp_task_1',
            args: {
              content: 'First task',
              project_id: '220474322',
            },
          },
          {
            type: 'item_update',
            args: {
              id: '2995104339',
              content: 'Updated task',
            },
          },
        ],
      };

      const result =
        validationSchemas.BatchOperationSchema.safeParse(validBatchData);
      expect(result.success).toBe(true);
    });

    test('should validate batch size limits', () => {
      const tooManyCommands = {
        batch_commands: Array.from({ length: 101 }, (_, i) => ({
          type: 'item_add',
          temp_id: `temp_${i}`,
          args: {
            content: `Task ${i}`,
            project_id: '220474322',
          },
        })),
      };

      const result =
        validationSchemas.BatchOperationSchema.safeParse(tooManyCommands);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('100');
    });

    test('should validate command types', () => {
      const validCommandTypes = [
        'item_add',
        'item_update',
        'item_delete',
        'item_complete',
        'item_uncomplete',
        'item_move',
      ];

      validCommandTypes.forEach(type => {
        const batchData = {
          batch_commands: [
            {
              type,
              temp_id: 'temp_1',
              args: {
                content: 'Test task',
                project_id: '220474322',
              },
            },
          ],
        };

        const result =
          validationSchemas.BatchOperationSchema.safeParse(batchData);
        expect(result.success).toBe(true);
      });

      // Invalid command type
      const invalidCommand = {
        batch_commands: [
          {
            type: 'invalid_command',
            temp_id: 'temp_1',
            args: {},
          },
        ],
      };

      const result =
        validationSchemas.BatchOperationSchema.safeParse(invalidCommand);
      expect(result.success).toBe(false);
    });

    test('should validate temp_id uniqueness within batch', () => {
      const duplicateTempIds = {
        batch_commands: [
          {
            type: 'item_add',
            temp_id: 'duplicate_id',
            args: {
              content: 'First task',
              project_id: '220474322',
            },
          },
          {
            type: 'item_add',
            temp_id: 'duplicate_id', // Duplicate
            args: {
              content: 'Second task',
              project_id: '220474322',
            },
          },
        ],
      };

      const result =
        validationSchemas.BatchOperationSchema.safeParse(duplicateTempIds);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('unique');
    });
  });

  describe.skip('Error Schema Validation', () => {
    test('should validate error response structure', () => {
      expect(validationSchemas.ErrorResponseSchema).toBeDefined();

      const validErrorData = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: {
          field: 'content',
          expected: 'string',
          received: 'null',
        },
        retryable: false,
        retry_after: null,
      };

      const result =
        validationSchemas.ErrorResponseSchema.safeParse(validErrorData);
      expect(result.success).toBe(true);
    });

    test('should validate error codes enum', () => {
      const validErrorCodes = [
        'INVALID_TOKEN',
        'RATE_LIMIT_EXCEEDED',
        'RESOURCE_NOT_FOUND',
        'VALIDATION_ERROR',
        'SYNC_ERROR',
        'BATCH_PARTIAL_FAILURE',
      ];

      validErrorCodes.forEach(code => {
        const errorData = {
          code,
          message: 'Test error',
          retryable: false,
        };

        const result =
          validationSchemas.ErrorResponseSchema.safeParse(errorData);
        expect(result.success).toBe(true);
      });

      // Invalid error code
      const invalidCode = {
        code: 'INVALID_ERROR_CODE',
        message: 'Test error',
        retryable: false,
      };

      const result =
        validationSchemas.ErrorResponseSchema.safeParse(invalidCode);
      expect(result.success).toBe(false);
    });
  });

  describe.skip('Custom Validation Functions', () => {
    test('should validate Todoist query syntax', () => {
      expect(validationSchemas.validateTodoistQuery).toBeDefined();

      const validQueries = [
        'today',
        'overdue',
        'p1 | p2',
        '(today & p1) | (overdue & p2)',
        '#Work & @urgent',
        'due before: +7 days',
        'assigned to: me',
      ];

      validQueries.forEach(query => {
        const isValid = validationSchemas.validateTodoistQuery(query);
        expect(isValid).toBe(true);
      });

      const invalidQueries = [
        '((unbalanced',
        'invalid & syntax (((',
        'unknown_operator ?? test',
        'due before: invalid_date',
      ];

      invalidQueries.forEach(query => {
        const isValid = validationSchemas.validateTodoistQuery(query);
        expect(isValid).toBe(false);
      });
    });

    test('should validate file attachment types', () => {
      expect(validationSchemas.validateFileType).toBeDefined();

      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/pdf',
        'text/plain',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
      ];

      allowedTypes.forEach(type => {
        const isValid = validationSchemas.validateFileType(type);
        expect(isValid).toBe(true);
      });

      const blockedTypes = [
        'application/x-executable',
        'application/x-msdownload',
        'application/x-msdos-program',
        'text/javascript',
      ];

      blockedTypes.forEach(type => {
        const isValid = validationSchemas.validateFileType(type);
        expect(isValid).toBe(false);
      });
    });

    test('should validate URL formats', () => {
      expect(validationSchemas.validateUrl).toBeDefined();

      const validUrls = [
        'https://example.com',
        'https://example.com/path',
        'https://example.com/path?query=value',
        'https://subdomain.example.com',
      ];

      validUrls.forEach(url => {
        const isValid = validationSchemas.validateUrl(url);
        expect(isValid).toBe(true);
      });

      const invalidUrls = [
        'http://example.com', // Should require HTTPS
        'ftp://example.com',
        'invalid-url',
        'javascript:alert(1)',
      ];

      invalidUrls.forEach(url => {
        const isValid = validationSchemas.validateUrl(url);
        expect(isValid).toBe(false);
      });
    });
  });
});
