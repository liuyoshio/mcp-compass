#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const COMPASS_API_BASE = "https://registry.mcphub.io";
const NAME = "mcp-compass";

// Define Zod schemas for validation
const GeneralArgumentsSchema = z.object({
  query: z.string().min(1),
});

// Create server instance
const server = new Server(
  {
    name: NAME,
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "recommend-mcp-servers",
        description: `
          Use this tool when there is a need to findn external MCP tools.
          It explores and recommends existing MCP servers from the 
          internet, based on the description of the MCP Server 
          needed. It returns a list of MCP servers with their IDs, 
          descriptions, GitHub URLs, and similarity scores.
          `,
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: `
                Description for the MCP Server needed. 
                It should be specific and actionable, e.g.:
                GOOD:
                - 'MCP Server for AWS Lambda Python3.9 deployment'
                - 'MCP Server for United Airlines booking API'
                - 'MCP Server for Stripe refund webhook handling'

                BAD:
                - 'MCP Server for cloud' (too vague)
                - 'MCP Server for booking' (which booking system?)
                - 'MCP Server for payment' (which payment provider?)

                Query should explicitly specify:
                1. Target platform/vendor (e.g. AWS, Stripe, MongoDB)
                2. Exact operation/service (e.g. Lambda deployment, webhook handling)
                3. Additional context if applicable (e.g. Python, refund events)
                `,
            },
          },
          required: ["query"],
        },
      },
    ],
  };
});

interface MCPServerResponse {
  title: string;
  description: string;
  github_url: string;
  similarity: number;
}

const makeCOMPASSRequest = async (query: string): Promise<MCPServerResponse[]> => {
  try {
    const response = await fetch(`${COMPASS_API_BASE}/recommend?description=${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      throw new Error(`COMPASS API request failed with status ${response.status}`);
    }

    const data = await response.json();
    return data as MCPServerResponse[];
  } catch (error) {
    console.error('Error fetching from COMPASS API:', error);
    throw error;
  }
};

const toServersText = async (servers: MCPServerResponse[]): Promise<string> => {
  if (servers.length === 0) {
    return "No MCP servers found.";
  }

  return servers.map((server, index) => {
    const similarityPercentage = (server.similarity * 100).toFixed(1);
    return [
      `Server ${index + 1}:`,
      `Title: ${server.title}`,
      `Description: ${server.description}`,
      `GitHub URL: ${server.github_url}`,
      `Similarity: ${similarityPercentage}%`,
      ''
    ].join('\n');
  }).join('\n');
};

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "recommend-mcp-servers") {
      const { query } = GeneralArgumentsSchema.parse(args);
      const servers = await makeCOMPASSRequest(query);

      if (!servers || servers.length === 0) {
        return {
          content: [{
            type: "text",
            text: "No matching MCP servers found for your query. Try being more specific about the platform, operation, or service you need.",
          }],
        };
      }

      const serversText = await toServersText(servers);
      
      return {
        content: [
          {
            type: "text",
            text: serversText,
          },
        ],
      };
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error("Error handling request:", error);
    throw error;
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Compass Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
