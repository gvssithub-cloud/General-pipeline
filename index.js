const express = require('express');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');

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

// Lambda ALB handler
exports.handler = async (event, context) => {
  console.log('ALB Event:', JSON.stringify(event));
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    // Parse ALB event
    const httpMethod = event.httpMethod || 'GET';
    const path = event.path || '/';
    const queryString = event.queryStringParameters ? 
      '?' + new URLSearchParams(event.queryStringParameters).toString() : '';
    const headers = event.headers || {};
    const body = event.body || '';
    const isBase64Encoded = event.isBase64Encoded || false;

    console.log(`${httpMethod} ${path}${queryString}`);

    return new Promise((resolve) => {
      // Create mock request stream
      const mockReq = new Readable({
        read() {}
      });

      // Add properties to mock request
      mockReq.method = httpMethod;
      mockReq.url = path + queryString;
      mockReq.headers = headers;
      mockReq.httpVersion = '1.1';
      mockReq.socket = { remoteAddress: headers['x-forwarded-for'] || '127.0.0.1' };

      if (body) {
        mockReq.push(isBase64Encoded ? Buffer.from(body, 'base64').toString() : body);
      }
      mockReq.push(null);

      // Collect response
      let statusCode = 200;
      let responseHeaders = {};
      let responseBody = '';

      const mockRes = {
        statusCode: 200,
        statusMessage: 'OK',
        headers: {},
        finished: false,
        sent: false,

        status(code) {
          this.statusCode = code;
          return this;
        },

        setHeader(name, value) {
          this.headers[name.toLowerCase()] = value;
        },

        getHeader(name) {
          return this.headers[name.toLowerCase()];
        },

        writeHead(code, msg, headers) {
          statusCode = code || this.statusCode;
          if (typeof msg === 'object') {
            headers = msg;
          }
          if (headers) {
            Object.keys(headers).forEach(key => {
              this.headers[key.toLowerCase()] = headers[key];
            });
          }
        },

        write(chunk) {
          if (chunk) {
            responseBody += Buffer.isBuffer(chunk) ? chunk.toString() : chunk;
          }
          return true;
        },

        end(chunk) {
          if (chunk) {
            responseBody += Buffer.isBuffer(chunk) ? chunk.toString() : chunk;
          }

          if (!this.sent) {
            this.sent = true;
            this.finished = true;

            const response = {
              statusCode: statusCode,
              statusDescription: `${statusCode} OK`,
              headers: this.headers,
              body: responseBody,
              isBase64Encoded: false
            };

            console.log('ALB Response:', JSON.stringify({
              statusCode: response.statusCode,
              headers: response.headers,
              bodyLength: response.body.length
            }));

            resolve(response);
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
            this.setHeader('Content-Type', 'text/html; charset=utf-8');
            this.end(data);
          }
        },

        sendFile(filePath) {
          fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
              console.error('File read error:', err);
              this.statusCode = 404;
              this.setHeader('Content-Type', 'text/plain');
              this.end('File not found');
            } else {
              this.setHeader('Content-Type', 'text/html; charset=utf-8');
              this.end(data);
            }
          });
        }
      };

      // Call Express app
      try {
        app(mockReq, mockRes);
      } catch (err) {
        console.error('Express error:', err);
        resolve({
          statusCode: 500,
          statusDescription: '500 Internal Server Error',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: err.message }),
          isBase64Encoded: false
        });
      }

      // Timeout safety net
      setTimeout(() => {
        if (!mockRes.sent) {
          mockRes.sent = true;
          resolve({
            statusCode: 504,
            statusDescription: '504 Gateway Timeout',
            headers: { 'Content-Type': 'text/plain' },
            body: 'Request timeout',
            isBase64Encoded: false
          });
        }
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
if (!process.env.LAMBDA_TASK_ROOT) {
  app.listen(PORT, () => {
    console.log(`Development server running at http://localhost:${PORT}`);
  });
}
