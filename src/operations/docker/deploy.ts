// Server deployment functions
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ServerDeploymentError } from '../../common/errors.js';
import { Logger } from '../../common/logger.js';
import { 
  DeployServerInput, 
  DeployServerResponse 
} from '../../types/schemas.js';
import { removeClientFromCache } from '../client/index.js';
import { CONTAINER_PREFIX, runningServers, terminateProcess } from './process.js';
import { setupLogStream } from './logs.js';

/**
 * Deploy a server
 */
export async function deployServer(input: DeployServerInput): Promise<DeployServerResponse> {
  const { name, source_path, env_vars, persistent } = input;
  const containerId = `${CONTAINER_PREFIX}${name}`;
  
  try {
    // Validate source path
    validateSourcePath(source_path);
    
    // Always clean up any cached clients for this server name first
    removeClientFromCache(name);
    
    // If a server with this name already exists, we need to fully stop it first
    if (runningServers.has(name)) {
      Logger.info(`Server with name '${name}' is already running. Forcefully stopping it before redeployment.`);
      await terminateProcess(name);
    }
    
    // Get start command from package.json
    const startCommand = determineStartCommand(source_path);
    
    // Set up environment variables
    const environment = prepareEnvironmentVariables(env_vars);
    
    // Start the server process
    Logger.info(`Starting server '${name}' from ${source_path}`);
    const serverProcess = spawn('sh', ['-c', startCommand], {
      cwd: source_path,
      env: environment,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Set up logging
    const logStream = setupLogStream(name);
    serverProcess.stdout.pipe(logStream);
    serverProcess.stderr.pipe(logStream);
    
    // Store server process information
    const deployedAt = new Date();
    runningServers.set(name, {
      process: serverProcess,
      stdin: serverProcess.stdin,
      stdout: serverProcess.stdout,
      name,
      source_path,
      deployed_at: deployedAt
    });
    
    // Handle process exit
    serverProcess.on('exit', (code) => {
      Logger.info(`Server '${name}' exited with code ${code}`);
      
      // If not persistent, remove from running servers
      if (!persistent) {
        runningServers.delete(name);
      }
    });
    
    // Give server time to initialize
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    return {
      name,
      id: containerId,
      status: 'running'
    };
  } catch (error) {
    Logger.error(`Error deploying server '${name}':`, error);
    
    if (error instanceof ServerDeploymentError) {
      throw error;
    }
    
    throw new ServerDeploymentError(
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Validate the source path for a server
 */
function validateSourcePath(sourcePath: string): void {
  // Check if source path exists
  if (!fs.existsSync(sourcePath)) {
    throw new ServerDeploymentError(`Source path not found: ${sourcePath}`);
  }
  
  // Check if package.json exists
  const packageJsonPath = path.join(sourcePath, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new ServerDeploymentError(`package.json not found in ${sourcePath}`);
  }
}

/**
 * Determine the start command from package.json
 */
function determineStartCommand(sourcePath: string): string {
  const packageJsonPath = path.join(sourcePath, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  
  // Default command
  let startCommand = 'node dist/index.js';
  
  // Use start script if available
  if (packageJson.scripts && packageJson.scripts.start) {
    startCommand = 'npm run start';
  }
  
  return startCommand;
}

/**
 * Prepare environment variables for the server
 */
function prepareEnvironmentVariables(envVars?: Record<string, string>): Record<string, string> {
  const environment: Record<string, string> = {};
  
  // Add current environment, filtering out undefined values
  if (process.env) {
    Object.entries(process.env).forEach(([key, value]) => {
      if (value !== undefined) {
        environment[key] = value;
      }
    });
  }
  
  // Add provided environment variables
  if (envVars) {
    Object.entries(envVars).forEach(([key, value]) => {
      environment[key] = value;
    });
  }
  
  return environment;
}