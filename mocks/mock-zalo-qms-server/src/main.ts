import { createMockZaloQmsServer } from './server.js';

function parsePort(value: string | undefined): number {
  const port = Number(value ?? '3003');
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new TypeError('MOCK_ZALO_QMS_PORT must be an integer from 1 to 65535.');
  }
  return port;
}

const corsOrigins = (process.env.MOCK_ZALO_QMS_CORS_ORIGIN ??
  'http://127.0.0.1:5173,http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

const server = createMockZaloQmsServer({ corsOrigins });
const host = process.env.MOCK_ZALO_QMS_HOST ?? '127.0.0.1';
const port = parsePort(process.env.MOCK_ZALO_QMS_PORT);

server
  .listen(port, host)
  .then((actualPort) => {
    console.info(`Mock Zalo QMS Server listening at http://${host}:${String(actualPort)}`);
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Mock Zalo QMS Server failed.');
    process.exitCode = 1;
  });
