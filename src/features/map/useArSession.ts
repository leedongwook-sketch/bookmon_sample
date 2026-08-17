"use client";

import { useCallback, useState } from "react";
import type { ArSessionParams } from "./ArOverlay";

/**
 * AR 세션 관리 훅 — 콜백 방식 DX 제공.
 *   const { session, openArSession, closeArSession } = useArSession();
 *   openArSession({ imageUrl, hitCount, onSuccess, onFail });
 * session이 있으면 <ArOverlay {...session} onClose={closeArSession} />를 렌더한다.
 */
export function useArSession() {
  const [session, setSession] = useState<ArSessionParams | null>(null);

  const openArSession = useCallback((params: ArSessionParams) => {
    setSession(params);
  }, []);

  const closeArSession = useCallback(() => {
    setSession(null);
  }, []);

  return { session, openArSession, closeArSession };
}
