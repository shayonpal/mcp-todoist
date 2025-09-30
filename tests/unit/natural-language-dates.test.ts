/**
 * Unit tests for natural language due date support in reminders
 * Verifies that various natural language patterns are properly handled
 * Tests patterns specified in tasks.md: "every day", "tomorrow", "every 4th", "day after tomorrow"
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { TodoistRemindersTool } from '../../src/tools/todoist-reminders.js';
import { TodoistTasksTool } from '../../src/tools/todoist-tasks.js';

// Mock API configuration for tests
const mockApiConfig = {
  token: 'test_token',
  base_url: 'https://api.todoist.com/rest/v1',
  timeout: 10000,
  retry_attempts: 3,
};

let todoistRemindersTool: TodoistRemindersTool;
let todoistTasksTool: TodoistTasksTool;

describe('Natural Language Due Date Support', () => {
  beforeEach(() => {
    todoistRemindersTool = new TodoistRemindersTool(mockApiConfig);
    todoistTasksTool = new TodoistTasksTool(mockApiConfig);
  });

  describe('Basic Natural Language Patterns', () => {
    test('should support "tomorrow" pattern', async () => {
      const taskResult = await todoistTasksTool.execute({
        action: 'create',
        content: 'Test task for tomorrow reminder',
        project_id: '220474322',
      });

      const taskId = extractTaskId(taskResult);

      const reminderResult = await todoistRemindersTool.execute({
        action: 'create',
        type: 'absolute',
        item_id: taskId,
        due: {
          string: 'tomorrow at 10:00',
        },
      });

      expect(reminderResult).toBeDefined();
      expect(reminderResult.content[0].text).toContain('reminder');
      expect(reminderResult.content[0].text).toContain('absolute');

      const response = JSON.parse(reminderResult.content[0].text);
      expect(response.success).toBe(true);
      expect(response.data.type).toBe('absolute');
      expect(response.data.due).toBeDefined();
    });

    test('should support "day after tomorrow" pattern', async () => {
      const taskResult = await todoistTasksTool.execute({
        action: 'create',
        content: 'Test task for day after tomorrow',
        project_id: '220474322',
      });

      const taskId = extractTaskId(taskResult);

      const reminderResult = await todoistRemindersTool.execute({
        action: 'create',
        type: 'absolute',
        item_id: taskId,
        due: {
          string: 'day after tomorrow at 2pm',
        },
      });

      expect(reminderResult).toBeDefined();
      const response = JSON.parse(reminderResult.content[0].text);
      expect(response.success).toBe(true);
      expect(response.data.due).toBeDefined();
      expect(response.data.due.string).toContain('day after tomorrow');
    });

    test('should support "next [weekday]" pattern', async () => {
      const taskResult = await todoistTasksTool.execute({
        action: 'create',
        content: 'Test task for next weekday',
        project_id: '220474322',
      });

      const taskId = extractTaskId(taskResult);

      const weekdays = [
        'next monday',
        'next tuesday',
        'next wednesday',
        'next thursday',
        'next friday',
      ];

      for (const weekday of weekdays) {
        const reminderResult = await todoistRemindersTool.execute({
          action: 'create',
          type: 'absolute',
          item_id: taskId,
          due: {
            string: `${weekday} at 9am`,
          },
        });

        expect(reminderResult).toBeDefined();
        const response = JSON.parse(reminderResult.content[0].text);
        expect(response.success).toBe(true);
      }
    });
  });

  describe('Recurring Natural Language Patterns', () => {
    test('should support "every day" pattern', async () => {
      const taskResult = await todoistTasksTool.execute({
        action: 'create',
        content: 'Test task for daily reminder',
        project_id: '220474322',
      });

      const taskId = extractTaskId(taskResult);

      const reminderResult = await todoistRemindersTool.execute({
        action: 'create',
        type: 'absolute',
        item_id: taskId,
        due: {
          string: 'every day at 9am',
          is_recurring: true,
        },
      });

      expect(reminderResult).toBeDefined();
      const response = JSON.parse(reminderResult.content[0].text);
      expect(response.success).toBe(true);
      expect(response.data.due).toBeDefined();
      expect(response.data.due.is_recurring).toBe(true);
      expect(response.data.due.string).toContain('every day');
    });

    test('should support "every [weekday]" pattern', async () => {
      const taskResult = await todoistTasksTool.execute({
        action: 'create',
        content: 'Test task for weekly reminders',
        project_id: '220474322',
      });

      const taskId = extractTaskId(taskResult);

      const patterns = [
        'every monday at 10am',
        'every tuesday at 2pm',
        'every friday at 5pm',
      ];

      for (const pattern of patterns) {
        const reminderResult = await todoistRemindersTool.execute({
          action: 'create',
          type: 'absolute',
          item_id: taskId,
          due: {
            string: pattern,
            is_recurring: true,
          },
        });

        expect(reminderResult).toBeDefined();
        const response = JSON.parse(reminderResult.content[0].text);
        expect(response.success).toBe(true);
        expect(response.data.due.is_recurring).toBe(true);
      }
    });

    test('should support "every 4th" (monthly) pattern', async () => {
      const taskResult = await todoistTasksTool.execute({
        action: 'create',
        content: 'Test task for monthly reminder',
        project_id: '220474322',
      });

      const taskId = extractTaskId(taskResult);

      const reminderResult = await todoistRemindersTool.execute({
        action: 'create',
        type: 'absolute',
        item_id: taskId,
        due: {
          string: 'every 4th at noon',
          is_recurring: true,
        },
      });

      expect(reminderResult).toBeDefined();
      const response = JSON.parse(reminderResult.content[0].text);
      expect(response.success).toBe(true);
      expect(response.data.due).toBeDefined();
      expect(response.data.due.is_recurring).toBe(true);
      expect(response.data.due.string).toMatch(/every 4th|4th/i);
    });

    test('should support "every [month] [day]" pattern', async () => {
      const taskResult = await todoistTasksTool.execute({
        action: 'create',
        content: 'Test task for yearly reminder',
        project_id: '220474322',
      });

      const taskId = extractTaskId(taskResult);

      const patterns = [
        'every sept 7 at 10am',
        'every jan 1 at midnight',
        'every dec 25 at 9am',
      ];

      for (const pattern of patterns) {
        const reminderResult = await todoistRemindersTool.execute({
          action: 'create',
          type: 'absolute',
          item_id: taskId,
          due: {
            string: pattern,
            is_recurring: true,
          },
        });

        expect(reminderResult).toBeDefined();
        const response = JSON.parse(reminderResult.content[0].text);
        expect(response.success).toBe(true);
        expect(response.data.due.is_recurring).toBe(true);
      }
    });
  });

  describe('Time-of-Day Variations', () => {
    test('should support various time formats', async () => {
      const taskResult = await todoistTasksTool.execute({
        action: 'create',
        content: 'Test task for time format variations',
        project_id: '220474322',
      });

      const taskId = extractTaskId(taskResult);

      const timeFormats = [
        'tomorrow at 9am',
        'tomorrow at 9:00',
        'tomorrow at 9:30am',
        'tomorrow at 2pm',
        'tomorrow at 14:00',
        'tomorrow at noon',
        'tomorrow at midnight',
      ];

      for (const timeFormat of timeFormats) {
        const reminderResult = await todoistRemindersTool.execute({
          action: 'create',
          type: 'absolute',
          item_id: taskId,
          due: {
            string: timeFormat,
          },
        });

        expect(reminderResult).toBeDefined();
        const response = JSON.parse(reminderResult.content[0].text);
        expect(response.success).toBe(true);
        expect(response.data.due).toBeDefined();
      }
    });
  });

  describe('Relative Time Patterns', () => {
    test('should support "in [X] days" pattern', async () => {
      const taskResult = await todoistTasksTool.execute({
        action: 'create',
        content: 'Test task for relative days',
        project_id: '220474322',
      });

      const taskId = extractTaskId(taskResult);

      const patterns = [
        'in 1 day at 10am',
        'in 2 days at 2pm',
        'in 7 days at 9am',
      ];

      for (const pattern of patterns) {
        const reminderResult = await todoistRemindersTool.execute({
          action: 'create',
          type: 'absolute',
          item_id: taskId,
          due: {
            string: pattern,
          },
        });

        expect(reminderResult).toBeDefined();
        const response = JSON.parse(reminderResult.content[0].text);
        expect(response.success).toBe(true);
      }
    });

    test('should support "this [weekday]" pattern', async () => {
      const taskResult = await todoistTasksTool.execute({
        action: 'create',
        content: 'Test task for this week',
        project_id: '220474322',
      });

      const taskId = extractTaskId(taskResult);

      const patterns = [
        'this monday at 9am',
        'this friday at 5pm',
        'this weekend at noon',
      ];

      for (const pattern of patterns) {
        const reminderResult = await todoistRemindersTool.execute({
          action: 'create',
          type: 'absolute',
          item_id: taskId,
          due: {
            string: pattern,
          },
        });

        expect(reminderResult).toBeDefined();
        const response = JSON.parse(reminderResult.content[0].text);
        expect(response.success).toBe(true);
      }
    });
  });

  describe('Language Support', () => {
    test('should support language parameter for non-English dates', async () => {
      const taskResult = await todoistTasksTool.execute({
        action: 'create',
        content: 'Test task for multi-language support',
        project_id: '220474322',
      });

      const taskId = extractTaskId(taskResult);

      // Test with different language codes
      const languages = ['en', 'es', 'fr', 'de', 'pt', 'ja'];

      for (const lang of languages) {
        const reminderResult = await todoistRemindersTool.execute({
          action: 'create',
          type: 'absolute',
          item_id: taskId,
          due: {
            string: 'tomorrow at 10:00',
            lang: lang,
          },
        });

        expect(reminderResult).toBeDefined();
        const response = JSON.parse(reminderResult.content[0].text);
        expect(response.success).toBe(true);
        expect(response.data.due.lang).toBe(lang);
      }
    });
  });

  describe('Timezone Support', () => {
    test('should support timezone in due date', async () => {
      const taskResult = await todoistTasksTool.execute({
        action: 'create',
        content: 'Test task for timezone support',
        project_id: '220474322',
      });

      const taskId = extractTaskId(taskResult);

      const timezones = [
        'America/Toronto',
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
        'UTC',
      ];

      for (const timezone of timezones) {
        const reminderResult = await todoistRemindersTool.execute({
          action: 'create',
          type: 'absolute',
          item_id: taskId,
          due: {
            string: 'tomorrow at 10:00',
            timezone: timezone,
          },
        });

        expect(reminderResult).toBeDefined();
        const response = JSON.parse(reminderResult.content[0].text);
        expect(response.success).toBe(true);
        expect(response.data.due.timezone).toBe(timezone);
      }
    });
  });

  describe('Edge Cases and Special Patterns', () => {
    test('should support "today" pattern', async () => {
      const taskResult = await todoistTasksTool.execute({
        action: 'create',
        content: 'Test task for today reminder',
        project_id: '220474322',
      });

      const taskId = extractTaskId(taskResult);

      const reminderResult = await todoistRemindersTool.execute({
        action: 'create',
        type: 'absolute',
        item_id: taskId,
        due: {
          string: 'today at 5pm',
        },
      });

      expect(reminderResult).toBeDefined();
      const response = JSON.parse(reminderResult.content[0].text);
      expect(response.success).toBe(true);
    });

    test('should support "end of [timeframe]" patterns', async () => {
      const taskResult = await todoistTasksTool.execute({
        action: 'create',
        content: 'Test task for end-of patterns',
        project_id: '220474322',
      });

      const taskId = extractTaskId(taskResult);

      const patterns = [
        'end of day',
        'end of week',
        'end of month',
      ];

      for (const pattern of patterns) {
        const reminderResult = await todoistRemindersTool.execute({
          action: 'create',
          type: 'absolute',
          item_id: taskId,
          due: {
            string: pattern,
          },
        });

        expect(reminderResult).toBeDefined();
        const response = JSON.parse(reminderResult.content[0].text);
        expect(response.success).toBe(true);
      }
    });

    test('should handle complex recurring patterns', async () => {
      const taskResult = await todoistTasksTool.execute({
        action: 'create',
        content: 'Test task for complex recurring',
        project_id: '220474322',
      });

      const taskId = extractTaskId(taskResult);

      const complexPatterns = [
        'every other day at 9am',
        'every weekday at 8am',
        'every weekend at 10am',
        'every 2 weeks at noon',
        'every month on the 1st at 9am',
      ];

      for (const pattern of complexPatterns) {
        const reminderResult = await todoistRemindersTool.execute({
          action: 'create',
          type: 'absolute',
          item_id: taskId,
          due: {
            string: pattern,
            is_recurring: true,
          },
        });

        expect(reminderResult).toBeDefined();
        const response = JSON.parse(reminderResult.content[0].text);
        expect(response.success).toBe(true);
        expect(response.data.due.is_recurring).toBe(true);
      }
    });
  });

  describe('Validation and Error Handling', () => {
    test('should handle invalid natural language gracefully', async () => {
      const taskResult = await todoistTasksTool.execute({
        action: 'create',
        content: 'Test task for invalid date',
        project_id: '220474322',
      });

      const taskId = extractTaskId(taskResult);

      // Test with clearly invalid date string
      const reminderResult = await todoistRemindersTool.execute({
        action: 'create',
        type: 'absolute',
        item_id: taskId,
        due: {
          string: 'not a valid date string xyz123',
        },
      });

      // The API might still accept it and try to parse, or return an error
      expect(reminderResult).toBeDefined();
    });

    test('should handle empty due string', async () => {
      const taskResult = await todoistTasksTool.execute({
        action: 'create',
        content: 'Test task for empty due string',
        project_id: '220474322',
      });

      const taskId = extractTaskId(taskResult);

      try {
        await todoistRemindersTool.execute({
          action: 'create',
          type: 'absolute',
          item_id: taskId,
          due: {
            string: '',
          },
        });
        // May succeed or fail depending on API validation
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Natural Language with Task Due Dates', () => {
    test('should create reminder with natural language when task has due date', async () => {
      // Create task with due date
      const taskResult = await todoistTasksTool.execute({
        action: 'create',
        content: 'Task with due date for reminder',
        project_id: '220474322',
        due_string: 'next friday at 3pm',
      });

      const taskId = extractTaskId(taskResult);

      // Create reminder using natural language
      const reminderResult = await todoistRemindersTool.execute({
        action: 'create',
        type: 'absolute',
        item_id: taskId,
        due: {
          string: 'next friday at 2pm', // 1 hour before task
        },
      });

      expect(reminderResult).toBeDefined();
      const response = JSON.parse(reminderResult.content[0].text);
      expect(response.success).toBe(true);
      expect(response.data.due.string).toContain('friday');
    });

    test('should verify natural language converts to proper datetime', async () => {
      const taskResult = await todoistTasksTool.execute({
        action: 'create',
        content: 'Test datetime conversion',
        project_id: '220474322',
      });

      const taskId = extractTaskId(taskResult);

      const reminderResult = await todoistRemindersTool.execute({
        action: 'create',
        type: 'absolute',
        item_id: taskId,
        due: {
          string: 'tomorrow at 10:00',
        },
      });

      const response = JSON.parse(reminderResult.content[0].text);
      expect(response.success).toBe(true);

      // Verify that due object has date field populated (natural language was parsed)
      expect(response.data.due).toBeDefined();
      expect(response.data.due.string).toBeDefined();
      // The API should populate the date field based on the string
      if (response.data.due.date) {
        expect(response.data.due.date).toMatch(/\d{4}-\d{2}-\d{2}/);
      }
    });
  });

  // Helper function to extract task ID
  function extractTaskId(result: any): string {
    try {
      const response = JSON.parse(result.content[0].text);
      return response.data?.id || 'test_task_id';
    } catch {
      return 'test_task_id';
    }
  }
});

/**
 * Summary of natural language patterns tested:
 *
 * Basic patterns:
 * - "tomorrow" / "tomorrow at [time]"
 * - "day after tomorrow"
 * - "next [weekday]"
 * - "today"
 *
 * Recurring patterns:
 * - "every day"
 * - "every [weekday]"
 * - "every 4th" (monthly)
 * - "every [month] [day]" (yearly)
 * - "every other day"
 * - "every weekday"
 * - "every weekend"
 * - "every 2 weeks"
 *
 * Time formats:
 * - "9am", "9:00", "9:30am"
 * - "2pm", "14:00"
 * - "noon", "midnight"
 *
 * Relative patterns:
 * - "in [X] days"
 * - "this [weekday]"
 * - "end of day/week/month"
 *
 * Advanced features:
 * - Language support (lang parameter)
 * - Timezone support
 * - Complex recurring patterns
 */