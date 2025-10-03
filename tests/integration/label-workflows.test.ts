import { describe, test, beforeEach, expect } from '@jest/globals';
import { TodoistLabelsTool } from '../../src/tools/todoist-labels.js';
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

describe('Label workflow integration', () => {
  let labelsTool: TodoistLabelsTool;
  let tasksTool: TodoistTasksTool;
  let apiService: any;
  let cache: CacheService;

  beforeEach(() => {
    apiService = createInMemoryApiService();
    cache = new CacheService();
    const batchService = new BatchOperationsService(apiService);

    labelsTool = new TodoistLabelsTool(mockApiConfig, {
      apiService,
      cacheService: cache,
    });
    tasksTool = new TodoistTasksTool(mockApiConfig, {
      apiService,
      cacheService: cache,
      batchService,
    });
  });

  /**
   * T020: Integration test - label lifecycle
   * Create label → Update color → Delete label
   * Verify each step succeeds
   */
  test('creates, updates, and deletes a label successfully', async () => {
    // Step 1: Create label
    const createResult = await labelsTool.execute({
      action: 'create',
      name: 'Lifecycle Test',
      color: 'blue',
      is_favorite: false,
    });

    expect(createResult.success).toBe(true);
    expect(createResult.data).toBeDefined();
    const labelId = (createResult.data as any).id;
    expect(labelId).toBeDefined();
    expect((createResult.data as any).name).toBe('Lifecycle Test');
    expect((createResult.data as any).color).toBe('blue');

    // Step 2: Update label color and favorite status
    const updateResult = await labelsTool.execute({
      action: 'update',
      label_id: labelId,
      color: 'red',
      is_favorite: true,
    });

    expect(updateResult.success).toBe(true);
    expect((updateResult.data as any).color).toBe('red');
    expect((updateResult.data as any).is_favorite).toBe(true);
    expect((updateResult.data as any).name).toBe('Lifecycle Test'); // Name unchanged

    // Step 3: Delete label
    const deleteResult = await labelsTool.execute({
      action: 'delete',
      label_id: labelId,
    });

    expect(deleteResult.success).toBe(true);
    expect(deleteResult.data).toBeNull();
    expect(deleteResult.message).toContain('deleted');

    // Step 4: Verify label no longer exists
    const getResult = await labelsTool.execute({
      action: 'get',
      label_id: labelId,
    });

    expect(getResult.success).toBe(false);
    expect(getResult.error?.code).toBe('LABEL_NOT_FOUND');
  });

  /**
   * T021: Integration test - label and task relationship
   * Create label → Assign to task → Delete label
   * Verify label removed from task.label_names
   */
  test('manages label-task relationship correctly', async () => {
    // Step 1: Create a label
    const labelResult = await labelsTool.execute({
      action: 'create',
      name: 'Task Label',
      color: 'green',
    });

    expect(labelResult.success).toBe(true);
    const labelId = (labelResult.data as any).id;
    const labelName = (labelResult.data as any).name;

    // Step 2: Create a task with the label
    const taskResult = await tasksTool.execute({
      action: 'create',
      content: 'Task with label',
      labels: [labelName],
    });

    expect(taskResult.success).toBe(true);
    const taskId = (taskResult.data as any).id;
    expect((taskResult.data as any).labels).toContain(labelName);

    // Step 3: Delete the label
    const deleteResult = await labelsTool.execute({
      action: 'delete',
      label_id: labelId,
    });

    expect(deleteResult.success).toBe(true);

    // Step 4: Verify task no longer has the label
    const getTaskResult = await tasksTool.execute({
      action: 'get',
      task_id: taskId,
    });

    expect(getTaskResult.success).toBe(true);
    expect((getTaskResult.data as any).labels).not.toContain(labelName);
  });

  /**
   * T022: Integration test - pagination workflow
   * Create 150 test labels
   * Page through with limit=50
   * Verify cursor handling and next_cursor=null at end
   */
  test('paginates through large label collections', async () => {
    // Step 1: Create 150 test labels
    const labelCount = 150;
    const createdLabels: string[] = [];

    for (let i = 1; i <= labelCount; i++) {
      const result = await labelsTool.execute({
        action: 'create',
        name: `PaginationLabel-${i.toString().padStart(3, '0')}`,
        color: 'charcoal',
      });

      expect(result.success).toBe(true);
      createdLabels.push((result.data as any).id);
    }

    expect(createdLabels.length).toBe(labelCount);

    // Step 2: Page through with limit=50
    const allFetchedLabels: any[] = [];
    let cursor: string | null | undefined = undefined;
    let pageCount = 0;

    do {
      const listResult = await labelsTool.execute({
        action: 'list',
        limit: 50,
        cursor: cursor || undefined,
      });

      expect(listResult.success).toBe(true);
      const labels = listResult.data as any[];
      expect(Array.isArray(labels)).toBe(true);
      expect(labels.length).toBeGreaterThan(0);
      expect(labels.length).toBeLessThanOrEqual(50);

      allFetchedLabels.push(...labels);
      cursor = listResult.metadata?.next_cursor;
      pageCount++;

      // Safety check to prevent infinite loops
      if (pageCount > 10) {
        throw new Error('Too many pages, possible infinite loop');
      }
    } while (cursor !== null && cursor !== undefined);

    // Step 3: Verify we got all labels
    expect(allFetchedLabels.length).toBeGreaterThanOrEqual(labelCount);
    expect(cursor).toBeNull(); // Last page should have next_cursor=null

    // Step 4: Verify pagination worked correctly (at least 3 pages for 150 items with limit 50)
    expect(pageCount).toBeGreaterThanOrEqual(3);
  });

  /**
   * T023: Integration test - shared label operations
   * Create shared label on tasks
   * Rename shared label
   * Verify name changed across tasks
   * Remove shared label
   * Verify removed from all tasks
   */
  test('handles shared label operations across tasks', async () => {
    const sharedLabelName = 'SharedLabel';
    const newSharedLabelName = 'RenamedSharedLabel';

    // Step 1: Create multiple tasks with the shared label
    const task1Result = await tasksTool.execute({
      action: 'create',
      content: 'Task 1 with shared label',
      labels: [sharedLabelName],
    });
    expect(task1Result.success).toBe(true);
    const task1Id = (task1Result.data as any).id;

    const task2Result = await tasksTool.execute({
      action: 'create',
      content: 'Task 2 with shared label',
      labels: [sharedLabelName],
    });
    expect(task2Result.success).toBe(true);
    const task2Id = (task2Result.data as any).id;

    const task3Result = await tasksTool.execute({
      action: 'create',
      content: 'Task 3 with shared label',
      labels: [sharedLabelName],
    });
    expect(task3Result.success).toBe(true);
    const task3Id = (task3Result.data as any).id;

    // Verify all tasks have the shared label
    expect((task1Result.data as any).labels).toContain(sharedLabelName);
    expect((task2Result.data as any).labels).toContain(sharedLabelName);
    expect((task3Result.data as any).labels).toContain(sharedLabelName);

    // Step 2: Rename the shared label
    const renameResult = await labelsTool.execute({
      action: 'rename_shared',
      name: sharedLabelName,
      new_name: newSharedLabelName,
    });

    expect(renameResult.success).toBe(true);
    expect(renameResult.message).toContain('across all tasks');

    // Step 3: Verify the label name changed across all tasks
    const task1Check = await tasksTool.execute({
      action: 'get',
      task_id: task1Id,
    });
    expect((task1Check.data as any).labels).toContain(newSharedLabelName);
    expect((task1Check.data as any).labels).not.toContain(sharedLabelName);

    const task2Check = await tasksTool.execute({
      action: 'get',
      task_id: task2Id,
    });
    expect((task2Check.data as any).labels).toContain(newSharedLabelName);
    expect((task2Check.data as any).labels).not.toContain(sharedLabelName);

    const task3Check = await tasksTool.execute({
      action: 'get',
      task_id: task3Id,
    });
    expect((task3Check.data as any).labels).toContain(newSharedLabelName);
    expect((task3Check.data as any).labels).not.toContain(sharedLabelName);

    // Step 4: Remove the shared label
    const removeResult = await labelsTool.execute({
      action: 'remove_shared',
      name: newSharedLabelName,
    });

    expect(removeResult.success).toBe(true);
    expect(removeResult.message).toContain('from all tasks');

    // Step 5: Verify the label was removed from all tasks
    const task1Final = await tasksTool.execute({
      action: 'get',
      task_id: task1Id,
    });
    expect((task1Final.data as any).labels).not.toContain(newSharedLabelName);

    const task2Final = await tasksTool.execute({
      action: 'get',
      task_id: task2Id,
    });
    expect((task2Final.data as any).labels).not.toContain(newSharedLabelName);

    const task3Final = await tasksTool.execute({
      action: 'get',
      task_id: task3Id,
    });
    expect((task3Final.data as any).labels).not.toContain(newSharedLabelName);
  });
});
