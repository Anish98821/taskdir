import { subscribe } from "@/lib/watcher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string) => {
        controller.enqueue(encoder.encode(`data: ${event}\n\n`));
      };
      send("hello");

      const unsubscribe = subscribe(() => send("change"));
      const keepalive = setInterval(() => {
        controller.enqueue(encoder.encode(`: keepalive\n\n`));
      }, 25_000);

      const close = () => {
        clearInterval(keepalive);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      };
      request.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
