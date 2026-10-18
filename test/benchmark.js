import sm9 from '../src/index.js';

console.log('================================================================');
console.log(' SM9-JS Performance Benchmark (Pure JS / V8 ES2020 Native BigInt)');
console.log('================================================================');

function timeOp(name, fn, iterations = 50) {
  // Warm up
  for (let i = 0; i < Math.min(iterations, 5); i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const elapsed = performance.now() - start;
  const avg = elapsed / iterations;
  const ops = (1000 / avg).toFixed(1);
  console.log(`[${name.padEnd(35)}] : ${avg.toFixed(2).padStart(6)} ms/op (${ops.padStart(6)} ops/s)`);
  return avg;
}

// 1. Bilinear Pairing
timeOp('Bilinear Pairing e(P1, P2)', () => {
  sm9.pairing(sm9.P1, sm9.P2);
}, 20);

// 2. Key Generation
const signMaster = sm9.generateSignMasterKey();
const encMaster = sm9.generateEncryptMasterKey();

timeOp('Generate Sign Master Key', () => sm9.generateSignMasterKey(), 20);
timeOp('Extract User Sign Key (dA)', () => sm9.extractSignUserKey(signMaster.privateKey, 'Alice'), 20);

timeOp('Generate Encrypt Master Key', () => sm9.generateEncryptMasterKey(), 20);
timeOp('Extract User Decrypt Key (deB)', () => sm9.extractEncryptUserKey(encMaster.privateKey, 'Bob'), 20);

// 3. Digital Signature
const alicePriv = sm9.extractSignUserKey(signMaster.privateKey, 'Alice');
const msg = 'Test message for digital signature';

timeOp('Sign Message', () => sm9.sign(signMaster.publicKey, alicePriv, msg), 30);

const sig = sm9.sign(signMaster.publicKey, alicePriv, msg);
timeOp('Verify Signature (full pairing)', () => sm9.verify(signMaster.publicKey, 'Alice', msg, sig), 20);

const precomputedSignG = sm9.signPrecompute(signMaster.publicKey);
timeOp('Verify Signature (with precompute)', () => sm9.verify(signMaster.publicKey, 'Alice', msg, sig, sm9.HID_SIGN, precomputedSignG), 20);

// 4. KEM Key Encapsulation
const bobPriv = sm9.extractEncryptUserKey(encMaster.privateKey, 'Bob');
timeOp('Wrap Key (32-byte KEM)', () => sm9.wrapKey(encMaster.publicKey, 'Bob', 32), 20);

const wrapped = sm9.wrapKey(encMaster.publicKey, 'Bob', 32);
timeOp('Unwrap Key (32-byte KEM)', () => sm9.unwrapKey(bobPriv, 'Bob', wrapped.c1, 32), 20);

// 5. Encryption & Decryption
const payload = 'Confidential payload data for end-to-end SM9 encryption test';
timeOp('Encrypt (Payload 60B)', () => sm9.encrypt(encMaster.publicKey, 'Bob', payload), 20);

const cipher = sm9.encrypt(encMaster.publicKey, 'Bob', payload);
timeOp('Decrypt (Payload 60B)', () => sm9.decrypt(bobPriv, 'Bob', cipher), 20);

// 6. SM3 & KDF
const buf1k = new Uint8Array(1024);
timeOp('SM3 Hash (1 KB)', () => sm9.sm3(buf1k), 200);
timeOp('KDF (1 KB input -> 256B key)', () => sm9.kdf(buf1k, 256), 100);

console.log('================================================================');
