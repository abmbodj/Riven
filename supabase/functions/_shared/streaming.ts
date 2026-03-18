import { getCorsHeaders } from './http.ts';

type SSEStream = {
  response: Response;
  sendChunk: (text: string) => void;
  sendError: (message: string, status?: number, extra?: Record<string, unknown>) => void;
  sendDone: (metadata: Record<string, unknown>) => void;
  close: () => void;
};

export function createSSEStream(request: Request): SSEStream {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  const send = (event: string, data: unknown) => {
    try {
      controller.enqueue(
        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
      );
    } catch {
      // Client disconnected — swallow the write error
    }
  };

  const headers: Record<string, string> = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    ...getCorsHeaders(request),
  };

  return {
    response: new Response(stream, { headers }),
    sendChunk: (text: string) => send('chunk', { text }),
    sendError: (message: string, status = 500, extra: Record<string, unknown> = {}) =>
      send('error', { message, status, ...extra }),
    sendDone: (metadata: Record<string, unknown>) => send('done', metadata),
    close: () => {
      try {
        controller.close();
      } catch {
        // Already closed
      }
    },
  };
}
