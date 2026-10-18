/**
 * SM9 Identity-based Cryptographic Algorithms Library (GB/T 38635 / GM/T 0044)
 * Pure JavaScript (ES2020), zero third-party dependencies, high performance.
 */

// Constants
export * from './constants.js';

// Finite Fields
export * from './fp.js';
export * from './fp2.js';
export * from './fp4.js';
export * from './fp12.js';

// Elliptic Curve Groups
export * from './g1.js';
export * from './g2.js';

// Bilinear Pairing
export * from './pairing.js';

// Hash and KDF primitives
export * from './sm3.js';
export * from './kdf.js';
export * from './hash_to_field.js';

// Protocols
export * from './keygen.js';
export * from './sign.js';
export * from './encrypt.js';

// CamelCase named exports for destructuring convenience
export {
  generate_sign_master_key as generateSignMasterKey,
  extract_sign_user_key as extractSignUserKey,
  generate_encrypt_master_key as generateEncryptMasterKey,
  extract_encrypt_user_key as extractEncryptUserKey,
  generate_encrypt_user_public_key as generateEncryptUserPublicKey,
  random_scalar as randomScalar,
} from './keygen.js';

export {
  sign_precompute as signPrecompute,
} from './sign.js';

export {
  wrap_key as wrapKey,
  unwrap_key as unwrapKey,
  encrypt_precompute as encryptPrecompute,
  encode_cipher as encodeCipher,
  decode_cipher as decodeCipher,
} from './encrypt.js';

export {
  hash_to_field as hashToField,
} from './hash_to_field.js';

// Re-import for unified namespace
import * as constants from './constants.js';
import * as keygen from './keygen.js';
import * as signModule from './sign.js';
import * as encryptModule from './encrypt.js';
import * as pairingModule from './pairing.js';
import * as sm3Module from './sm3.js';
import * as kdfModule from './kdf.js';
import * as hashToFieldModule from './hash_to_field.js';
import * as g1Module from './g1.js';
import * as g2Module from './g2.js';

/**
 * Unified SM9 API object
 */
export const sm9 = {
  // Constants
  constants,
  N: constants.SM9_N,
  P: constants.SM9_P,
  P1: constants.SM9_P1,
  P2: constants.SM9_P2,
  HID_SIGN: constants.HID_SIGN,
  HID_KEY_EXCHANGE: constants.HID_KEY_EXCHANGE,
  HID_ENCRYPT: constants.HID_ENCRYPT,

  // Key Generation & Extraction
  generateSignMasterKey: keygen.generate_sign_master_key,
  extractSignUserKey: keygen.extract_sign_user_key,
  generateEncryptMasterKey: keygen.generate_encrypt_master_key,
  extractEncryptUserKey: keygen.extract_encrypt_user_key,
  generateEncryptUserPublicKey: keygen.generate_encrypt_user_public_key,
  randomScalar: keygen.random_scalar,

  // Digital Signature
  sign: signModule.sign,
  verify: signModule.verify,
  signPrecompute: signModule.sign_precompute,

  // Identity-based Encryption & KEM
  encrypt: encryptModule.encrypt,
  decrypt: encryptModule.decrypt,
  wrapKey: encryptModule.wrap_key,
  unwrapKey: encryptModule.unwrap_key,
  encryptPrecompute: encryptModule.encrypt_precompute,
  encodeCipher: encryptModule.encode_cipher,
  decodeCipher: encryptModule.decode_cipher,

  // Bilinear Pairing
  pairing: pairingModule.pairing,
  millerLoop: pairingModule.miller_loop,
  finalExp: pairingModule.final_exp,

  // Hash & KDF
  sm3: sm3Module.sm3,
  SM3: sm3Module.SM3,
  kdf: kdfModule.kdf,
  mac: kdfModule.mac,
  h1: hashToFieldModule.h1,
  h2: hashToFieldModule.h2,
  hashToField: hashToFieldModule.hash_to_field,

  // Curve utilities
  g1: g1Module,
  g2: g2Module,
};

export default sm9;
