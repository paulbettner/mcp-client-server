// Log handling functions
import fs from 'fs';
import path from 'path';
import { ServerNotFoundError } from '../../common/errors.js';
import { Logger } from '../../common/logger.js';
import { getServerProcess } from './process.js';
import { GetLogsInput, GetLogsResponse } from '../../types/schemas.js';

/**
 * Get logs from a server
 */
export async function getServerLogs(input: GetLogsInput): Promise<GetLogsResponse> {
  const { server_name, lines } = input;
  
  try {
    // Make sure server exists
    getServerProcess(server_name);
    
    // Read log file
    const logDir = path.join(process.cwd(), 'logs');
    const logFile = path.join(logDir, `${server_name}.log`);
    
    if (!fs.existsSync(logFile)) {
      return {
        logs: `No logs found for server '${server_name}'`
      };
    }
    
    // Read the last N lines from log file
    const logs = await readLastLines(logFile, lines);
    
    return {
      logs
    };
  } catch (error) {
    Logger.error(`Error getting logs for server '${server_name}':`, error);
    
    if (error instanceof ServerNotFoundError) {
      throw error;
    }
    
    return {
      logs: "",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Read last N lines from a file
 */
export async function readLastLines(filePath: string, lineCount: number): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const lines: string[] = [];
      
      // Create read stream with high water mark to avoid loading too much at once
      const stream = fs.createReadStream(filePath, {
        encoding: 'utf-8',
        highWaterMark: 1024  // 1KB chunks
      });
      
      let buffer = '';
      
      stream.on('data', (chunk) => {
        buffer += chunk.toString();
        const linesToAdd = buffer.split('\n');
        buffer = linesToAdd.pop() || '';
        
        lines.push(...linesToAdd);
        
        // Keep only the last N+1 lines (accounting for potential incomplete line in buffer)
        if (lines.length > lineCount) {
          lines.splice(0, lines.length - lineCount);
        }
      });
      
      stream.on('end', () => {
        // Add any remaining content in buffer
        if (buffer.length > 0) {
          lines.push(buffer);
        }
        
        // Return the last N lines
        resolve(lines.slice(-lineCount).join('\n'));
      });
      
      stream.on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Create log stream for server process
 */
export function setupLogStream(serverName: string): fs.WriteStream {
  // Set up logging
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const logFile = path.join(logDir, `${serverName}.log`);
  return fs.createWriteStream(logFile, { flags: 'a' });
}