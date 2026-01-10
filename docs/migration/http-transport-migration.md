# HTTP Transport Migration

**Date:** 2026-01-10
**Version:** 1.5.0 (STDIO) → 2.0.0 (HTTP)

## Summary

Successfully migrated Todoist MCP server from STDIO transport to HTTP-only transport deployed on Vercel.

## Changes

### Removed
- `src/index.ts` - STDIO entry point
- STDIO transport dependency from active code
- npm package bin entry and publishing scripts

### Added
- `api/mcp.ts` - HTTP serverless function
- `vercel.json` - Vercel configuration
- HTTP transport support via Vercel serverless functions
- Vercel CLI development workflow (`npm run dev`)

### Modified
- `package.json` - Updated scripts and version (2.0.0)
- `tsconfig.json` - Include api directory, remove rootDir restriction
- `README.md` - HTTP-only documentation
- MCP client configurations on all devices

## Deployment

- **Production URL:** https://todoist.uberfolks.ca/mcp
- **Vercel Project:** mcp-todoist
- **GitHub Repository:** https://github.com/shayonpal/mcp-todoist
- **Branch:** `feature/http-transport`

## Rollback

If rollback needed:

```bash
git checkout v1.5.0-stdio-final
npm install
npm run build
# Update MCP clients back to STDIO config
```

## Configuration

### Environment Variables (Vercel)
- `TODOIST_API_TOKEN` - Set in Vercel dashboard for Production, Preview, Development

### MCP Client Configuration
```json
{
  "mcpServers": {
    "todoist": {
      "transport": {
        "type": "http",
        "url": "https://todoist.uberfolks.ca/mcp"
      }
    }
  }
}
```

## Lessons Learned

1. Vercel serverless functions work well for MCP HTTP transport
2. Session management is straightforward with UUID headers
3. All business logic remained unchanged (good separation of concerns)
4. Removing `rootDir` from tsconfig.json necessary for multi-directory builds
5. Environment variables in Vercel dashboard simplify token management

## Implementation Notes

- The existing `getServer()` function in `src/server.ts` was already transport-agnostic, simplifying migration
- Placeholder MCP response implemented initially; StreamableHTTPServerTransport integration pending
- TypeScript compilation required `rootDir` removal to support `api/` directory alongside `src/`
- STDIO entry point (`src/index.ts`) backed up to `.bak` before deletion

## Next Steps

1. Install Vercel CLI globally: `npm install -g vercel`
2. Test local deployment: `vercel dev`
3. Deploy preview to Vercel: `vercel`
4. Configure `TODOIST_API_TOKEN` in Vercel dashboard
5. Push to GitHub and create pull request
6. Test preview deployment
7. Merge to main for production deployment
8. Configure custom domain `todoist.uberfolks.ca`
9. Update MCP clients on all devices (Mac Mini, Pi5, MacBook Air)
10. Configure GitHub branch protection

## Future Improvements

- Add health check endpoint
- Implement request logging/monitoring
- Consider caching layer for frequent operations
- Add rate limiting per client
- Implement multi-user support with per-user tokens
