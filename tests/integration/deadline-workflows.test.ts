/**
 * Integration tests for deadline workflows
 * Tests the complete deadline feature including warnings and reminders
 * Tests MUST FAIL until the deadline feature is fully implemented
 */

import { describe, test, beforeEach, expect } from '@jest/globals';
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

describe('Deadline workflow integration', () => {
  let tasksTool: TodoistTasksTool;
  let apiService: any;

  beforeEach(() => {
    apiService = createInMemoryApiService();
    const cache = new CacheService();
    const batchService = new BatchOperationsService(apiService);

    tasksTool = new TodoistTasksTool(mockApiConfig, {
      apiService,
      cacheService: cache,
      batchService,
    });
  });

  /**
   * T009: Integration test - Recurring task deadline warning
   * Create task with due_string (recurring) + deadline
   * Verify warning appears in metadata.warnings
   */
  test('warns when deadline added to recurring task', async () => {
    const result = await tasksTool.execute({
      action: 'create',
      content: 'Weekly status update',
      due_string: 'every Monday',
      deadline: '2025-12-31',
      project_id: '220474322',
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    // Check for warning in metadata
    expect(result.metadata?.warnings).toBeDefined();
    expect(result.metadata?.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('recurring task'),
        expect.stringContaining('deadline will not recur'),
      ])
    );

    // Verify task was still created successfully
    expect((result.data as any).content).toBe('Weekly status update');
    expect((result.data as any).deadline).toBeDefined();
    expect((result.data as any).deadline.date).toBe('2025-12-31');
  });

  /**
   * T010: Integration test - Past deadline reminder
   * Create task with deadline in the past
   * Verify reminder appears in metadata.reminders
   */
  test('reminds when deadline is in the past', async () => {
    const result = await tasksTool.execute({
      action: 'create',
      content: 'Overdue item',
      deadline: '2025-01-15',
      project_id: '220474322',
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    // Check for reminder in metadata
    expect(result.metadata?.reminders).toBeDefined();
    expect(result.metadata?.reminders).toEqual(
      expect.arrayContaining([
        expect.stringContaining('2025-01-15'),
        expect.stringContaining('in the past'),
      ])
    );

    // Verify task was still created successfully
    expect((result.data as any).content).toBe('Overdue item');
    expect((result.data as any).deadline).toBeDefined();
    expect((result.data as any).deadline.date).toBe('2025-01-15');
  });

  /**
   * T011: Integration test - Valid future deadline (no warnings)
   * Create task with future deadline
   * Verify NO warnings or reminders
   */
  test('accepts future deadline without warnings', async () => {
    const result = await tasksTool.execute({
      action: 'create',
      content: 'Future deadline task',
      deadline: '2026-12-31',
      project_id: '220474322',
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    // No warnings or reminders for valid future deadline
    expect(result.metadata?.warnings).toBeUndefined();
    expect(result.metadata?.reminders).toBeUndefined();

    // Verify task created successfully
    expect((result.data as any).content).toBe('Future deadline task');
    expect((result.data as any).deadline).toBeDefined();
    expect((result.data as any).deadline.date).toBe('2026-12-31');
  });

  /**
   * T012: Integration test - Deadline with due date independence
   * Create task with both due_date and deadline
   * Update to remove deadline (null)
   * Verify due_date remains unchanged
   */
  test('manages deadline and due date independently', async () => {
    // Step 1: Create task with both due_date and deadline
    const createResult = await tasksTool.execute({
      action: 'create',
      content: 'Task with both dates',
      due_date: '2025-10-10',
      deadline: '2025-10-15',
      project_id: '220474322',
    });

    expect(createResult.success).toBe(true);
    const taskId = (createResult.data as any).id;
    expect((createResult.data as any).due).toBeDefined();
    expect((createResult.data as any).due.date).toBe('2025-10-10');
    expect((createResult.data as any).deadline).toBeDefined();
    expect((createResult.data as any).deadline.date).toBe('2025-10-15');

    // Step 2: Remove deadline only
    const updateResult = await tasksTool.execute({
      action: 'update',
      task_id: taskId,
      deadline: null,
    });

    expect(updateResult.success).toBe(true);
    expect((updateResult.data as any).deadline).toBeUndefined();

    // Step 3: Verify due_date still exists
    const getResult = await tasksTool.execute({
      action: 'get',
      task_id: taskId,
    });

    expect(getResult.success).toBe(true);
    expect((getResult.data as any).due).toBeDefined();
    expect((getResult.data as any).due.date).toBe('2025-10-10');
    expect((getResult.data as any).deadline).toBeUndefined();
  });

  /**
   * Additional integration test - Update recurring task to add deadline
   */
  test('warns when deadline added via update to recurring task', async () => {
    // Step 1: Create recurring task without deadline
    const createResult = await tasksTool.execute({
      action: 'create',
      content: 'Daily standup',
      due_string: 'every day',
      project_id: '220474322',
    });

    expect(createResult.success).toBe(true);
    const taskId = (createResult.data as any).id;

    // Step 2: Update to add deadline
    const updateResult = await tasksTool.execute({
      action: 'update',
      task_id: taskId,
      deadline: '2025-12-31',
    });

    expect(updateResult.success).toBe(true);
    expect(updateResult.metadata?.warnings).toBeDefined();
    expect(updateResult.metadata?.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('recurring task'),
        expect.stringContaining('deadline will not recur'),
      ])
    );
  });
});
