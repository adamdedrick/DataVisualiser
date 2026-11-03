const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createApp } = require('../server');

async function withServer(t, generateReport) {
  const server = createApp(generateReport).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

test('POST passes the entire JSON body and query report name to the generator and returns PDF', async t => {
  const payload = { orderId: 'ABC-123', ItemLinesCollection: [], reportname: 'data-value', payload: { nested: true } };
  const pdf = Buffer.from('%PDF-1.4\nTest');
  let calls = 0;
  const url = await withServer(t, async (data, name) => {
    calls++;
    assert.deepEqual(data, payload);
    assert.equal(name, 'sample');
    return pdf;
  });
  const response = await fetch(`${url}/generate-report?reportname=sample`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.equal(response.headers.get('content-disposition'), 'attachment; filename="sample.pdf"');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), pdf);
  assert.equal(calls, 1);
});

test('POST returns rendered HTML when inHTML=true', async t => {
  const payload = { orderId: 'ABC-123' };
  const html = '<!doctype html><html><body>Report</body></html>';
  const url = await withServer(t, async (data, name, options) => {
    assert.deepEqual(data, payload);
    assert.equal(name, 'sample');
    assert.deepEqual(options, { inHTML: true });
    return html;
  });
  const response = await fetch(`${url}/generate-report?reportname=sample&inHTML=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/html/);
  assert.equal(response.headers.get('content-disposition'), null);
  assert.equal(await response.text(), html);
});

test('POST rejects missing, encoded, or invalid payloads and unsafe report names', async t => {
  const url = await withServer(t, () => assert.fail('Invalid request reached generator'));
  for (const [query, body] of [
    ['', {}], ['', { reportname: 'sample' }],
    ['?reportname=', {}],
    ['?reportname=sample', undefined],
    ['?reportname=sample', null],
    ['?reportname=sample', []],
    ['?reportname=sample', 'eyJvcmRlcklkIjoiQUJDIn0='],
    ['?reportname=..%2Fsample', {}],
    ['?reportname=sample%22', {}],
    ['?reportname=sample&reportname=other', {}],
    ['?reportname[name]=sample', {}]
  ]) {
    const response = await fetch(`${url}/generate-report${query}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    assert.equal(response.status, 400);
    assert.ok((await response.json()).error);
  }
});

test('POST rejects malformed JSON, wrong content type, and oversized bodies', async t => {
  const url = await withServer(t, () => assert.fail('Invalid request reached generator'));
  for (const [contentType, body, expectedStatus] of [
    ['application/json', '{invalid', 400],
    ['text/plain', '{}', 415],
    ['application/json', JSON.stringify({ data: 'x'.repeat(10 * 1024 * 1024) }), 413]
  ]) {
    const response = await fetch(`${url}/generate-report?reportname=sample`, {
      method: 'POST', headers: { 'Content-Type': contentType }, body
    });
    assert.equal(response.status, expectedStatus);
    assert.ok((await response.json()).error);
  }
});

test('old GET endpoint is unavailable and home page uses JSON POST', async t => {
  const url = await withServer(t, () => assert.fail('GET reached generator'));
  assert.equal((await fetch(`${url}/generate-report?reportname=sample`)).status, 404);
  const html = await (await fetch(url)).text();
  assert.match(html, /method: 'POST'/);
  assert.match(html, /encodeURIComponent\(reportname\)/);
  assert.match(html, /body: JSON.stringify\(payload\)/);
  assert.match(html, /JSON data/);
  assert.match(html, /<option value="pdf">PDF<\/option>/);
  assert.match(html, /<option value="html">HTML<\/option>/);
  assert.match(html, /outputFormat === 'html' \? '&inHTML=true' : ''/);
});

test('POST returns 500 if PDF generation fails', async t => {
  const url = await withServer(t, async () => { throw new Error('Test generation failure'); });
  const response = await fetch(`${url}/generate-report?reportname=sample`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Failed to generate PDF' });
});