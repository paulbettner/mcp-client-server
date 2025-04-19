// MCP server request handlers
import { Logger } from '../common/logger.js';
import { MCPTestError } from '../common/errors.js';
import { deployServer, listServers, getServerLogs, stopServer } from '../operations/docker/index.js';
import { callTool, runTests, clearClientCache } from '../operations/client/index.js';
import {
  DeployServerSchema,
  CallToolSchema,
  GetLogsSchema,
  ListServersSchema,
  RunTestsSchema,
  ServerOperationSchema
} from '../types/schemas.js';

/**
 * Handle the list tools request
 */
export async function handleListTools() {
  Logger.debug('Handling list tools request');
  
  // Import tool definitions
  const { getToolDefinitions } = await import('../tools/definitions.js');
  
  return {
    tools: getToolDefinitions()
  };
}

/**
 * Handle tool call requests
 */
export async function handleToolCall(name: string, args: any) {
  Logger.debug(`Handling tool call: ${name}`, args);

  if (!args && name !== 'mcp_test_clear_connections') {
    throw new Error(`No arguments provided for tool: ${name}`);
  }

  try {
    let result;
    
    switch (name) {
      case 'mcp_test_deploy_server': {
        const input = DeployServerSchema.parse(args);
        result = await deployServer(input);
        break;
      }
      
      case 'mcp_test_call_tool': {
        const input = CallToolSchema.parse(args);
        result = await callTool(input);
        break;
      }
      
      case 'mcp_test_get_logs': {
        const input = GetLogsSchema.parse(args);
        result = await getServerLogs(input);
        break;
      }
      
      case 'mcp_test_list_servers': {
        const input = ListServersSchema.parse(args);
        result = await listServers(input);
        break;
      }
      
      case 'mcp_test_run_tests': {
        const input = RunTestsSchema.parse(args);
        result = await runTests(input);
        break;
      }
      
      case 'mcp_test_stop_server': {
        const input = ServerOperationSchema.parse(args);
        result = await stopServer(input);
        break;
      }
      
      case 'mcp_test_clear_connections': {
        clearClientCache();
        result = { success: true, message: "All client connections cleared" };
        break;
      }
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ],
      isError: false
    };
  } catch (error) {
    Logger.error(`Error executing tool ${name}:`, error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof MCPTestError ? error.name : 'InternalServerError';
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: errorMessage,
            errorType: errorName
          }, null, 2)
        }
      ],
      isError: true
    };
  }
}