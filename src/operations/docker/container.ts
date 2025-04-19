// Server container management
import Dockerode from 'dockerode';
import { DockerConnectionError, ServerNotFoundError } from '../../common/errors.js';
import { Logger } from '../../common/logger.js';
import { 
  ListServersInput, 
  ServerInfo, 
  ServerOperationInput, 
  ServerOperationResponse 
} from '../../types/schemas.js';
import { removeClientFromCache } from '../client/index.js';
import { CONTAINER_PREFIX, runningServers, getServerProcess } from './process.js';

// Initialize Docker client
const docker = new Dockerode({
  socketPath: process.env.DOCKER_HOST || '/var/run/docker.sock'
});

/**
 * List running servers
 */
export async function listServers(input: ListServersInput): Promise<ServerInfo[]> {
  try {
    return Array.from(runningServers.entries()).map(([name, server]) => {
      return {
        name,
        id: `${CONTAINER_PREFIX}${name}`,
        status: 'running',
        source_path: server.source_path,
        deployed_at: server.deployed_at.toISOString()
      };
    });
  } catch (error) {
    Logger.error('Error listing servers:', error);
    throw new DockerConnectionError(
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Stop a server
 */
export async function stopServer(input: ServerOperationInput): Promise<ServerOperationResponse> {
  const { server_name } = input;
  
  try {
    // Even if the server process doesn't exist, still clean up any cached client
    if (!runningServers.has(server_name)) {
      // Server might not be running, but there could be a cached client
      removeClientFromCache(server_name);
      return {
        name: server_name,
        status: 'stopped'
      };
    }
    
    const server = getServerProcess(server_name);
    
    // Kill the process
    server.process.kill();
    
    // Remove from running servers
    runningServers.delete(server_name);
    
    // Clean up any cached clients for this server
    removeClientFromCache(server_name);
    
    // Wait a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 200));
    
    return {
      name: server_name,
      status: 'stopped'
    };
  } catch (error) {
    Logger.error(`Error stopping server '${server_name}':`, error);
    
    // Attempt to clean up cached client even if server process handling fails
    try {
      removeClientFromCache(server_name);
    } catch (clientError) {
      Logger.warn(`Error cleaning up client for ${server_name}:`, clientError);
    }
    
    if (error instanceof ServerNotFoundError) {
      // Return success anyway, since the goal was to stop the server
      // and it's not running (which is the desired state)
      return {
        name: server_name,
        status: 'stopped'
      };
    }
    
    throw new Error(
      error instanceof Error ? error.message : String(error)
    );
  }
}