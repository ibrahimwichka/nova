import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectImage } from '../server/vision.mjs';
const image = 'data:image/png;base64,iVBORw0KGgo=';
test('vision adapter sends an image with schema and validates the response', async () => {
  let request;
  const actual = { quality: 'uncertain', occluded: true, items: [], notes: ['No identifiable food.'] };
  const result = await inspectImage(image, { key: 'test-only', fetch: async (url, input) => { request = JSON.parse(input.body); assert.equal(url, 'https://openrouter.ai/api/v1/responses'); return Response.json({ output: [{ content: [{ type: 'output_text', text: JSON.stringify(actual) }] }] }); } });
  assert.deepEqual(result, actual);
  assert.equal(request.text.format.type, 'json_schema');
  assert.equal(request.input[0].content[1].image_url, image);
});
test('invalid or failed vision responses never become green evidence', async () => {
  await assert.rejects(inspectImage('not-an-image', { key: 'test-only' }));
  await assert.rejects(inspectImage(image, { key: 'test-only', fetch: async () => new Response('{}', { status: 401 }) }));
  await assert.rejects(inspectImage(image, { key: 'test-only', fetch: async () => Response.json({ output: [{ content: [{ type: 'output_text', text: '{"quality":"made-up"}' }] }] }) }));
});
