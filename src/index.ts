#!/usr/bin/env node

// Import server setup
import { createServer, startServer } from './server/setup.js';
import { Logger } from './common/logger.js';

// Initialize logger
Logger.init();

// Create MCP server instance
const server = createServer();

// Start the server
async function main() {
  try {
    await startServer(server);
  } catch (error) {
    Logger.error('Fatal error in main():', error);
    process.exit(1);
  }
}

main().catch((error) => {
  Logger.error('Fatal error in main():', error);
  process.exit(1);
});