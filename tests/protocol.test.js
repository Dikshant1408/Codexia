import { test } from 'node:test';
import * as assert from 'node:assert';
import { ProtocolClient, ProtocolServer } from '../packages/protocol/dist/index.js';

test('Universal Protocol: client and server communicate via JSON-RPC', async () => {
  let serverReceiver = (msg) => {};
  let clientReceiver = (msg) => {};

  const serverTransport = {
    send: (msg) => clientReceiver(msg),
    onMessage: (cb) => { serverReceiver = cb; },
    close: () => {}
  };

  const clientTransport = {
    send: (msg) => serverReceiver(msg),
    onMessage: (cb) => { clientReceiver = cb; },
    close: () => {}
  };

  const server = new ProtocolServer(serverTransport);
  const client = new ProtocolClient(clientTransport);

  server.registerHandler('codearch/getStatus', async () => {
    return {
      version: '0.1.0',
      status: 'ready',
      dbPath: ':memory:',
      aiStatus: {
        enabled: false,
        statusText: '● LOCAL ANALYSIS'
      }
    };
  });

  const response = await client.request('codearch/getStatus', {});

  assert.strictEqual(response.version, '0.1.0');
  assert.strictEqual(response.status, 'ready');
  assert.strictEqual(response.aiStatus.enabled, false);
});
