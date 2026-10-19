"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clinicApi, type ClinicInfo } from "@/services/api";

/**
 * Fetch now and then every `intervalMs` while the tab is visible.
 * Keeps the last good data on transient errors so screens don't flash empty.
 */
export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const refresh = useCallback(async () => {
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
      setUpdatedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "حصل خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, intervalMs);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, refresh, ...deps]);

  return { data, error, loading, updatedAt, refresh };
}

let clinicInfoCache: Promise<ClinicInfo> | null = null;

export function useClinicInfo(): ClinicInfo | null {
  const [info, setInfo] = useState<ClinicInfo | null>(null);
  useEffect(() => {
    clinicInfoCache ??= clinicApi.getClinicInfo().catch((e) => {
      clinicInfoCache = null;
      throw e;
    });
    clinicInfoCache.then(setInfo).catch(() => {});
  }, []);
  return info;
}
