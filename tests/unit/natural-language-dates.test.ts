import { describe, test, expect, beforeEach } from '@jest/globals';
import { TodoistRemindersTool } from '../../src/tools/todoist-reminders.js';
import {
  RemindersApiMock,
  createRemindersApiMock,
} from '../helpers/mockTodoistApiService.js';
import { TodoistApiService } from '../../src/services/todoist-api.js';
import { TodoistReminder } from '../../src/types/todoist.js';

const mockApiConfig = {
  token: 'test_token_123456',
  base_url: 'https://api.todoist.com/rest/v1',
  timeout: 10000,
  retry_attempts: 3,
};

describe('TodoistRemindersTool natural language support', () => {
  let apiService: RemindersApiMock;
  let remindersTool: TodoistRemindersTool;

  beforeEach(() => {
    apiService = createRemindersApiMock();

    apiService.createReminder.mockImplementation(
      async (args: Parameters<TodoistApiService['createReminder']>[0]) => ({
        id: 'rem-1',
        item_id: args.item_id ?? 'task-1',
        notify_uid: args.notify_uid ?? 'user-1',
        type: (args.type as TodoistReminder['type']) ?? 'absolute',
        due: args.due,
        minute_offset: args.minute_offset,
        name: args.name,
        loc_lat: args.loc_lat,
        loc_long: args.loc_long,
        loc_trigger: args.loc_trigger,
        radius: args.radius,
        is_deleted: false,
      })
    );

    remindersTool = new TodoistRemindersTool(mockApiConfig, {
      apiService: apiService as unknown as TodoistApiService,
    });
  });

  test('creates absolute reminder from natural language string', async () => {
    const result = await remindersTool.execute({
      action: 'create',
      type: 'absolute',
      item_id: 'task-1',
      due: {
        string: 'tomorrow at 10:00',
      },
    });

    expect(result.success).toBe(true);
    const reminder = result.data as TodoistReminder;
    expect(reminder.due?.string).toBe('tomorrow at 10:00');
    expect(apiService.createReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        item_id: 'task-1',
        due: expect.objectContaining({ string: 'tomorrow at 10:00' }),
      })
    );
  });

  test('supports recurring natural language patterns', async () => {
    const result = await remindersTool.execute({
      action: 'create',
      type: 'absolute',
      item_id: 'task-2',
      due: {
        string: 'every day at 9am',
        is_recurring: true,
      },
    });

    expect(result.success).toBe(true);
    const reminder = result.data as TodoistReminder;
    expect(reminder.due?.is_recurring).toBe(true);
    expect(reminder.due?.string).toBe('every day at 9am');
  });

  test('passes through language and timezone hints', async () => {
    const result = await remindersTool.execute({
      action: 'create',
      type: 'absolute',
      item_id: 'task-3',
      due: {
        string: 'mañana a las 10',
        lang: 'es',
        timezone: 'Europe/Madrid',
      },
    });

    expect(result.success).toBe(true);
    const reminder = result.data as TodoistReminder;
    expect(reminder.due?.lang).toBe('es');
    expect(reminder.due?.timezone).toBe('Europe/Madrid');
  });

  test('creates relative reminders with minute offsets', async () => {
    const result = await remindersTool.execute({
      action: 'create',
      type: 'relative',
      item_id: 'task-4',
      minute_offset: 30,
    });

    expect(result.success).toBe(true);
    expect(apiService.createReminder).toHaveBeenCalledWith(
      expect.objectContaining({ minute_offset: 30 })
    );
  });
});
