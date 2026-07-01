const express = require('express');
const path = require('path');
const http = require('http');

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

let server;

// Lambda handler for ALB
exports.handler = async (event, context) => {
  console.log('Event received:', JSON.stringify(event, null, 2));
  
  return new Promise((resolve, reject) => {
    // Start server if not already running
    if (!server) {
      server = http.createServer(app);
      server.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
      });
    }

    // Create a mock request and response
    const requestUrl = event.path || event.rawPath || '/';
    const requestMethod = event.httpMethod || event.requestContext?.http?.method || 'GET';
    const requestHeaders = event.headers || {};
    
    // Make request to local server
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: requestUrl,
      method: requestMethod,
      headers: requestHeaders
    };

    const req = http.request(options, (res) => {
      let responseBody = '';

      res.on('data', (chunk) => {
        responseBody += chunk;
      });

      res.on('end', () => {
        const response = {
          statusCode: res.statusCode,
          statusDescription: `${res.statusCode} ${res.statusMessage}`,
          headers: res.headers,
          body: responseBody,
          isBase64Encoded: false
        };
        console.log('Response:', JSON.stringify(response, null, 2));
        resolve(response);
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error);
      resolve({
        statusCode: 500,
        statusDescription: '500 Internal Server Error',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Internal Server Error' }),
        isBase64Encoded: false
      });
    });

    if (event.body) {
      req.write(event.body);
    }

    req.end();
  });
};

// Local development mode
if (process.env.AWS_LAMBDA_FUNCTION_NAME === undefined && !process.env.LAMBDA_TASK_ROOT) {
  server = http.createServer(app);
  server.listen(PORT, () => {
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
