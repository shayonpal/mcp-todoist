#!/usr/bin/env node

/**
 * Vercel serverless function for MCP HTTP transport
 * Handles MCP protocol messages over HTTP POST requests
 */

import { getServer } from '../src/server.js';
import { randomUUID } from 'crypto';

/**
 * Vercel serverless function handler
 * Accepts POST requests with MCP protocol messages
 */
export async function POST(request: Request): Promise<Response> {
  try {
    // Get or create session ID from header
    const sessionId = getOrCreateSessionId(request);

    // Get server instance
    const server = getServer();

    // Parse request body
    const body = (await request.json()) as { id?: number | string };

    // For now, return a placeholder response
    // We'll integrate StreamableHTTPServerTransport in next task
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: body.id || 1,
        result: { message: 'HTTP transport placeholder' },
      }),
      {
        status: 200,
        headers: {
          'mcp-session-id': sessionId,
          'content-type': 'application/json',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
        },
      }),
      {
        status: 500,
        headers: {
          'content-type': 'application/json',
        },
      }
    );
  }
}

/**
 * Get existing session ID or create new one
 */
function getOrCreateSessionId(request: Request): string {
  const sessionId = request.headers.get('mcp-session-id');

  if (sessionId && isValidSessionId(sessionId)) {
    return sessionId;
  }

  return randomUUID();
}

/**
 * Validate session ID is a valid UUID
 */
function isValidSessionId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id
  );
}
