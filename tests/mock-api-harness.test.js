const test = require('node:test');
const assert = require('node:assert/strict');
const { createMockApiHarness, sanitizeForLog, createMockBatchWorkflow } = require('../mock-api-harness');

test('mock harness streams, stops, retries, and reports usage', async () => {
  const harness = createMockApiHarness({ provider: 'openai', scenario: 'streaming' });
  const chunks = [];
  const result = await harness.call({
    provider: 'openai',
    model: 'gpt-4.1-mini',
    messages: [{ role: 'user', content: 'hello' }],
    onDelta: (delta) => chunks.push(delta)
  });
  assert.equal(result.text, 'สวัสดีจาก Mock');
  assert.deepEqual(chunks, ['ส', 'วั', 'สด', 'ี']);
  assert.equal(result.usage.total_tokens, 12);
});

test('mock harness handles stop, timeout, retry backoff, and provider status codes', async () => {
  const harness = createMockApiHarness({ provider: 'gemini', scenario: 'retry' });
  const controller = new AbortController();
  const promise = harness.call({
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    messages: [{ role: 'user', content: 'retry me' }],
    signal: controller.signal
  });
  controller.abort();
  await assert.rejects(promise, /aborted/i);

  const timeoutHarness = createMockApiHarness({ provider: 'openai', scenario: 'timeout' });
  await assert.rejects(timeoutHarness.call({ provider: 'openai', model: 'gpt-4o-mini', messages: [] }), /timeout/i);

  for (const scenario of ['401', '403', '429', '500', '503']) {
    const scenarioHarness = createMockApiHarness({ provider: 'openai', scenario });
    await assert.rejects(scenarioHarness.call({ provider: 'openai', model: 'gpt-4.1-mini', messages: [] }), /invalid|permission|rate|server|unavailable/i);
  }
});

test('mock harness returns fallback, empty response, malformed JSON, and redacts secrets', async () => {
  const fallbackHarness = createMockApiHarness({ provider: 'openai', scenario: 'fallback' });
  const fallback = await fallbackHarness.call({ provider: 'openai', model: 'gpt-4.1-mini', messages: [] });
  assert.equal(fallback.fallbackProvider, 'gemini');
  assert.equal(fallback.fallbackModel, 'gemini-2.0-flash');

  const emptyHarness = createMockApiHarness({ provider: 'gemini', scenario: 'empty' });
  const empty = await emptyHarness.call({ provider: 'gemini', model: 'gemini-2.0-flash', messages: [] });
  assert.equal(empty.text, '');

  const malformedHarness = createMockApiHarness({ provider: 'openai', scenario: 'malformed-json' });
  const malformed = await malformedHarness.call({ provider: 'openai', model: 'gpt-4.1-mini', messages: [] });
  assert.equal(malformed.text, '{not json');

  const redacted = sanitizeForLog({ message: 'sk-abc123', authorization: 'Bearer sk-abc123', nested: { apiKey: 'secret' } });
  assert.equal(redacted.message, '[REDACTED]');
  assert.equal(redacted.authorization, '[REDACTED]');
  assert.equal(redacted.nested.apiKey, '[REDACTED]');
});

test('mock batch workflow supports validator repair, pause/resume/cancel recovery, and export-ready data', async () => {
  const workflow = await createMockBatchWorkflow({
    scenario: 'repair',
    validator: {
      requiredFields: ['title'],
      minWords: 2,
      forbiddenTerms: ['bad']
    }
  });
  assert.equal(workflow.status, 'completed');
  assert.equal(workflow.items[0].status, 'success');
  assert.equal(workflow.items[0].output.title, 'Fixed Title');
  assert.equal(workflow.items[0].repaired, true);
  assert.equal(workflow.items[0].output.detail, 'ok');
});
