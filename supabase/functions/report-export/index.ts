import { fail, json } from '../_shared/contracts.ts';

Deno.serve(async request => {
  if (request.method !== 'POST') {
    return fail('Method not allowed', 405);
  }

  const body = await request.json();
  return json({
    message: 'Report export edge function scaffold created.',
    received: body,
    contracts: ['admin-overview', 'report-list', 'export-pdf-or-csv'],
  });
});
