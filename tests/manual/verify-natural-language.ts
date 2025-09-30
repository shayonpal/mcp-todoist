#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Manual verification script for natural language due date support
 * Run this script to verify that the specified patterns work correctly
 *
 * Usage: npx tsx tests/manual/verify-natural-language.ts
 */

import { TodoistRemindersTool } from '../../src/tools/todoist-reminders.js';
import { TodoistTasksTool } from '../../src/tools/todoist-tasks.js';
import { getConfig } from '../../src/config/index.js';

interface TestCase {
  name: string;
  pattern: string;
  type: 'absolute';
  isRecurring?: boolean;
}

// Test cases from tasks.md specification
const testCases: TestCase[] = [
  // Required patterns from T063
  { name: 'Tomorrow', pattern: 'tomorrow at 10:00', type: 'absolute' },
  {
    name: 'Every day',
    pattern: 'every day at 9am',
    type: 'absolute',
    isRecurring: true,
  },
  {
    name: 'Every 4th',
    pattern: 'every 4th at noon',
    type: 'absolute',
    isRecurring: true,
  },
  {
    name: 'Day after tomorrow',
    pattern: 'day after tomorrow at 2pm',
    type: 'absolute',
  },

  // Additional common patterns
  { name: 'Next Monday', pattern: 'next monday at 9am', type: 'absolute' },
  {
    name: 'Every Monday',
    pattern: 'every monday at 10am',
    type: 'absolute',
    isRecurring: true,
  },
  {
    name: 'Every Sept 7',
    pattern: 'every sept 7 at 10am',
    type: 'absolute',
    isRecurring: true,
  },
  { name: 'Today', pattern: 'today at 5pm', type: 'absolute' },
  { name: 'In 2 days', pattern: 'in 2 days at 3pm', type: 'absolute' },
  { name: 'End of week', pattern: 'end of week', type: 'absolute' },
];

async function verifyNaturalLanguageSupport() {
  console.log('🔍 Verifying Natural Language Due Date Support\n');
  console.log('='.repeat(60));

  try {
    // Get configuration
    const config = getConfig();

    if (!config.token) {
      console.error('❌ TODOIST_API_TOKEN not found in environment variables');
      console.log('\nPlease set TODOIST_API_TOKEN in your .env file');
      process.exit(1);
    }

    // Initialize tools
    const tasksTool = new TodoistTasksTool(config);
    const remindersTool = new TodoistRemindersTool(config);

    console.log('✅ Tools initialized successfully');
    console.log(`📍 Using API: ${config.base_url}\n`);

    // Create a test task
    console.log('📝 Creating test task...');
    const taskResult = await tasksTool.execute({
      action: 'create',
      content: 'Natural Language Reminder Test Task (auto-created)',
      project_id: 'inbox', // Use inbox project
      due_string: 'next friday at 3pm',
    });

    const taskResponse = JSON.parse(taskResult.content[0].text);

    if (!taskResponse.success) {
      console.error('❌ Failed to create test task');
      console.error(taskResponse.error);
      process.exit(1);
    }

    const taskId = taskResponse.data.id;
    console.log(`✅ Test task created: ${taskId}\n`);

    // Test each natural language pattern
    const results: Array<{
      name: string;
      pattern: string;
      success: boolean;
      reminderId?: string;
      error?: string;
    }> = [];

    for (const testCase of testCases) {
      process.stdout.write(
        `Testing "${testCase.name}": "${testCase.pattern}"... `
      );

      try {
        const reminderResult = await remindersTool.execute({
          action: 'create',
          type: testCase.type,
          item_id: taskId,
          due: {
            string: testCase.pattern,
            is_recurring: testCase.isRecurring || false,
          },
        });

        const reminderResponse = JSON.parse(reminderResult.content[0].text);

        if (reminderResponse.success) {
          const reminderId = reminderResponse.data.id;
          results.push({
            name: testCase.name,
            pattern: testCase.pattern,
            success: true,
            reminderId: reminderId,
          });
          console.log('✅');
        } else {
          results.push({
            name: testCase.name,
            pattern: testCase.pattern,
            success: false,
            error: reminderResponse.error?.message || 'Unknown error',
          });
          console.log('❌');
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        results.push({
          name: testCase.name,
          pattern: testCase.pattern,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        console.log('❌');
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 VERIFICATION SUMMARY\n');

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Total tests: ${results.length}`);
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}\n`);

    if (failed > 0) {
      console.log('Failed tests:');
      results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`  ❌ ${r.name}: ${r.error}`);
        });
      console.log('');
    }

    // List all created reminders
    console.log('📋 All reminders created for test task:');
    const listResult = await remindersTool.execute({
      action: 'list',
      item_id: taskId,
    });

    const listResponse = JSON.parse(listResult.content[0].text);
    console.log(
      `Found ${listResponse.metadata?.total_count || 0} reminder(s)\n`
    );

    // Cleanup: Delete test task (which will also delete reminders)
    console.log('🧹 Cleaning up test task...');
    await tasksTool.execute({
      action: 'delete',
      task_id: taskId,
    });
    console.log('✅ Test task deleted\n');

    // Final verdict
    console.log('='.repeat(60));
    if (failed === 0) {
      console.log('✅ ALL NATURAL LANGUAGE PATTERNS VERIFIED SUCCESSFULLY! 🎉');
      process.exit(0);
    } else {
      console.log('⚠️  SOME PATTERNS FAILED - Review errors above');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Verification failed with error:');
    console.error(error);
    process.exit(1);
  }
}

// Run verification
verifyNaturalLanguageSupport().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
