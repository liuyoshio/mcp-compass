#!/usr/bin/env node

import { FastMCP } from 'fastmcp';
import { z } from "zod";

const COMPASS_API_BASE = "https://registry.mcphub.io";
const NAME = "mcp-compass";

const server = new FastMCP(
  {
    name: NAME,
    version: "1.0.0",
  },
);

server.addTool({
  name: "recommend-mcp-servers",
  description: `
    Use this tool when there is a need to findn external MCP tools.
    It explores and recommends existing MCP servers from the 
    internet, based on the description of the MCP Server 
    needed. It returns a list of MCP servers with their IDs, 
    descriptions, GitHub URLs, and similarity scores.
    `,
  parameters: z.object({
    query: z.string().min(1).describe(`
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
      `),
  }),
  execute: async ({ query }) => {
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
  },
})

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

server.start({
  transportType: 'stdio'
})
