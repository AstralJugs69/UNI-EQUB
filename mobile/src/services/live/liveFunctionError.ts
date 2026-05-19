interface ErrorEnvelope {
  ok?: boolean;
  error?: string;
  errorCode?: string;
  errorId?: string;
  status?: number;
}

function withErrorId(message: string, errorId?: string) {
  return errorId ? `${message} (error ${errorId})` : message;
}

export async function readLiveFunctionError(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: Response }).context;
  if (context) {
    try {
      const payload = await context.clone().json() as ErrorEnvelope;
      if (payload.error) {
        return withErrorId(payload.error, payload.errorId);
      }
    } catch {
      try {
        const text = await context.clone().text();
        if (text) {
          return text;
        }
      } catch {
        // Fall through to the Supabase client error message.
      }
    }
  }
  return error instanceof Error ? error.message : fallback;
}

export function assertLiveEnvelope<T>(data: { ok?: boolean; data?: T; error?: string; errorId?: string } | null | undefined, fallback: string): T {
  if (data?.ok && data.data) {
    return data.data;
  }
  throw new Error(withErrorId(data?.error ?? fallback, data?.errorId));
}
