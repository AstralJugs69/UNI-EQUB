interface ErrorEnvelope {
  ok?: boolean;
  error?: string;
  errorCode?: string;
  errorId?: string;
  status?: number;
  action?: string;
  details?: {
    code?: string;
    details?: string;
    hint?: string;
  };
}

function withErrorId(message: string, errorId?: string) {
  return errorId ? `${message} (error ${errorId})` : message;
}

function describeEnvelope(payload: ErrorEnvelope) {
  const parts = [payload.error].filter(Boolean) as string[];
  if (payload.errorCode) {
    parts.push(`code ${payload.errorCode}`);
  }
  if (payload.details?.details) {
    parts.push(payload.details.details);
  }
  if (payload.details?.hint) {
    parts.push(`hint: ${payload.details.hint}`);
  }
  return withErrorId(parts.join(' | ') || 'Edge Function request failed.', payload.errorId);
}

export async function readLiveFunctionError(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: Response | { status?: number; statusText?: string } }).context;
  if (context && typeof (context as Response).clone === 'function') {
    try {
      const payload = await (context as Response).clone().json() as ErrorEnvelope;
      if (payload.error) {
        return describeEnvelope(payload);
      }
    } catch {
      try {
        const text = await (context as Response).clone().text();
        if (text) {
          return text;
        }
      } catch {
        // Fall through to the Supabase client error message.
      }
    }
  }
  if (context?.status) {
    return `${fallback} HTTP ${context.status}${context.statusText ? ` ${context.statusText}` : ''}.`;
  }
  return error instanceof Error ? error.message : fallback;
}

export function assertLiveEnvelope<T>(data: { ok?: boolean; data?: T; error?: string; errorId?: string } | null | undefined, fallback: string): T {
  if (data?.ok && data.data) {
    return data.data;
  }
  throw new Error(withErrorId(data?.error ?? fallback, data?.errorId));
}
