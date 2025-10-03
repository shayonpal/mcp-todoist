import { describe, test, beforeEach, expect } from '@jest/globals';
import { TodoistRemindersTool } from '../../src/tools/todoist-reminders.js';
import { TodoistTasksTool } from '../../src/tools/todoist-tasks.js';
import { CacheService } from '../../src/services/cache.js';
import { BatchOperationsService } from '../../src/services/batch.js';
import { createInMemoryApiService } from '../helpers/inMemoryTodoistApiService.js';

const mockApiConfig = {
  token: 'test_token_123456',
  base_url: 'https://api.todoist.com/rest/v1',
  timeout: 10000,
  retry_attempts: 3,
};

describe('Reminder workflow integration', () => {
  let remindersTool: TodoistRemindersTool;
  let tasksTool: TodoistTasksTool;
  let apiService: any;

  beforeEach(() => {
    apiService = createInMemoryApiService();
    const cache = new CacheService();
    const batchService = new BatchOperationsService(apiService);

    remindersTool = new TodoistRemindersTool(mockApiConfig, {
      apiService,
    });
    tasksTool = new TodoistTasksTool(mockApiConfig, {
      apiService,
      cacheService: cache,
      batchService,
    });
  });

  test('creates, updates, and deletes reminders for a task', async () => {
    const task = await tasksTool.execute({
      action: 'create',
      content: 'Task with reminder',
      project_id: '220474322',
    });
    const taskId = (task.data as any).id;

    const createResult = await remindersTool.execute({
      action: 'create',
      type: 'absolute',
      item_id: taskId,
      due: {
        string: 'tomorrow at 10:00',
        is_recurring: false,
        lang: 'en',
      },
    });

    expect(createResult.success).toBe(true);
    const reminderId = (createResult.data as any).id;

    const updateResult = await remindersTool.execute({
      action: 'update',
      reminder_id: reminderId,
      minute_offset: 30,
    });
    expect(updateResult.success).toBe(true);

    const listResult = await remindersTool.execute({
      action: 'list',
      item_id: taskId,
    });
    expect(listResult.success).toBe(true);
    expect(Array.isArray(listResult.data)).toBe(true);

    const deleteResult = await remindersTool.execute({
      action: 'delete',
      reminder_id: reminderId,
    });
    expect(deleteResult.success).toBe(true);
  });
});
