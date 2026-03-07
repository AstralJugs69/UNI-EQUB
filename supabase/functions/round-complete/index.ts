import { fail, json } from '../_shared/contracts.ts';

Deno.serve(async request => {
  if (request.method !== 'POST') {
    return fail('Method not allowed', 405);
  }

  const body = await request.json();
  return json({
    message: 'Round completion edge function scaffold created.',
    received: body,
    contracts: ['check-round-completion', 'auto-draw', 'create-payout-transaction'],
  });
});
