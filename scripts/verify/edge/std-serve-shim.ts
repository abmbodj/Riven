// Import-map target for https://deno.land/std@0.224.0/http/server.ts in the local
// verification host only. std's `serve` opens its own listener; route it through
// Deno.serve so host.ts can capture the handler like every other function.
type Handler = (req: Request, info: Deno.ServeHandlerInfo) => Response | Promise<Response>;
export function serve(handler: Handler, _options?: unknown) {
  return Deno.serve(handler).finished;
}
