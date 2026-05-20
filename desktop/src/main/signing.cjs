const crypto = require('node:crypto');

function signCommand(command, secret) {
  const issuedAt = new Date().toISOString();
  const body = JSON.stringify({ command, issuedAt });
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return { command, issuedAt, signature };
}

function verifyEnvelope(envelope, secret) {
  if (!envelope?.command || !envelope.issuedAt || !envelope.signature) {
    return false;
  }
  const body = JSON.stringify({ command: envelope.command, issuedAt: envelope.issuedAt });
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(envelope.signature));
}

module.exports = { signCommand, verifyEnvelope };
