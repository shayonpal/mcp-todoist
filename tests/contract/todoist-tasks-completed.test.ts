import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { TodoistTasksTool } from '../../src/tools/todoist-tasks.js';
import { CacheService } from '../../src/services/cache.js';
import { TodoistApiService } from '../../src/services/todoist-api.js';
import {
  BatchOperationsService,
  BatchOperationRequest,
} from '../../src/services/batch.js';
import { BatchOperationResult } from '../../src/types/errors.js';
import { TodoistTask } from '../../src/types/todoist.js';

const mockApiConfig = {
  token: 'test_token',
  base_url: 'https://api.todoist.com/rest/v1',
  timeout: 10000,
  retry_attempts: 3,
};

// Mock completed tasks data
const mockCompletedTask1: TodoistTask = {
  id: '8765432109',
  content: 'Complete project proposal',
  description: 'Draft and submit Q4 proposal',
  project_id: '2345678901',
  section_id: null as any,
  parent_id: null as any,
  order: 1,
  priority: 4,
  labels: ['Work', 'Urgent'],
  assignee_id: undefined,
  assigner_id: undefined,
  comment_count: 0,
  completed: true,
  completed_at: '2025-09-15T14:30:00Z',
  due: {
    date: '2025-09-15',
    string: '2025-09-15',
    is_recurring: false,
  },
  url: 'https://todoist.com/showTask?id=8765432109',
  created_at: '2025-09-01T09:00:00Z',
  creator_id: '123456',
};

const mockCompletedTask2: TodoistTask = {
  id: '8765432110',
  content: 'Team meeting notes',
  description: '',
  project_id: '2345678901',
  section_id: null as any,
  parent_id: null as any,
  order: 2,
  priority: 2,
  labels: ['Work'],
  assignee_id: undefined,
  assigner_id: undefined,
  comment_count: 0,
  completed: true,
  completed_at: '2025-09-16T10:00:00Z',
  due: {
    date: '2025-09-16',
    string: '2025-09-16',
    is_recurring: false,
  },
  url: 'https://todoist.com/showTask?id=8765432110',
  created_at: '2025-09-05T12:00:00Z',
  creator_id: '123456',
};

type CompletedTasksApiMock = jest.Mocked<
  Pick<
    TodoistApiService,
    'getCompletedTasksByCompletionDate' | 'getCompletedTasksByDueDate'
  >
>;

function createCompletedTasksApiMock(): CompletedTasksApiMock {
  return {
    getCompletedTasksByCompletionDate: jest.fn(async () => ({
      items: [mockCompletedTask1, mockCompletedTask2],
      next_cursor: null,
    })),
    getCompletedTasksByDueDate: jest.fn(async () => ({
      items: [mockCompletedTask1],
      next_cursor: null,
    })),
  } as unknown as CompletedTasksApiMock;
}

type BatchServiceMock = jest.Mocked<
  Pick<BatchOperationsService, 'executeBatch'>
>;

function createMockBatchService(): BatchServiceMock {
  const result: BatchOperationResult = {
    success: true,
    completed_commands: 0,
    failed_commands: 0,
    errors: [],
    temp_id_mapping: {},
  };

  const executeBatch = jest.fn(
    async (_request: BatchOperationRequest): Promise<BatchOperationResult> =>
      result
  );

  return {
    executeBatch,
  } as unknown as BatchServiceMock;
}

