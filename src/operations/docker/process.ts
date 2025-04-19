// Server process management
import { spawn } from 'child_process';
import { ServerNotFoundError } from '../../common/errors.js';
import { Logger } from '../../common/logger.js';

// Container name prefix to avoid conflicts
export const CONTAINER_PREFIX = 'mcp-test-';

// Storage for running server processes
export interface ServerProcess {
  process: ReturnType<typeof spawn>;
  stdin: NodeJS.WritableStream;
  stdout: NodeJS.ReadableStream;
  name: string;
  source_path: string;
  deployed_at: Date;
}

// Map of running server processes by name
export const runningServers = new Map<string, ServerProcess>();

/**
 * Get server process by name
 */
export function getServerProcess(name: string): ServerProcess {
  const server = runningServers.get(name);
  if (!server) {
    throw new ServerNotFoundError(name);
  }
  return server;
}

/**
 * Terminate a server process
 */
export async function terminateProcess(name: string): Promise<void> {
  try {
    // Get the existing server
    const existingServer = getServerProcess(name);
    
    // Try graceful termination first (SIGTERM)
    existingServer.process.kill('SIGTERM');
    
    // Remove from running servers map immediately to prevent any access attempts
    runningServers.delete(name);
    
    // Wait for process to terminate gracefully
    await new Promise<void>((resolve) => {
      // Set a timeout for graceful shutdown
      const forceKillTimeout = setTimeout(() => {
        try {
          // Force kill if still running (SIGKILL)
          if (!existingServer.process.killed) {
            Logger.warn(`Server '${name}' did not terminate gracefully, forcing kill...`);
            existingServer.process.kill('SIGKILL');
          }
        } catch (forceError) {
          Logger.warn(`Error during force kill of server '${name}':`, forceError);
        }
        resolve();
      }, 1000); // Wait 1 second before force killing
      
      // If process exits naturally, clear timeout and resolve
      existingServer.process.once('exit', () => {
        clearTimeout(forceKillTimeout);
        Logger.debug(`Server '${name}' process exited successfully`);
        resolve();
      });
    });
    
    // Additional wait time to ensure OS resources are fully released
    Logger.debug(`Waiting for system resources to be fully released for server '${name}'...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    Logger.info(`Server '${name}' has been fully terminated.`);
  } catch (error) {
    Logger.warn(`Error during termination of server '${name}':`, error);
    // Even if there was an error, wait a bit longer to be safe
    await new Promise(resolve => setTimeout(resolve, 1000));
    Logger.info(`Proceeding after termination attempt.`);
  }
}