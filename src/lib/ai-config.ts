/**
 * Centralized AI model configuration
 * All AI models can be changed by setting the AI_MODEL environment variable
 * Default: claude-3-haiku-20240307
 */

export const AI_MODEL = process.env.AI_MODEL || 'claude-3-haiku-20240307';
export const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;

if (!CLAUDE_API_KEY) {
  console.warn('CLAUDE_API_KEY or ANTHROPIC_API_KEY environment variable is not set');
}

export interface AIModelConfig {
  model: string;
  apiKey: string;
}

export function getAIModelConfig(): AIModelConfig {
  return {
    model: AI_MODEL,
    apiKey: CLAUDE_API_KEY || '',
  };
}
