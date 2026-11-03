const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { renderTemplate, dataVisualise } = require('../dataVisualise');
const Handlebars = require('handlebars');

test('renderTemplate replaces the report name in the sample template', { concurrency: false }, async () => {
  const html = await renderTemplate({
    reportname: 'sample'
  });

  assert.match(html, /<h1>Sales Summary<\/h1>/);
  assert.match(html, /Report Name:<\/strong> sample/);
  assert.doesNotMatch(html, /{{\s*reportname\s*}}/);
});

test('renderTemplate supports Mustache sections and loops', { concurrency: false }, async () => {
  const html = await renderTemplate({
     reportname: 'sample',
    items: [
      { name: 'Widget', value: '$10' },
      { name: 'Gadget', value: '$20' }
    ]
  });

  assert.match(html, /<strong>Widget:<\/strong> \$10/);
  assert.match(html, /<strong>Gadget:<\/strong> \$20/);
});

test('renderTemplate includes payload data when provided', { concurrency: false }, async () => {
  const html = await renderTemplate({
    reportname: 'payload-test'
  }, {
    orderId: 'ABC-123'
  });

  assert.match(html, /Order ID: ABC-123/);
});

test('blankIfZero2 returns blank for zero and supports optional prefix and suffix for non-zero', { concurrency: false }, async () => {
  await renderTemplate({ reportname: 'sample' });

  const template = Handlebars.compile('{{blankIfZero2 value prefix suffix}}');
  assert.equal(template({ value: 0, suffix: ' cc' }), '');
  assert.equal(template({ value: '0', suffix: ' cc' }), '');
  assert.equal(template({ value: 125, suffix: ' cc' }), '125 cc');
  assert.equal(template({ value: 125, suffix: ' cc', prefix: '~' }), '~125 cc');
});

test('dataVisualise returns a PDF buffer for a report template', { concurrency: false }, async () => {
  const pdfBuffer = await dataVisualise({ orderId: 'ABC-123' }, 'sample');

  assert.ok(Buffer.isBuffer(pdfBuffer));
  assert.match(pdfBuffer.toString('utf8').slice(0, 5), /^%PDF/);
});

test('dataVisualise returns HTML without creating a PDF when requested', { concurrency: false }, async () => {
  const reportName = 'payload-test';
  const pdfPath = path.join(__dirname, '..', 'reports', reportName, `${reportName}.pdf`);
  await fs.rm(pdfPath, { force: true });

  const html = await dataVisualise({ orderId: 'ABC-123' }, reportName, { inHTML: true });

  assert.equal(typeof html, 'string');
  assert.match(html, /Order ID: ABC-123/);
  await assert.rejects(fs.access(pdfPath), { code: 'ENOENT' });
});

test('dataVisualise rejects invalid payloads and unsafe report names', async () => {
  for (const payload of [undefined, null, [], 'base64-data']) {
    await assert.rejects(dataVisualise(payload, 'sample'), /JSON payload object/);
  }
  for (const reportname of [undefined, '', '../sample', 'sample"']) {
    await assert.rejects(dataVisualise({}, reportname), /valid reportName/);
  }
});
