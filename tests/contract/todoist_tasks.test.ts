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

type BatchServiceMock = jest.Mocked<
  Pick<BatchOperationsService, 'executeBatch'>
>;

const mockApiConfig = {
  token: 'test_token',
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
});
