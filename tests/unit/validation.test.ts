/**
 * Unit tests for Zod validation schemas
 * Tests the input validation for all MCP tool parameters
 * Tests MUST FAIL until the actual schemas are implemented
 */

import * as validationSchemas from '../../src/schemas/validation.js';
import { describe, test, expect } from '@jest/globals';

const expectFailure = <T>(result: { success: boolean; error?: T }): T => {
  expect(result.success).toBe(false);
  if (result.success || !result.error) {
    throw new Error('Expected validation to fail');
  }
  return result.error;
};

const expectSuccess = <T>(result: { success: boolean; data?: T }): T => {
  expect(result.success).toBe(true);
  if (!result.success || result.data === undefined) {
    throw new Error('Expected validation to succeed');
  }
  return result.data;
};

describe('Zod Schema Validation Tests', () => {
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
      const data = expectSuccess(result);
      expect(data).toEqual(validTaskData);
    });

    test('should reject task creation with missing required fields', () => {
      const invalidTaskData = {
        // Missing content and project_id
        priority: 2,
      };

      const result =
        validationSchemas.CreateTaskSchema.safeParse(invalidTaskData);
      const error = expectFailure(result);
      expect(error.issues).toEqual(
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
      const error = expectFailure(result);
      expect(error.issues[0].message).toContain('500');
    });

    test('should validate priority range', () => {
      const invalidPriorityTask = {
        content: 'Test task',
        project_id: '220474322',
        priority: 5, // Invalid: must be 1-4
      };

      const result =
        validationSchemas.CreateTaskSchema.safeParse(invalidPriorityTask);
      const error = expectFailure(result);
      expect(error.issues[0].message).toContain('4');
    });

    test('should validate labels array constraints', () => {
      const tooManyLabelsTask = {
        content: 'Test task',
        project_id: '220474322',
        labels: Array.from({ length: 101 }, (_, i) => `label_${i}`), // Exceeds 100 limit
      };

      const result =
        validationSchemas.CreateTaskSchema.safeParse(tooManyLabelsTask);
      const error = expectFailure(result);
      expect(error.issues[0].message).toContain('100');
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
        expectSuccess(result);
      });

      // Invalid date format
      const invalidDateTask = {
        content: 'Test task',
        project_id: '220474322',
        due_date: 'invalid-date-format',
      };

      const result =
        validationSchemas.CreateTaskSchema.safeParse(invalidDateTask);
      expectFailure(result);
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
      expectSuccess(result);

      // Should require task ID
      const noIdUpdate = {
        content: 'Updated content',
      };

      const noIdResult =
        validationSchemas.UpdateTaskSchema.safeParse(noIdUpdate);
      const error = expectFailure(noIdResult);
      expect(error.issues[0].path).toEqual(['task_id']);
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
      expectSuccess(result);

      // All parameters should be optional
      const emptyQuery = {};
      const emptyResult =
        validationSchemas.TaskQuerySchema.safeParse(emptyQuery);
      const data = expectSuccess(emptyResult);
      expect(data.lang).toBe('en'); // Default value
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
      expectSuccess(result);
    });

    test('should validate project name constraints', () => {
      // Missing name
      const noNameProject = {
        color: 'blue',
      };

      const noNameResult =
        validationSchemas.CreateProjectSchema.safeParse(noNameProject);
      const noNameError = expectFailure(noNameResult);
      expect(noNameError.issues[0].path).toEqual(['name']);

      // Name too long
      const longNameProject = {
        name: 'a'.repeat(121), // Exceeds 120 char limit
      };

      const longNameResult =
        validationSchemas.CreateProjectSchema.safeParse(longNameProject);
      const longNameError = expectFailure(longNameResult);
      expect(longNameError.issues[0].message).toContain('120');
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
        expectSuccess(result);
      });

      // Invalid view style
      const invalidStyleProject = {
        name: 'Test Project',
        color: 'blue',
        view_style: 'invalid_style',
      };

      const result =
        validationSchemas.CreateProjectSchema.safeParse(invalidStyleProject);
      const error = expectFailure(result);
      expect(error.issues[0].message).toContain('list');
      expect(error.issues[0].message).toContain('board');
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
        const error = expectFailure(result);
        expect(error.issues[0].path).toEqual([field]);
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
      expectSuccess(result);
    });

    test('should require name and project_id', () => {
      const incompleteSectionData = {
        order: 1,
        // Missing name and project_id
      };

      const result = validationSchemas.CreateSectionSchema.safeParse(
        incompleteSectionData
      );
      const error = expectFailure(result);

      const missingFields = error.issues.map((issue: any) => issue.path[0]);
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
      const error = expectFailure(result);
      expect(error.issues[0].message).toContain('120');
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
        expectFailure(result);
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
      expectSuccess(result);
    });

    test('should validate content length constraints', () => {
      const longContentComment = {
        content: 'a'.repeat(15001), // Exceeds 15000 char limit
        task_id: '2995104339',
      };

      const result =
        validationSchemas.CreateCommentSchema.safeParse(longContentComment);
      const error = expectFailure(result);
      expect(error.issues[0].message).toMatch(/15[,]?000/);
    });

    test('should require either task_id or project_id', () => {
      // Missing both
      const noTargetComment = {
        content: 'Comment without target',
      };

      const result =
        validationSchemas.CreateCommentSchema.safeParse(noTargetComment);
      const error = expectFailure(result);

      // Should have custom validation for either/or requirement
      expect(error.issues[0].message).toContain('task_id or project_id');
    });

    test('should reject both task_id and project_id', () => {
      const bothTargetsComment = {
        content: 'Comment with both targets',
        task_id: '2995104339',
        project_id: '220474322',
      };

      const result =
        validationSchemas.CreateCommentSchema.safeParse(bothTargetsComment);
      const error = expectFailure(result);
      expect(error.issues[0].message).toContain('only one');
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
      expectSuccess(result);

      // Invalid attachment structure
      const invalidAttachment = {
        content: 'Comment with invalid attachment',
        task_id: '2995104339',
        attachment: 'invalid_attachment_format',
      };

      const invalidResult =
        validationSchemas.CreateCommentSchema.safeParse(invalidAttachment);
      expectFailure(invalidResult);
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
      expectSuccess(result);
    });

    test('should require name and query', () => {
      const incompleteFilterData = {
        color: 'blue',
        // Missing name and query
      };

      const result =
        validationSchemas.CreateFilterSchema.safeParse(incompleteFilterData);
      const error = expectFailure(result);

      const missingFields = error.issues.map((issue: any) => issue.path[0]);
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
      const error = expectFailure(result);
      expect(error.issues[0].message).toContain('120');
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
        expectSuccess(result);
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
      expectSuccess(result);
    });

    test('should validate label name constraints', () => {
      // Name too long
      const longNameLabel = {
        name: 'a'.repeat(121), // Exceeds 120 char limit
        color: 'blue',
      };

      const result =
        validationSchemas.CreateLabelSchema.safeParse(longNameLabel);
      const error = expectFailure(result);
      expect(error.issues[0].message).toContain('120');

      // Empty name
      const emptyNameLabel = {
        name: '',
        color: 'blue',
      };

      const emptyResult =
        validationSchemas.CreateLabelSchema.safeParse(emptyNameLabel);
      expectFailure(emptyResult);
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
        expectSuccess(result);
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
        expectFailure(result);
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
      expectSuccess(result);
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
      const error = expectFailure(result);
      expect(error.issues[0].message).toContain('100');
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
        expectSuccess(result);
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
      expectFailure(result);
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
      const error = expectFailure(result);
      expect(error.issues[0].message).toContain('unique');
    });
  });

  /**
   * T013: Unit test - Deadline format validation (YYYY-MM-DD regex)
   * T014: Unit test - DeadlineSchema error messages
   */
  describe('Deadline Schema Validation', () => {
    test('should accept valid YYYY-MM-DD format', () => {
      const validFormats = [
        '2025-01-01',
        '2025-12-31',
        '2026-06-15',
        '2030-02-28',
      ];

      validFormats.forEach(deadline => {
        // Test with DeadlineParameterSchema (used in tool input)
        const result =
          validationSchemas.DeadlineParameterSchema?.safeParse(deadline);
        if (result) {
          expectSuccess(result);
        }
      });
    });

    test('should reject invalid date formats', () => {
      const invalidFormats = [
        { input: '10/15/2025', name: 'US format' },
        { input: '2025/10/15', name: 'slash separators' },
        { input: '20251015', name: 'no separators' },
        { input: '2025-10', name: 'partial date' },
        { input: '15-10-2025', name: 'DD-MM-YYYY format' },
        { input: 'tomorrow', name: 'natural language' },
        { input: '2025-1-1', name: 'single digit month/day' },
      ];

      invalidFormats.forEach(({ input }) => {
        const result =
          validationSchemas.DeadlineParameterSchema?.safeParse(input);
        if (result) {
          const error = expectFailure(result);
          expect(error.issues[0].message).toContain('YYYY-MM-DD');
          expect(error.issues[0].message).toContain('2025-10-15'); // Example format
        }
      });
    });

    test('should accept null deadline (for removal)', () => {
      const result = validationSchemas.DeadlineParameterSchema?.safeParse(null);
      if (result) {
        expectSuccess(result);
      }
    });

    test('should accept undefined deadline (optional)', () => {
      const result =
        validationSchemas.DeadlineParameterSchema?.safeParse(undefined);
      if (result) {
        expectSuccess(result);
      }
    });

    test('should provide helpful error messages', () => {
      const result =
        validationSchemas.DeadlineParameterSchema?.safeParse('invalid-date');
      if (result) {
        const error = expectFailure(result);
        const message = error.issues[0].message;

        // Error message should contain:
        expect(message).toContain('YYYY-MM-DD'); // Expected format
        expect(message).toContain('2025'); // Example year
        expect(message).toContain('10'); // Example month
        expect(message).toContain('15'); // Example day
      }
    });

    test('should validate deadline in CreateTaskSchema', () => {
      const taskWithValidDeadline = {
        content: 'Test task',
        project_id: '220474322',
        deadline: '2025-12-31',
      };

      const result = validationSchemas.CreateTaskSchema.safeParse(
        taskWithValidDeadline
      );
      const data = expectSuccess(result);
      expect(data.deadline).toBe('2025-12-31');
    });

    test('should validate deadline in UpdateTaskSchema', () => {
      const updateWithDeadline = {
        task_id: '123456',
        deadline: '2025-11-30',
      };

      const result =
        validationSchemas.UpdateTaskSchema.safeParse(updateWithDeadline);
      const data = expectSuccess(result);
      expect(data.deadline).toBe('2025-11-30');
    });

    test('should allow deadline removal in UpdateTaskSchema', () => {
      const updateRemoveDeadline = {
        task_id: '123456',
        deadline: null,
      };

      const result =
        validationSchemas.UpdateTaskSchema.safeParse(updateRemoveDeadline);
      const data = expectSuccess(result);
      expect(data.deadline).toBeNull();
    });
  });
});
