/**
 * Batch operations handler with temp ID management
 * Handles Todoist sync API batch operations with dependency resolution
 */

import { TodoistApiService } from './todoist-api.js';
import {
  BatchOperationResult,
  BatchOperationError,
  TodoistAPIError,
  TodoistErrorCode,
} from '../types/errors.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Batch command types supported by Todoist sync API
 */
export type BatchCommandType =
  | 'item_add'
  | 'item_update'
  | 'item_delete'
  | 'item_complete'
  | 'item_uncomplete'
  | 'project_add'
  | 'project_update'
  | 'project_delete'
  | 'project_archive'
  | 'section_add'
  | 'section_update'
  | 'section_delete';

/**
 * Batch command structure for Todoist sync API
 */
export interface BatchCommand {
  type: BatchCommandType;
  temp_id?: string;
  uuid: string;
  args: Record<string, any>;
}

/**
 * Dependency relationship between commands
 */
interface CommandDependency {
  commandIndex: number;
  dependsOn: string; // temp_id that this command depends on
  field: string; // field name that will be resolved
}

/**
 * Batch operation request with dependency tracking
 */
export interface BatchOperationRequest {
  commands: BatchCommand[];
  dependencies?: CommandDependency[];
  options?: {
    continueOnError?: boolean;
    validateOnly?: boolean;
    timeout?: number;
  };
}

/**
 * Batch operations service for managing complex multi-command operations
 */
export class BatchOperationsService {
  private readonly apiService: TodoistApiService;
  private readonly maxBatchSize = 100; // Todoist API limit

  constructor(apiService: TodoistApiService) {
    this.apiService = apiService;
  }

  /**
   * Execute a batch of commands with dependency resolution
   */
  async executeBatch(
    request: BatchOperationRequest
  ): Promise<BatchOperationResult> {
    const { commands, dependencies = [], options = {} } = request;

    // Validate batch size
    if (commands.length === 0) {
      throw new TodoistAPIError(
        TodoistErrorCode.VALIDATION_ERROR,
        'Batch cannot be empty',
        {},
        false
      );
    }

    if (commands.length > this.maxBatchSize) {
      throw new TodoistAPIError(
        TodoistErrorCode.VALIDATION_ERROR,
        `Batch size exceeds maximum of ${this.maxBatchSize} commands`,
        { provided: commands.length, maximum: this.maxBatchSize },
        false
      );
    }

    // Generate UUIDs for commands that don't have them
    const processedCommands = this.ensureCommandUUIDs(commands);

    // Validate dependencies
    this.validateDependencies(processedCommands, dependencies);

    // Sort commands by dependencies
    const sortedCommands = this.resolveDependencyOrder(
      processedCommands,
      dependencies
    );

    if (options.validateOnly) {
      return {
        success: true,
        completed_commands: sortedCommands.length,
        failed_commands: 0,
        errors: [],
        temp_id_mapping: {},
      };
    }

    try {
      // Execute the batch via Todoist sync API
      const syncResponse = await this.apiService.sync(sortedCommands);
      return this.processSyncResponse(
        syncResponse,
        sortedCommands,
        options.continueOnError
      );
    } catch (error) {
      return this.handleBatchError(error, sortedCommands);
    }
  }

  /**
   * Create a batch operation builder for fluent API
   */
  createBatch(): BatchBuilder {
    return new BatchBuilder(this);
  }

  /**
   * Helper methods for common batch operations
   */

  /**
   * Create a project with tasks and sections in one batch
   */
  async createProjectWithStructure(
    projectData: any,
    sections: any[] = [],
    tasks: any[] = []
  ): Promise<BatchOperationResult> {
    const batch = this.createBatch();

    // Add project
    const projectTempId = batch.addProject(projectData);

    // Add sections
    const sectionTempIds: string[] = [];
    for (const sectionData of sections) {
      const sectionTempId = batch.addSection({
        ...sectionData,
        project_id: projectTempId,
      });
      sectionTempIds.push(sectionTempId);
    }

    // Add tasks
    for (let i = 0; i < tasks.length; i++) {
      const taskData = tasks[i];
      const sectionId =
        taskData.section_index !== undefined
          ? sectionTempIds[taskData.section_index]
          : undefined;

      batch.addTask({
        ...taskData,
        project_id: projectTempId,
        section_id: sectionId,
      });
    }

    return batch.execute();
  }

  /**
   * Move tasks between projects/sections in batch
   */
  async moveTasks(
    taskIds: string[],
    targetProjectId: string,
    targetSectionId?: string
  ): Promise<BatchOperationResult> {
    const batch = this.createBatch();

    for (const taskId of taskIds) {
      batch.updateTask(taskId, {
        project_id: targetProjectId,
        section_id: targetSectionId,
      });
    }

    return batch.execute();
  }

  /**
   * Complete multiple tasks at once
   */
  async completeTasks(taskIds: string[]): Promise<BatchOperationResult> {
    const batch = this.createBatch();

    for (const taskId of taskIds) {
      batch.completeTask(taskId);
    }

    return batch.execute();
  }

  private ensureCommandUUIDs(commands: BatchCommand[]): BatchCommand[] {
    return commands.map(cmd => ({
      ...cmd,
      uuid: cmd.uuid || uuidv4(),
    }));
  }

