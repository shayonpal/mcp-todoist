#!/usr/bin/env node

/**
 * Main entry point for the Todoist MCP Server
 */

import { getServer } from './server.js';
import { logger } from './middleware/logging.js';
import { validateConfig } from './config/index.js';

async function main() {
  try {
    // Validate configuration before starting
    const configValidation = validateConfig();
    if (!configValidation.valid) {
      logger.error('Configuration validation failed', {
        errors: configValidation.errors,
        warnings: configValidation.warnings,
      });
      process.exit(1);
    }

    // Log warnings if any
    if (configValidation.warnings.length > 0) {
      logger.warn('Configuration warnings', {
        warnings: configValidation.warnings,
      });
    }

    // Start the server
    const server = getServer();
    await server.run();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      const server = getServer();
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      const server = getServer();
      await server.stop();
      process.exit(0);
    });

    process.on('uncaughtException', error => {
      logger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start Todoist MCP Server', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Run the server if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

const server = getServer();

export { server, getServer };
export * from './types/todoist.js';
export * from './types/errors.js';
