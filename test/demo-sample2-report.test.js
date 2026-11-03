const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { dataVisualise } = require('../dataVisualise');

const reportName = 'sample2';
const reportDir = path.join(__dirname, '..', 'reports', reportName);

const demoPayload = {
  OrderNumber: 'DEMO-2026-001',
  Customer: {
    Name: 'Northwind Workshop',
    Email: 'orders@example.test'
  },
  AlternativesCollection: [
    {
      DesignsCollection: [
        {
          ItemLinesCollection: [
            {
              Code: 'CHAIR-OAK',
              Description: 'Solid oak dining chair',
              QuotationQuantity: 4,
              ModelName: 'Oak Chair',
              Volume: '0.42'
            },
            {
              Code: 'TABLE-OAK',
              Description: 'Extendable solid oak table',
              QuotationQuantity: 1,
              ModelName: 'Oak Table',
              Volume: '0.85'
            },
            {
              Code: 'LAMP-BRASS',
              Description: 'Brushed brass desk lamp',
              QuotationQuantity: 2,
              ModelName: 'Brass Lamp',
              Volume: '0.18'
            }
          ]
        }
      ]
    }
  ]
};

test('demo: generate sample PDF report using made-up data', { concurrency: false }, async () => {
  const pdfBuffer = await dataVisualise(demoPayload, reportName);

  assert.ok(Buffer.isBuffer(pdfBuffer), 'generator should return a PDF buffer');
  assert.match(pdfBuffer.toString('utf8', 0, 5), /^%PDF/, 'generated output should be a PDF');

  const pdfPath = path.join(reportDir, `${reportName}.pdf`);
  const htmlPath = path.join(reportDir, `${reportName}-debug.html`);
  const renderedHtml = await fs.readFile(htmlPath, 'utf8');
  const savedPdf = await fs.readFile(pdfPath);
  const extendedPayload = JSON.parse(await fs.readFile(
    path.join(reportDir, `${reportName}-extendedPayload.json`),
    'utf8'
  ));

  assert.match(renderedHtml, /CHAIR-OAK/);
  assert.match(renderedHtml, /Solid oak dining chair/);
  assert.match(renderedHtml, /LAMP-BRASS/);
  assert.deepEqual(savedPdf, pdfBuffer);
  assert.equal(extendedPayload.OrderNumber, 'DEMO-2026-001');

  console.log(`Demo PDF saved to ${pdfPath}`);
});
