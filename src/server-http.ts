#!/usr/bin/env node

import { createServer } from 'http';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { parse } from 'url';
import { createServerInstance } from './server/impl.js';
import { logger } from './middleware/logging.js';

const PORT = parseInt(process.env.PORT || '3000', 10);

// Create HTTP server for MCP over SSE
const httpServer = createServer(async (req, res) => {
  const parsedUrl = parse(req.url || '', true);

  // Health check endpoint
  if (parsedUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
    return;
  }

  // MCP endpoint
  if (parsedUrl.pathname === '/mcp' || parsedUrl.pathname === '/sse') {
    // Extract configuration from query parameters
    const config = parsedUrl.query;

    // Set TODOIST_API_TOKEN from config if provided
    if (config.TODOIST_API_TOKEN && typeof config.TODOIST_API_TOKEN === 'string') {
      process.env.TODOIST_API_TOKEN = config.TODOIST_API_TOKEN;
    }

    logger.info('MCP SSE connection request', {
      path: parsedUrl.pathname,
      hasToken: !!process.env.TODOIST_API_TOKEN,
    });

    // Create SSE transport
    const transport = new SSEServerTransport('/mcp', res);

    // Create server instance
    const server = createServerInstance();

    // Connect transport to server
    await server.connect(transport);

    // Handle connection close
    req.on('close', () => {
      logger.info('MCP SSE connection closed');
      transport.close();
    });

    return;
  }

  // 404 for other paths
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    error: 'Not found',
    availableEndpoints: {
      '/mcp': 'MCP SSE endpoint',
      '/health': 'Health check'
    }
  }));
});

httpServer.listen(PORT, () => {
  logger.info(`MCP HTTP server listening`, {
    port: PORT,
    endpoints: {
      mcp: `/mcp`,
      health: `/health`
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});
