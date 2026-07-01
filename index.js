const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    service: 'arss-it-solutions.com',
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Simple Lambda handler
const handler = async (event, context) => {
  console.log('Event:', JSON.stringify(event));
  context.callbackWaitsForEmptyEventLoop = false;

  const method = event.httpMethod;
  const urlPath = event.path;
  const headers = event.headers || {};
  const body = event.body || '';

  console.log(`${method} ${urlPath}`);

  return new Promise((resolve, reject) => {
    let responseStatusCode = 200;
    let responseHeaders = { 'Content-Type': 'text/html; charset=utf-8' };
    let responseBody = '';
    let responded = false;

    const req = {
      method,
      url: urlPath,
      path: urlPath,
      headers,
      body,
      on: () => {},
      once: () => {},
      removeListener: () => {}
    };

    const res = {
      statusCode: 200,
      headersSent: false,
      finished: false,
      writableEnded: false,

      status(code) {
        responseStatusCode = code;
        return this;
      },

      setHeader(name, value) {
        responseHeaders[name] = value;
      },

      writeHead(code, msg, hdrs) {
        responseStatusCode = code || 200;
        if (typeof msg === 'object') hdrs = msg;
        if (hdrs) Object.assign(responseHeaders, hdrs);
      },

      write(chunk) {
        responseBody += chunk || '';
        return true;
      },

      end(chunk) {
        if (chunk) responseBody += chunk;
        if (!responded) {
          responded = true;
          console.log(`Response: ${responseStatusCode}`);
          resolve({
            statusCode: responseStatusCode,
            statusDescription: `${responseStatusCode} OK`,
            headers: responseHeaders,
            body: responseBody,
            isBase64Encoded: false
          });
        }
      },

      json(data) {
        this.setHeader('Content-Type', 'application/json');
        this.end(JSON.stringify(data));
      },

      send(data) {
        if (typeof data === 'object') {
          this.json(data);
        } else {
          this.end(data || '');
        }
      },

      sendFile(filepath) {
        try {
          const content = fs.readFileSync(filepath, 'utf8');
          this.setHeader('Content-Type', 'text/html; charset=utf-8');
          this.end(content);
        } catch (err) {
          this.statusCode = 404;
          this.end('Not Found');
        }
      }
    };

    try {
      app(req, res);
    } catch (err) {
      console.error('Error:', err);
      if (!responded) {
        responded = true;
        resolve({
          statusCode: 500,
          statusDescription: '500 Error',
          headers: { 'Content-Type': 'text/plain' },
          body: err.message,
          isBase64Encoded: false
        });
      }
    }

    setTimeout(() => {
      if (!responded) {
        responded = true;
        resolve({
          statusCode: 500,
          statusDescription: '500 Timeout',
          headers: { 'Content-Type': 'text/plain' },
          body: 'Timeout',
          isBase64Encoded: false
        });
      }
    }, 29000);
  });
};

exports.handler = handler;

// Development
if (!process.env.LAMBDA_TASK_ROOT) {
  app.listen(3000, () => console.log('Dev server on :3000'));
}
