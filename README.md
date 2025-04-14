# MCP Test Client

An MCP middleware that acts as both a server (to Claude) and a client (to servers under test) for testing MCP servers during development.

## Key Takeaways for Successful MCP Server Development

1. **Version Compatibility**: Always use SDK version 1.9.0, matching exactly with the test client
2. **Tool Registration**: Register tools in both the server capabilities AND ListToolsRequestSchema handler
3. **Clean Environment**: Stop all existing servers before testing new implementations
4. **Protocol Understanding**: Use proper message structures for initialize, list_tools, and call_tool
5. **Error Handling**: Implement comprehensive error handling and logging
6. **Testing Approach**: Test directly with a test script before using the MCP test client
7. **File Operations**: Use fs-extra and fs.promises for asynchronous file operations 
8. **Type Safety**: Use TypeScript type assertions for MCP request parameters

## Architecture

The MCP Test Client has a dual role:
- It's a **server** registered with Claude that exposes tools for testing
- It's a **client** that connects to and tests other MCP servers

```
┌─────────────┐          ┌───────────────────┐          ┌────────────────┐
│             │  Tools   │                   │  Client  │                │
│   Claude    │─────────>│  MCP Test Client  │─────────>│  Server Under  │
│             │          │                   │          │     Test       │
└─────────────┘          └───────────────────┘          └────────────────┘
```

This architecture lets you test MCP servers without registering them directly with Claude.

## Features

- Deploy MCP servers to test environments
- Call individual tools with custom arguments
- Run automated test suites
- View server logs
- Test servers before formal registration with Claude

## Implementation

The MCP Test Client is implemented with:

- **Process Management**: Spawns and manages MCP server processes
- **MCP SDK Client**: Uses the official MCP SDK to communicate with servers
- **Custom Transport**: Implements a custom transport for stdio communication
- **Test Execution**: Runs tests and validates responses
- **CLI Interface**: Provides an interactive testing interface

The current implementation is Phase 1 of the design plan, with future enhancements planned for Phases 2 and 3.

## Installation

```bash
# Install dependencies
npm install

# Build the TypeScript project
npm run build
```

## Creating an MCP Server

This section provides a detailed guide for creating, implementing, and testing an MCP server using the MCP Test Client.

### Step 1: Setting Up Your Server

1. Create a new directory in `/packages/mcp/` for your server:
   ```bash
   mkdir -p /packages/mcp/mcp-your-server/{src,dist}
   ```

2. Create a basic `package.json`:
   ```json
   {
     "name": "mcp-your-server",
     "version": "0.1.0",
     "description": "MCP server for your purpose",
     "main": "dist/index.js",
     "type": "module",
     "scripts": {
       "build": "tsc",
       "start": "node dist/index.js",
       "dev": "tsc -w"
     },
     "dependencies": {
       "@modelcontextprotocol/sdk": "1.9.0",
       "fs-extra": "^11.2.0",
       "zod": "^3.24.2"
     },
     "devDependencies": {
       "@types/node": "^20.11.16",
       "typescript": "^5.3.3"
     }
   }
   ```

3. Create a `tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "NodeNext",
       "moduleResolution": "NodeNext",
       "esModuleInterop": true,
       "strict": true,
       "outDir": "dist",
       "declaration": true,
       "skipLibCheck": true,
       "forceConsistentCasingInFileNames": true
     },
     "include": ["src/**/*"],
     "exclude": ["node_modules", "dist"]
   }
   ```

### Step 2: Implementing Your MCP Server

Below is a complete, tested implementation pattern that works reliably with the MCP test client. This pattern addresses many subtle issues that can cause connectivity problems:

