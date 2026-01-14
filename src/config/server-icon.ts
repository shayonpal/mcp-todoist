/**
 * Todoist MCP Server Icon
 * Base64-encoded JPEG icon for display in MCP clients
 */

import { EMBEDDED_ICON } from './embedded-icon.js';

/**
 * Server icon configuration for MCP Implementation
 */
export const SERVER_ICONS = [
  {
    src: `data:image/jpeg;base64,${EMBEDDED_ICON}`,
    mimeType: 'image/jpeg' as const,
    sizes: ['48x48'],
  },
];
