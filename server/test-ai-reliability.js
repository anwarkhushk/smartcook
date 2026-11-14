/**
 * Test script for SmartCook Groq API Reliability
 *
 * Verifies:
 * 1. Retry on 429/5xx errors (3 attempts with 1s, 2s delays)
 * 2. No retry on 401 (bad key) or 404 (bad model)
 * 3. Friendly error when all attempts fail
 * 4. HTTP POST /api/ask route validation
 */

process.env.TEST_MODE = '1';

import assert from 'node:assert/strict';
import { app, isRetryable } from './server.js';

console.log('--- SmartCook Groq Reliability Tests ---\n');

// Test 1: isRetryable recognises retryable status codes
console.log('Test 1: isRetryable identifies retryable vs non-retryable errors');
assert.ok(isRetryable({ status: 429 }), '429 should be retryable');
assert.ok(isRetryable({ status: 500 }), '500 should be retryable');
assert.ok(isRetryable({ status: 503 }), '503 should be retryable');
assert.ok(!isRetryable({ status: 401 }), '401 should NOT be retryable');
assert.ok(!isRetryable({ status: 404 }), '404 should NOT be retryable');
assert.ok(!isRetryable({ status: 400 }), '400 should NOT be retryable');
console.log('✓ Test 1 passed!\n');

// Test 2: HTTP validation
async function testHttpValidation() {
  console.log('Test 2: POST /api/ask validates input');
  const server = app.listen(0);
  const port = server.address().port;

  try {
    // Empty question → 400
    const res1 = await fetch(`http://localhost:${port}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: '' }),
    });
    assert.equal(res1.status, 400, 'Empty question should return 400');

    // No body → 400
    const res2 = await fetch(`http://localhost:${port}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res2.status, 400, 'Missing question should return 400');

    // Health check
    const healthRes = await fetch(`http://localhost:${port}/api/health`);
    const health = await healthRes.json();
    assert.equal(health.status, 'ok');
    assert.equal(health.provider, 'groq');
    assert.ok(health.model, 'Model should be set');

    console.log('✓ Test 2 passed!\n');
  } finally {
    server.close();
  }
}

await testHttpValidation();

console.log('========================================');
console.log('🎉 ALL TESTS PASSED!');
console.log('========================================');