```typescript
#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import fs modules - use fs-extra for convenience and native promises for stats/access
import fs from 'fs-extra';
import path from 'path';
import { promises as fsPromises } from 'fs';

// Define your tools as constants for reuse
const exampleTool = {
  name: 'example_tool',
  description: 'Example tool that processes data',
  inputSchema: {
    type: 'object',
    properties: {
      param_name: { 
        type: 'string',
        description: 'Description of parameter'
      }
    },
    required: ['param_name']
  }
};

// Create the server with proper tool registration in capabilities
// IMPORTANT: This pattern of registering tools in capabilities AND
// returning them in ListToolsRequestSchema is critical for compatibility
const server = new Server(
  { 
    name: 'mcp-your-server',
    version: '0.1.0' 
  },
  { 
    capabilities: { 
      tools: {
        // Register each tool by name (must match the tool's name property)
        example_tool: exampleTool
      } 
    } 
  }
);

// Set up ListToolsRequestSchema handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.log("Handling ListToolsRequestSchema request");
  
  // Return the same tools registered in capabilities
  return {
    tools: [exampleTool]
  };
});

// Set up CallToolRequestSchema handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  console.log(`Handling tool call: ${name}`);
  
  try {
    // Validate the tool name
    if (name !== 'example_tool') {
      throw new Error(`Unknown tool: ${name}`);
    }

    // Type safety for parameters
    if (!args || !args.param_name) {
      throw new Error('param_name is required');
    }

    const paramValue = args.param_name as string;
    console.log(`Processing parameter: ${paramValue}`);
    
    // Add your tool implementation here
    const result = {
      status: "success",
      processed: paramValue,
      timestamp: new Date().toISOString()
    };
    
    // Return formatted response
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
    console.error(`Error executing tool ${name}:`, error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorType = error instanceof Error ? error.constructor.name : 'UnknownError';
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: errorMessage,
            errorType: errorType
          }, null, 2)
        }
      ],
      isError: true
    };
  }
});

// Start the server with proper error handling
async function main() {
  try {
    console.log('Starting MCP Server...');
    
    const transport = new StdioServerTransport();
    console.log('Created transport');
    
    await server.connect(transport);
    console.log('MCP Server running on stdio');
    
    // Set up process signal handlers
    process.on('SIGINT', () => {
      console.log('Received SIGINT signal, shutting down gracefully');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('Received SIGTERM signal, shutting down gracefully');
      process.exit(0);
    });
    
    // Log unhandled rejections
    process.on('unhandledRejection', (reason) => {
      console.error('Unhandled Promise Rejection:', reason);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
```

### Step 3: Create a Wrapper Script

Create a `your-server-wrapper.sh` to help with starting the server:

```bash
#!/bin/bash

# Get the directory of the script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Change to the script directory
cd "$SCRIPT_DIR"

# Debug output
echo "Running from directory: $SCRIPT_DIR"
echo "Files in directory:"
ls -la

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Build the project if needed
if [ ! -d "dist" ] || [ ! -f "dist/index.js" ]; then
  echo "Building project..."
  npm run build
fi

# Run the MCP server
echo "Starting MCP Server..."
if [ -f "$SCRIPT_DIR/dist/index.js" ]; then
  exec node "$SCRIPT_DIR/dist/index.js"
else
  echo "ERROR: dist/index.js not found"
  exit 1
fi
```

Make the script executable:
```bash
chmod +x your-server-wrapper.sh
```

### Step 4: Build Your Server

```bash
cd /path/to/your/server
npm install
npm run build
```

### Step 5: Testing Your Server with MCP Test Client

#### Deploy Your Server

```typescript
mcp__mcp-test__mcp_test_deploy_server({
  name: "your-server-test",
  source_path: "/path/to/your/server"
})
```

#### Check Server Logs

```typescript
mcp__mcp-test__mcp_test_get_logs({
  server_name: "your-server-test"
})
```

#### Call a Tool on Your Server

```typescript
mcp__mcp-test__mcp_test_call_tool({
  server_name: "your-server-test",
  tool_name: "your_tool_name",
  arguments: {
    "param_name": "test-value"
  }
})
```

#### Run Automated Tests

