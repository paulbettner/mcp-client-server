// Test execution functionality
import { ServerNotFoundError } from '../../common/errors.js';
import { Logger } from '../../common/logger.js';
import { 
  RunTestsInput, 
  RunTestsResponse,
  TestCase,
  TestResult 
} from '../../types/schemas.js';
import { getServerProcess } from '../docker/index.js';
import { callTool } from './tools.js';
import { listTools } from './tools.js';

/**
 * Run a single test case
 */
async function runTestCase(serverName: string, test: TestCase): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    // Call the tool
    const result = await callTool({
      server_name: serverName,
      tool_name: test.tool,
      arguments: test.input
    });
    
    const duration = Date.now() - startTime;
    
    // Check for errors
    if (result.error) {
      return {
        name: test.name,
        passed: false,
        message: `Tool call failed: ${result.error}`,
        duration_ms: duration,
        error: result.error
      };
    }
    
    // If there's an expected result, check it
    if (test.expected) {
      let passed = false;
      
      if (test.expected.type === 'equals') {
        passed = JSON.stringify(result.result) === JSON.stringify(test.expected.value);
      } else if (test.expected.type === 'contains') {
        const resultStr = JSON.stringify(result.result);
        const expectedStr = JSON.stringify(test.expected.value);
        passed = resultStr.includes(expectedStr);
      } else if (test.expected.type === 'regex') {
        const regex = new RegExp(test.expected.value);
        passed = regex.test(JSON.stringify(result.result));
      }
      
      return {
        name: test.name,
        passed,
        message: passed ? 'Test passed' : 'Test failed: result did not match expected value',
        duration_ms: duration
      };
    }
    
    // If no expected result, assume success
    return {
      name: test.name,
      passed: true,
      message: 'Test passed',
      duration_ms: duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    return {
      name: test.name,
      passed: false,
      message: `Test failed with error: ${error instanceof Error ? error.message : String(error)}`,
      duration_ms: duration,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Run tests for a server
 */
export async function runTests(input: RunTestsInput): Promise<RunTestsResponse> {
  const { server_name, test_suite } = input;
  const startTime = Date.now();
  
  try {
    // First, let's check that the server exists
    getServerProcess(server_name);
    
    // Get the tools available on the server
    const tools = await listTools(server_name);
    
    // Create a basic test for each tool
    const basicTests: TestCase[] = tools.map(tool => ({
      name: `List ${tool} schema`,
      description: `Check that ${tool} is available and has a valid schema`,
      tool,
      // Send an empty input just to see if the tool exists
      // This will likely fail for most tools, but will show the schema
      input: {}
    }));
    
    // Run each test
    const results: TestResult[] = [];
    for (const test of basicTests) {
      const result = await runTestCase(server_name, test);
      results.push(result);
    }
    
    // Calculate summary
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const failed = total - passed;
    const duration = Date.now() - startTime;
    
    return {
      results,
      summary: {
        total,
        passed,
        failed,
        duration_ms: duration
      }
    };
  } catch (error) {
    Logger.error(`Error running tests for server '${server_name}':`, error);
    
    if (error instanceof ServerNotFoundError) {
      throw error;
    }
    
    const duration = Date.now() - startTime;
    
    return {
      results: [{
        name: 'Test suite setup',
        passed: false,
        message: `Failed to setup test suite: ${error instanceof Error ? error.message : String(error)}`,
        duration_ms: duration,
        error: error instanceof Error ? error.message : String(error)
      }],
      summary: {
        total: 1,
        passed: 0,
        failed: 1,
        duration_ms: duration
      }
    };
  }
}