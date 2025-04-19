// Process transport implementation
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { Logger } from '../../common/logger.js';
import { getServerProcess } from '../docker/index.js';

/**
 * Custom Transport implementation for process communication
 */
export class ProcessTransport implements Transport {
  private messageBuffer = '';
  private isConnected = false;
  private exitHandler: any;
  
  constructor(private server: ReturnType<typeof getServerProcess>) {}
  
  async start(): Promise<void> {
    try {
      // Check if the server process is still running
      if (!this.server.process || this.server.process.killed) {
        throw new Error(`Server process for ${this.server.name} is not active`);
      }
      
      // Set up data handler for stdout
      this.server.stdout.on('data', (data: Buffer) => {
        this.handleData(data.toString());
      });
      
      // Handle process exit
      this.exitHandler = (code: number) => {
        this.isConnected = false;
        Logger.warn(`Server process for ${this.server.name} exited with code ${code}`);
        if (this.onclose) {
          this.onclose();
        }
      };
      
      this.server.process.on('exit', this.exitHandler);
      
      // Also handle errors
      this.server.process.on('error', (err) => {
        this.isConnected = false;
        Logger.error(`Server process error for ${this.server.name}:`, err);
        if (this.onerror) {
          this.onerror(err);
        }
      });
      
      this.isConnected = true;
      return Promise.resolve();
    } catch (error) {
      this.isConnected = false;
      Logger.error(`Failed to start transport for ${this.server.name}:`, error);
      return Promise.reject(error);
    }
  }
  
  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.isConnected || !this.server.stdin.writable) {
      const err = new Error(`Cannot send message to ${this.server.name}: transport not connected`);
      if (this.onerror) {
        this.onerror(err);
      }
      return Promise.reject(err);
    }
    
    try {
      // Send message to server's stdin
      this.server.stdin.write(JSON.stringify(message) + '\n');
      return Promise.resolve();
    } catch (error) {
      this.isConnected = false;
      if (this.onerror && error instanceof Error) {
        this.onerror(error);
      }
      return Promise.reject(error);
    }
  }
  
  async close(): Promise<void> {
    try {
      // Remove event listeners to prevent memory leaks
      if (this.exitHandler && this.server.process) {
        this.server.process.removeListener('exit', this.exitHandler);
      }
      
      // Try to gracefully end the process, but only if this transport created it
      if (this.server.process && !this.server.process.killed) {
        this.server.process.kill();
      }
    } catch (error) {
      Logger.warn(`Error during transport close for ${this.server.name}:`, error);
    } finally {
      this.isConnected = false;
      if (this.onclose) {
        this.onclose();
      }
    }
    
    return Promise.resolve();
  }
  
  private handleData(data: string): void {
    // Add data to buffer
    this.messageBuffer += data;
    
    // Process complete messages
    let messageEndIndex;
    while ((messageEndIndex = this.messageBuffer.indexOf('\n')) !== -1) {
      const messageStr = this.messageBuffer.slice(0, messageEndIndex);
      this.messageBuffer = this.messageBuffer.slice(messageEndIndex + 1);
      
      if (messageStr.trim()) {
        try {
          const message = JSON.parse(messageStr) as JSONRPCMessage;
          
          // Call message handler if available
          if (this.onmessage) {
            this.onmessage(message);
          }
        } catch (error) {
          Logger.error('Error parsing message:', error);
          if (this.onerror && error instanceof Error) {
            this.onerror(error);
          }
        }
      }
    }
  }
  
  // These will be set by the Client
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;
}