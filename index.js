const express = require('express');
const path = require('path');

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
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Lambda handler for ALB
exports.handler = async (event, context) => {
  console.log('ALB Event:', JSON.stringify(event, null, 2));
  context.callbackWaitsForEmptyEventLoop = false;

  return new Promise((resolve) => {
    // Create mock request and response objects
    const mockReq = {
      method: event.httpMethod || 'GET',
      url: event.path || '/',
      headers: event.headers || {},
      body: event.body || '',
      rawBody: event.body || ''
    };

    let responseStatusCode = 200;
    let responseHeaders = {};
    let responseBody = '';
    let responseSent = false;

    const mockRes = {
      statusCode: 200,
      statusMessage: 'OK',
      headers: {},

      status(code) {
        responseStatusCode = code;
        this.statusCode = code;
        return this;
      },

      setHeader(name, value) {
        responseHeaders[name.toLowerCase()] = value;
        this.headers[name.toLowerCase()] = value;
      },

      getHeader(name) {
        return this.headers[name.toLowerCase()];
      },

      writeHead(statusCode, headers) {
        responseStatusCode = statusCode;
        if (headers) {
          Object.keys(headers).forEach(key => {
            responseHeaders[key.toLowerCase()] = headers[key];
          });
        }
      },

      write(chunk) {
        if (typeof chunk === 'string') {
          responseBody += chunk;
        } else if (Buffer.isBuffer(chunk)) {
          responseBody += chunk.toString();
        }
      },

      end(chunk) {
        if (chunk) {
          if (typeof chunk === 'string') {
            responseBody += chunk;
          } else if (Buffer.isBuffer(chunk)) {
            responseBody += chunk.toString();
          }
        }

        if (!responseSent) {
          responseSent = true;
          const response = {
            statusCode: responseStatusCode,
            statusDescription: `${responseStatusCode} OK`,
            headers: responseHeaders,
            body: responseBody,
            isBase64Encoded: false
          };
          console.log('ALB Response:', JSON.stringify(response, null, 2));
          resolve(response);
        }
      },

      json(data) {
        this.setHeader('Content-Type', 'application/json');
        this.end(JSON.stringify(data));
      },

      send(data) {
        if (typeof data === 'string') {
          this.setHeader('Content-Type', 'text/html; charset=utf-8');
        } else if (typeof data === 'object') {
          this.setHeader('Content-Type', 'application/json');
          data = JSON.stringify(data);
        }
        this.end(data);
      },

      sendFile(filePath, callback) {
        const fs = require('fs');
        fs.readFile(filePath, 'utf8', (err, data) => {
          if (err) {
            console.error('Error reading file:', err);
            this.statusCode = 404;
            this.end('Not Found');
          } else {
            this.setHeader('Content-Type', 'text/html; charset=utf-8');
            this.end(data);
          }
          if (callback) callback(err);
        });
      }
    };

    // Call the Express app with our mock request/response
    try {
      app(mockReq, mockRes);

      // Set a timeout in case the handler doesn't call res.end()
      setTimeout(() => {
        if (!responseSent) {
          responseSent = true;
          resolve({
            statusCode: 500,
            statusDescription: '500 Internal Server Error',
            headers: { 'Content-Type': 'text/plain' },
            body: 'Request timeout',
            isBase64Encoded: false
          });
        }
      }, 25000); // 25 second timeout (Lambda has 30s max by default)

    } catch (error) {
      console.error('Error:', error);
      if (!responseSent) {
        responseSent = true;
        resolve({
          statusCode: 500,
          statusDescription: '500 Internal Server Error',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: error.message }),
          isBase64Encoded: false
        });
      }
    }
  });
};

// Local development mode
if (process.env.NODE_ENV !== 'production' && !process.env.LAMBDA_TASK_ROOT) {
  const server = app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });

  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}
