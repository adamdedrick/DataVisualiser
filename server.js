const express = require('express');
const { dataVisualise } = require('./dataVisualise');

const port = process.env.PORT || 3000;

function createApp(generateReport = dataVisualise) {
const app = express();
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buffer) => {
    req.hasJsonBody = buffer.length > 0;
  }
}));

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head><title>DataVisualise</title></head>
<body>
  <h1>DataVisualise</h1>
  <form id="report-form">
    <label>Report Name: <input name="reportname" required /></label><br><br>
    <label>Output format:
      <select name="outputFormat">
        <option value="pdf">PDF</option>
        <option value="html">HTML</option>
      </select>
    </label><br><br>
    <label>JSON data:<br><textarea name="payload" rows="20" cols="80" required>{}</textarea></label><br><br>
    <button type="submit">Generate PDF</button>
  </form>
  <p id="status" role="status"></p>
  <script>
    document.getElementById('report-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const status = document.getElementById('status');
      const button = form.querySelector('button');
      button.disabled = true;
      status.textContent = 'Generating report...';
      try {
        const reportname = form.elements.reportname.value.trim();
        const outputFormat = form.elements.outputFormat.value;
        const payload = JSON.parse(form.elements.payload.value);
        const query = 'reportname=' + encodeURIComponent(reportname)
          + (outputFormat === 'html' ? '&inHTML=true' : '');
        const response = await fetch('/generate-report?' + query, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to generate PDF');
        }
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement('a');
        link.href = url;
        link.download = reportname + '.' + outputFormat;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        status.textContent = outputFormat.toUpperCase() + ' report downloaded.';
      } catch (error) {
        status.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });
  </script>
</body>
</html>`);
});

app.post('/generate-report', async (req, res) => {
  if (!req.is('application/json')) {
    return res.status(415).json({ error: 'Content-Type must be application/json' });
  }
  const { reportname } = req.query;
  const inHTML = typeof req.query.inHTML === 'string' && req.query.inHTML.toLowerCase() === 'true';
  const payload = req.body;

  if (typeof reportname !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9 _-]*$/.test(reportname)) {
    return res.status(400).json({
      error: 'The reportname query parameter must start with a letter or number and contain only letters, numbers, spaces, underscores or hyphens'
    });
  }
  if (!req.hasJsonBody || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }

  try {
    const result = await generateReport(payload, reportname, { inHTML });

    if (inHTML) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(result);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${reportname}.pdf"`);
    res.send(result);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

app.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON request body' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'JSON request body exceeds the 10 MB limit' });
  }
  next(error);
});

return app;
}

if (require.main === module) {
  createApp().listen(port, () => {
    console.log(`DataVisualise listening on http://localhost:${port}`);
  });
}

module.exports = { createApp };
