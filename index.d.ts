/**
 * TypeScript type definitions for sm9-js
 * SM9 Identity-based Cryptographic Algorithms Library (GB/T 38635 / GM/T 0044)
 */

export interface PointG1 {
  x: bigint;
  y: bigint;
  infinity?: boolean;
}

export interface PointG2 {
  x: [bigint, bigint];
  y: [bigint, bigint];
  infinity?: boolean;
}

export type PointGT = [
  [[bigint, bigint], [bigint, bigint]],
  [[bigint, bigint], [bigint, bigint]],
  [[bigint, bigint], [bigint, bigint]]
];

export interface SignMasterKeyPair {
  privateKey: bigint;
  publicKey: PointG2;
}

export interface EncryptMasterKeyPair {
  privateKey: bigint;
  publicKey: PointG1;
}

export interface Signature {
  h: bigint;
  s: PointG1;
}

export interface Ciphertext {
  c1: PointG1;
  c2: Uint8Array;
  c3: Uint8Array;
}

export interface WrappedKey {
  key: Uint8Array;
  c1: PointG1;
}

// Key Generation
export function generate_sign_master_key(custom_ks?: bigint): SignMasterKeyPair;
export function extract_sign_user_key(masterPrivateKey: bigint, id: string | Uint8Array, hid?: number): PointG1;
export function generate_encrypt_master_key(custom_ke?: bigint): EncryptMasterKeyPair;
export function extract_encrypt_user_key(masterPrivateKey: bigint, id: string | Uint8Array, hid?: number): PointG2;
export function generate_encrypt_user_public_key(masterPublicKey: PointG1, id: string | Uint8Array, hid?: number): PointG1;
export function random_scalar(): bigint;

// Signature
export function sign(
  masterPublicKey: PointG2,
  userPrivateKey: PointG1,
  message: string | Uint8Array,
  custom_r?: bigint,
  precomputed_g?: PointGT
): Signature;

export function verify(
  masterPublicKey: PointG2,
  id: string | Uint8Array,
  message: string | Uint8Array,
  signature: Signature,
  hid?: number,
  precomputed_g?: PointGT
): boolean;

export function sign_precompute(masterPublicKey: PointG2): PointGT;

// Encryption
export function wrap_key(
  masterPublicKey: PointG1,
  id: string | Uint8Array,
  keyLen: number,
  custom_r?: bigint,
  hid?: number,
  precomputed_g?: PointGT
): WrappedKey;

export function unwrap_key(
  userPrivateKey: PointG2,
  id: string | Uint8Array,
  c1: PointG1 | Uint8Array,
  keyLen: number
): Uint8Array;

export function encrypt(
  masterPublicKey: PointG1,
  id: string | Uint8Array,
  plaintext: string | Uint8Array,
  custom_r?: bigint,
  hid?: number,
  precomputed_g?: PointGT
): Ciphertext;

export function decrypt(
  userPrivateKey: PointG2,
  id: string | Uint8Array,
  ciphertext: Ciphertext | Uint8Array
): Uint8Array;

export function encrypt_precompute(masterPublicKey: PointG1): PointGT;
export function encode_cipher(cipher: Ciphertext): Uint8Array;
export function decode_cipher(bytes: Uint8Array): Ciphertext;

// Pairing
export function pairing(P: PointG1, Q: PointG2): PointGT;

// Hashes & KDF
export function sm3(data: string | Uint8Array): Uint8Array;
export function kdf(z: string | Uint8Array, keyLen: number): Uint8Array;
export function mac(key: string | Uint8Array, msg: string | Uint8Array): Uint8Array;
export function h1(z: string | Uint8Array): bigint;
export function h2(z: string | Uint8Array): bigint;
export function hash_to_field(z: string | Uint8Array, prefix: number, n?: bigint): bigint;

// CamelCase named export aliases
export const generateSignMasterKey: typeof generate_sign_master_key;
export const extractSignUserKey: typeof extract_sign_user_key;
export const generateEncryptMasterKey: typeof generate_encrypt_master_key;
export const extractEncryptUserKey: typeof extract_encrypt_user_key;
export const generateEncryptUserPublicKey: typeof generate_encrypt_user_public_key;
export const randomScalar: typeof random_scalar;
export const signPrecompute: typeof sign_precompute;
export const wrapKey: typeof wrap_key;
export const unwrapKey: typeof unwrap_key;
export const encryptPrecompute: typeof encrypt_precompute;
export const encodeCipher: typeof encode_cipher;
export const decodeCipher: typeof decode_cipher;
export const hashToField: typeof hash_to_field;

// Constants
export const SM9_N: bigint;
export const SM9_P: bigint;
export const SM9_B: bigint;
export const SM9_P1: PointG1;
export const SM9_P2: PointG2;
export const HID_SIGN: number;
export const HID_KEY_EXCHANGE: number;
export const HID_ENCRYPT: number;

// Namespace object
export interface SM9 {
  constants: Record<string, any>;
  N: bigint;
  P: bigint;
  P1: PointG1;
  P2: PointG2;
  HID_SIGN: number;
  HID_KEY_EXCHANGE: number;
  HID_ENCRYPT: number;

  generateSignMasterKey(custom_ks?: bigint): SignMasterKeyPair;
  extractSignUserKey(masterPrivateKey: bigint, id: string | Uint8Array, hid?: number): PointG1;
  generateEncryptMasterKey(custom_ke?: bigint): EncryptMasterKeyPair;
  extractEncryptUserKey(masterPrivateKey: bigint, id: string | Uint8Array, hid?: number): PointG2;
  generateEncryptUserPublicKey(masterPublicKey: PointG1, id: string | Uint8Array, hid?: number): PointG1;
  randomScalar(): bigint;

  sign(masterPublicKey: PointG2, userPrivateKey: PointG1, message: string | Uint8Array, custom_r?: bigint, precomputed_g?: PointGT): Signature;
  verify(masterPublicKey: PointG2, id: string | Uint8Array, message: string | Uint8Array, signature: Signature, hid?: number, precomputed_g?: PointGT): boolean;
  signPrecompute(masterPublicKey: PointG2): PointGT;

  encrypt(masterPublicKey: PointG1, id: string | Uint8Array, plaintext: string | Uint8Array, custom_r?: bigint, hid?: number, precomputed_g?: PointGT): Ciphertext;
  decrypt(userPrivateKey: PointG2, id: string | Uint8Array, ciphertext: Ciphertext | Uint8Array): Uint8Array;
  wrapKey(masterPublicKey: PointG1, id: string | Uint8Array, keyLen: number, custom_r?: bigint, hid?: number, precomputed_g?: PointGT): WrappedKey;
  unwrapKey(userPrivateKey: PointG2, id: string | Uint8Array, c1: PointG1 | Uint8Array, keyLen: number): Uint8Array;
  encryptPrecompute(masterPublicKey: PointG1): PointGT;
  encodeCipher(cipher: Ciphertext): Uint8Array;
  decodeCipher(bytes: Uint8Array): Ciphertext;

  pairing(P: PointG1, Q: PointG2): PointGT;
  sm3(data: string | Uint8Array): Uint8Array;
  kdf(z: string | Uint8Array, keyLen: number): Uint8Array;
  mac(key: string | Uint8Array, msg: string | Uint8Array): Uint8Array;
  h1(z: string | Uint8Array): bigint;
  h2(z: string | Uint8Array): bigint;

  g1: Record<string, any>;
  g2: Record<string, any>;
}

export const sm9: SM9;
export default sm9;
