const express = require('express');
const path = require('path');
const serverlessExpress = require('@vendia/serverless-express');

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

// Production - Lambda handler
exports.handler = serverlessExpress({ app });

// Development - local server
if (!process.env.AWS_EXECUTION_ENV) {
  app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
  });
}
