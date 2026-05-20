const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAdbDevices } = require('./adb.cjs');
const { signCommand, verifyEnvelope } = require('./signing.cjs');

test('parseAdbDevices handles empty output', () => {
  assert.deepEqual(parseAdbDevices('List of devices attached\n\n'), []);
});

test('parseAdbDevices keeps unauthorized and multiple devices', () => {
  const devices = parseAdbDevices(`List of devices attached
emulator-5554 device product:sdk_gphone64 model:sdk_gphone64 transport_id:1
R9YT123456 unauthorized usb:1-2 transport_id:2
`);
  assert.equal(devices.length, 2);
  assert.equal(devices[0].id, 'emulator-5554');
  assert.equal(devices[0].authorized, true);
  assert.equal(devices[0].model, 'sdk_gphone64');
  assert.equal(devices[1].authorized, false);
});

test('signCommand creates verifiable command envelopes', () => {
  const command = { id: 'cmd-1', type: 'Refresh', payload: {}, issuedAt: new Date().toISOString() };
  const envelope = signCommand(command, 'secret');
  assert.equal(verifyEnvelope(envelope, 'secret'), true);
  assert.equal(verifyEnvelope(envelope, 'wrong'), false);
});
