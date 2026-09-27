/**
 * Startup file for cPanel "Setup Node.js App" (Phusion Passenger), PM2 or plain `node server.js`.
 * Runs the production Next.js server on the port the host provides.
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
const { createServer } = require('http');
const next = require('next');

const port = parseInt(process.env.PORT || '3000', 10);
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(port, () => {
    console.log(`NEVER SETTLE running on port ${port}`);
  });
});
