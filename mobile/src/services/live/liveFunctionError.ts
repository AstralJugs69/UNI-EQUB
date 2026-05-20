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

function headerValue(headers: Headers, name: string) {
  return headers.get(name) ?? headers.get(name.toLowerCase());
}

function describeNonJsonResponse(response: Response, text: string, fallback: string) {
  const parts = [
    `${fallback} HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`,
  ];
  const supabaseCode = headerValue(response.headers, 'sb_error_code');
  const edgeRegion = headerValue(response.headers, 'x_sb_edge_region');
  const requestId = headerValue(response.headers, 'x-sb-request-id') ?? headerValue(response.headers, 'sb_request_id');
  if (supabaseCode) {
    parts.push(`Supabase ${supabaseCode}`);
  }
  if (edgeRegion) {
    parts.push(`edge ${edgeRegion}`);
  }
  if (requestId) {
    parts.push(`request ${requestId}`);
  }
  if (text.trim()) {
    parts.push(text.trim());
  } else {
    parts.push('The Edge Function returned a non-JSON error before the app error envelope was created.');
  }
  return parts.join(' | ');
}

export async function readLiveFunctionError(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: Response | { status?: number; statusText?: string } }).context;
  if (context && typeof (context as Response).clone === 'function') {
    const response = context as Response;
    try {
      const payload = await response.clone().json() as ErrorEnvelope;
      if (payload.error) {
        return describeEnvelope(payload);
      }
    } catch {
      try {
        const text = await response.clone().text();
        return describeNonJsonResponse(response, text, fallback);
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
