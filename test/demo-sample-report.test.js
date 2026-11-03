const test = require('node:test');
const assert = require('node:assert/strict');
const { dataVisualise, renderTemplate } = require('../dataVisualise');

const reportName = 'sample';

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

test('demo: generate a PDF using the simple sample report', { concurrency: false }, async () => {
  const renderedHtml = await renderTemplate({ reportname: reportName }, demoPayload);

  assert.match(renderedHtml, /CHAIR-OAK/);
  assert.match(renderedHtml, /Solid oak dining chair/);
  assert.match(renderedHtml, /LAMP-BRASS/);

  const pdfBuffer = await dataVisualise(demoPayload, reportName);

  assert.ok(Buffer.isBuffer(pdfBuffer), 'generator should return a PDF buffer');
  assert.match(pdfBuffer.toString('utf8', 0, 5), /^%PDF/, 'generated output should be a PDF');
});
