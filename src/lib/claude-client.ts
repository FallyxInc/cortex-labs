/**
 * Centralized Claude client initialization and helper functions
 */
import Anthropic from '@anthropic-ai/sdk';
import { getAIModelConfig } from './ai-config';

// Re-export for convenience
export { getAIModelConfig };

let claudeClient: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  const config = getAIModelConfig();
  
  if (!config.apiKey) {
    throw new Error('CLAUDE_API_KEY or ANTHROPIC_API_KEY environment variable is not set');
  }

  if (!claudeClient) {
    claudeClient = new Anthropic({ apiKey: config.apiKey });
  }
  
  return claudeClient;
}

export function getAIModel(): string {
  return getAIModelConfig().model;
}

/**
 * Helper function to call Claude API with standardized error handling
 */
export async function callClaudeAPI(
  systemPrompt: string,
  userPrompt: string,
  options: {
    maxTokens?: number;
    temperature?: number;
  } = {}
): Promise<string> {
  const client = getClaudeClient();
  const model = getAIModel();
  
  try {
    const response = await client.messages.create({
      model,
      max_tokens: options.maxTokens || 4000,
      temperature: options.temperature,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    return content.text;
  } catch (error) {
    console.error('Error calling Claude API:', error);
    throw error;
  }
}

/**
 * Helper function to call Claude API and parse JSON response
 */
export async function callClaudeAPIForJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  options: {
    maxTokens?: number;
    temperature?: number;
  } = {}
): Promise<T> {
  const text = await callClaudeAPI(systemPrompt, userPrompt, options);
  
  // Extract JSON from response (might have markdown code blocks)
  let jsonText = text.trim();
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }

  return JSON.parse(jsonText) as T;
}
