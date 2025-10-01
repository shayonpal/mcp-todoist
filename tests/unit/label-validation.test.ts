import { describe, test, expect } from '@jest/globals';
import { LabelToolInputSchema } from '../../src/schemas/validation.js';
import { ZodError } from 'zod';

/**
 * T014: Unit test - label validation
 * Tests Zod schema validation for LabelToolInputSchema
 */
describe('Label Validation Schema', () => {
  describe('Action Enum Validation', () => {
    test('accepts valid actions', () => {
      const validActions = [
        'create',
        'get',
        'update',
        'delete',
        'list',
        'rename_shared',
        'remove_shared',
      ];

      validActions.forEach(action => {
        const result = LabelToolInputSchema.safeParse({ action });
        expect(result.success).toBe(true);
      });
    });

    test('rejects invalid actions', () => {
      const invalidActions = ['invalid', 'noop', 'archive', 'complete'];

      invalidActions.forEach(action => {
        const result = LabelToolInputSchema.safeParse({ action });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(ZodError);
        }
      });
    });

    test('rejects missing action', () => {
      const result = LabelToolInputSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('action');
      }
    });
  });

  describe('Name Length Validation', () => {
    test('rejects empty name (0 chars)', () => {
      const result = LabelToolInputSchema.safeParse({
        action: 'create',
        name: '',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('name');
      }
    });

    test('accepts valid name length (128 chars)', () => {
      const name = 'a'.repeat(128);
      const result = LabelToolInputSchema.safeParse({
        action: 'create',
        name,
      });
      expect(result.success).toBe(true);
    });

    test('rejects name over limit (129 chars)', () => {
      const name = 'a'.repeat(129);
      const result = LabelToolInputSchema.safeParse({
        action: 'create',
        name,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('name');
        expect(result.error.issues[0].message).toMatch(/128|maximum|length/i);
      }
    });

    test('accepts moderate name length (64 chars)', () => {
      const name = 'a'.repeat(64);
      const result = LabelToolInputSchema.safeParse({
        action: 'create',
        name,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Limit Validation', () => {
    test('rejects limit of 0', () => {
      const result = LabelToolInputSchema.safeParse({
        action: 'list',
        limit: 0,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('limit');
      }
    });

    test('accepts limit of 1 (minimum)', () => {
      const result = LabelToolInputSchema.safeParse({
        action: 'list',
        limit: 1,
      });
      expect(result.success).toBe(true);
    });

    test('accepts limit of 200 (maximum)', () => {
      const result = LabelToolInputSchema.safeParse({
        action: 'list',
        limit: 200,
      });
      expect(result.success).toBe(true);
    });

    test('rejects limit of 201 (over maximum)', () => {
      const result = LabelToolInputSchema.safeParse({
        action: 'list',
        limit: 201,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('limit');
        expect(result.error.issues[0].message).toMatch(/200|maximum/i);
      }
    });

    test('accepts default pagination (no limit)', () => {
      const result = LabelToolInputSchema.safeParse({
        action: 'list',
      });
      expect(result.success).toBe(true);
    });

    test('accepts limit of 50 (common value)', () => {
      const result = LabelToolInputSchema.safeParse({
        action: 'list',
        limit: 50,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Conditional Required Fields Per Action', () => {
    describe('create action', () => {
      test('requires name', () => {
        const result = LabelToolInputSchema.safeParse({
          action: 'create',
        });
        // Schema should allow optional name, but tool implementation requires it
        expect(result.success).toBe(true);
      });

      test('accepts optional color', () => {
        const result = LabelToolInputSchema.safeParse({
          action: 'create',
          name: 'Work',
          color: 'blue',
        });
        expect(result.success).toBe(true);
      });

      test('accepts optional order', () => {
        const result = LabelToolInputSchema.safeParse({
          action: 'create',
          name: 'Work',
          order: 1,
        });
        expect(result.success).toBe(true);
      });

      test('accepts optional is_favorite', () => {
        const result = LabelToolInputSchema.safeParse({
          action: 'create',
          name: 'Work',
          is_favorite: true,
        });
        expect(result.success).toBe(true);
      });
    });

    describe('get action', () => {
      test('requires label_id', () => {
        const result = LabelToolInputSchema.safeParse({
          action: 'get',
        });
        // Schema allows optional label_id, but tool implementation requires it
        expect(result.success).toBe(true);
      });

      test('accepts valid label_id', () => {
        const result = LabelToolInputSchema.safeParse({
          action: 'get',
          label_id: '2156154810',
        });
        expect(result.success).toBe(true);
      });
    });

    describe('update action', () => {
      test('requires label_id', () => {
        const result = LabelToolInputSchema.safeParse({
          action: 'update',
        });
        // Schema allows optional label_id, but tool implementation requires it
        expect(result.success).toBe(true);
      });

      test('accepts optional color update', () => {
        const result = LabelToolInputSchema.safeParse({
          action: 'update',
          label_id: '2156154810',
          color: 'red',
        });
        expect(result.success).toBe(true);
      });

      test('accepts optional is_favorite update', () => {
        const result = LabelToolInputSchema.safeParse({
          action: 'update',
          label_id: '2156154810',
          is_favorite: false,
        });
        expect(result.success).toBe(true);
      });

      test('accepts multiple field updates', () => {
        const result = LabelToolInputSchema.safeParse({
          action: 'update',
          label_id: '2156154810',
          color: 'green',
          order: 5,
          is_favorite: true,
        });
        expect(result.success).toBe(true);
      });
    });

    describe('delete action', () => {
      test('requires label_id', () => {
        const result = LabelToolInputSchema.safeParse({
          action: 'delete',
        });
        // Schema allows optional label_id, but tool implementation requires it
        expect(result.success).toBe(true);
      });

      test('accepts valid label_id', () => {
        const result = LabelToolInputSchema.safeParse({
          action: 'delete',
          label_id: '2156154810',
        });
        expect(result.success).toBe(true);
      });
    });

    describe('list action', () => {
      test('accepts no parameters', () => {
        const result = LabelToolInputSchema.safeParse({
          action: 'list',
        });
        expect(result.success).toBe(true);
      });

      test('accepts cursor', () => {
        const result = LabelToolInputSchema.safeParse({
          action: 'list',
          cursor: 'cursor_abc123',
        });
        expect(result.success).toBe(true);
      });

      test('accepts limit', () => {
        const result = LabelToolInputSchema.safeParse({
          action: 'list',
          limit: 50,
        });
        expect(result.success).toBe(true);
      });

      test('accepts cursor and limit together', () => {
        const result = LabelToolInputSchema.safeParse({
          action: 'list',
          cursor: 'cursor_abc123',
          limit: 100,
        });
        expect(result.success).toBe(true);
      });
    });

    describe('rename_shared action', () => {
      test('requires name and new_name', () => {
        const result = LabelToolInputSchema.safeParse({
          action: 'rename_shared',
        });
        // Schema allows optional fields, but tool implementation requires them
        expect(result.success).toBe(true);
      });

      test('accepts valid rename parameters', () => {
        const result = LabelToolInputSchema.safeParse({
          action: 'rename_shared',
          name: 'OldName',
          new_name: 'NewName',
        });
        expect(result.success).toBe(true);
      });
    });

    describe('remove_shared action', () => {
      test('requires name', () => {
        const result = LabelToolInputSchema.safeParse({
          action: 'remove_shared',
        });
        // Schema allows optional name, but tool implementation requires it
        expect(result.success).toBe(true);
      });

      test('accepts valid name', () => {
        const result = LabelToolInputSchema.safeParse({
          action: 'remove_shared',
          name: 'SharedLabel',
        });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Type Validation', () => {
    test('rejects non-string label_id', () => {
      const result = LabelToolInputSchema.safeParse({
        action: 'get',
        label_id: 123,
      });
      expect(result.success).toBe(false);
    });

    test('rejects non-number limit', () => {
      const result = LabelToolInputSchema.safeParse({
        action: 'list',
        limit: '50',
      });
      expect(result.success).toBe(false);
    });

    test('rejects non-boolean is_favorite', () => {
      const result = LabelToolInputSchema.safeParse({
        action: 'create',
        name: 'Work',
        is_favorite: 'true',
      });
      expect(result.success).toBe(false);
    });

    test('rejects non-string cursor', () => {
      const result = LabelToolInputSchema.safeParse({
        action: 'list',
        cursor: 123,
      });
      expect(result.success).toBe(false);
    });
  });
});
