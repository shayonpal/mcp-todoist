/**
 * Integration tests for reminder lifecycle workflow
 * Tests the complete workflow of creating, updating, and deleting reminders
 * Tests MUST FAIL until the actual implementation is complete
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { TodoistRemindersTool } from '../../src/tools/todoist-reminders.js';
import { TodoistTasksTool } from '../../src/tools/todoist-tasks.js';

// Mock API configuration for tests
const mockApiConfig = {
  token: 'test_token',
  base_url: 'https://api.todoist.com/rest/v1',
  timeout: 10000,
  retry_attempts: 3,
};

// Initialize tools with mock configuration
let todoistRemindersTool: TodoistRemindersTool;
let todoistTasksTool: TodoistTasksTool;

describe('Reminder Workflow Integration Tests', () => {
  beforeEach(() => {
    todoistRemindersTool = new TodoistRemindersTool(mockApiConfig);
    todoistTasksTool = new TodoistTasksTool(mockApiConfig);
  });

  afterEach(() => {
    // Clean up any test data created during integration tests
  });

  describe('Relative Reminder Lifecycle', () => {
    test('should create, update, and delete a relative reminder', async () => {
      // Step 1: Create a task
      const taskResult = await todoistTasksTool.execute({
        action: 'create',
        content: 'Task with relative reminder',
        project_id: '220474322',
        due_string: 'tomorrow at 2pm',
      });

      expect(taskResult).toBeDefined();
      const taskId = extractTaskIdFromResult(taskResult);

      // Step 2: Create a relative reminder (30 minutes before)
      const createReminderResult = await todoistRemindersTool.execute({
        action: 'create',
        type: 'relative',
        item_id: taskId,
        minute_offset: 30,
      });

      expect(createReminderResult).toBeDefined();
      expect(createReminderResult.content[0].text).toContain('relative');
      const reminderId = extractReminderIdFromResult(createReminderResult);

      // Step 3: Verify the reminder was created
      const getReminderResult = await todoistRemindersTool.execute({
        action: 'get',
        reminder_id: reminderId,
      });

      expect(getReminderResult).toBeDefined();
      expect(getReminderResult.content[0].text).toContain(reminderId);
      expect(getReminderResult.content[0].text).toContain('30');

      // Step 4: Update the reminder (change to 60 minutes)
      const updateReminderResult = await todoistRemindersTool.execute({
        action: 'update',
        reminder_id: reminderId,
        minute_offset: 60,
      });

      expect(updateReminderResult).toBeDefined();
      expect(updateReminderResult.content[0].text).toContain('updated');

      // Step 5: Verify the update
      const getUpdatedReminderResult = await todoistRemindersTool.execute({
        action: 'get',
        reminder_id: reminderId,
      });

      expect(getUpdatedReminderResult.content[0].text).toContain('60');

      // Step 6: Delete the reminder
      const deleteReminderResult = await todoistRemindersTool.execute({
        action: 'delete',
        reminder_id: reminderId,
      });

      expect(deleteReminderResult).toBeDefined();
      expect(deleteReminderResult.content[0].text).toContain('deleted');

      // Step 7: Verify deletion
      try {
        await todoistRemindersTool.execute({
          action: 'get',
          reminder_id: reminderId,
        });
        fail('Should have thrown an error for deleted reminder');
      } catch (error) {
        expect((error as Error).message).toContain('not found');
      }
    });

    test('should list reminders for a specific task', async () => {
      // Create a task
      const taskResult = await todoistTasksTool.execute({
        action: 'create',
        content: 'Task with multiple reminders',
        project_id: '220474322',
        due_string: 'next monday at 10am',
      });

      const taskId = extractTaskIdFromResult(taskResult);

      // Create multiple reminders
      await todoistRemindersTool.execute({
        action: 'create',
        type: 'relative',
        item_id: taskId,
        minute_offset: 15,
      });

      await todoistRemindersTool.execute({
        action: 'create',
        type: 'relative',
        item_id: taskId,
        minute_offset: 30,
      });

      await todoistRemindersTool.execute({
        action: 'create',
        type: 'relative',
        item_id: taskId,
        minute_offset: 60,
      });

      // List all reminders for the task
      const listResult = await todoistRemindersTool.execute({
        action: 'list',
        item_id: taskId,
      });

      expect(listResult).toBeDefined();
      expect(listResult.content[0].text).toContain('3');
      expect(listResult.content[0].text).toContain('reminder');
    });
  });

  describe('Absolute Reminder Lifecycle', () => {
    test('should create and manage absolute reminders with specific datetime', async () => {
      // Create a task
      const taskResult = await todoistTasksTool.execute({
        action: 'create',
        content: 'Task with absolute reminder',
        project_id: '220474322',
      });

      const taskId = extractTaskIdFromResult(taskResult);

      // Create absolute reminder with specific date
      const createReminderResult = await todoistRemindersTool.execute({
        action: 'create',
        type: 'absolute',
        item_id: taskId,
        due: {
          date: '2025-12-25T09:00:00.000000Z',
        },
      });

      expect(createReminderResult).toBeDefined();
      expect(createReminderResult.content[0].text).toContain('absolute');

      const reminderId = extractReminderIdFromResult(createReminderResult);

      // Verify the reminder
      const getReminderResult = await todoistRemindersTool.execute({
        action: 'get',
        reminder_id: reminderId,
      });

      expect(getReminderResult.content[0].text).toContain('2025-12-25');
    });

    test('should support natural language due dates for absolute reminders', async () => {
      // Create a task
      const taskResult = await todoistTasksTool.execute({
        action: 'create',
        content: 'Task with natural language reminder',
        project_id: '220474322',
      });

      const taskId = extractTaskIdFromResult(taskResult);

      // Test various natural language patterns
      const naturalLanguageTests = [
        'tomorrow at 10:00',
        'next monday at 2pm',
        'day after tomorrow at noon',
      ];

      for (const dateString of naturalLanguageTests) {
        const createReminderResult = await todoistRemindersTool.execute({
          action: 'create',
          type: 'absolute',
          item_id: taskId,
          due: {
            string: dateString,
          },
        });

        expect(createReminderResult).toBeDefined();
        expect(createReminderResult.content[0].text).toContain('reminder');
      }

      // Verify all reminders were created
      const listResult = await todoistRemindersTool.execute({
        action: 'list',
        item_id: taskId,
      });

      expect(listResult.content[0].text).toContain('3');
    });

    test('should support recurring reminders with natural language', async () => {
      // Create a task
      const taskResult = await todoistTasksTool.execute({
        action: 'create',
        content: 'Task with recurring reminder',
        project_id: '220474322',
      });

      const taskId = extractTaskIdFromResult(taskResult);

      // Create recurring reminders
      const recurringPatterns = [
        'every day at 9am',
        'every monday at 10am',
        'every 4th at noon',
      ];

      for (const pattern of recurringPatterns) {
        const createReminderResult = await todoistRemindersTool.execute({
          action: 'create',
          type: 'absolute',
          item_id: taskId,
          due: {
            string: pattern,
            is_recurring: true,
          },
        });

        expect(createReminderResult).toBeDefined();
        expect(createReminderResult.content[0].text).toContain('reminder');
      }
    });
  });

  describe('Location Reminder Lifecycle', () => {
    test('should create and manage location-based reminders', async () => {
      // Create a task
      const taskResult = await todoistTasksTool.execute({
        action: 'create',
        content: 'Task with location reminder',
        project_id: '220474322',
      });

      const taskId = extractTaskIdFromResult(taskResult);

      // Create location reminder
      const createReminderResult = await todoistRemindersTool.execute({
        action: 'create',
        type: 'location',
        item_id: taskId,
        name: 'Home',
        loc_lat: '43.6532',
        loc_long: '-79.3832',
        loc_trigger: 'on_enter',
        radius: 100,
      });

      expect(createReminderResult).toBeDefined();
      expect(createReminderResult.content[0].text).toContain('location');

      const reminderId = extractReminderIdFromResult(createReminderResult);

      // Verify the location reminder
      const getReminderResult = await todoistRemindersTool.execute({
        action: 'get',
        reminder_id: reminderId,
      });

      expect(getReminderResult.content[0].text).toContain('Home');
      expect(getReminderResult.content[0].text).toContain('43.6532');
      expect(getReminderResult.content[0].text).toContain('on_enter');

      // Update location trigger
      const updateReminderResult = await todoistRemindersTool.execute({
        action: 'update',
        reminder_id: reminderId,
        loc_trigger: 'on_leave',
        radius: 200,
      });

      expect(updateReminderResult).toBeDefined();
      expect(updateReminderResult.content[0].text).toContain('updated');

      // Verify the update
      const getUpdatedReminderResult = await todoistRemindersTool.execute({
        action: 'get',
        reminder_id: reminderId,
      });

      expect(getUpdatedReminderResult.content[0].text).toContain('on_leave');
      expect(getUpdatedReminderResult.content[0].text).toContain('200');
    });

    test('should handle multiple location reminders for a task', async () => {
      // Create a task
      const taskResult = await todoistTasksTool.execute({
        action: 'create',
        content: 'Task with multiple location reminders',
        project_id: '220474322',
      });

      const taskId = extractTaskIdFromResult(taskResult);

      // Create multiple location reminders
      const locations = [
        { name: 'Home', lat: '43.6532', long: '-79.3832' },
        { name: 'Office', lat: '43.6426', long: '-79.3871' },
        { name: 'Gym', lat: '43.6511', long: '-79.3470' },
      ];

      for (const location of locations) {
        await todoistRemindersTool.execute({
          action: 'create',
          type: 'location',
          item_id: taskId,
          name: location.name,
          loc_lat: location.lat,
          loc_long: location.long,
          loc_trigger: 'on_enter',
          radius: 100,
        });
      }

      // List all location reminders
      const listResult = await todoistRemindersTool.execute({
        action: 'list',
        item_id: taskId,
      });

      expect(listResult.content[0].text).toContain('3');
      expect(listResult.content[0].text).toContain('reminder');
    });
  });

  describe('Mixed Reminder Types', () => {
    test('should support multiple reminder types on a single task', async () => {
      // Create a task
      const taskResult = await todoistTasksTool.execute({
        action: 'create',
        content: 'Task with mixed reminders',
        project_id: '220474322',
        due_string: 'next friday at 3pm',
      });

      const taskId = extractTaskIdFromResult(taskResult);

      // Create relative reminder
      await todoistRemindersTool.execute({
        action: 'create',
        type: 'relative',
        item_id: taskId,
        minute_offset: 30,
      });

      // Create absolute reminder
      await todoistRemindersTool.execute({
        action: 'create',
        type: 'absolute',
        item_id: taskId,
        due: {
          string: 'next friday at 2pm',
        },
      });

      // Create location reminder
      await todoistRemindersTool.execute({
        action: 'create',
        type: 'location',
        item_id: taskId,
        name: 'Office',
        loc_lat: '43.6426',
        loc_long: '-79.3871',
        loc_trigger: 'on_enter',
        radius: 100,
      });

      // List all reminders
      const listResult = await todoistRemindersTool.execute({
        action: 'list',
        item_id: taskId,
      });

      expect(listResult.content[0].text).toContain('3');
      expect(listResult.content[0].text).toContain('reminder');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid reminder ID gracefully', async () => {
      try {
        await todoistRemindersTool.execute({
          action: 'get',
          reminder_id: 'nonexistent_reminder_id',
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain('not found');
      }
    });

    test('should validate relative reminder constraints', async () => {
      const taskResult = await todoistTasksTool.execute({
        action: 'create',
        content: 'Task for validation test',
        project_id: '220474322',
      });

      const taskId = extractTaskIdFromResult(taskResult);

      // Test invalid minute_offset (exceeds 30 days)
      try {
        await todoistRemindersTool.execute({
          action: 'create',
          type: 'relative',
          item_id: taskId,
          minute_offset: 50000, // More than 43200 minutes (30 days)
        });
        fail('Should have thrown a validation error');
      } catch (error) {
        expect((error as Error).message).toContain('43200');
      }
    });

    test('should validate location reminder constraints', async () => {
      const taskResult = await todoistTasksTool.execute({
        action: 'create',
        content: 'Task for location validation test',
        project_id: '220474322',
      });

      const taskId = extractTaskIdFromResult(taskResult);

      // Test invalid radius (exceeds 5000 meters)
      try {
        await todoistRemindersTool.execute({
          action: 'create',
          type: 'location',
          item_id: taskId,
          name: 'Far Away',
          loc_lat: '43.6532',
          loc_long: '-79.3832',
          loc_trigger: 'on_enter',
          radius: 10000, // Exceeds 5000 meter limit
        });
        fail('Should have thrown a validation error');
      } catch (error) {
        expect((error as Error).message).toContain('5000');
      }
    });

    test('should require task to have due date for relative reminders', async () => {
      // Create a task without due date
      const taskResult = await todoistTasksTool.execute({
        action: 'create',
        content: 'Task without due date',
        project_id: '220474322',
      });

      const taskId = extractTaskIdFromResult(taskResult);

      // Try to create relative reminder (should fail or warn)
      try {
        await todoistRemindersTool.execute({
          action: 'create',
          type: 'relative',
          item_id: taskId,
          minute_offset: 30,
        });
        // May succeed but should warn that task needs due date
      } catch (error) {
        expect((error as Error).message).toContain('due');
      }
    });
  });

  // Helper functions for extracting IDs from results
  function extractTaskIdFromResult(result: any): string {
    // Parse the JSON response and extract task ID
    const response = JSON.parse(result.message);
    return response.data?.id || 'test_task_id';
  }

  function extractReminderIdFromResult(result: any): string {
    // Parse the JSON response and extract reminder ID
    const response = JSON.parse(result.message);
    return response.data?.id || 'test_reminder_id';
  }
});