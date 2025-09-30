import { describe, test, beforeEach, expect } from '@jest/globals';
import { TodoistTasksTool } from '../../src/tools/todoist-tasks.js';
import { CacheService } from '../../src/services/cache.js';
import { BatchOperationsService } from '../../src/services/batch.js';
import { createInMemoryApiService } from '../helpers/inMemoryTodoistApiService.js';

const mockApiConfig = {
  token: 'test_token',
  base_url: 'https://api.todoist.com/rest/v1',
  timeout: 10000,
  retry_attempts: 3,
};

describe('Batch operations integration', () => {
  let tasksTool: TodoistTasksTool;
  let apiService: any;
  let batchService: BatchOperationsService;

  beforeEach(() => {
    apiService = createInMemoryApiService();
    batchService = new BatchOperationsService(apiService);

    tasksTool = new TodoistTasksTool(mockApiConfig, {
      apiService,
      batchService,
      cacheService: new CacheService(),
    });
  });

  test('executes batch task creation', async () => {
    const batchResult = await tasksTool.execute({
      action: 'batch',
      batch_commands: [
        {
          type: 'item_add',
          temp_id: 'temp_task_1',
          args: {
            content: 'Batch Task 1',
            project_id: '220474322',
          },
        },
        {
          type: 'item_add',
          temp_id: 'temp_task_2',
          args: {
            content: 'Batch Task 2',
            project_id: '220474322',
          },
        },
      ],
    });

    expect(batchResult.success).toBe(true);
    expect(batchResult.metadata?.completed_commands).toBe(2);

    const listResult = await tasksTool.execute({
      action: 'list',
      project_id: '220474322',
    });

    const tasks = listResult.data as any[];
    expect(tasks.some(task => task.content === 'Batch Task 1')).toBe(true);
    expect(tasks.some(task => task.content === 'Batch Task 2')).toBe(true);
  });
});
