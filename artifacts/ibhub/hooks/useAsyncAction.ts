import { useState, useCallback, useRef } from "react";
import { Alert } from "react-native";

export function friendlyErrorMessage(e: unknown): string {
  const rawMsg = e instanceof Error ? e.message : String(e);
  const lower = rawMsg.toLowerCase();

  if (
    lower.includes("network request failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("etimedout") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("conexão") ||
    lower.includes("connection")
  ) {
    return "Verifique sua conexão e tente novamente.";
  }

  if (/[À-úÃ-ã]/.test(rawMsg) && rawMsg.length < 200) {
    return rawMsg;
  }

  return "Ocorreu um erro inesperado. Tente novamente.";
}

interface UseAsyncActionOptions {
  onError?: (message: string, original: unknown) => void;
  silent?: boolean;
}

export function useAsyncAction<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  options?: UseAsyncActionOptions,
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRunningRef = useRef(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const execute = useCallback(async (...args: T): Promise<R | undefined> => {
    if (isRunningRef.current) return undefined;
    isRunningRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      return await fnRef.current(...args);
    } catch (e: unknown) {
      const msg = friendlyErrorMessage(e);
      setError(msg);
      const opts = optionsRef.current;
      if (opts?.onError) {
        opts.onError(msg, e);
      } else if (!opts?.silent) {
        Alert.alert("Erro", msg);
      }
      return undefined;
    } finally {
      setIsLoading(false);
      isRunningRef.current = false;
    }
  }, []);

  const reset = useCallback(() => setError(null), []);

  return { execute, isLoading, error, reset };
}
