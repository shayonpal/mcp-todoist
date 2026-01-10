#!/usr/bin/env node

/**
 * Vercel serverless function for MCP HTTP transport
 * Handles MCP protocol messages over HTTP POST requests
 */

import { getServer } from '../src/server.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

/**
 * Vercel serverless function handler
 * Accepts POST requests with MCP protocol messages
 */
export async function POST(request: Request): Promise<Response> {
  try {
    // Get server wrapper and underlying MCP Server instance
    const serverWrapper = getServer();
    const server = await serverWrapper.getServerInstance();

    // Create stateless transport (perfect for serverless environments)
    // sessionIdGenerator: undefined enables stateless mode
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode for serverless deployment
      enableJsonResponse: true, // Return JSON responses instead of SSE
    });

    // Connect server to transport
    await server.connect(transport);

    // Parse request body for handleRequest
    const parsedBody = await request.json();

    // Handle the request and get response
    const response = await transport.handleRequest(request, { parsedBody });

    // Close transport after handling request (stateless per-request model)
    await transport.close();

    return response;
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
