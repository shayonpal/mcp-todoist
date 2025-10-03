import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { TodoistTasksTool } from '../../src/tools/todoist-tasks.js';
import { CacheService } from '../../src/services/cache.js';
import { TodoistApiService } from '../../src/services/todoist-api.js';
import {
  BatchOperationsService,
  BatchOperationRequest,
} from '../../src/services/batch.js';
import { BatchOperationResult } from '../../src/types/errors.js';
import {
  createTasksApiMock,
  TasksApiMock,
} from '../helpers/mockTodoistApiService.js';
import { TokenValidatorSingleton } from '../../src/services/token-validator.js';
import { resetConfig } from '../../src/config/index.js';

type BatchServiceMock = jest.Mocked<
  Pick<BatchOperationsService, 'executeBatch'>
>;

const mockApiConfig = {
  token: 'test_token_123456',
  base_url: 'https://api.todoist.com/rest/v1',
  timeout: 10000,
  retry_attempts: 3,
};

function createMockBatchService(): BatchServiceMock {
  const result: BatchOperationResult = {
    success: true,
    completed_commands: 2,
    failed_commands: 0,
    errors: [],
    temp_id_mapping: {
      temp_1: 'generated-id-1',
      temp_2: 'generated-id-2',
    },
  };

  const executeBatch = jest.fn(
    async (_request: BatchOperationRequest): Promise<BatchOperationResult> =>
      result
  );

  return {
    executeBatch,
  } as unknown as BatchServiceMock;
}

