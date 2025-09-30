/**
 * Contract tests for todoist_reminders MCP tool
 * These tests validate the tool interface and parameter schemas
 * Tests MUST FAIL until the actual tool is implemented
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { TodoistRemindersTool } from '../../src/tools/todoist-reminders.js';

// Mock API configuration for tests
const mockApiConfig = {
  token: 'test_token',
  base_url: 'https://api.todoist.com/rest/v1',
  timeout: 10000,
  retry_attempts: 3,
};

// Initialize tool with mock configuration
let todoistRemindersTool: TodoistRemindersTool;

describe('todoist_reminders MCP Tool Contract', () => {
  beforeEach(() => {
    todoistRemindersTool = new TodoistRemindersTool(mockApiConfig);
  });

  describe('Tool Registration', () => {
    test('should be defined as MCP tool', () => {
      expect(todoistRemindersTool).toBeDefined();
      expect(todoistRemindersTool.name).toBe('todoist_reminders');
      expect(todoistRemindersTool.description).toContain('reminder');
    });

    test('should have correct input schema structure', () => {
      expect(todoistRemindersTool.inputSchema).toBeDefined();
      expect(todoistRemindersTool.inputSchema.type).toBe('object');
      expect(todoistRemindersTool.inputSchema.properties).toBeDefined();
    });

    test('should support all required actions', () => {
      const actionProperty = todoistRemindersTool.inputSchema.properties.action;
        'create',
        'get',
        'update',
        'delete',
        'list',
      ]);
    });
  });

  describe('Parameter Validation', () => {
    test('should require action parameter', () => {
      const actionProperty = todoistRemindersTool.inputSchema.properties.action;
      expect(actionProperty.type).toBe('string');
    });

    test('should require task_id for reminders', () => {
      const taskIdProperty = todoistRemindersTool.inputSchema.properties.item_id;
      expect(taskIdProperty).toBeDefined();
      expect(taskIdProperty.type).toBe('string');
    });

    test('should validate reminder type', () => {
      const typeProperty = todoistRemindersTool.inputSchema.properties.type;
      expect(typeProperty).toBeDefined();
      expect(typeProperty.enum).toEqual(['relative', 'absolute', 'location']);
    });

    test('should support minute_offset for relative reminders', () => {
      const minuteOffsetProperty =
        todoistRemindersTool.inputSchema.properties.minute_offset;
      expect(minuteOffsetProperty).toBeDefined();
      expect(minuteOffsetProperty.type).toBe('number');
    });

    test('should support due date object for absolute reminders', () => {
      const dueProperty = todoistRemindersTool.inputSchema.properties.due;
      expect(dueProperty).toBeDefined();
      expect(dueProperty.type).toBe('object');
    });

    test('should support location fields for location reminders', () => {
      const nameProperty = todoistRemindersTool.inputSchema.properties.name;
      const locLatProperty = todoistRemindersTool.inputSchema.properties.loc_lat;
      const locLongProperty =
        todoistRemindersTool.inputSchema.properties.loc_long;
      const locTriggerProperty =
        todoistRemindersTool.inputSchema.properties.loc_trigger;
      const radiusProperty = todoistRemindersTool.inputSchema.properties.radius;

      expect(nameProperty).toBeDefined();
      expect(locLatProperty).toBeDefined();
      expect(locLongProperty).toBeDefined();
      expect(locTriggerProperty).toBeDefined();
      expect(locTriggerProperty.enum).toEqual(['on_enter', 'on_leave']);
      expect(radiusProperty).toBeDefined();
      expect(radiusProperty.type).toBe('number');
    });
  });

  describe('Create Action Contract', () => {
    test('should accept valid relative reminder parameters', async () => {
      const params = {
        action: 'create',
        item_id: '2995104339',
        type: 'relative',
        minute_offset: 30,
      };

      const result = await todoistRemindersTool.execute(params);

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.message).toBeDefined();
