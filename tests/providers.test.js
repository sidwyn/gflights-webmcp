import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { loadSource } from './helpers/loadSource.js';

// Load provider classes into global scope
loadSource(join(__dirname, '../sidepanel/providers/base.js'));
loadSource(join(__dirname, '../sidepanel/providers/anthropic.js'));
loadSource(join(__dirname, '../sidepanel/providers/openai.js'));

describe('AnthropicProvider', () => {
  const provider = new globalThis.AnthropicProvider('test-key');

  describe('constructor', () => {
    it('defaults model to claude-sonnet-4-6', () => {
      expect(provider.model).toBe('claude-sonnet-4-6');
    });

    it('accepts a custom model', () => {
      const custom = new globalThis.AnthropicProvider('test-key', 'claude-opus-4-6');
      expect(custom.model).toBe('claude-opus-4-6');
    });

    it('sets API key', () => {
      expect(provider.apiKey).toBe('test-key');
    });

    it('includes today date in system prompt', () => {
      const today = new Date().toISOString().split('T')[0];
      expect(provider.systemPrompt).toContain(today);
    });

    it('system prompt contains anti-hallucination rules', () => {
      expect(provider.systemPrompt).toContain('NEVER HALLUCINATE');
    });

    it('system prompt lists all tools', () => {
      const tools = ['search_flights', 'get_results', 'set_filters', 'get_price_insights',
        'get_flight_details', 'track_price', 'explore_destinations', 'search_multi_city',
        'get_tracked_flights', 'get_booking_link', 'select_return_flight'];
      for (const tool of tools) {
        expect(provider.systemPrompt).toContain(tool);
      }
    });

    it('includes quick reply syntax', () => {
      expect(provider.systemPrompt).toContain('<<');
    });
  });

  describe('convertTool', () => {
    it('converts to Anthropic format', () => {
      const tool = { name: 'test', description: 'desc', inputSchema: { type: 'object' } };
      const result = provider.convertTool(tool);
      expect(result.name).toBe('test');
      expect(result.input_schema).toEqual({ type: 'object' });
      expect(result.parameters).toBeUndefined(); // Anthropic uses input_schema, not parameters
    });
  });

  describe('formatToolResult', () => {
    it('formats string result as user message with tool_result', () => {
      const result = provider.formatToolResult('tool-123', 'Success');
      expect(result.role).toBe('user');
      expect(result.content[0].type).toBe('tool_result');
      expect(result.content[0].tool_use_id).toBe('tool-123');
    });

    it('formats object with content array', () => {
      const result = provider.formatToolResult('tool-123', {
        content: [{ type: 'text', text: 'Found 5 flights' }]
      });
      expect(result.content[0].content[0].text).toBe('Found 5 flights');
    });

    it('JSON-stringifies unknown objects', () => {
      const result = provider.formatToolResult('tool-123', { foo: 'bar' });
      expect(result.content[0].content[0].text).toBe('{"foo":"bar"}');
    });
  });
});

describe('OpenAIProvider', () => {
  const provider = new globalThis.OpenAIProvider('test-key');

  describe('constructor', () => {
    it('defaults model to gpt-4o', () => {
      expect(provider.model).toBe('gpt-4o');
    });

    it('accepts a custom model', () => {
      const custom = new globalThis.OpenAIProvider('test-key', 'gpt-4o-mini');
      expect(custom.model).toBe('gpt-4o-mini');
    });

    it('system prompt contains anti-hallucination rules', () => {
      expect(provider.systemPrompt).toContain('NEVER HALLUCINATE');
    });
  });

  describe('convertTool', () => {
    it('converts to OpenAI function format', () => {
      const tool = { name: 'test', description: 'desc', inputSchema: { type: 'object' } };
      const result = provider.convertTool(tool);
      expect(result.type).toBe('function');
      expect(result.function.name).toBe('test');
      expect(result.function.parameters).toEqual({ type: 'object' });
    });
  });

  describe('formatToolResult', () => {
    it('formats as tool role message', () => {
      const result = provider.formatToolResult('call-123', 'Success');
      expect(result.role).toBe('tool');
      expect(result.tool_call_id).toBe('call-123');
      expect(result.content).toBe('Success');
    });
  });
});
