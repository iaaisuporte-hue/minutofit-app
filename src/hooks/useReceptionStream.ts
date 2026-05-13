import { useEffect, useRef } from "react";
import { API_URL } from "../services/apiBase";
import { authFetch } from "../services/apiClient";

const SSE_CLIENT_ENABLED = import.meta.env.VITE_RECEPCAO_SSE === "true";

/**
 * Consumes GET /academy/recepcao/stream with Bearer (fetch + reader).
 * Reconnects on close/error. No-op unless VITE_RECEPCAO_SSE=true and enable=true.
 */
export function useReceptionStream(onEvent: () => void, enable: boolean) {
  const ref = useRef(onEvent);

  useEffect(() => {
    ref.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!SSE_CLIENT_ENABLED || !enable) return;
    const ac = new AbortController();

    const readLoop = async () => {
      while (!ac.signal.aborted) {
        try {
          const res = await authFetch(`${API_URL}/academy/recepcao/stream`, {
            signal: ac.signal,
            headers: { Accept: "text/event-stream" },
          });
          if (!res.ok) {
            await new Promise((r) => setTimeout(r, 8000));
            continue;
          }
          const body = res.body;
          if (!body) {
            await new Promise((r) => setTimeout(r, 4000));
            continue;
          }
          const reader = body.getReader();
          const dec = new TextDecoder();
          let buf = "";
          while (!ac.signal.aborted) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const parts = buf.split("\n");
            buf = parts.pop() ?? "";
            for (const line of parts) {
              if (!line.startsWith("data:")) continue;
              const payload = line.replace(/^data:\s?/, "");
              try {
                JSON.parse(payload);
                ref.current();
              } catch {
                /* ignore */
              }
            }
          }
          reader.releaseLock();
        } catch {
          if (ac.signal.aborted) break;
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
    };

    void readLoop();
    return () => ac.abort();
  }, [enable]);
}