```typescript
mcp__mcp-test__mcp_test_run_tests({
  server_name: "your-server-test"
})
```

#### Stop Your Server When Done

```typescript
mcp__mcp-test__mcp_test_stop_server({
  server_name: "your-server-test"
})
```

### Important Implementation Details

1. **ListToolsRequestSchema Handler**: This handler is critical and must return a correctly formatted list of tools. The MCP test client expects this to work correctly.

2. **CallToolRequestSchema Handler**: This handler processes tool calls. Make sure to validate the arguments and handle errors properly.

3. **Server Connection**: The server uses the StdioServerTransport to communicate with clients. This transport expects JSON-RPC messages over stdin/stdout.

4. **Error Handling**: Always provide clear error messages when things go wrong, using the correct error response format.

5. **Console Logging**: Use console.log/error for debugging, as these will appear in the server logs.

### Common Issues and Troubleshooting

1. **SDK Version Compatibility**: Use the EXACT same SDK version as the test client
   - **THIS IS CRITICAL**: The mcp-client-server uses SDK version 1.9.0, so your server MUST use this exact version
   - Update your package.json with `"@modelcontextprotocol/sdk": "1.9.0"` (not 1.7.0 as shown in some examples)
   - Mismatched SDK versions are a common cause of connection issues and "Unknown tool: list_tools" errors
   - Run `npm clean-install` and completely rebuild your server after changing SDK versions
   - Prior versions like 1.7.0 may have different API expectations, causing silent failures

2. **"Not connected" Error**: If you get a "Not connected" error when trying to call a tool:
   - First check that you don't have multiple instances of the same server running (use `mcp_test_list_servers`)
   - Stop any running instances with the same name using `mcp_test_stop_server`
   - Ensure both capabilities and ListToolsRequestSchema handlers are properly configured
   - Make sure your tool names match EXACTLY between capabilities and handler responses
   - Check server logs for initialization errors or JSON parsing issues
   - Verify the transport connection is established properly

3. **Tool Registration**: Tools must be registered properly in TWO places:
   - In the server capabilities object: `capabilities: { tools: { tool_name: toolObject } }`
   - In the ListToolsRequestSchema handler: `return { tools: [toolObject] }`
   - The tool name in capabilities MUST match the name property in the tool object
   - Missing either registration will cause "Unknown tool" errors or connection issues

4. **"Unknown tool: list_tools" Error**: If you get this specific error:
   - Ensure your server is properly handling the ListToolsRequestSchema request
   - The `list_tools` message is a special protocol message, not a normal tool call
   - You may need to add special handling in your CallToolRequestSchema handler
   - Try stopping ALL running servers and redeploying with a clean environment

5. **File System Operations**: When working with filesystem operations:
   - Use `fs-extra` and Node's native `fs.promises` for asynchronous file operations
   - Add proper error handling around file operations:
   ```typescript
   try {
     const fileStats = await fsPromises.stat(filePath);
     // Process the file
   } catch (error) {
     console.error(`Error accessing file: ${error}`);
     throw new Error(`File error: ${error.message}`);
   }
   ```
   - Use type assertions for parameters from MCP calls: `const path = args.file_path as string;`
   - Validate parameters before use: `if (!args || !args.file_path) throw new Error('Missing parameter');`

6. **Client Connection Management**:
   - **IMPORTANT**: The MCP test client maintains client connections separately from server processes
   - When you stop a server with `mcp_test_stop_server`, the client connection is now also cleared
   - If you encounter connection issues, there's a new tool to help: `mcp_test_clear_connections`
   - This tool will clear all cached client connections, ensuring a completely clean state
   
   Usage:
   ```typescript
   mcp__mcp-test__mcp_test_clear_connections({})
   ```

