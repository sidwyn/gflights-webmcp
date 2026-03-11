import { describe, it, expect } from 'vitest';

// These functions are embedded in app.js's IIFE. We replicate them here for unit testing.
// Any changes to the logic in app.js must be mirrored here.

function capToolResult(result, maxLen) {
  if (typeof result === 'string') {
    return result.length > maxLen ? result.slice(0, maxLen) + '…' : result;
  }
  if (result?.content && Array.isArray(result.content)) {
    return {
      ...result,
      content: result.content.map(c => {
        if (c.type === 'text' && c.text && c.text.length > maxLen) {
          return { ...c, text: c.text.slice(0, maxLen) + '…' };
        }
        return c;
      })
    };
  }
  return result;
}

function trimmedHistory(conversationHistory) {
  const KEEP_RECENT = 6;
  const MAX_TOOL_RESULT_LEN = 150;
  const DROP_BEYOND = 20;

  if (conversationHistory.length <= KEEP_RECENT) return conversationHistory;

  return conversationHistory.reduce((acc, msg, idx) => {
    const age = conversationHistory.length - idx;
    const isRecent = age <= KEEP_RECENT;
    if (isRecent) { acc.push(msg); return acc; }
    const isVeryOld = age > DROP_BEYOND;

    if (msg.role === 'user' && Array.isArray(msg.content)) {
      const trimmed = msg.content.map(block => {
        if (block.type === 'tool_result' && Array.isArray(block.content)) {
          if (isVeryOld) return { ...block, content: [{ type: 'text', text: '[old result removed]' }] };
          const fullText = block.content.map(c => c.text || '').join(' ');
          if (fullText.length > MAX_TOOL_RESULT_LEN) {
            return { ...block, content: [{ type: 'text', text: fullText.slice(0, MAX_TOOL_RESULT_LEN) + '…' }] };
          }
        }
        return block;
      });
      acc.push({ ...msg, content: trimmed });
      return acc;
    }

    if (msg.role === 'tool' && typeof msg.content === 'string') {
      if (isVeryOld) { acc.push({ ...msg, content: '[old result removed]' }); return acc; }
      if (msg.content.length > MAX_TOOL_RESULT_LEN) {
        acc.push({ ...msg, content: msg.content.slice(0, MAX_TOOL_RESULT_LEN) + '…' });
        return acc;
      }
    }

    if (msg.role === 'assistant' && !isRecent) {
      if (typeof msg.content === 'string' && msg.content.length > 300) {
        acc.push({ ...msg, content: msg.content.slice(0, 300) + '…' });
        return acc;
      }
      if (Array.isArray(msg.content)) {
        const trimmedContent = msg.content.map(block => {
          if (block.type === 'text' && block.text && block.text.length > 300) {
            return { ...block, text: block.text.slice(0, 300) + '…' };
          }
          return block;
        });
        acc.push({ ...msg, content: trimmedContent });
        return acc;
      }
    }

    acc.push(msg);
    return acc;
  }, []);
}

describe('capToolResult', () => {
  it('passes through short strings', () => {
    expect(capToolResult('short', 100)).toBe('short');
  });

  it('truncates long strings', () => {
    const long = 'a'.repeat(200);
    const result = capToolResult(long, 50);
    expect(result.length).toBe(51); // 50 + '…'
    expect(result.endsWith('…')).toBe(true);
  });

  it('truncates MCP-format tool results', () => {
    const result = capToolResult({
      content: [{ type: 'text', text: 'x'.repeat(2000) }]
    }, 100);
    expect(result.content[0].text.length).toBeLessThanOrEqual(102);
    expect(result.content[0].text.endsWith('…')).toBe(true);
  });

  it('passes through short MCP-format results', () => {
    const input = { content: [{ type: 'text', text: 'hello' }] };
    const result = capToolResult(input, 100);
    expect(result.content[0].text).toBe('hello');
  });

  it('passes through non-text content blocks unchanged', () => {
    const input = { content: [{ type: 'image', data: 'abc' }] };
    const result = capToolResult(input, 10);
    expect(result.content[0]).toEqual({ type: 'image', data: 'abc' });
  });

  it('returns non-string/non-MCP values unchanged', () => {
    expect(capToolResult(42, 10)).toBe(42);
    expect(capToolResult(null, 10)).toBe(null);
  });
});

describe('trimmedHistory', () => {
  function makeHistory(n, role = 'user', contentFn) {
    return Array.from({ length: n }, (_, i) =>
      contentFn ? contentFn(i) : { role, content: `msg ${i}` }
    );
  }

  it('returns history unchanged when <= KEEP_RECENT', () => {
    const history = makeHistory(5);
    expect(trimmedHistory(history)).toEqual(history);
  });

  it('keeps last 6 messages intact', () => {
    const history = makeHistory(10);
    const result = trimmedHistory(history);
    // Last 6 should be untouched
    for (let i = 4; i < 10; i++) {
      expect(result[i]).toEqual(history[i]);
    }
  });

  it('truncates old OpenAI tool results', () => {
    const history = [
      { role: 'tool', content: 'x'.repeat(500) },
      ...makeHistory(8)
    ];
    const result = trimmedHistory(history);
    expect(result[0].content.length).toBeLessThan(200);
    expect(result[0].content.endsWith('…')).toBe(true);
  });

  it('truncates old Anthropic tool_result blocks', () => {
    const history = [
      {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: 'test',
          content: [{ type: 'text', text: 'y'.repeat(500) }]
        }]
      },
      ...makeHistory(8)
    ];
    const result = trimmedHistory(history);
    const block = result[0].content[0];
    expect(block.content[0].text.length).toBeLessThan(200);
  });

  it('drops very old tool results entirely (OpenAI)', () => {
    const history = [
      { role: 'tool', content: 'old data' },
      ...makeHistory(25)
    ];
    const result = trimmedHistory(history);
    expect(result[0].content).toBe('[old result removed]');
  });

  it('drops very old tool results entirely (Anthropic)', () => {
    const history = [
      {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: 'old',
          content: [{ type: 'text', text: 'old data here' }]
        }]
      },
      ...makeHistory(25)
    ];
    const result = trimmedHistory(history);
    expect(result[0].content[0].content[0].text).toBe('[old result removed]');
  });

  it('truncates old assistant text', () => {
    const history = [
      { role: 'assistant', content: 'z'.repeat(500) },
      ...makeHistory(8)
    ];
    const result = trimmedHistory(history);
    expect(result[0].content.length).toBeLessThan(350);
    expect(result[0].content.endsWith('…')).toBe(true);
  });

  it('truncates old assistant content blocks (Anthropic format)', () => {
    const history = [
      { role: 'assistant', content: [{ type: 'text', text: 'z'.repeat(500) }] },
      ...makeHistory(8)
    ];
    const result = trimmedHistory(history);
    expect(result[0].content[0].text.length).toBeLessThan(350);
  });

  it('preserves message count (no messages dropped)', () => {
    const history = [
      { role: 'tool', content: 'x'.repeat(1000) },
      { role: 'assistant', content: 'y'.repeat(1000) },
      ...makeHistory(8)
    ];
    expect(trimmedHistory(history).length).toBe(history.length);
  });

  it('leaves short old messages intact', () => {
    const history = [
      { role: 'user', content: 'hi' },
      ...makeHistory(8)
    ];
    const result = trimmedHistory(history);
    expect(result[0].content).toBe('hi');
  });
});
