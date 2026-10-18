# SM9-JS

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Standards](https://img.shields.io/badge/standard-GB%2FT%2038635-red.svg)](http://openstd.samr.gov.cn/)
[![Zero-Dependency](https://img.shields.io/badge/dependencies-0-brightgreen.svg)]()
[![AI-Assisted](https://img.shields.io/badge/AI--Assisted-Pair%20Programming-blueviolet.svg)](https://github.com/)

[English](./README.md) | [中文](./README_CN.md)

An pure **JavaScript (ES2020 / native `BigInt`)** implementation of the Chinese National Standard **SM9 Identity-Based Cryptographic (IBC) Algorithms**.

Strictly compliant with the national standard **GB/T 38635-2020** and the cryptographic industry standard **GM/T 0044-2016**, covering digital signatures, identity-based encryption and decryption, key encapsulation mechanism (KEM), R-ate bilinear pairings, and the SM3 cryptographic hash algorithm.

---

## ✨ Key Features

- **Zero External Dependencies (0 Dependencies)**: Pure handwritten clean code without any third-party npm dependencies;
- High Performance**: Deeply built on ES2020 native `BigInt` and `TypedArray`, utilizing 4-bit window wNAF scalar multiplication, 66-bit NAF Miller loop sparse multiplication, and bilinear pairing precomputations;
  - **R-ate Bilinear Pairing**: Measured at only **~11 ms** per pairing on Node.js V8;
  - **Digital Signature**: ~18 ms sign / ~15 ms verify with precomputation;
  - **Identity-based Encryption**: ~14 ms encrypt / only **~6.9 ms** decrypt;
- **Standards Compliance**: 100% pass rate for all standard test vectors in the appendices of GB/T 38635.2 and GM/T 0044 (Appendices A, B, C, D);
- **Cross-Runtime Support**: Fully compatible with Node.js 20+, modern browsers (Chrome, Firefox, Safari, Edge), Deno, Bun, and Cloudflare Workers, utilizing the Web Crypto API as a cryptographically secure random number source;
- **TypeScript Ready**: Ships with comprehensive type definitions in [`index.d.ts`](./index.d.ts).

---

## 📦 Installation & Import

```bash
npm install sm9-js
```

### ESM Import
```javascript
import sm9 from 'sm9-js';

// Or via named destructuring imports (supports both camelCase and snake_case)
import {
  generateSignMasterKey,
  extractSignUserKey,
  sign,
  verify,
  generateEncryptMasterKey,
  extractEncryptUserKey,
  encrypt,
  decrypt,
  wrapKey,
  unwrapKey,
  pairing,
} from 'sm9-js';
```

---

## 🚀 Quick Start

### 1. Digital Signature & Verification (GB/T 38635.2 / GM/T 0044.2)

```javascript
import sm9 from 'sm9-js';

// 1. KGC generates master key pair for digital signatures
const masterKey = sm9.generateSignMasterKey();

// 2. Extract signing private key for a user (Alice)
const aliceId = 'Alice@company.com';
const alicePrivKey = sm9.extractSignUserKey(masterKey.privateKey, aliceId);

// 3. User signs a message using private key
const message = 'Payment instruction: Transfer 1000 USD to 0x1234...';
const signature = sm9.sign(masterKey.publicKey, alicePrivKey, message);

// 4. Any verifier validates signature using KGC master public key and Alice's ID
const isValid = sm9.verify(masterKey.publicKey, aliceId, message, signature);
console.log('Verification result:', isValid); // true
```

#### Precomputation Acceleration (High Throughput Scenarios)
When verifying multiple signatures under the same master public key, precalculate $g = e(P_1, P_{pub-s})$:
```javascript
const precomputedG = sm9.signPrecompute(masterKey.publicKey);

// Pass precomputed pairing value to reduce verification time from ~22ms to ~15ms
const isValid = sm9.verify(masterKey.publicKey, aliceId, message, signature, sm9.HID_SIGN, precomputedG);
```

---

### 2. Identity-Based Encryption & Decryption (GB/T 38635.2 / GM/T 0044.4)

Senders do not need to retrieve certificates or public keys in advance; encryption is performed directly using the recipient's **email, phone number, or unique identifier**:

```javascript
import sm9 from 'sm9-js';

// 1. KGC generates master key pair for encryption
const encMasterKey = sm9.generateEncryptMasterKey();

// 2. Recipient (Bob) requests decryption private key from KGC
const bobId = 'Bob@financial-dept.cn';
const bobPrivKey = sm9.extractEncryptUserKey(encMasterKey.privateKey, bobId);

// 3. Sender encrypts plaintext using Bob's identity ID
const plaintext = 'Top Secret Business Plan 2026';
const cipher = sm9.encrypt(encMasterKey.publicKey, bobId, plaintext);

// 4. Bob decrypts ciphertext using his decryption private key
const decryptedBytes = sm9.decrypt(bobPrivKey, bobId, cipher);
const decryptedText = new TextDecoder().decode(decryptedBytes);
console.log('Decrypted plaintext:', decryptedText); // 'Top Secret Business Plan 2026'
```

---

### 3. Key Encapsulation Mechanism (KEM - WrapKey / UnwrapKey, GB/T 38635.2 / GM/T 0044.4)

Used to negotiate a fixed-length, high-entropy symmetric session key between endpoints:

```javascript
import sm9 from 'sm9-js';

const encMasterKey = sm9.generateEncryptMasterKey();
const receiverId = 'IOT-Device-007';
const receiverKey = sm9.extractEncryptUserKey(encMasterKey.privateKey, receiverId);

// Sender encapsulates a 32-byte symmetric key
const { key: sessionKey, c1 } = sm9.wrapKey(encMasterKey.publicKey, receiverId, 32);

// Recipient decapsulates and recovers the symmetric key
const recoveredKey = sm9.unwrapKey(receiverKey, receiverId, c1, 32);
// sessionKey and recoveredKey are strictly identical
```

---

### 4. Ciphertext Serialization & Deserialization

Ciphertexts consist of three components: $C_1$ (elliptic curve point, 64 bytes), $C_3$ (SM3 MAC code, 32 bytes), and $C_2$ (stream ciphertext). Built-in binary stream encoding/decoding is provided:

```javascript
// Encode to standard compact binary stream (64 + 32 + len(M) bytes)
const encodedBytes = sm9.encodeCipher(cipher);

// Decode back to structured ciphertext object
const decodedCipher = sm9.decodeCipher(encodedBytes);

// decrypt also directly accepts Uint8Array binary streams
const plaintextBytes = sm9.decrypt(bobPrivKey, bobId, encodedBytes);
```

---

## ⚡ Performance Benchmarks

Benchmarking environment: Intel Core i7 / Linux x86_64, Node.js v20 (V8 engine), Pure JS execution (no native C++ addons):

```bash
npm run benchmark
```

| Cryptographic Primitive / Protocol Operation | Latency (ms/op) | Throughput (ops/sec) | Notes |
| :--- | :--- | :--- | :--- |
| **R-ate Bilinear Pairing $e(P_1, P_2)$** | **11.09 ms** | **90.2 ops/s** | 66-bit NAF sparse Miller loop + BN final exponentiation |
| **User Signing Key Extraction ($d_A$)** | **1.25 ms** | **802.7 ops/s** | $G_1$ scalar multiplication + ExtGCD inversion |
| **User Decryption Key Extraction ($de_B$)** | **3.50 ms** | **285.6 ops/s** | $G_2$ scalar multiplication + ExtGCD inversion |
| **Digital Signature (`sign`)** | **18.95 ms** | **52.8 ops/s** | Includes $g^r \in G_T$ exponentiation and point multiplication |
| **Signature Verification (`verify` full pairing)** | **22.21 ms** | **45.0 ops/s** | Includes 2 bilinear pairing operations |
| **Signature Verification (`verify` precomputed)** | **15.53 ms** | **64.4 ops/s** | Precomputed base-point pairing acceleration |
| **Key Encapsulation (`wrapKey` - KEM)** | **6.75 ms** | **148.1 ops/s** | Scalar multiplication + $g^r$ exponentiation + KDF |
| **Key Decapsulation (`unwrapKey` - KEM)** | **6.82 ms** | **146.6 ops/s** | Single bilinear pairing + KDF |
| **Identity Encryption (`encrypt`)** | **14.10 ms** | **70.9 ops/s** | Key encapsulation + stream cipher encryption + MAC |
| **Identity Decryption (`decrypt`)** | **6.95 ms** | **143.9 ops/s** | Key decapsulation + stream cipher decryption + MAC |
| **SM3 Cryptographic Hash (1 KB)** | **0.01 ms** | **143,828 ops/s** | Direct TypedArray in-memory processing |
| **KDF Key Derivation (1KB $\to$ 256B)** | **0.06 ms** | **17,450 ops/s** | Standard counter-mode iteration |

---

## 🧪 Unit Testing

Run the complete suite of 75 unit tests (covering group arithmetic, bilinear pairings, hashes, KDF, standard test vectors, and tamper-resistance):

```bash
npm test
```

```
ℹ tests 75
ℹ suites 14
ℹ pass 75
ℹ fail 0
ℹ duration_ms ~440ms
```

---

## 📜 Standards & Specifications

- **GB/T 38635.1-2020**: *Information security technology — SM9 identity-based cryptographic algorithms — Part 1: General*
- **GB/T 38635.2-2020**: *Information security technology — SM9 identity-based cryptographic algorithms — Part 2: Algorithms* (includes digital signatures, key exchange, key encapsulation mechanisms, and public-key encryption)
- **GB/T 32905-2016**: *Information security technology — SM3 cryptographic hash algorithm*
- **GM/T 0044-2016**: *SM9 Identity-based Cryptographic Algorithms* (Parts 1 to 5: General, Digital Signature Algorithm, Key Exchange Protocol, Key Encapsulation Mechanism and Public Key Encryption Algorithm, Parameter Definitions)

---

## 🤖 AI-Assisted Development & Transparency Disclosure (AI Disclosure)

This project was guided throughout architecture planning, mathematical derivation, and algorithmic design by a human engineer, and co-developed with an advanced AI coding assistant in a pair-programming workflow.

To guarantee mathematical precision and cryptographic reliability, the implementation is validated against an exhaustive engineering test matrix:
- **Standard Test Vector Alignment**: Complete reproduction against standard test vectors in the appendices of **GB/T 38635 / GM/T 0044** (signatures, verification, KEM, and encryption/decryption);
- **Full Lifecycle Closed-Loop Testing**: Covers finite field automorphisms, bilinearity and non-degeneracy properties, tamper-resistance exception blocking, and large-payload end-to-end roundtrips.

### ⚠️ Security & Side-Channel Disclaimer
1. **Production Deployment**: Although the algorithms have been mathematically proven and strictly aligned with State Cryptography Administration specifications, independent third-party audits by accredited cybersecurity labs are recommended before deploying into high-security systems;
2. **Side-Channel Protection**: Pure JavaScript running on JIT engines (e.g., V8) undergoes dynamic optimizations, garbage collection, and variable-time BigInt operations, which make absolute constant-time execution against physical timing attacks infeasible without hardware-isolated security enclaves. For hardware-vulnerable client environments, evaluate accordingly.

---

## 📄 License

This project is licensed under the [Apache-2.0](LICENSE) License.
