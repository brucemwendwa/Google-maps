import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLocalGuidePrompt, sanitizeInsightsHtml } from './insights';

test('buildLocalGuidePrompt follows the exact required prompt template', () => {
  const prompt = buildLocalGuidePrompt('Miami, Florida');
  assert.equal(
    prompt,
    'You are a local tour guide for Miami, Florida. Give me exactly 3 short, highly engaging, and unusual or surprising fun facts about this place. Keep each fact under 2 sentences. Format the response as a clean HTML unordered list (<ul>) so I can inject it directly.'
  );
});

test('sanitizeInsightsHtml strips markdown fences and unsafe tags/attributes', () => {
  const raw = [
    '```html',
    '<p>Here are 3 facts:</p>',
    '<ul class="extra" onclick="alert(1)">',
    '  <li>Miami is the <strong>only</strong> major US city founded by a woman.<script>alert("xss")</script></li>',
    '  <li onmouseover="evil()">A coral castle was carved in secret at night.</li>',
    '  <li>An <a href="javascript:alert(1)">underground</a> river flows beneath Biscayne Bay.</li>',
    '</ul>',
    '```',
  ].join('\n');

  const safe = sanitizeInsightsHtml(raw);
  assert.ok(safe.startsWith('<ul>'));
  assert.ok(safe.endsWith('</ul>'));
  assert.ok(!safe.includes('<script'));
  assert.ok(!safe.includes('onclick'));
  assert.ok(!safe.includes('onmouseover'));
  assert.ok(!safe.includes('javascript:'));
  assert.ok(safe.includes('<strong>only</strong>'));
  assert.ok(safe.includes('<li>Miami is the <strong>only</strong> major US city founded by a woman.</li>'));
});

test('sanitizeInsightsHtml wraps plain bulleted output in a valid ul list', () => {
  const plain = '- Fact one.\n- Fact two.\n- Fact three.';
  const html = sanitizeInsightsHtml(plain);
  assert.equal(html, '<ul><li>Fact one.</li><li>Fact two.</li><li>Fact three.</li></ul>');
});
