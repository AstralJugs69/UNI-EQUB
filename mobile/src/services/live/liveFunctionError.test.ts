import { readLiveFunctionError } from './liveFunctionError';

describe('readLiveFunctionError', () => {
  it('includes Supabase crash metadata for non-JSON Edge Function failures', async () => {
    const response = new Response('Worker failed to respond', {
      status: 500,
      statusText: 'Internal Server Error',
      headers: {
        'content-type': 'text/plain;charset=UTF-8',
        sb_error_code: 'EDGE_FUNCTION_ERROR',
        x_sb_edge_region: 'eu-central-2',
      },
    });

    const message = await readLiveFunctionError({ context: response }, 'Group formation invocation failed.');

    expect(message).toContain('Group formation invocation failed. HTTP 500 Internal Server Error');
    expect(message).toContain('Supabase EDGE_FUNCTION_ERROR');
    expect(message).toContain('edge eu-central-2');
    expect(message).toContain('Worker failed to respond');
  });

  it('formats JSON envelopes without leaking raw backend details', async () => {
    const response = new Response(JSON.stringify({
      ok: false,
      error: 'Missing group request id.',
      errorId: 'err-123',
      errorCode: 'PGRST116',
      details: { details: 'No rows found', hint: 'Check requestId' },
    }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });

    await expect(readLiveFunctionError({ context: response }, 'Fallback')).resolves.toBe(
      'Missing group request id. (error err-123)',
    );
  });
});
