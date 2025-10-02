import { describe, it, expect } from '@jest/globals';
import { bulkOperationInputSchema } from '../../src/schemas/validation';

describe('Bulk Operations - Deduplication Logic', () => {
  it('should deduplicate task IDs [1,2,1,3] to [1,2,3]', () => {
    const taskIds = ['1', '2', '1', '3'];
    const deduplicated = Array.from(new Set(taskIds));

    expect(deduplicated).toEqual(['1', '2', '3']);
    expect(deduplicated.length).toBe(3);
  });

  it('should handle single task ID [1] without deduplication', () => {
    const taskIds = ['1'];
    const deduplicated = Array.from(new Set(taskIds));

    expect(deduplicated).toEqual(['1']);
    expect(deduplicated.length).toBe(1);
  });

  it('should reject empty task_ids array', () => {
    const input = {
      action: 'update',
      task_ids: [],
    };

    const result = bulkOperationInputSchema.safeParse(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('task_ids');
    }
  });

  it('should accept 50 unique task IDs after deduplication', () => {
    const taskIds = Array.from({ length: 50 }, (_, i) => `task-${i + 1}`);
    const input = {
      action: 'update',
      task_ids: taskIds,
      priority: 2,
    };

    const result = bulkOperationInputSchema.safeParse(input);

    expect(result.success).toBe(true);
  });

  it('should reject 51 unique task IDs after deduplication', () => {
    const taskIds = Array.from({ length: 51 }, (_, i) => `task-${i + 1}`);
    const input = {
      action: 'update',
      task_ids: taskIds,
      priority: 2,
    };

    const result = bulkOperationInputSchema.safeParse(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('task_ids');
      expect(result.error.issues[0].message).toContain('50');
    }
  });

  it('should deduplicate and count correctly for mixed duplicates', () => {
    // Input: 60 IDs with duplicates, deduplicates to 45 unique
    const taskIds = [
      ...Array.from({ length: 30 }, (_, i) => `task-${i + 1}`),
      ...Array.from({ length: 15 }, (_, i) => `task-${i + 1}`), // Duplicates
      ...Array.from({ length: 15 }, (_, i) => `task-${i + 31}`),
    ];

    const deduplicated = Array.from(new Set(taskIds));

    expect(taskIds.length).toBe(60);
    expect(deduplicated.length).toBe(45);

    // Should pass validation (45 < 50)
    const input = {
      action: 'update',
      task_ids: deduplicated,
      priority: 2,
    };

    const result = bulkOperationInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

describe('Bulk Operations - Field Validation', () => {
  it('should reject content field', () => {
    const input = {
      action: 'update',
      task_ids: ['task-1', 'task-2'],
      content: 'New title',
    };

    const result = bulkOperationInputSchema.safeParse(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(issue => issue.message.includes('content'))
      ).toBe(true);
    }
  });

  it('should reject description field', () => {
    const input = {
      action: 'update',
      task_ids: ['task-1', 'task-2'],
      description: 'New description',
    };

    const result = bulkOperationInputSchema.safeParse(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(issue => issue.message.includes('description'))
      ).toBe(true);
    }
  });

  it('should reject comments field', () => {
    const input = {
      action: 'update',
      task_ids: ['task-1', 'task-2'],
      comments: ['New comment'],
    };

    const result = bulkOperationInputSchema.safeParse(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(issue => issue.message.includes('comments'))
      ).toBe(true);
    }
  });

  it('should allow all supported fields', () => {
    const input = {
      action: 'update',
      task_ids: ['task-1', 'task-2'],
      project_id: 'project-123',
      section_id: 'section-456',
      labels: ['urgent', 'work'],
      priority: 2,
      due_string: 'tomorrow',
      deadline_date: '2025-12-31',
    };

    const result = bulkOperationInputSchema.safeParse(input);

    expect(result.success).toBe(true);
  });

  it('should accept priority 1 (normal)', () => {
    const input = {
      action: 'update',
      task_ids: ['task-1'],
      priority: 1,
    };

    const result = bulkOperationInputSchema.safeParse(input);

    expect(result.success).toBe(true);
  });

  it('should accept priority 4 (highest)', () => {
    const input = {
      action: 'update',
      task_ids: ['task-1'],
      priority: 4,
    };

    const result = bulkOperationInputSchema.safeParse(input);

    expect(result.success).toBe(true);
  });

  it('should reject priority 0 (invalid)', () => {
    const input = {
      action: 'update',
      task_ids: ['task-1'],
      priority: 0,
    };

    const result = bulkOperationInputSchema.safeParse(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('priority');
    }
  });

  it('should reject priority 5 (invalid)', () => {
    const input = {
      action: 'update',
      task_ids: ['task-1'],
      priority: 5,
    };

    const result = bulkOperationInputSchema.safeParse(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('priority');
    }
  });

  it('should validate due_date format (YYYY-MM-DD)', () => {
    const validInput = {
      action: 'update',
      task_ids: ['task-1'],
      due_date: '2025-12-31',
    };

    const result = bulkOperationInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should reject invalid due_date format', () => {
    const invalidInput = {
      action: 'update',
      task_ids: ['task-1'],
      due_date: '31/12/2025', // Wrong format
    };

    const result = bulkOperationInputSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });

  it('should validate deadline_date format (YYYY-MM-DD)', () => {
    const validInput = {
      action: 'update',
      task_ids: ['task-1'],
      deadline_date: '2025-12-31',
    };

    const result = bulkOperationInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should accept valid action types', () => {
    const actions = ['update', 'complete', 'uncomplete', 'move'];

    actions.forEach(action => {
      const input = {
        action,
        task_ids: ['task-1'],
      };

      const result = bulkOperationInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  it('should reject invalid action type', () => {
    const input = {
      action: 'delete',
      task_ids: ['task-1'],
    };

    const result = bulkOperationInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should allow optional fields to be omitted', () => {
    const input = {
      action: 'complete',
      task_ids: ['task-1', 'task-2'],
    };

    const result = bulkOperationInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should validate duration_unit values', () => {
    const validInput = {
      action: 'update',
      task_ids: ['task-1'],
      duration: 30,
      duration_unit: 'minute',
    };

    const result = bulkOperationInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);

    const validInputDay = {
      action: 'update',
      task_ids: ['task-1'],
      duration: 2,
      duration_unit: 'day',
    };

    const resultDay = bulkOperationInputSchema.safeParse(validInputDay);
    expect(resultDay.success).toBe(true);
  });

  it('should reject invalid duration_unit', () => {
    const invalidInput = {
      action: 'update',
      task_ids: ['task-1'],
      duration: 30,
      duration_unit: 'hour', // Invalid
    };

    const result = bulkOperationInputSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });
});