describe('todoist_tasks MCP Tool Contract', () => {
  let apiService: TasksApiMock;
  let batchService: BatchServiceMock;
  let todoistTasksTool: TodoistTasksTool;

  beforeEach(() => {
    apiService = createTasksApiMock();
    batchService = createMockBatchService();

    (TokenValidatorSingleton as any).resetForTesting();
    (TokenValidatorSingleton as any).setMockApiService({
      validateToken: jest.fn(async () => undefined),
    } as unknown as TodoistApiService);

    process.env.TODOIST_API_TOKEN = mockApiConfig.token;
    resetConfig();

    todoistTasksTool = new TodoistTasksTool(mockApiConfig, {
      apiService: apiService as unknown as TodoistApiService,
      batchService: batchService as unknown as BatchOperationsService,
      cacheService: new CacheService(),
    });
  });

  describe('Tool Registration', () => {
    test('should provide MCP tool metadata', () => {
      const definition = TodoistTasksTool.getToolDefinition();
      expect(definition.name).toBe('todoist_tasks');
      expect(definition.description).toContain('task management');
      expect(definition.inputSchema).toBeDefined();
    });
  });

  describe('Parameter Validation', () => {
    test('should reject missing action parameter', async () => {
      const result = await todoistTasksTool.execute({} as any);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBeDefined();
    });

    test('should reject invalid action value', async () => {
      const result = await todoistTasksTool.execute({ action: 'invalid' });
      expect(result.success).toBe(false);
      expect(result.error?.code).toBeDefined();
    });
  });

  describe('CREATE action', () => {
    test('creates a task with minimal parameters', async () => {
      const params = {
        action: 'create' as const,
        content: 'Test task',
        project_id: '220474322',
      };

      const result = await todoistTasksTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.message).toContain('Task created');
      expect(apiService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Test task',
          project_id: '220474322',
        })
      );
    });

    test('validates required fields', async () => {
      const result = await todoistTasksTool.execute({
        action: 'create',
      } as any);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET action', () => {
    test('retrieves a task by id', async () => {
      const result = await todoistTasksTool.execute({
        action: 'get',
        task_id: '2995104339',
      });

      expect(apiService.getTask).toHaveBeenCalledWith('2995104339');
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('UPDATE action', () => {
    test('updates task properties', async () => {
      const result = await todoistTasksTool.execute({
        action: 'update',
        task_id: '2995104339',
        content: 'Updated task content',
      });

      expect(result.success).toBe(true);
      expect(apiService.updateTask).toHaveBeenCalledWith(
        '2995104339',
        expect.objectContaining({ content: 'Updated task content' })
      );
    });
  });

  describe('DELETE action', () => {
    test('deletes a task', async () => {
      const result = await todoistTasksTool.execute({
        action: 'delete',
        task_id: '2995104339',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Task deleted');
      expect(apiService.deleteTask).toHaveBeenCalledWith('2995104339');
    });
  });

  describe('LIST action', () => {
    test('lists tasks by project', async () => {
      const result = await todoistTasksTool.execute({
        action: 'list',
        project_id: '220474322',
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(apiService.getTasks).toHaveBeenCalledWith(
        expect.objectContaining({ project_id: '220474322' })
      );
    });
  });

  describe('COMPLETE / UNCOMPLETE actions', () => {
    test('completes a task', async () => {
      const result = await todoistTasksTool.execute({
        action: 'complete',
        task_id: '2995104339',
      });

      expect(result.success).toBe(true);
      expect(apiService.completeTask).toHaveBeenCalledWith('2995104339');
    });

    test('reopens a task', async () => {
      const result = await todoistTasksTool.execute({
        action: 'uncomplete',
        task_id: '2995104339',
      });

      expect(result.success).toBe(true);
      expect(apiService.reopenTask).toHaveBeenCalledWith('2995104339');
    });
  });

  describe('BATCH action', () => {
    test('executes batch operations', async () => {
      const params = {
        action: 'batch' as const,
        batch_commands: [
          {
            type: 'item_add',
            temp_id: 'temp_1',
            args: {
              content: 'Batch task 1',
              project_id: '220474322',
            },
          },
          {
            type: 'item_add',
            temp_id: 'temp_2',
            args: {
              content: 'Batch task 2',
              project_id: '220474322',
            },
          },
        ],
      };

      const result = await todoistTasksTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.metadata?.completed_commands).toBe(2);
      expect(batchService.executeBatch).toHaveBeenCalledWith(
        expect.objectContaining({
          commands: expect.arrayContaining([
            expect.objectContaining({ type: 'item_add', temp_id: 'temp_1' }),
            expect.objectContaining({ type: 'item_add', temp_id: 'temp_2' }),
          ]),
        })
      );
    });
  });

  describe('DEADLINE support', () => {
    describe('CREATE with deadline', () => {
      test('creates task with valid deadline', async () => {
        const params = {
          action: 'create' as const,
          content: 'Submit quarterly report',
          deadline: '2025-12-31',
          project_id: '220474322',
        };

        const result = await todoistTasksTool.execute(params);

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(apiService.createTask).toHaveBeenCalledWith(
          expect.objectContaining({
            content: 'Submit quarterly report',
            deadline: '2025-12-31',
          })
        );
      });

      test('creates task with both due_date and deadline', async () => {
        const params = {
          action: 'create' as const,
          content: 'Review PR',
          due_date: '2025-10-10',
          deadline: '2025-10-15',
          project_id: '220474322',
        };

        const result = await todoistTasksTool.execute(params);

        expect(result.success).toBe(true);
        expect(apiService.createTask).toHaveBeenCalledWith(
          expect.objectContaining({
            content: 'Review PR',
            due_date: '2025-10-10',
            deadline: '2025-10-15',
          })
        );
      });
    });

    describe('UPDATE with deadline', () => {
      test('adds deadline to existing task', async () => {
        const params = {
          action: 'update' as const,
          task_id: '2995104339',
          deadline: '2025-11-30',
        };

        const result = await todoistTasksTool.execute(params);

        expect(result.success).toBe(true);
        expect(apiService.updateTask).toHaveBeenCalledWith(
          '2995104339',
          expect.objectContaining({ deadline: '2025-11-30' })
        );
      });

      test('removes deadline with null value', async () => {
        const params = {
          action: 'update' as const,
          task_id: '2995104339',
          deadline: null,
        };

        const result = await todoistTasksTool.execute(params);

        expect(result.success).toBe(true);
        expect(apiService.updateTask).toHaveBeenCalledWith(
          '2995104339',
          expect.objectContaining({ deadline: null })
        );
      });
    });

    describe('GET with deadline', () => {
      test('retrieves task with deadline field', async () => {
        const result = await todoistTasksTool.execute({
          action: 'get',
          task_id: '2995104339',
        });

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(apiService.getTask).toHaveBeenCalledWith('2995104339');
      });
    });

    describe('VALIDATION errors', () => {
      test('rejects invalid deadline format - US format', async () => {
        const params = {
          action: 'create' as const,
          content: 'Test task',
          deadline: '10/15/2025',
          project_id: '220474322',
        };

        const result = await todoistTasksTool.execute(params);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('VALIDATION_ERROR');
        expect(result.error?.message).toContain('YYYY-MM-DD');
      });

      test('rejects invalid deadline format - no separators', async () => {
        const params = {
          action: 'create' as const,
          content: 'Test task',
          deadline: '20251015',
          project_id: '220474322',
        };

        const result = await todoistTasksTool.execute(params);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('VALIDATION_ERROR');
        expect(result.error?.message).toContain('YYYY-MM-DD');
      });

      test('rejects invalid deadline format - wrong separators', async () => {
        const params = {
          action: 'create' as const,
          content: 'Test task',
          deadline: '2025/10/15',
          project_id: '220474322',
        };

        const result = await todoistTasksTool.execute(params);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('VALIDATION_ERROR');
        expect(result.error?.message).toContain('YYYY-MM-DD');
      });

      test('rejects invalid deadline format - partial date', async () => {
        const params = {
          action: 'create' as const,
          content: 'Test task',
          deadline: '2025-10',
          project_id: '220474322',
        };

        const result = await todoistTasksTool.execute(params);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('VALIDATION_ERROR');
        expect(result.error?.message).toContain('YYYY-MM-DD');
      });

      test('rejects natural language deadline', async () => {
        const params = {
          action: 'create' as const,
          content: 'Test task',
          deadline: 'tomorrow',
          project_id: '220474322',
        };

        const result = await todoistTasksTool.execute(params);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('VALIDATION_ERROR');
        expect(result.error?.message).toContain('YYYY-MM-DD');
      });
    });
  });
});
