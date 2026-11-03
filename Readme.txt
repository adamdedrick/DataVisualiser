DataVisualise
=============

DataVisualiser turns structured JSON into a formatted report.
It allows you to create a standard visualisation of any supplied json data.



How to Run
==========

Start with npm start, then visit http://localhost:3000 to paste JSON data
and select a report template (for example, sample ).

API: POST http://localhost:3000/generate-report?reportname=sample
Content-Type: application/json

Add &inHTML=true to the query string to return the rendered HTML instead of a PDF.
HTML mode skips PDF generation.

Request body example:
{
	"orderId": "ABC-123",
	"ItemLinesCollection": []
}

Send the full report data object as the entire POST body, without a payload wrapper.
Specify the template name in the reportname query parameter (URL-encoded).
Do not base64 encode the data or send it as a JSON string.
The response is an application/pdf attachment. Maximum JSON body size: 10 MB.
Report names must start with a letter or number and contain only letters,
numbers, spaces, underscores or hyphens.

Debug HTML and extended payload JSON are still saved locally by the generator.

Run tests with node --test.








