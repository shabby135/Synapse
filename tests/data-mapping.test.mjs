import assert from 'node:assert/strict';
import test from 'node:test';
import {
  configurationForPublish, DataMappingError, getAncestorNodeIds,
  parseReference, resolveActionConfiguration, resolveTemplate,
} from '../src/features/workflow/data-mapping.ts';
import { parseHttpActionConfiguration } from '../src/features/workflow/http-request-configuration.ts';
import { parseAiPromptConfiguration } from '../src/features/workflow/ai-prompt-configuration.ts';
import { parseMessagingActionConfiguration } from '../src/features/workflow/messaging-action-configuration.ts';

const context = {
  trigger: { name: 'Rahul', message: 'Billing issue', count: 0, active: false, empty: null,
    items: [{ name: 'Item A' }], payload: { quoted: 'He said "hello"\nNext line' } },
  input: { text: 'AI summary', nested: { value: 42 } },
  nodes: { 'ai-123': { text: 'AI summary', usage: { totalTokens: 12 } } },
};
const data = (configuration) => ({ label: 'Test', configuration });

test('maps original trigger, immediate input, and explicit ancestor output', () => {
  assert.equal(resolveTemplate('{{trigger.name}}: {{input.text}} / {{nodes["ai-123"].usage.totalTokens}}', context), 'Rahul: AI summary / 12');
});
test('supports array indexes and quoted keys', () => {
  assert.equal(resolveTemplate('{{trigger.items[0]["name"]}}', context), 'Item A');
  assert.deepEqual(parseReference(' nodes["ai-123"].text '), ['nodes', 'ai-123', 'text']);
});
test('retains legacy whole input JSON formatting', () => {
  assert.equal(resolveTemplate('{{input}}', context), JSON.stringify(context.input, null, 2));
});
test('preserves zero, false, null, arrays and objects in whole expressions', () => {
  for (const key of ['count', 'active', 'empty', 'items', 'payload']) {
    assert.deepEqual(resolveTemplate(`{{trigger.${key}}}`, context, true), context.trigger[key]);
  }
  assert.equal(resolveTemplate('Count: {{trigger.count}}', context, true), 'Count: 0');
});
test('missing properties and out-of-bounds indexes fail clearly', () => {
  for (const expression of ['{{input.absent}}', '{{trigger.items[9]}}', '{{nodes["future"].text}}']) {
    assert.throws(() => resolveTemplate(expression, context), DataMappingError);
  }
});
test('forbids prototype traversal, function calls, environment access, and operators', () => {
  for (const expression of ['input.__proto__', 'input["constructor"]', 'input.prototype',
    'process.env.SECRET', 'input.text.toUpperCase()', 'trigger.count + 1', 'nodes']) {
    assert.throws(() => parseReference(expression), DataMappingError);
  }
});
test('does not read inherited properties', () => {
  assert.throws(() => resolveTemplate('{{input.hidden}}', { ...context, input: Object.create({ hidden: 'secret' }) }), DataMappingError);
});
test('does not evaluate expressions inside substituted data', () => {
  assert.equal(resolveTemplate('Message: {{input.text}}', { ...context, input: { text: '{{trigger.name}}' } }), 'Message: {{trigger.name}}');
});
test('allows ordinary JSON closing braces and rejects malformed openings', () => {
  assert.equal(resolveTemplate('{"nested":{"a":1}}', context), '{"nested":{"a":1}}');
  for (const value of ['{{input.text', '{{}}', '{{input..text}}']) {
    assert.throws(() => resolveTemplate(value, context), DataMappingError);
  }
});
test('enforces field and reference-count bounds', () => {
  assert.throws(() => resolveTemplate('x'.repeat(262145), context), DataMappingError);
  assert.throws(() => resolveTemplate('{{input.text}}'.repeat(101), context), DataMappingError);
});
test('JSON body mapping preserves types and safely escapes strings', () => {
  const configuration = resolveActionConfiguration({ actionType: 'HTTP_REQUEST', url: 'https://example.com', method: 'POST', headersJson: '{}',
    body: JSON.stringify({ count: '{{trigger.count}}', active: '{{trigger.active}}', payload: '{{trigger.payload}}', summary: '{{input.text}}' }),
  }, context);
  assert.deepEqual(JSON.parse(configuration.body), { count: 0, active: false, payload: context.trigger.payload, summary: 'AI summary' });
  assert.equal(parseHttpActionConfiguration(data(configuration)).method, 'POST');
});
test('supports whole-object bodies and mapped header values', () => {
  const configuration = resolveActionConfiguration({ actionType: 'HTTP_REQUEST', url: 'https://example.com/{{trigger.count}}', method: 'POST',
    headersJson: '{"X-Name":"{{trigger.name}}"}', body: '{{trigger.payload}}',
  }, context);
  const parsed = parseHttpActionConfiguration(data(configuration));
  assert.equal(parsed.headers['X-Name'], 'Rahul');
  assert.deepEqual(JSON.parse(parsed.body), context.trigger.payload);
  assert.equal(parsed.url.pathname, '/0');
});
test('static configuration is not mutated', () => {
  const original = { actionType: 'AI_PROMPT', prompt: '{{input.text}}', model: 'gpt-4.1-mini' };
  const mapped = resolveActionConfiguration(original, context);
  assert.equal(original.prompt, '{{input.text}}');
  assert.equal(mapped.prompt, 'AI summary');
});
test('integration IDs and action types cannot be expressions', () => {
  assert.throws(() => resolveActionConfiguration({ actionType: 'SLACK_MESSAGE', integrationId: '{{trigger.name}}' }, context), DataMappingError);
  assert.throws(() => resolveActionConfiguration({ actionType: '{{trigger.name}}' }, context), DataMappingError);
});
test('ancestor traversal includes merges but excludes siblings, future nodes and self', () => {
  const edges = [{ source: 't', target: 'a' }, { source: 't', target: 'b' }, { source: 'a', target: 'c' }, { source: 'b', target: 'c' }, { source: 'c', target: 'd' }];
  assert.deepEqual([...getAncestorNodeIds('a', edges)], ['t']);
  assert.deepEqual(new Set(getAncestorNodeIds('c', edges)), new Set(['a', 'b', 't']));
});
test('publish rejects disconnected node references', () => {
  assert.throws(() => configurationForPublish({ actionType: 'AI_PROMPT', prompt: '{{nodes["sibling"].text}}' }, new Set(['ai-123'])), /must be connected/);
});
test('publish accepts upstream refs and defers unknown fields to runtime', () => {
  const configuration = { actionType: 'AI_PROMPT', prompt: '{{nodes["ai-123"].unknown}}' };
  assert.doesNotThrow(() => parseAiPromptConfiguration(data(configurationForPublish(configuration, new Set(['ai-123'])))));
  assert.throws(() => resolveActionConfiguration(configuration, context), /Missing/);
});
test('publish validates HTTP static settings with dynamic URLs and headers', () => {
  const configuration = { actionType: 'HTTP_REQUEST', url: '{{trigger.url}}', headersJson: '{"X-Value":"{{trigger.name}}"}' };
  assert.doesNotThrow(() => parseHttpActionConfiguration(data(configurationForPublish(configuration, new Set()))));
  assert.throws(() => parseHttpActionConfiguration(data(configurationForPublish({ ...configuration, method: 'INVALID' }, new Set()))), /not supported/);
  assert.throws(() => parseHttpActionConfiguration(data(configurationForPublish({ ...configuration, headersJson: '{"Cookie":"{{trigger.name}}"}' }, new Set()))), /not allowed/);
});
test('runtime revalidates resolved URL and header types', () => {
  assert.throws(() => parseHttpActionConfiguration(data(resolveActionConfiguration({ actionType: 'HTTP_REQUEST', url: '{{trigger.name}}' }, context))), /URL is invalid/);
  assert.throws(() => parseHttpActionConfiguration(data(resolveActionConfiguration({ actionType: 'HTTP_REQUEST', url: 'https://example.com', headersJson: '{"X-Count":"{{trigger.count}}"}' }, context))), /string value/);
});
test('runtime enforces messaging limit after expansion', () => {
  const configuration = { actionType: 'DISCORD_MESSAGE', integrationId: '12345678-1234-4234-8234-123456789012', message: '{{input.text}}' };
  assert.throws(() => parseMessagingActionConfiguration(data(resolveActionConfiguration(configuration, { ...context, input: { text: 'x'.repeat(2001) } }))), /2000/);
});
test('end-to-end mapped enquiry, simulated AI result, and Slack message', () => {
  const ai = resolveActionConfiguration({ actionType: 'AI_PROMPT', prompt: 'Summarize: {{trigger.message}}' }, context);
  assert.equal(ai.prompt, 'Summarize: Billing issue');
  const message = resolveActionConfiguration({ actionType: 'SLACK_MESSAGE', message: 'Customer: {{trigger.name}}\nSummary: {{nodes["ai-123"].text}}' }, context);
  assert.equal(message.message, 'Customer: Rahul\nSummary: AI summary');
});