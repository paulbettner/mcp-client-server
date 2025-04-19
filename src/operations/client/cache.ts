// Client cache management
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Logger } from '../../common/logger.js';

// Cache of connected clients by server name
export const connectedClients = new Map<string, Client>();

/**
 * Remove a client from the cache
 */
export function removeClientFromCache(serverName: string): void {
  if (connectedClients.has(serverName)) {
    const client = connectedClients.get(serverName);
    Logger.info(`Removing client for server '${serverName}' from cache`);
    
    try {
      // Attempt to close the client connection
      if (client && client.transport) {
        client.transport.close().catch(err => {
          Logger.warn(`Error closing transport for client ${serverName}:`, err);
        });
      }
    } catch (error) {
      Logger.warn(`Error during client cleanup for ${serverName}:`, error);
    } finally {
      // Remove from cache regardless of close success
      connectedClients.delete(serverName);
      Logger.debug(`Successfully removed client for server '${serverName}' from cache`);
    }
  } else {
    Logger.debug(`No cached client found for server '${serverName}'`);
  }
}

/**
 * Clear all cached clients
 */
export function clearClientCache(): void {
  const clientCount = connectedClients.size;
  if (clientCount === 0) {
    Logger.info(`No cached clients to clear`);
    return;
  }
  
  Logger.info(`Clearing client cache (${clientCount} clients)`);
  
  // Close and clean up each client
  const serverNames = Array.from(connectedClients.keys());
  for (const serverName of serverNames) {
    removeClientFromCache(serverName);
  }
  
  // Verify all clients were removed
  if (connectedClients.size > 0) {
    Logger.warn(`Failed to clear all clients. ${connectedClients.size} clients remain.`);
    // Force clear the cache as a last resort
    connectedClients.clear();
  }
  
  Logger.info(`Client cache successfully cleared (was ${clientCount} clients)`);
}