7. **Deployment Best Practices**:
   - **CRITICAL**: The MCP test client does NOT rebuild your server - it simply launches what's already in the dist directory
   - The complete deployment workflow is: 
     1. Stop existing server with `mcp_test_stop_server` 
     2. Rebuild with `npm run build` or `tsc`
     3. Deploy with `mcp_test_deploy_server`
   - Missing any of these steps can result in testing old code while thinking you're testing new changes
   - Use this shell script for reliable rebuild and deploy:
   ```bash
   #!/bin/bash
   # rebuild-and-deploy.sh
   SERVER_NAME="my-server-name"
   
   # Stop any existing server with this name
   echo "Stopping any existing '$SERVER_NAME' server..."
   node /path/to/packages/mcp/utils/mcp-test.js stop-server $SERVER_NAME 2>/dev/null || true
   
   # Clean and rebuild
   echo "Cleaning and rebuilding from source..."
   cd "$(dirname "$0")"
   rm -rf dist/*
   npm run build
   
   # If experiencing persistent connection issues, uncomment this line:
   # node /path/to/packages/mcp/utils/mcp-test.js clear-connections
   
   # Deploy the server
   echo "Deploying '$SERVER_NAME'..."
   node /path/to/packages/mcp/utils/mcp-test.js deploy-server $SERVER_NAME $(pwd)
   
   echo "Done. Server '$SERVER_NAME' should now be running with the latest changes."
   ```
   - If experiencing persistent issues, try using a unique name with a timestamp or version number
   - To be extra cautious, you can also try direct testing with a test script before using the MCP test client
   - Run `mcp_test_list_servers` with `status: "all"` to see all servers, including stopped ones

7. **Error Handling**:
   - Always include detailed error handling in your tool implementations
   - Log errors with context: `console.error(\`Error in ${toolName}:\`, error);`
   - Return properly structured error responses:
   ```typescript
   return {
     content: [{ 
       type: "text", 
       text: JSON.stringify({
         error: error instanceof Error ? error.message : String(error),
         errorType: error instanceof Error ? error.constructor.name : 'UnknownError'
       }, null, 2) 
     }],
     isError: true
   };
   ```
   - Add signal handlers for graceful shutdown (SIGINT, SIGTERM)
   - Set up unhandledRejection handlers to catch Promise errors

8. **Debugging Tips**:
   - Use extensive logging in your server implementation
   - Log the entire request object when debugging: `console.log(JSON.stringify(request))`
   - Use `mcp_test_get_logs` to see server output after each operation
   - Test with simple tools first before implementing complex functionality
   - If you get persistent connection issues, try re-deploying with a different server name
   - Test your server directly with your own test script before using the MCP test client
   - Always check logs for both startup errors and runtime errors

## Usage

### As an MCP Server

The MCP Test Client is registered with Claude via the `claude-mcp-local` script. You can use the following tools:

1. Deploy a server:
```typescript
mcp__mcp-test__mcp_test_deploy_server({
  name: "my-server",
  source_path: "/path/to/server",
  env_vars: {
    "API_KEY": "${API_KEY}"
  }
})
```

2. Call a tool on a deployed server:
```typescript
mcp__mcp-test__mcp_test_call_tool({
  server_name: "my-server",
  tool_name: "tool_name",
  arguments: {
    // Tool-specific arguments
  }
})
```

3. Run tests against a server:
```typescript
mcp__mcp-test__mcp_test_run_tests({
  server_name: "my-server"
})
```

4. View server logs:
```typescript
mcp__mcp-test__mcp_test_get_logs({
  server_name: "my-server",
  lines: 100
})
```

5. List deployed servers:
```typescript
mcp__mcp-test__mcp_test_list_servers({})
```

6. Stop a server:
```typescript
mcp__mcp-test__mcp_test_stop_server({
  server_name: "my-server"
})
```

### As a CLI Tool

Run the CLI interface for testing:

```bash
# Use npm script
npm run test

# Or run directly
node dist/test-runner.js
```

This provides an interactive menu for deploying, testing, and managing MCP servers.

## Development Workflow

