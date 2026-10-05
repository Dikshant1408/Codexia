import type { JsonRpcRequest, JsonRpcResponse, ProtocolMethodMap } from './messages.js';

export interface Transport {
  send(message: string): void;
  onMessage(callback: (message: string) => void): void;
  close(): void;
}

export class ProtocolServer {
  private handlers = new Map<string, (params: any) => Promise<any> | any>();

  constructor(private transport: Transport) {
    this.transport.onMessage((msg) => this.handleRawMessage(msg));
  }

  public registerHandler<K extends keyof ProtocolMethodMap>(
    method: K,
    handler: (params: ProtocolMethodMap[K]['params']) => Promise<ProtocolMethodMap[K]['result']> | ProtocolMethodMap[K]['result']
  ): void {
    this.handlers.set(method, handler);
  }

  private async handleRawMessage(raw: string): Promise<void> {
    let req: JsonRpcRequest;
    try {
      req = JSON.parse(raw);
    } catch (e) {
      return;
    }

    if (!req || req.jsonrpc !== '2.0' || !req.method) {
      return;
    }

    const handler = this.handlers.get(req.method);
    if (!handler) {
      const errRes: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: req.id,
        error: {
          code: -32601,
          message: `Method not found: ${req.method}`
        }
      };
      this.transport.send(JSON.stringify(errRes));
      return;
    }

    try {
      const result = await handler(req.params);
      const res: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: req.id,
        result
      };
      this.transport.send(JSON.stringify(res));
    } catch (err: any) {
      const errRes: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: req.id,
        error: {
          code: -32000,
          message: err?.message || 'Internal RPC error',
          data: err?.stack
        }
      };
      this.transport.send(JSON.stringify(errRes));
    }
  }
}

export class ProtocolClient {
  private nextId = 1;
  private pendingRequests = new Map<
    string | number,
    { resolve: (value: any) => void; reject: (reason?: any) => void }
  >();

  constructor(private transport: Transport) {
    this.transport.onMessage((msg) => this.handleRawMessage(msg));
  }

  public async request<K extends keyof ProtocolMethodMap>(
    method: K,
    params: ProtocolMethodMap[K]['params']
  ): Promise<ProtocolMethodMap[K]['result']> {
    const id = this.nextId++;
    const req: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.transport.send(JSON.stringify(req));
    });
  }

  private handleRawMessage(raw: string): void {
    let res: JsonRpcResponse;
    try {
      res = JSON.parse(raw);
    } catch {
      return;
    }

    if (!res || res.id === undefined) return;
    const pending = this.pendingRequests.get(res.id);
    if (!pending) return;

    this.pendingRequests.delete(res.id);
    if (res.error) {
      pending.reject(new Error(`RPC error [${res.error.code}]: ${res.error.message}`));
    } else {
      pending.resolve(res.result);
    }
  }
}
