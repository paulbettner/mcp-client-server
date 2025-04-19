// Tool definitions for MCP Test Client
import { VERSION } from '../common/version.js';

/**
 * Get the definitions for all tools
 */
export function getToolDefinitions() {
  return [
    {
      name: 'mcp_test_deploy_server',
      description: 'Deploy an MCP server to a test environment',
      inputSchema: {
        type: 'object',
        properties: {
          name: { 
            type: 'string',
            description: 'Name for the deployed server'
          },
          source_path: { 
            type: 'string',
            description: 'Absolute path to the server source code'
          },
          env_vars: { 
            type: 'object',
            additionalProperties: { type: 'string' },
            description: 'Environment variables to pass to the server'
          },
          persistent: { 
            type: 'boolean',
            description: 'Whether to keep the server running after tests',
            default: true
          }
        },
        required: ['name', 'source_path']
      }
    },
    {
      name: 'mcp_test_call_tool',
      description: 'Call a tool on a deployed MCP server',
      inputSchema: {
        type: 'object',
        properties: {
          server_name: { 
            type: 'string',
            description: 'Name of the deployed server to call'
          },
          tool_name: { 
            type: 'string',
            description: 'Name of the tool to call'
          },
          arguments: { 
            type: 'object',
            additionalProperties: true,
            description: 'Arguments to pass to the tool'
          }
        },
        required: ['server_name', 'tool_name', 'arguments']
      }
    },
    {
      name: 'mcp_test_get_logs',
      description: 'Get logs from a deployed MCP server',
      inputSchema: {
        type: 'object',
        properties: {
          server_name: { 
            type: 'string',
            description: 'Name of the deployed server'
          },
          lines: { 
            type: 'number',
            description: 'Number of log lines to return',
            default: 100
          }
        },
        required: ['server_name']
      }
    },
    {
      name: 'mcp_test_list_servers',
      description: 'List all deployed MCP servers',
      inputSchema: {
        type: 'object',
        properties: {
          status: { 
            type: 'string',
            enum: ['running', 'all'],
            description: 'Status of servers to list',
            default: 'running'
          }
        }
      }
    },
    {
      name: 'mcp_test_run_tests',
      description: 'Run tests against a deployed MCP server',
      inputSchema: {
        type: 'object',
        properties: {
          server_name: { 
            type: 'string',
            description: 'Name of the deployed server to test'
          },
          test_suite: { 
            type: 'string',
            description: 'Name of the test suite to run'
          },
          interactive: { 
            type: 'boolean',
            description: 'Whether to run tests interactively',
            default: false
          }
        },
        required: ['server_name']
      }
    },
    {
      name: 'mcp_test_stop_server',
      description: 'Stop a deployed MCP server',
      inputSchema: {
        type: 'object',
        properties: {
          server_name: { 
            type: 'string',
            description: 'Name of the deployed server'
          }
        },
        required: ['server_name']
      }
    },
    {
      name: 'mcp_test_clear_connections',
      description: 'Clear all cached client connections to ensure clean state',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    }
  ];
}

/**
 * Get the server configuration
 */
export function getServerConfig() {
  return {
    name: 'mcp-test-client',
    version: VERSION,
  };
}

/**
 * Get server capabilities
 */
export function getServerCapabilities() {
  return {
    capabilities: {
      tools: {},
    },
  };
}