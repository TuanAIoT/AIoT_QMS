import { createMockCentralServer } from './server.js';

function parsePort(value: string | undefined): number {
  const port = Number(value ?? '3002');
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new TypeError('MOCK_CENTRAL_PORT must be an integer from 1 to 65535.');
  }
  return port;
}

const port = parsePort(process.env.MOCK_CENTRAL_PORT);
const host = process.env.MOCK_CENTRAL_HOST ?? '127.0.0.1';
const corsOrigins = (process.env.MOCK_CENTRAL_CORS_ORIGIN ?? 'http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

const server = createMockCentralServer({
  corsOrigins,
  ...(process.env.NODE_ENV === undefined ? {} : { nodeEnv: process.env.NODE_ENV }),
  ...(process.env.MOCK_CENTRAL_RESET_CREDENTIAL === undefined
    ? {}
    : { resetCredential: process.env.MOCK_CENTRAL_RESET_CREDENTIAL }),
  ...(process.env.MOCK_CENTRAL_ZALO_TOKEN_USER_A === undefined
    ? {}
    : { userAToken: process.env.MOCK_CENTRAL_ZALO_TOKEN_USER_A }),
  ...(process.env.MOCK_CENTRAL_ZALO_TOKEN_USER_B === undefined
    ? {}
    : { userBToken: process.env.MOCK_CENTRAL_ZALO_TOKEN_USER_B }),
});

await server.listen(port, host);
console.log(`Mock Central Server DEVELOPMENT_ONLY listening at http://${host}:${String(port)}`);
