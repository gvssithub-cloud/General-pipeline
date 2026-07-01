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
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
let server;

if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
  // Running on Lambda - export handler for web adapter
  // The aws-lambda-web-adapter will route traffic through this
  const awsLambdaWebAdapter = require('aws-lambda-web-adapter');
  exports.handler = awsLambdaWebAdapter.httpHandler(app);
} else {
  // Local development
  server = app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
  });

  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}
