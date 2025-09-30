import { describe, test, expect, beforeEach } from '@jest/globals';
import { TodoistRemindersTool } from '../../src/tools/todoist-reminders.js';
import { TodoistApiService } from '../../src/services/todoist-api.js';
import {
  RemindersApiMock,
  createRemindersApiMock,
} from '../helpers/mockTodoistApiService.js';
import { TodoistReminder } from '../../src/types/todoist.js';

const mockApiConfig = {
  token: 'test_token',
  base_url: 'https://api.todoist.com/rest/v1',
  timeout: 10000,
  retry_attempts: 3,
};

describe('todoist_reminders MCP Tool Contract', () => {
  let apiService: RemindersApiMock;
  let todoistRemindersTool: TodoistRemindersTool;

  beforeEach(() => {
    const reminder: TodoistReminder = {
      id: 'rem-1',
      item_id: '2995104339',
      notify_uid: 'user-1',
      type: 'absolute',
      due: {
        string: 'tomorrow at 10:00',
        is_recurring: false,
        lang: 'en',
      },
      is_deleted: false,
    };

    apiService = createRemindersApiMock();
    apiService.getReminders.mockResolvedValue([reminder]);
    apiService.createReminder.mockResolvedValue(reminder);
    apiService.updateReminder.mockResolvedValue({
      ...reminder,
      due: {
        string: 'next week at 5pm',
        is_recurring: false,
        lang: 'en',
      },
    });

    todoistRemindersTool = new TodoistRemindersTool(mockApiConfig, {
      apiService: apiService as unknown as TodoistApiService,
    });
  });

  describe('Tool definition', () => {
    test('exposes metadata', () => {
      const definition = TodoistRemindersTool.getToolDefinition();
      expect(definition.name).toBe('todoist_reminders');
      expect(definition.description).toContain('reminders');
    });
  });

  describe('Validation', () => {
    test('rejects missing action', async () => {
      const result = await todoistRemindersTool.execute({} as any);
      expect(result.success).toBe(false);
    });

    test('rejects invalid action', async () => {
      const result = await todoistRemindersTool.execute({ action: 'noop' });
      expect(result.success).toBe(false);
    });
  });

  describe('CREATE action', () => {
    test('creates absolute reminder', async () => {
      const result = await todoistRemindersTool.execute({
        action: 'create',
        type: 'absolute',
        item_id: '2995104339',
        due: {
          string: 'tomorrow at 10:00',
          is_recurring: false,
          lang: 'en',
        },
      });

      expect(result.success).toBe(true);
      expect(apiService.createReminder).toHaveBeenCalledWith(
        expect.objectContaining({
          item_id: '2995104339',
          due: expect.objectContaining({ string: 'tomorrow at 10:00' }),
        })
      );
    });
  });

  describe('GET action', () => {
    test('retrieves reminder by id', async () => {
      const result = await todoistRemindersTool.execute({
        action: 'get',
        reminder_id: 'rem-1',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(apiService.getReminders).toHaveBeenCalled();
    });
  });

  describe('UPDATE action', () => {
    test('updates reminder properties', async () => {
      const result = await todoistRemindersTool.execute({
        action: 'update',
        reminder_id: 'rem-1',
        minute_offset: 30,
      });

      expect(result.success).toBe(true);
      expect(apiService.updateReminder).toHaveBeenCalledWith(
        'rem-1',
        expect.objectContaining({ minute_offset: 30 })
      );
    });
  });

  describe('DELETE action', () => {
    test('deletes reminder', async () => {
      const result = await todoistRemindersTool.execute({
        action: 'delete',
        reminder_id: 'rem-1',
      });

      expect(result.success).toBe(true);
      expect(apiService.deleteReminder).toHaveBeenCalledWith('rem-1');
    });
  });

  describe('LIST action', () => {
    test('lists reminders for a task', async () => {
      const result = await todoistRemindersTool.execute({
        action: 'list',
        item_id: '2995104339',
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(apiService.getReminders).toHaveBeenCalledWith('2995104339');
    });
  });
});
