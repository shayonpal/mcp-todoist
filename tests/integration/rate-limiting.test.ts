import { describe, test, beforeEach, expect } from '@jest/globals';
import { TodoistTasksTool } from '../../src/tools/todoist-tasks.js';
import { CacheService } from '../../src/services/cache.js';
import { BatchOperationsService } from '../../src/services/batch.js';
import { TodoistApiService } from '../../src/services/todoist-api.js';
import {
  createTasksApiMock,
  TasksApiMock,
} from '../helpers/mockTodoistApiService.js';

const mockApiConfig = {
  token: 'test_token',
  base_url: 'https://api.todoist.com/rest/v1',
  timeout: 10000,
  retry_attempts: 3,
};

describe('Rate limiting integration', () => {
  let apiService: TasksApiMock;
  let tasksTool: TodoistTasksTool;

  beforeEach(() => {
    const rateLimitStatus = {
      rest: {
        remaining: 5,
        resetTime: new Date(Date.now() + 1_000),
        isLimited: false,
      },
      sync: {
        remaining: 10,
        resetTime: new Date(Date.now() + 1_000),
        isLimited: false,
      },
    };

    apiService = createTasksApiMock();
    apiService.getRateLimitStatus.mockReturnValue(rateLimitStatus);

    tasksTool = new TodoistTasksTool(mockApiConfig, {
      apiService: apiService as unknown as TodoistApiService,
      batchService: new BatchOperationsService(
        apiService as unknown as TodoistApiService
      ),
      cacheService: new CacheService(),
    });
  });

  test('includes rate limit metadata in responses', async () => {
    const result = await tasksTool.execute({
      action: 'list',
      project_id: '220474322',
    });

    expect(result.success).toBe(true);
    expect(result.metadata?.rate_limit_remaining).toBe(5);
    expect(apiService.getRateLimitStatus).toHaveBeenCalled();
  });
});
