"use client";

import { useEffect, useState } from "react";

/**
 * Hook nhỏ để chắc chắn đang ở client trước khi làm việc
 * với window/localStorage hoặc fetch có header Authorization.
 *
 * ready = false -> render skeleton nhẹ (phù hợp SSR)
 * ready = true  -> chạy logic fetch thật.
 */
export function useClientReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  return ready;
}
