import { describe, test, expect } from '@jest/globals';
import { z } from 'zod';
import { CompletedTasksInputSchema } from '../../src/schemas/validation.js';

/**
 * T006: Unit tests for time window validation logic
 *
 * These tests verify the time window calculation and validation refinements
 * implemented in CompletedTasksInputSchema (T007).
 */

describe('Time Window Validation Logic', () => {
  // Helper function to calculate days between two ISO 8601 datetimes
  function calculateDaysDifference(since: string, until: string): number {
    const sinceDate = new Date(since);
    const untilDate = new Date(until);
    const diffMs = untilDate.getTime() - sinceDate.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  describe('Day Calculation', () => {
    test('should calculate correct days between dates', () => {
      const days = calculateDaysDifference(
        '2025-09-01T00:00:00Z',
        '2025-10-01T00:00:00Z'
      );
      expect(days).toBe(30);
    });

    test('should handle 92-day window (3 months)', () => {
      const days = calculateDaysDifference(
        '2025-07-01T00:00:00Z',
        '2025-10-01T00:00:00Z'
      );
      expect(days).toBe(92);
    });

    test('should handle 42-day window (6 weeks)', () => {
      const days = calculateDaysDifference(
        '2025-08-20T00:00:00Z',
        '2025-10-01T00:00:00Z'
      );
      expect(days).toBe(42);
    });
  });

  describe('CompletedTasksInputSchema (by_completion_date)', () => {
    test('should accept valid request within 92-day limit', () => {
      const validInput = {
        action: 'list_completed',
        completed_query_type: 'by_completion_date',
        since: '2025-09-01T00:00:00Z',
        until: '2025-10-01T00:00:00Z', // 30 days
        limit: 50,
      };

      expect(() => CompletedTasksInputSchema.parse(validInput)).not.toThrow();
    });

    test('should accept exactly 92-day window', () => {
      const validInput = {
        action: 'list_completed',
        completed_query_type: 'by_completion_date',
        since: '2025-07-01T00:00:00Z',
        until: '2025-10-01T00:00:00Z', // Exactly 92 days
        limit: 50,
      };

      expect(() => CompletedTasksInputSchema.parse(validInput)).not.toThrow();
    });

    test('should reject window exceeding 92 days', () => {
      const invalidInput = {
        action: 'list_completed',
        completed_query_type: 'by_completion_date',
        since: '2025-06-01T00:00:00Z',
        until: '2025-10-01T00:00:00Z', // 122 days
        limit: 50,
      };

      expect(() => CompletedTasksInputSchema.parse(invalidInput)).toThrow();

      try {
        CompletedTasksInputSchema.parse(invalidInput);
      } catch (error) {
        expect(error).toBeInstanceOf(z.ZodError);
        const zodError = error as z.ZodError;
        expect(zodError.errors[0].message).toContain('92 days');
        expect(zodError.errors[0].message).toContain('completion date');
      }
    });

    test('should provide clear error message for exceeded window', () => {
      const invalidInput = {
        action: 'list_completed',
        completed_query_type: 'by_completion_date',
        since: '2025-01-01T00:00:00Z',
        until: '2025-09-30T23:59:59Z',
        limit: 50,
      };

      try {
        CompletedTasksInputSchema.parse(invalidInput);
        throw new Error('Should have thrown validation error');
      } catch (error) {
        expect(error).toBeInstanceOf(z.ZodError);
        const zodError = error as z.ZodError;
        expect(zodError.errors[0].message).toBe(
          'Time window exceeds 92 days maximum for completion date queries'
        );
      }
    });
  });

  describe('CompletedTasksInputSchema (by_due_date)', () => {
    test('should accept valid request within 42-day limit', () => {
      const validInput = {
        action: 'list_completed',
        completed_query_type: 'by_due_date',
        since: '2025-09-15T00:00:00Z',
        until: '2025-10-01T00:00:00Z', // 16 days
        limit: 50,
      };

      expect(() => CompletedTasksInputSchema.parse(validInput)).not.toThrow();
    });

    test('should accept exactly 42-day window', () => {
      const validInput = {
        action: 'list_completed',
        completed_query_type: 'by_due_date',
        since: '2025-08-20T00:00:00Z',
        until: '2025-10-01T00:00:00Z', // Exactly 42 days
        limit: 50,
      };

      expect(() => CompletedTasksInputSchema.parse(validInput)).not.toThrow();
    });

    test('should reject window exceeding 42 days', () => {
      const invalidInput = {
        action: 'list_completed',
        completed_query_type: 'by_due_date',
        since: '2025-08-01T00:00:00Z',
        until: '2025-10-01T00:00:00Z', // 61 days
        limit: 50,
      };

      expect(() => CompletedTasksInputSchema.parse(invalidInput)).toThrow();

      try {
        CompletedTasksInputSchema.parse(invalidInput);
      } catch (error) {
        expect(error).toBeInstanceOf(z.ZodError);
        const zodError = error as z.ZodError;
        expect(zodError.errors[0].message).toContain('42 days');
        expect(zodError.errors[0].message).toContain('due date');
      }
    });

    test('should provide clear error message for exceeded window', () => {
      const invalidInput = {
        action: 'list_completed',
        completed_query_type: 'by_due_date',
        since: '2025-07-01T00:00:00Z',
        until: '2025-09-30T23:59:59Z',
        limit: 50,
      };

      try {
        CompletedTasksInputSchema.parse(invalidInput);
        throw new Error('Should have thrown validation error');
      } catch (error) {
        expect(error).toBeInstanceOf(z.ZodError);
        const zodError = error as z.ZodError;
        expect(zodError.errors[0].message).toBe(
          'Time window exceeds 42 days maximum for due date queries'
        );
      }
    });
  });

  describe('Until > Since Validation', () => {
    test('should accept valid date order (until after since)', () => {
      const validInput = {
        action: 'list_completed',
        completed_query_type: 'by_completion_date',
        since: '2025-09-01T00:00:00Z',
        until: '2025-10-01T00:00:00Z',
        limit: 50,
      };

      expect(() => CompletedTasksInputSchema.parse(validInput)).not.toThrow();
    });

    test('should reject until before since', () => {
      const invalidInput = {
        action: 'list_completed',
        completed_query_type: 'by_completion_date',
        since: '2025-10-01T00:00:00Z',
        until: '2025-09-01T00:00:00Z',
        limit: 50,
      };

      expect(() => CompletedTasksInputSchema.parse(invalidInput)).toThrow();

      try {
        CompletedTasksInputSchema.parse(invalidInput);
      } catch (error) {
        expect(error).toBeInstanceOf(z.ZodError);
        const zodError = error as z.ZodError;
        expect(zodError.errors[0].message).toContain('after since');
      }
    });

    test('should reject until equal to since', () => {
      const invalidInput = {
        action: 'list_completed',
        completed_query_type: 'by_completion_date',
        since: '2025-09-15T00:00:00Z',
        until: '2025-09-15T00:00:00Z',
        limit: 50,
      };

      expect(() => CompletedTasksInputSchema.parse(invalidInput)).toThrow();
    });

    test('should provide clear error message for invalid date order', () => {
      const invalidInput = {
        action: 'list_completed',
        completed_query_type: 'by_completion_date',
        since: '2025-09-30T00:00:00Z',
        until: '2025-09-01T00:00:00Z',
        limit: 50,
      };

      try {
        CompletedTasksInputSchema.parse(invalidInput);
        throw new Error('Should have thrown validation error');
      } catch (error) {
        expect(error).toBeInstanceOf(z.ZodError);
        const zodError = error as z.ZodError;
        expect(zodError.errors[0].message).toBe(
          'Until date must be after since date'
        );
      }
    });
  });

  describe('ISO 8601 DateTime Format Validation', () => {
    test('should accept valid ISO 8601 datetime with Z', () => {
      const validInput = {
        action: 'list_completed',
        completed_query_type: 'by_completion_date',
        since: '2025-09-01T00:00:00Z',
        until: '2025-10-01T23:59:59Z',
        limit: 50,
      };

      expect(() => CompletedTasksInputSchema.parse(validInput)).not.toThrow();
    });

    test('should accept ISO 8601 with milliseconds', () => {
      const validInput = {
        action: 'list_completed',
        completed_query_type: 'by_completion_date',
        since: '2025-09-01T00:00:00.000Z',
        until: '2025-10-01T23:59:59.999Z',
        limit: 50,
      };

      expect(() => CompletedTasksInputSchema.parse(validInput)).not.toThrow();
    });

    test('should reject date without time component', () => {
      const invalidInput = {
        action: 'list_completed',
        completed_query_type: 'by_completion_date',
        since: '2025-09-01',
        until: '2025-10-01',
        limit: 50,
      };

      expect(() => CompletedTasksInputSchema.parse(invalidInput)).toThrow();
    });

    test('should reject malformed datetime', () => {
      const invalidInput = {
        action: 'list_completed',
        completed_query_type: 'by_completion_date',
        since: 'September 1, 2025',
        until: 'October 1, 2025',
        limit: 50,
      };

      expect(() => CompletedTasksInputSchema.parse(invalidInput)).toThrow();
    });
  });

  describe('Boundary Conditions', () => {
    test('should handle 1-day window', () => {
      const days = calculateDaysDifference(
        '2025-09-01T00:00:00Z',
        '2025-09-02T00:00:00Z'
      );
      expect(days).toBe(1);
    });

    test('should handle leap year dates', () => {
      const days = calculateDaysDifference(
        '2024-02-28T00:00:00Z',
        '2024-03-01T00:00:00Z'
      );
      expect(days).toBe(2); // 2024 is a leap year
    });

    test('should handle year boundary', () => {
      const days = calculateDaysDifference(
        '2024-12-31T00:00:00Z',
        '2025-01-01T00:00:00Z'
      );
      expect(days).toBe(1);
    });
  });
});