  private validateDependencies(
    commands: BatchCommand[],
    dependencies: CommandDependency[]
  ): void {
    const tempIds = new Set(commands.map(cmd => cmd.temp_id).filter(Boolean));
    const commandIndices = new Set(commands.map((_, index) => index));

    for (const dep of dependencies) {
      if (!commandIndices.has(dep.commandIndex)) {
        throw new TodoistAPIError(
          TodoistErrorCode.VALIDATION_ERROR,
          `Invalid dependency: command index ${dep.commandIndex} does not exist`,
          { dependency: dep },
          false
        );
      }

      if (!tempIds.has(dep.dependsOn)) {
        throw new TodoistAPIError(
          TodoistErrorCode.VALIDATION_ERROR,
          `Invalid dependency: temp_id '${dep.dependsOn}' does not exist`,
          { dependency: dep },
          false
        );
      }
    }
  }

  private resolveDependencyOrder(
    commands: BatchCommand[],
    _dependencies: CommandDependency[]
  ): BatchCommand[] {
    // Simple topological sort for dependency resolution
    // For now, return commands in original order
    // TODO: Implement proper topological sorting if complex dependencies are needed
    return commands;
  }

  private processSyncResponse(
    syncResponse: any,
    commands: BatchCommand[],
    continueOnError: boolean = false
  ): BatchOperationResult {
    const result: BatchOperationResult = {
      success: true,
      completed_commands: 0,
      failed_commands: 0,
      errors: [],
      temp_id_mapping: {},
    };

    // Process sync token mapping
    if (syncResponse.temp_id_mapping) {
      result.temp_id_mapping = syncResponse.temp_id_mapping;
    }

    // Process command results
    if (syncResponse.sync_status) {
      for (let i = 0; i < commands.length; i++) {
        const command = commands[i];
        const status = syncResponse.sync_status[command.uuid];

        if (status === 'ok') {
          result.completed_commands++;
        } else {
          result.failed_commands++;
          result.errors.push({
            command_index: i,
            temp_id: command.temp_id,
            error: new TodoistAPIError(
              TodoistErrorCode.SYNC_ERROR,
              `Command failed: ${status}`,
              { command, status },
              false
            ).toTodoistError(),
          });

          if (!continueOnError) {
            result.success = false;
            break;
          }
        }
      }
    }

    return result;
  }

  private handleBatchError(
    error: any,
    commands: BatchCommand[]
  ): BatchOperationResult {
    const batchError: BatchOperationError = {
      command_index: -1, // Indicates batch-level error
      error:
        error instanceof TodoistAPIError
          ? error.toTodoistError()
          : new TodoistAPIError(
              TodoistErrorCode.SYNC_ERROR,
              'Batch operation failed',
              { originalError: error },
              false
            ).toTodoistError(),
    };

    return {
      success: false,
      completed_commands: 0,
      failed_commands: commands.length,
      errors: [batchError],
      temp_id_mapping: {},
    };
  }
}

/**
 * Fluent builder for batch operations
 */
export class BatchBuilder {
  private commands: BatchCommand[] = [];
  private dependencies: CommandDependency[] = [];
  private tempIdCounter = 0;

  constructor(private batchService: BatchOperationsService) {}

  /**
   * Add a task creation command
   */
  addTask(taskData: any): string {
    const tempId = this.generateTempId('task');
    this.commands.push({
      type: 'item_add',
      temp_id: tempId,
      uuid: uuidv4(),
      args: taskData,
    });
    return tempId;
  }

  /**
   * Update an existing task
   */
  updateTask(taskId: string, updates: any): this {
    this.commands.push({
      type: 'item_update',
      uuid: uuidv4(),
      args: { id: taskId, ...updates },
    });
    return this;
  }

  /**
   * Delete a task
   */
  deleteTask(taskId: string): this {
    this.commands.push({
      type: 'item_delete',
      uuid: uuidv4(),
      args: { id: taskId },
    });
    return this;
  }

  /**
   * Complete a task
   */
  completeTask(taskId: string): this {
    this.commands.push({
      type: 'item_complete',
      uuid: uuidv4(),
      args: { id: taskId },
    });
    return this;
  }

  /**
   * Add a project creation command
   */
  addProject(projectData: any): string {
    const tempId = this.generateTempId('project');
    this.commands.push({
      type: 'project_add',
      temp_id: tempId,
      uuid: uuidv4(),
      args: projectData,
    });
    return tempId;
  }

  /**
   * Update an existing project
   */
  updateProject(projectId: string, updates: any): this {
    this.commands.push({
      type: 'project_update',
      uuid: uuidv4(),
      args: { id: projectId, ...updates },
    });
    return this;
  }

  /**
   * Add a section creation command
   */
  addSection(sectionData: any): string {
    const tempId = this.generateTempId('section');
    this.commands.push({
      type: 'section_add',
      temp_id: tempId,
      uuid: uuidv4(),
      args: sectionData,
    });
    return tempId;
  }

  /**
   * Update an existing section
   */
  updateSection(sectionId: string, updates: any): this {
    this.commands.push({
      type: 'section_update',
      uuid: uuidv4(),
      args: { id: sectionId, ...updates },
    });
    return this;
  }

  /**
   * Execute the batch
   */
  async execute(options?: {
    continueOnError?: boolean;
  }): Promise<BatchOperationResult> {
    return this.batchService.executeBatch({
      commands: this.commands,
      dependencies: this.dependencies,
      options,
    });
  }

  /**
   * Get the current batch size
   */
  size(): number {
    return this.commands.length;
  }

  /**
   * Clear all commands
   */
  clear(): this {
    this.commands = [];
    this.dependencies = [];
    this.tempIdCounter = 0;
    return this;
  }

  private generateTempId(type: string): string {
    return `temp_${type}_${++this.tempIdCounter}_${Date.now()}`;
  }
}
