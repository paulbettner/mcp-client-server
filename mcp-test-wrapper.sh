#!/bin/bash

# Change to script directory
cd "$(dirname "$0")" || exit 1

# Run the MCP test server
node dist/index.js