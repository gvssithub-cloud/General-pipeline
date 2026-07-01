const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    service: 'arss-it-solutions.com',
  });
});

app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Not Found');
  }
});

// Lambda handler for ALB integration
exports.handler = async (event, context) => {
  console.log('Lambda invoked with event:', JSON.stringify(event));
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    return await new Promise((resolve) => {
      // Parse the request
      const httpMethod = event.httpMethod || 'GET';
      const path = event.path || '/';
      const headers = event.headers || {};
      const body = event.body || '';

      console.log(`Processing ${httpMethod} ${path}`);

      // Create mock request/response
      let statusCode = 200;
      let responseHeaders = { 'Content-Type': 'text/html' };
      let responseBody = '';

      const req = {
        method: httpMethod,
        url: path,
        path: path,
        headers: headers,
        body: body,
        on: () => {}
      };

      const res = {
        statusCode: 200,
        status(code) {
          statusCode = code;
          return this;
        },
        setHeader(key, value) {
          responseHeaders[key] = value;
        },
        writeHead(code, hdrs) {
          statusCode = code;
          if (hdrs) {
            Object.assign(responseHeaders, hdrs);
          }
        },
        write(chunk) {
          responseBody += chunk || '';
        },
        end(chunk) {
          if (chunk) responseBody += chunk;
          resolve({
            statusCode: statusCode,
            statusDescription: `${statusCode} OK`,
            headers: responseHeaders,
            body: responseBody,
            isBase64Encoded: false
          });
        },
        json(data) {
          responseHeaders['Content-Type'] = 'application/json';
          responseBody = JSON.stringify(data);
          resolve({
            statusCode: statusCode,
            statusDescription: `${statusCode} OK`,
            headers: responseHeaders,
            body: responseBody,
            isBase64Encoded: false
          });
        },
        send(data) {
          if (typeof data === 'object') {
            this.json(data);
          } else {
            responseHeaders['Content-Type'] = 'text/html';
            responseBody = data;
            resolve({
              statusCode: statusCode,
              statusDescription: `${statusCode} OK`,
              headers: responseHeaders,
              body: responseBody,
              isBase64Encoded: false
            });
          }
        },
        sendFile(filePath) {
          try {
            const content = fs.readFileSync(filePath, 'utf8');
            responseHeaders['Content-Type'] = 'text/html';
            responseBody = content;
            resolve({
              statusCode: 200,
              statusDescription: '200 OK',
              headers: responseHeaders,
              body: responseBody,
              isBase64Encoded: false
            });
          } catch (err) {
            console.error('Error reading file:', err);
            resolve({
              statusCode: 404,
              statusDescription: '404 Not Found',
              headers: { 'Content-Type': 'text/plain' },
              body: 'Not Found',
              isBase64Encoded: false
            });
          }
        }
      };

      // Call Express
      app(req, res);

      // Timeout fallback
      setTimeout(() => {
        resolve({
          statusCode: 504,
          statusDescription: '504 Gateway Timeout',
          headers: { 'Content-Type': 'text/plain' },
          body: 'Request timeout',
          isBase64Encoded: false
        });
      }, 25000);
    });
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      statusDescription: '500 Internal Server Error',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message }),
      isBase64Encoded: false
    };
  }
};

// Local development
if (process.env.NODE_ENV !== 'production' && !process.env.LAMBDA_TASK_ROOT) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}
