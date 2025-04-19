// Client connection management
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ToolCallError } from '../../common/errors.js';
import { Logger } from '../../common/logger.js';
import { getServerProcess } from '../docker/index.js';
import { connectedClients, removeClientFromCache } from './cache.js';
import { ProcessTransport } from './transport.js';

/**
 * Get or create a client for a server
 */
export async function getClient(serverName: string): Promise<Client> {
  // Check if we already have a connected client
  if (connectedClients.has(serverName)) {
    Logger.debug(`Found existing client for server '${serverName}'`);
    
    try {
      // Get the server process to confirm it's still running
      const serverProcess = getServerProcess(serverName);
      
      // Additional validation to ensure the server is still alive and responsive
      if (!serverProcess.process || serverProcess.process.killed) {
        throw new Error(`Server process for ${serverName} is not active`);
      }
      
      // Get the cached client
      const cachedClient = connectedClients.get(serverName)!;
      
      // Verify the connection is still healthy with a ping
      if (await verifyConnection(cachedClient, serverName)) {
        Logger.debug(`Connection to server '${serverName}' is healthy, reusing client`);
        return cachedClient;
      } else {
        // Health check failed, create new connection
        removeClientFromCache(serverName);
      }
    } catch (error) {
      // Server process no longer exists or is not running
      Logger.warn(`Cached client exists for server '${serverName}', but server is not available: ${error instanceof Error ? error.message : String(error)}`);
      removeClientFromCache(serverName);
      // Continue with creating a new client
    }
  }
  
  return createNewClient(serverName);
}

/**
 * Verify if a connection is still healthy
 */
async function verifyConnection(client: Client, serverName: string): Promise<boolean> {
  Logger.debug(`Verifying connection health for client '${serverName}'...`);
  
  try {
    // Set a timeout for the health check
    const timeoutPromise = new Promise<boolean>((_, reject) => {
      setTimeout(() => reject(new Error('Connection health check timed out')), 1000);
    });
    
    // Try to list tools quickly as a health check
    const healthCheckPromise = client.listTools()
      .then(() => true)
      .catch(() => false);
    
    // Race the health check against the timeout
    return await Promise.race([healthCheckPromise, timeoutPromise]);
  } catch (healthError) {
    // Health check failed - server might be unresponsive
    Logger.warn(`Client for '${serverName}' failed health check: ${healthError instanceof Error ? healthError.message : String(healthError)}`);
    return false;
  }
}

/**
 * Create a new client for a server
 */
async function createNewClient(serverName: string): Promise<Client> {
  try {
    // Get the server process
    const server = getServerProcess(serverName);
    
    // Create transport for the server process
    const transport = new ProcessTransport(server);
    
    // Create the client
    const client = new Client({
      name: `test-client-${serverName}`,
      version: '0.1.0',
      transport
    });
    
    // Connect to the server
    Logger.debug(`Creating new connection to server '${serverName}'...`);
    await client.connect(transport);
    Logger.debug(`Successfully connected to server '${serverName}'`);
    
    // Cache the client for future use
    connectedClients.set(serverName, client);
    
    return client;
  } catch (error) {
    Logger.error(`Error creating client for server '${serverName}':`, error);
    throw new ToolCallError(
      serverName,
      'connect',
      error instanceof Error ? error.message : String(error)
    );
  }
}