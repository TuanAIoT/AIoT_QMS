import { createMockLocalServer } from './server.js';

const port = Number(process.env.MOCK_LOCAL_PORT ?? '3001');
const delayMs = Number(process.env.MOCK_LOCAL_DELAY_MS ?? '0');
const corsOrigin = process.env.MOCK_LOCAL_CORS_ORIGIN;
const server = createMockLocalServer({
  delayMs,
  ...(corsOrigin === undefined ? {} : { corsOrigin }),
});

await server.listen(port, '127.0.0.1');
console.log(`Mock Local Server listening on http://127.0.0.1:${String(port)}/api/v1`);
