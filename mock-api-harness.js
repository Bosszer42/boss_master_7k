'use strict';

function sanitizeForLog(value) {
  const redacted = '[REDACTED]';
  if (Array.isArray(value)) return value.map((item) => sanitizeForLog(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
      const lower = String(key).toLowerCase();
      if (lower.includes('key') || lower.includes('token') || lower.includes('authorization') || lower.includes('secret')) {
        return [key, redacted];
      }
      return [key, sanitizeForLog(entry)];
    }));
  }
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower.includes('sk-') || lower.includes('AIza') || lower.includes('bearer')) return redacted;
  }
  return value;
}

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createMockApiHarness(options = {}) {
  const { provider = 'openai', scenario = 'success' } = options;
  async function call(request) {
    const { onDelta, signal } = request;
    if (signal?.aborted) throw new Error('Request aborted');
    if (scenario === 'retry') {
      await delay(50);
      if (signal?.aborted) throw new Error('Request aborted');
      return { text: 'retry ok', usage: { total_tokens: 5 } };
    }
    if (scenario === 'timeout') {
      await delay(120);
      throw new Error('Timeout');
    }
    if (scenario === 'fallback') {
      return {
        text: 'fallback response',
        usage: { total_tokens: 3 },
        fallbackProvider: 'gemini',
        fallbackModel: 'gemini-2.0-flash'
      };
    }
    if (scenario === 'empty') {
      return { text: '', usage: { total_tokens: 0 } };
    }
    if (scenario === 'malformed-json') {
      return { text: '{not json', usage: { total_tokens: 1 } };
    }
    if (scenario === 'streaming') {
      const chunks = ['ส', 'วั', 'สด', 'ี'];
      for (const chunk of chunks) {
        if (signal?.aborted) throw new Error('Request aborted');
        onDelta?.(chunk);
        await delay(10);
      }
      return { text: 'สวัสดีจาก Mock', usage: { total_tokens: 12 } };
    }
    if (scenario === '401') {
      throw Object.assign(new Error('Invalid API key'), { status: 401 });
    }
    if (scenario === '403') {
      throw Object.assign(new Error('Permission denied'), { status: 403 });
    }
    if (scenario === '429') {
      throw Object.assign(new Error('Rate limit'), { status: 429 });
    }
    if (scenario === '500') {
      throw Object.assign(new Error('Server error'), { status: 500 });
    }
    if (scenario === '503') {
      throw Object.assign(new Error('Service unavailable'), { status: 503 });
    }
    return { text: `mock ${provider} success`, usage: { total_tokens: 8 } };
  }
  return { call, provider, scenario };
}

async function createMockBatchWorkflow(options = {}) {
  const validator = options.validator || {};
  const items = [{ id: '1', status: 'retry', output: null, retryCount: 1, repaired: false }];
  const repaired = { title: 'Fixed Title', detail: 'ok' };
  const errors = [];
  if (validator.requiredFields?.includes('title')) errors.push('ไม่มีข้อมูลช่อง title');
  if (validator.minWords > 1) errors.push('จำนวนคำต่ำกว่าเกณฑ์');
  if (validator.forbiddenTerms?.includes('bad')) errors.push('พบคำต้องห้าม');
  const finalItems = [];
  for (const item of items) {
    if (errors.length) {
      finalItems.push({ ...item, status: 'success', repaired: true, output: repaired, error: '' });
    } else {
      finalItems.push({ ...item, status: 'success', output: repaired });
    }
  }
  return { status: 'completed', items: finalItems };
}

module.exports = { createMockApiHarness, sanitizeForLog, createMockBatchWorkflow };
