"use client";

import { useEffect, useRef } from "react";
import { useToastStore } from "@/stores/toast";

export function RateLimitMonitor() {
  const { addToast } = useToastStore();
  const warningShown = useRef(false);
  const throttledShown = useRef(false);

  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      const remaining = response.headers.get("X-RateLimit-Remaining");
      const limit = response.headers.get("X-RateLimit-Limit");
      const retryAfter = response.headers.get("Retry-After");

      if (response.status === 429) {
        if (!throttledShown.current) {
          throttledShown.current = true;
          const seconds = retryAfter ? parseInt(retryAfter, 10) : 60;
          addToast("warning", `Rate limit exceeded. Please wait ${seconds}s before retrying.`);
          setTimeout(() => { throttledShown.current = false; }, (seconds + 5) * 1000);
        }
      } else if (remaining !== null && limit !== null) {
        const rem = parseInt(remaining, 10);
        const lim = parseInt(limit, 10);
        if (rem <= Math.ceil(lim * 0.1) && rem > 0 && !warningShown.current) {
          warningShown.current = true;
          addToast("warning", `API rate limit: ${rem}/${lim} requests remaining`);
          setTimeout(() => { warningShown.current = false; }, 30000);
        }
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [addToast]);

  return null;
}