The MCP Test Client supports this workflow:

1. Develop an MCP server in a new directory in packages/mcp/
2. Deploy it to the test environment with MCP Test Client
3. Test functionality, call individual tools, and debug issues
4. Fix and iterate until the server works correctly
5. Migrate the server to mcp-servers/ when ready
6. Register with Claude through claude-mcp-local

## Testing Your Server Directly

Sometimes it's helpful to test your MCP server directly without going through the MCP test client, especially when debugging connection issues. Here's a simple script to do that:

```javascript
#!/usr/bin/env node

import { spawn } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Spawn the MCP server process
const serverProcess = spawn('node', [path.join(__dirname, 'dist', 'index.js')], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Handle server's stdout
serverProcess.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('Server output:', output);
  
  try {
    // Try to parse as JSON
    const jsonResponse = JSON.parse(output);
    console.log('Parsed JSON response:', JSON.stringify(jsonResponse, null, 2));
  } catch (error) {
    // Not valid JSON, just log as text
  }
});

// Handle server's stderr
serverProcess.stderr.on('data', (data) => {
  console.error('Server error:', data.toString());
});

// Send initialize request (required first message)
setTimeout(() => {
  const initRequest = {
    jsonrpc: '2.0',
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {}
      },
      clientInfo: {
        name: 'test-client',
        version: '0.1.0'
      }
    },
    id: 0
  };
  console.log('Sending initialize request:', JSON.stringify(initRequest));
  serverProcess.stdin.write(JSON.stringify(initRequest) + '\n');
}, 1000);

// Send list_tools request
setTimeout(() => {
  const listToolsRequest = {
    jsonrpc: '2.0',
    method: 'request',
    params: {
      method: 'list_tools',
      params: {}
    },
    id: 1
  };
  console.log('Sending list_tools request:', JSON.stringify(listToolsRequest));
  serverProcess.stdin.write(JSON.stringify(listToolsRequest) + '\n');
}, 2000);

// Send call_tool request for your tool
setTimeout(() => {
  const callToolRequest = {
    jsonrpc: '2.0',
    method: 'request',
    params: {
      method: 'call_tool',
      params: {
        name: 'your_tool_name',
        arguments: {
          // Your tool arguments here
          param_name: "test value"
        }
      }
    },
    id: 2
  };
  console.log('Sending call_tool request:', JSON.stringify(callToolRequest));
  serverProcess.stdin.write(JSON.stringify(callToolRequest) + '\n');
}, 3000);

// Terminate after tests complete
setTimeout(() => {
  console.log('Tests completed, terminating server');
  serverProcess.kill();
  process.exit(0);
}, 5000);
```

Save this as `test-server.js` in your server directory and run it with:

```bash
node test-server.js
```

This test script will:
1. Start your server process directly
2. Send the proper initialization message
3. Send a list_tools request
4. Send a call_tool request for your specific tool
5. Log all responses and errors

This approach bypasses the MCP test client entirely and allows you to debug the raw protocol communication.

## Complete Example Workflow

Here's a complete workflow for creating, testing, and iterating on an MCP server:

1. Create your server structure in packages/mcp/mcp-your-server/
2. Implement core functionality with ListToolsRequestSchema and CallToolRequestSchema handlers
3. Test directly with test-server.js to verify protocol communication
4. Build your server with npm run build
5. Deploy your server with mcp_test_deploy_server
6. Test individual tools with mcp_test_call_tool
7. View logs with mcp_test_get_logs to diagnose issues
8. Make fixes to your implementation if needed
9. Rebuild and test until everything works correctly
10. Run automated tests with mcp_test_run_tests
11. Stop your server with mcp_test_stop_server when done

## Future Enhancements

Planned enhancements include:

- **Phase 2**: Docker-based container management, comprehensive test suites
- **Phase 3**: Migration tools, more advanced test validation

See `notes/mcp_test_client_design.md` for the complete design document.
