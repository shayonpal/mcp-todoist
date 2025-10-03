#!/usr/bin/env node

import { getServer } from './server.js';
import { logger } from './middleware/logging.js';

(async () => {
  try {
    await getServer().run();
  } catch (error) {
    logger.error('Failed to start Todoist MCP Server', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    // eslint-disable-next-line no-console -- ensure fatal startup errors reach STDERR when logger is unavailable
    console.error('Failed to start Todoist MCP Server', error);
    process.exit(1);
  }
})();
