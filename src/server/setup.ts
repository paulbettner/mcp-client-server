// Server setup functions
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Logger } from '../common/logger.js';
import { getServerConfig, getServerCapabilities } from '../tools/definitions.js';
import { handleListTools, handleToolCall } from '../tools/handlers.js';

/**
 * Create and configure the MCP server
 */
export function createServer(): Server {
  // Create MCP server instance with configuration
  const server = new Server(
    getServerConfig(),
    getServerCapabilities()
  );

  // Set up request handlers
  setupRequestHandlers(server);
  
  return server;
}

/**
 * Set up request handlers for the server
 */
function setupRequestHandlers(server: Server): void {
  // Handle listing tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return handleListTools();
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(name, args);
  });
}

/**
 * Start the MCP server
 */
export async function startServer(server: Server): Promise<void> {
  try {
    Logger.info('Starting MCP Test Client...');
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    Logger.info('MCP Test Client running on stdio');
  } catch (error) {
    Logger.error('Failed to start server:', error);
    process.exit(1);
  }
}