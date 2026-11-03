const fs = require('fs/promises');
const path = require('path');
const Handlebars = require('handlebars');
const puppeteer = require('puppeteer');
const { initHandlebarsHelpers } = require('./handlebars-helpers');

async function dataVisualise(payload, reportName, options = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('dataVisualise requires a JSON payload object');
  }
  if (typeof reportName !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9 _-]*$/.test(reportName)) {
    throw new Error('dataVisualise requires a valid reportName');
  }

  const params = {
    reportname: reportName
  };

  const reportDir = path.join(__dirname, 'reports', reportName);
  await fs.mkdir(reportDir, { recursive: true });

  let extendedPayload = payload;
  const payLoadPath = path.join(reportDir, `${reportName}-Payload.json`);
  await fs.writeFile(payLoadPath, JSON.stringify(payload, null, 2), 'utf8');

  const dataManipulationPath = path.join(reportDir, 'dataManipulation.js');
  let hasReportDataManipulation = true;

  try {
    await fs.access(dataManipulationPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      hasReportDataManipulation = false;
    } else {
      throw error;
    }
  }

  if (hasReportDataManipulation) {
    const { PrepareData } = require(dataManipulationPath);
    if (typeof PrepareData !== 'function') {
      throw new TypeError(`The dataManipulation.js for report "${reportName}" must export PrepareData`);
    }
    extendedPayload = await PrepareData(payload);
  }

  const extendedPath = path.join(reportDir, `${reportName}-extendedPayload.json`);
  await fs.writeFile(extendedPath, JSON.stringify(extendedPayload, null, 2), 'utf8');
  const html = await renderTemplate(params, extendedPayload);

  // Save HTML to file for debugging
  const htmlFilePath = path.join(reportDir, `${reportName}-debug.html`);
    await fs.writeFile(htmlFilePath, html, 'utf8');
   console.log(`Saved HTML to ${htmlFilePath}`);

  if (options.inHTML === true) {
    return html;
  }
  
  let pdfBuffer;
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox','--allow-file-access-from-files', '--enable-local-file-accesses']
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, {  waitUntil: "load" });

      const generatedPdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });

      pdfBuffer = Buffer.from(generatedPdf);
    } finally {
      await browser.close();
    }
  } catch (error) {
    const plainText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    console.warn('Falling back to a simple PDF because HTML rendering failed:', error.message);
    const simplePdf = buildSimplePdf(plainText);
    pdfBuffer = Buffer.from(simplePdf, 'utf8');
  }

  const pdfPath = path.join(reportDir, `${reportName}.pdf`);
  await fs.writeFile(pdfPath, pdfBuffer);
  return pdfBuffer;
}

function escapePdfText(value) {
  const escapedText = String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

  return escapedText;
}

async function findTemplatePath(reportname) {
  const safeReportName = String(reportname || '').trim().replace(/[\\/]/g, '');

  if (!safeReportName) {
    throw new Error('reportname is required');
  }

  const candidatePaths = [
    path.join(__dirname, 'reports', safeReportName, 'template.html'),
    path.join(__dirname, 'reports', `${safeReportName}.html`),
    path.join(__dirname, 'reports', safeReportName, 'index.html')
  ];

  for (const candidatePath of candidatePaths) {
    try {
      await fs.access(candidatePath);
      return candidatePath;
    } catch {
      // Continue searching for the next candidate.
    }
  }

  throw new Error(`No report template found for "${reportname}" in the reports folder.`);
}

function getImageMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.svg':
      return 'image/svg+xml';
    case '.webp':
      return 'image/webp';
    case '.bmp':
      return 'image/bmp';
    case '.ico':
      return 'image/x-icon';
    default:
      return 'application/octet-stream';
  }
}


async function inlineLocalImageSources(templateHtml, templatePath) {
  const templateDir = path.dirname(templatePath);
  let htmlWithInlinedImages = templateHtml;
  const imageTagPattern = /<img\b[^>]*\bsrc=(['"])(.*?)\1[^>]*>/gi;

  for (const match of htmlWithInlinedImages.matchAll(imageTagPattern)) {
    const rawSrc = match[2];
    if (!rawSrc) {
      continue;
    }

    const normalizedSrc = rawSrc.split('?')[0].split('#')[0];
    if (!normalizedSrc || /^(?:data:|https?:|\/\/|mailto:|tel:|javascript:)/i.test(normalizedSrc) || normalizedSrc.includes('{{')) {
      continue;
    }

    const imagePath = path.resolve(templateDir, normalizedSrc);

    try {
      await fs.access(imagePath);
    } catch {
      continue;
    }

    const imageBuffer = await fs.readFile(imagePath);
    const mimeType = getImageMimeType(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    htmlWithInlinedImages = htmlWithInlinedImages.replace(match[0], match[0].replace(rawSrc, dataUrl));
  }

  return htmlWithInlinedImages;
}



async function renderTemplate(params = {}, jsonData = {}) {
  const { reportname, ...extraValues } = params;
  const templatePath = await findTemplatePath(reportname);
  const templateHtml = await fs.readFile(templatePath, 'utf8');

  const replacements = {
    reportname: reportname || '',
    payload: jsonData,
    ...extraValues
  };
  initHandlebarsHelpers(Handlebars);

  const template = Handlebars.compile(templateHtml);
  const renderedTemplate = template({
    ...jsonData,
    ...replacements
  });

  const htmlWithInlineImages = await inlineLocalImageSources(renderedTemplate, templatePath);
  return htmlWithInlineImages;
}

module.exports = { dataVisualise, renderTemplate };
