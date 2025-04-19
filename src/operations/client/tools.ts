// Tool execution functionality
import { ToolCallError } from '../../common/errors.js';
import { Logger } from '../../common/logger.js';
import { CallToolInput, CallToolResponse } from '../../types/schemas.js';
import { getClient } from './connection.js';

/**
 * Call a tool on a server
 */
export async function callTool(input: CallToolInput): Promise<CallToolResponse> {
  const { server_name, tool_name, arguments: args } = input;
  const startTime = Date.now();
  
  try {
    // Get client for this server
    const client = await getClient(server_name);
    
    // Call the tool
    Logger.debug(`Calling tool '${tool_name}' on server '${server_name}'`, args);
    const response = await client.callTool({
      name: tool_name, 
      arguments: args
    });
    
    const duration = Date.now() - startTime;
    Logger.debug(`Tool call completed in ${duration}ms`, response);
    
    // Extract the result from the response
    let result = response;
    
    // Handle different response formats
    if (response && response.content && Array.isArray(response.content)) {
      // Handle standard MCP response format
      const textContent = response.content.find((item: any) => item.type === 'text');
      if (textContent && textContent.text) {
        try {
          // Try to parse JSON from text content
          result = JSON.parse(textContent.text);
        } catch (e) {
          // If not valid JSON, use the text directly
          result = textContent.text;
        }
      }
    }
    
    return {
      result,
      duration_ms: duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.error(`Error calling tool '${tool_name}' on server '${server_name}':`, error);
    
    return {
      result: null,
      error: error instanceof Error ? error.message : String(error),
      duration_ms: duration
    };
  }
}

/**
 * List tools available on a server
 */
export async function listTools(serverName: string): Promise<string[]> {
  try {
    // Get client for this server
    const client = await getClient(serverName);
    
    // List tools
    Logger.debug(`Listing tools for server '${serverName}'`);
    const response = await client.listTools();
    
    // Debug the response
    Logger.debug(`Tool list response:`, response);
    
    // Extract tools from the response
    let tools = response?.tools || [];
    
    // Debug the extracted tools
    Logger.debug(`Extracted ${tools.length} tools from response`);
    
    return tools.map((tool: { name: string }) => tool.name);
  } catch (error) {
    Logger.error(`Error listing tools for server '${serverName}':`, error);
    throw new ToolCallError(
      serverName,
      'listTools',
      error instanceof Error ? error.message : String(error)
    );
  }
}