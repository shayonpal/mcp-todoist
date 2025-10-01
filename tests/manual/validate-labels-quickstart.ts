/**
 * Manual validation script for todoist_labels tool
 * Executes all acceptance scenarios and edge cases from quickstart.md
 * against the real Todoist API
 *
 * Usage: npx tsx tests/manual/validate-labels-quickstart.ts
 */

import { TodoistApiService } from '../../src/services/todoist-api.js';
import { TodoistLabelsTool } from '../../src/tools/todoist-labels.js';
import * as dotenv from 'dotenv';
import { TodoistLabel, APIConfiguration } from '../../src/types/todoist.js';

// Load environment variables
dotenv.config();

interface ValidationResult {
  scenario: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: ValidationResult[] = [];
const createdLabelIds: string[] = [];
let labelsTool: TodoistLabelsTool | null = null;

function writeLine(message = ''): void {
  process.stdout.write(`${message}\n`);
}

function writeErrorLine(message = ''): void {
  process.stderr.write(`${message}\n`);
}

function writeDetails(details: unknown): void {
  const json = JSON.stringify(details, null, 2);
  if (!json) {
    return;
  }

  const indentedJson = json
    .split('\n')
    .map(line => `     ${line}`)
    .join('\n');
  writeLine('   Details:');
  writeLine(indentedJson);
}

function writeSectionHeader(header: string): void {
  writeLine();
  writeLine(header);
}

function logResult(result: ValidationResult) {
  results.push(result);
  const status = result.passed ? '✅' : '❌';
  writeLine(`${status} ${result.scenario}`);
  if (result.message) {
    writeLine(`   ${result.message}`);
  }
  if (!result.passed && result.details) {
    writeDetails(result.details);
  }
}

function getLabelsTool(): TodoistLabelsTool {
  if (labelsTool) {
    return labelsTool;
  }

  const token = process.env.TODOIST_API_TOKEN;
  if (!token) {
    throw new Error('TODOIST_API_TOKEN not found in environment');
  }

  const apiConfig: APIConfiguration = {
    token,
    base_url: 'https://api.todoist.com/api/v1',
    timeout: 10000,
    retry_attempts: 3,
  };

  const apiService = new TodoistApiService(apiConfig);
  labelsTool = new TodoistLabelsTool(apiConfig, { apiService });
  return labelsTool;
}

async function callTool(params: unknown) {
  const tool = getLabelsTool();
  return await tool.execute(params);
}

async function scenario1_CreatePersonalLabel() {
  writeSectionHeader('📋 Scenario 1: Create Personal Label');
  try {
    const response = await callTool({
      action: 'create',
      name: 'ValidationWork',
      color: 'blue',
      is_favorite: true,
    });

    const passed =
      response.success === true &&
      response.data?.name === 'ValidationWork' &&
      response.data?.color === 'blue' &&
      response.data?.is_favorite === true &&
      response.data?.id !== undefined;

    if (response.data?.id) {
      createdLabelIds.push(response.data.id);
    }

    logResult({
      scenario: 'Scenario 1: Create Personal Label',
      passed,
      message: passed ? 'Label created successfully' : 'Validation failed',
      details: !passed ? response : undefined,
    });
  } catch (error: any) {
    logResult({
      scenario: 'Scenario 1: Create Personal Label',
      passed: false,
      message: error.message,
      details: error,
    });
  }
}

async function scenario2_UpdateLabelProperties() {
  writeSectionHeader('📋 Scenario 2: Update Label Properties');
  try {
    // Step 1: Create label
    const createResponse = await callTool({
      action: 'create',
      name: 'ValidationPersonal',
      color: 'green',
    });

    if (!createResponse.success || !createResponse.data?.id) {
      throw new Error('Failed to create label for update test');
    }

    const labelId = createResponse.data.id;
    createdLabelIds.push(labelId);

    // Step 2: Update label
    const updateResponse = await callTool({
      action: 'update',
      label_id: labelId,
      color: 'red',
      is_favorite: true,
    });

    const passed =
      updateResponse.success === true &&
      updateResponse.data?.id === labelId &&
      updateResponse.data?.name === 'ValidationPersonal' &&
      updateResponse.data?.color === 'red' &&
      updateResponse.data?.is_favorite === true;

    logResult({
      scenario: 'Scenario 2: Update Label Properties',
      passed,
      message: passed ? 'Label updated successfully' : 'Validation failed',
      details: !passed ? updateResponse : undefined,
    });
  } catch (error: any) {
    logResult({
      scenario: 'Scenario 2: Update Label Properties',
      passed: false,
      message: error.message,
      details: error,
    });
  }
}

async function scenario3_ListAllLabels() {
  writeSectionHeader('📋 Scenario 3: List All Labels');
  try {
    const response = await callTool({
      action: 'list',
    });

    const passed =
      response.success === true &&
      Array.isArray(response.data) &&
      response.data.length >= 2 &&
      response.metadata?.total_count !== undefined &&
      response.data.every(
        (label: TodoistLabel) =>
          label.id && label.name && label.color !== undefined
      );

    logResult({
      scenario: 'Scenario 3: List All Labels',
      passed,
      message: passed
        ? `Found ${response.data?.length} labels`
        : 'Validation failed',
      details: !passed ? response : undefined,
    });
  } catch (error: any) {
    logResult({
      scenario: 'Scenario 3: List All Labels',
      passed: false,
      message: error.message,
      details: error,
    });
  }
}

async function scenario4_DeletePersonalLabel() {
  writeSectionHeader('📋 Scenario 4: Delete Personal Label');
  try {
    // Step 1: Create test label
    const createResponse = await callTool({
      action: 'create',
      name: 'ValidationArchive',
    });

    if (!createResponse.success || !createResponse.data?.id) {
      throw new Error('Failed to create label for delete test');
    }

    const labelId = createResponse.data.id;

    // Step 2: Delete label
    const deleteResponse = await callTool({
      action: 'delete',
      label_id: labelId,
    });

    // Step 3: Verify label no longer exists
    const getResponse = await callTool({
      action: 'get',
      label_id: labelId,
    });

    const passed =
      deleteResponse.success === true &&
      deleteResponse.data === null &&
      getResponse.success === false &&
      getResponse.error?.code === 'LABEL_NOT_FOUND';

    logResult({
      scenario: 'Scenario 4: Delete Personal Label',
      passed,
      message: passed
        ? 'Label deleted and verified not found'
        : 'Validation failed',
      details: !passed ? { deleteResponse, getResponse } : undefined,
    });
  } catch (error: any) {
    logResult({
      scenario: 'Scenario 4: Delete Personal Label',
      passed: false,
      message: error.message,
      details: error,
    });
  }
}

async function scenario5_GetLabelById() {
  writeSectionHeader('📋 Scenario 5: Get Label by ID');
  try {
    if (createdLabelIds.length === 0) {
      throw new Error('No labels available for get test');
    }

    const labelId = createdLabelIds[0];
    const response = await callTool({
      action: 'get',
      label_id: labelId,
    });

    const passed =
      response.success === true &&
      response.data?.id === labelId &&
      response.data?.name !== undefined &&
      response.data?.color !== undefined &&
      response.data?.order !== undefined &&
      response.data?.is_favorite !== undefined;

    logResult({
      scenario: 'Scenario 5: Get Label by ID',
      passed,
      message: passed
        ? `Retrieved label: ${response.data?.name}`
        : 'Validation failed',
      details: !passed ? response : undefined,
    });
  } catch (error: any) {
    logResult({
      scenario: 'Scenario 5: Get Label by ID',
      passed: false,
      message: error.message,
      details: error,
    });
  }
}

async function scenario6_PaginationWithLargeCollections() {
  writeSectionHeader(
    '📋 Scenario 6: Pagination (simplified - testing mechanism)'
  );
  try {
    // Test pagination mechanism without creating 150 labels
    const firstPage = await callTool({
      action: 'list',
      limit: 10,
    });

    const passed =
      firstPage.success === true &&
      Array.isArray(firstPage.data) &&
      firstPage.metadata?.total_count !== undefined &&
      (firstPage.metadata?.next_cursor !== undefined ||
        firstPage.metadata?.next_cursor === null);

    logResult({
      scenario: 'Scenario 6: Pagination',
      passed,
      message: passed
        ? `Pagination working (limit=10, got ${firstPage.data?.length} items)`
        : 'Validation failed',
      details: !passed ? firstPage : undefined,
    });
  } catch (error: any) {
    logResult({
      scenario: 'Scenario 6: Pagination',
      passed: false,
      message: error.message,
      details: error,
    });
  }
}

async function scenario7_RenameSharedLabel() {
  writeSectionHeader('📋 Scenario 7: Rename Shared Label');
  try {
    const response = await callTool({
      action: 'rename_shared',
      name: 'ValidationTeam',
      new_name: 'ValidationQ1',
    });

    const passed =
      response.success === true &&
      response.data === null &&
      response.message?.includes('renamed');

    logResult({
      scenario: 'Scenario 7: Rename Shared Label',
      passed,
      message: passed
        ? 'Shared label renamed successfully'
        : 'Validation failed (label may not exist)',
      details: !passed ? response : undefined,
    });

    // Rename back to avoid pollution
    if (passed) {
      await callTool({
        action: 'rename_shared',
        name: 'ValidationQ1',
        new_name: 'ValidationTeam',
      });
    }
  } catch (error: any) {
    logResult({
      scenario: 'Scenario 7: Rename Shared Label',
      passed: false,
      message: error.message,
      details: error,
    });
  }
}

async function scenario8_RemoveSharedLabel() {
  writeSectionHeader('📋 Scenario 8: Remove Shared Label');
  try {
    const response = await callTool({
      action: 'remove_shared',
      name: 'ValidationDeprecated',
    });

    const passed =
      response.success === true &&
      response.data === null &&
      response.message?.includes('removed');

    logResult({
      scenario: 'Scenario 8: Remove Shared Label',
      passed,
      message: passed
        ? 'Shared label removed successfully'
        : 'Validation failed (label may not exist)',
      details: !passed ? response : undefined,
    });
  } catch (error: any) {
    logResult({
      scenario: 'Scenario 8: Remove Shared Label',
      passed: false,
      message: error.message,
      details: error,
    });
  }
}

async function edgeCase1_DuplicateLabelName() {
  writeSectionHeader('📋 Edge Case 1: Duplicate Label Name (Idempotent)');
  try {
    // First create
    const firstCreate = await callTool({
      action: 'create',
      name: 'ValidationDuplicate',
    });

    if (!firstCreate.success || !firstCreate.data?.id) {
      throw new Error('Failed to create label for duplicate test');
    }

    const firstId = firstCreate.data.id;
    createdLabelIds.push(firstId);

    // Second create with same name
    const secondCreate = await callTool({
      action: 'create',
      name: 'ValidationDuplicate',
    });

    const passed =
      secondCreate.success === true &&
      secondCreate.data?.id === firstId &&
      secondCreate.message?.toLowerCase().includes('exists');

    logResult({
      scenario: 'Edge Case 1: Duplicate Label Name',
      passed,
      message: passed ? 'Idempotent behavior confirmed' : 'Validation failed',
      details: !passed ? { firstCreate, secondCreate } : undefined,
    });
  } catch (error: any) {
    logResult({
      scenario: 'Edge Case 1: Duplicate Label Name',
      passed: false,
      message: error.message,
      details: error,
    });
  }
}

async function edgeCase2_NonExistentLabel() {
  writeSectionHeader('📋 Edge Case 2: Operations on Non-Existent Label');
  try {
    const response = await callTool({
      action: 'get',
      label_id: '9999999999',
    });

    const passed =
      response.success === false &&
      response.error?.code === 'LABEL_NOT_FOUND' &&
      response.error?.retryable === false;

    logResult({
      scenario: 'Edge Case 2: Non-Existent Label',
      passed,
      message: passed ? 'Correct error handling' : 'Validation failed',
      details: !passed ? response : undefined,
    });
  } catch (error: any) {
    logResult({
      scenario: 'Edge Case 2: Non-Existent Label',
      passed: false,
      message: error.message,
      details: error,
    });
  }
}

async function edgeCase3_InvalidPaginationLimit() {
  writeSectionHeader('📋 Edge Case 3: Invalid Pagination Limit');
  try {
    const response = await callTool({
      action: 'list',
      limit: 250,
    });

    const passed =
      response.success === false &&
      response.error?.code === 'VALIDATION_ERROR' &&
      response.error?.message?.toLowerCase().includes('limit');

    logResult({
      scenario: 'Edge Case 3: Invalid Pagination Limit',
      passed,
      message: passed ? 'Validation caught invalid limit' : 'Validation failed',
      details: !passed ? response : undefined,
    });
  } catch (error: any) {
    logResult({
      scenario: 'Edge Case 3: Invalid Pagination Limit',
      passed: false,
      message: error.message,
      details: error,
    });
  }
}

async function cleanup() {
  writeSectionHeader('🧹 Cleanup: Deleting test labels...');
  let deletedCount = 0;

  for (const labelId of createdLabelIds) {
    try {
      await callTool({
        action: 'delete',
        label_id: labelId,
      });
      deletedCount++;
    } catch (error) {
      writeLine(`   ⚠️  Failed to delete label ${labelId}`);
    }
  }

  writeLine(`   Deleted ${deletedCount}/${createdLabelIds.length} labels`);
}

async function main() {
  writeLine('🚀 Starting Manual Validation for todoist_labels tool');
  writeLine('');
  writeLine('================================================');
  writeLine('');

  if (!process.env.TODOIST_API_TOKEN) {
    writeErrorLine('❌ TODOIST_API_TOKEN not found in environment');
    process.exit(1);
  }

  try {
    // Acceptance Scenarios
    await scenario1_CreatePersonalLabel();
    await scenario2_UpdateLabelProperties();
    await scenario3_ListAllLabels();
    await scenario4_DeletePersonalLabel();
    await scenario5_GetLabelById();
    await scenario6_PaginationWithLargeCollections();
    await scenario7_RenameSharedLabel();
    await scenario8_RemoveSharedLabel();

    // Edge Cases
    await edgeCase1_DuplicateLabelName();
    await edgeCase2_NonExistentLabel();
    await edgeCase3_InvalidPaginationLimit();

    // Cleanup
    await cleanup();

    // Summary
    writeLine('');
    writeLine('================================================');
    writeLine('📊 Validation Summary');
    writeLine('');
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const percentage = ((passed / total) * 100).toFixed(1);

    writeLine(`Total: ${passed}/${total} scenarios passed (${percentage}%)`);
    writeLine('');
    writeLine('Failed scenarios:');
    const failed = results.filter(r => !r.passed);
    if (failed.length === 0) {
      writeLine('   ✅ All scenarios passed!');
    } else {
      failed.forEach(r => {
        writeLine(`   ❌ ${r.scenario}: ${r.message}`);
      });
    }

    process.exit(failed.length === 0 ? 0 : 1);
  } catch (error: any) {
    writeErrorLine('');
    writeErrorLine(`❌ Fatal error: ${error.message}`);
    process.exit(1);
  }
}

main();