describe('todoist_tasks MCP Tool - list_completed action (by_completion_date)', () => {
  let apiService: CompletedTasksApiMock;
  let batchService: BatchServiceMock;
  let todoistTasksTool: TodoistTasksTool;

  beforeEach(() => {
    apiService = createCompletedTasksApiMock();
    batchService = createMockBatchService();

    todoistTasksTool = new TodoistTasksTool(mockApiConfig, {
      apiService: apiService as unknown as TodoistApiService,
      batchService: batchService as unknown as BatchOperationsService,
      cacheService: new CacheService(),
    });
  });

  // T002: Contract tests for list_completed with by_completion_date
  describe('by_completion_date query type', () => {
    test('1. Valid request with required params only', async () => {
      const params = {
        action: 'list_completed' as const,
        completed_query_type: 'by_completion_date' as const,
        since: '2025-09-01T00:00:00Z',
        until: '2025-10-01T23:59:59Z',
      };

      const result = await todoistTasksTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.items).toBeInstanceOf(Array);
      expect(result.data.next_cursor).toBeDefined();
      expect(apiService.getCompletedTasksByCompletionDate).toHaveBeenCalledWith(
        expect.objectContaining({
          since: '2025-09-01T00:00:00Z',
          until: '2025-10-01T23:59:59Z',
        })
      );
    });

    test('2. Valid request with project filter', async () => {
      const params = {
        action: 'list_completed' as const,
        completed_query_type: 'by_completion_date' as const,
        since: '2025-09-01T00:00:00Z',
        until: '2025-10-01T23:59:59Z',
        project_id: '2345678901',
      };

      const result = await todoistTasksTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data.items).toBeInstanceOf(Array);
      // All items should have matching project_id
      result.data.items.forEach((task: TodoistTask) => {
        expect(task.project_id).toBe('2345678901');
      });
      expect(apiService.getCompletedTasksByCompletionDate).toHaveBeenCalledWith(
        expect.objectContaining({
          project_id: '2345678901',
        })
      );
    });

    test('3. Valid request with filter query', async () => {
      const params = {
        action: 'list_completed' as const,
        completed_query_type: 'by_completion_date' as const,
        since: '2025-09-01T00:00:00Z',
        until: '2025-10-01T23:59:59Z',
        filter_query: '@Work',
      };

      const result = await todoistTasksTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data.items).toBeInstanceOf(Array);
      // All items should have "Work" label
      result.data.items.forEach((task: TodoistTask) => {
        expect(task.labels).toContain('Work');
      });
      expect(apiService.getCompletedTasksByCompletionDate).toHaveBeenCalledWith(
        expect.objectContaining({
          filter_query: '@Work',
        })
      );
    });

    test('4. Time window exactly 3 months (boundary test)', async () => {
      const params = {
        action: 'list_completed' as const,
        completed_query_type: 'by_completion_date' as const,
        since: '2025-07-01T00:00:00Z',
        until: '2025-10-01T00:00:00Z', // Exactly 92 days
      };

      const result = await todoistTasksTool.execute(params);

      // Should succeed at boundary
      expect(result.success).toBe(true);
      expect(apiService.getCompletedTasksByCompletionDate).toHaveBeenCalled();
    });

    test('5. Time window exceeds 3 months (should error)', async () => {
      const params = {
        action: 'list_completed' as const,
        completed_query_type: 'by_completion_date' as const,
        since: '2025-06-01T00:00:00Z',
        until: '2025-10-01T00:00:00Z', // More than 92 days
      };

      const result = await todoistTasksTool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.message).toContain('92 days');
      expect(result.error?.message).toContain('completion date');
    });

    test('6. Invalid datetime format (should error)', async () => {
      const params = {
        action: 'list_completed' as const,
        completed_query_type: 'by_completion_date' as const,
        since: '2025-09-01', // Missing time component
        until: '2025-10-01',
      };

      const result = await todoistTasksTool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.message).toContain('ISO 8601');
    });

    test('7. Missing required parameter since (should error)', async () => {
      const params = {
        action: 'list_completed' as const,
        completed_query_type: 'by_completion_date' as const,
        until: '2025-10-01T00:00:00Z',
        // Missing 'since'
      };

      const result = await todoistTasksTool.execute(params as any);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.message).toContain('since');
    });

    test('8. Until before since (should error)', async () => {
      const params = {
        action: 'list_completed' as const,
        completed_query_type: 'by_completion_date' as const,
        since: '2025-10-01T00:00:00Z',
        until: '2025-09-01T00:00:00Z', // Before since
      };

      const result = await todoistTasksTool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.message).toContain('after since');
    });

    test('9. Pagination with cursor', async () => {
      // Mock returns cursor for next page
      apiService.getCompletedTasksByCompletionDate = jest.fn(async () => ({
        items: [mockCompletedTask1],
        next_cursor: 'eyJwYWdlIjoyLCJsYXN0X2lkIjoiODc2NTQzMjEwOSJ9',
      }));

      const params = {
        action: 'list_completed' as const,
        completed_query_type: 'by_completion_date' as const,
        since: '2025-09-01T00:00:00Z',
        until: '2025-10-01T23:59:59Z',
        cursor: 'eyJwYWdlIjoxfQ==',
      };

      const result = await todoistTasksTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data.next_cursor).toBeDefined();
      expect(apiService.getCompletedTasksByCompletionDate).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: 'eyJwYWdlIjoxfQ==',
        })
      );
    });

    test('10. Custom limit parameter', async () => {
      const params = {
        action: 'list_completed' as const,
        completed_query_type: 'by_completion_date' as const,
        since: '2025-09-01T00:00:00Z',
        until: '2025-10-01T23:59:59Z',
        limit: 10,
      };

      const result = await todoistTasksTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data.items.length).toBeLessThanOrEqual(10);
      expect(apiService.getCompletedTasksByCompletionDate).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
        })
      );
    });
  });

  // T003: Contract tests for list_completed with by_due_date
  describe('by_due_date query type', () => {
    test('1. Valid request with required params only', async () => {
      const params = {
        action: 'list_completed' as const,
        completed_query_type: 'by_due_date' as const,
        since: '2025-09-15T00:00:00Z',
        until: '2025-10-01T23:59:59Z',
      };

      const result = await todoistTasksTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.items).toBeInstanceOf(Array);
      expect(apiService.getCompletedTasksByDueDate).toHaveBeenCalledWith(
        expect.objectContaining({
          since: '2025-09-15T00:00:00Z',
          until: '2025-10-01T23:59:59Z',
        })
      );
    });

    test('2. Time window exactly 6 weeks (boundary test)', async () => {
      const params = {
        action: 'list_completed' as const,
        completed_query_type: 'by_due_date' as const,
        since: '2025-08-20T00:00:00Z',
        until: '2025-10-01T00:00:00Z', // Exactly 42 days
      };

      const result = await todoistTasksTool.execute(params);

      // Should succeed at boundary
      expect(result.success).toBe(true);
      expect(apiService.getCompletedTasksByDueDate).toHaveBeenCalled();
    });

    test('3. Time window exceeds 6 weeks (should error)', async () => {
      const params = {
        action: 'list_completed' as const,
        completed_query_type: 'by_due_date' as const,
        since: '2025-08-01T00:00:00Z',
        until: '2025-10-01T00:00:00Z', // More than 42 days
      };

      const result = await todoistTasksTool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.message).toContain('42 days');
      expect(result.error?.message).toContain('due date');
    });

    test('4. Tasks with no due date excluded', async () => {
      // Mock returns tasks, all should have due dates
      const params = {
        action: 'list_completed' as const,
        completed_query_type: 'by_due_date' as const,
        since: '2025-09-15T00:00:00Z',
        until: '2025-10-01T23:59:59Z',
      };

      const result = await todoistTasksTool.execute(params);

      expect(result.success).toBe(true);
      // Verify no tasks with null due date
      result.data.items.forEach((task: TodoistTask) => {
        expect(task.due).not.toBeNull();
        expect(task.due).toBeDefined();
      });
    });

    test('5. Recurring task due dates handled', async () => {
      const recurringTask: TodoistTask = {
        ...mockCompletedTask1,
        id: '8765432111',
        content: 'Weekly status report',
        due: {
          date: '2025-09-20',
          string: 'every Friday',
          is_recurring: true,
        },
      };

      apiService.getCompletedTasksByDueDate = jest.fn(async () => ({
        items: [recurringTask],
        next_cursor: null,
      }));

      const params = {
        action: 'list_completed' as const,
        completed_query_type: 'by_due_date' as const,
        since: '2025-09-15T00:00:00Z',
        until: '2025-10-01T23:59:59Z',
      };

      const result = await todoistTasksTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data.items[0].due?.is_recurring).toBe(true);
      expect(result.data.items[0].due?.date).toBeDefined();
    });
  });
});
