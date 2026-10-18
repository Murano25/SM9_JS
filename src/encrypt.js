/**
 * SM9 标识加密与解密协议 (GB/T 38635.2-2020 / GM/T 0044.4-2016)
 * 纯 JavaScript (ES2020) 实现，零外部依赖
 *
 * 加密: 基于 G1 上的加密主公钥 P_pub-e 与接收者标识 IDB
 * 解密: 基于 G2 上的接收者解密私钥 deB
 *
 * 密文格式:
 * 1. 结构化对象: { c1: { x, y }, c2: Uint8Array, c3: Uint8Array }
 * 2. 紧凑字节流 (国标标准排列): C1 (64 字节) || C3 (32 字节 MAC) || C2 (变长密文)
 */

import {
  SM9_N,
  SM9_P1,
  SM9_P2,
  HID_ENCRYPT,
} from './constants.js';
import {
  g1_mul,
  g1_add,
  g1_to_affine,
  g1_is_zero,
  g1_is_on_curve,
} from './g1.js';
import {
  fp12_pow,
  fp12_to_bytes,
} from './fp12.js';
import { pairing } from './pairing.js';
import { kdf, mac } from './kdf.js';
import { h1, toUint8Array, bigint_to_bytes, bytes_to_bigint } from './hash_to_field.js';
import { random_scalar, make_id_bytes } from './keygen.js';

/**
 * 预计算双线性对 g = e(P_pub-e, P2)
 * @param {{ x: bigint, y: bigint }} masterPublicKey 加密主公钥 P_pub-e 属于 G1
 * @returns {[any, any, any]} GT 元素 g
 */
export function encrypt_precompute(masterPublicKey) {
  return pairing(masterPublicKey, SM9_P2);
}

/**
 * 将 G1 点序列化为 64 字节无前缀仿射坐标 (X[32] || Y[32])
 * @param {{ x: bigint, y: bigint }} point
 * @returns {Uint8Array} 64 字节
 */
export function g1_point_to_bytes(point) {
  const out = new Uint8Array(64);
  out.set(bigint_to_bytes(point.x, 32), 0);
  out.set(bigint_to_bytes(point.y, 32), 32);
  return out;
}

/**
 * 从 64 字节无前缀或 65 字节带 0x04 前缀的数据解析 G1 点
 * @param {Uint8Array} bytes
 * @returns {{ x: bigint, y: bigint }}
 */
export function g1_point_from_bytes(bytes) {
  let offset = 0;
  if (bytes.length === 65 && bytes[0] === 0x04) {
    offset = 1;
  } else if (bytes.length !== 64) {
    throw new Error('Invalid G1 point byte length: expected 64 or 65 bytes');
  }
  const x = bytes_to_bigint(bytes.subarray(offset, offset + 32));
  const y = bytes_to_bigint(bytes.subarray(offset + 32, offset + 64));
  return { x, y };
}

/**
 * 密钥封装机制 (Key Encapsulation Mechanism - KEM)
 * 对应 GB/T 38635.2 第 7 节 / GM/T 0044.4 第 6 节
 *
 * @param {{ x: bigint, y: bigint }} masterPublicKey 加密主公钥 P_pub-e
 * @param {string | Uint8Array} id 接收者身份标识 IDB
 * @param {number} keyLen 待派生对称密钥字节长度
 * @param {bigint} [custom_r] 可选的指定随机数 r
 * @param {number} [hid=HID_ENCRYPT] 算法标识符 (默认 0x03)
 * @param {[any, any, any]} [precomputed_g] 可选的预计算 g
 * @returns {{ key: Uint8Array, c1: { x: bigint, y: bigint } }} 派生的对称密钥与 C1
 */
export function wrap_key(masterPublicKey, id, keyLen, custom_r, hid = HID_ENCRYPT, precomputed_g) {
  const idBytes = toUint8Array(id);
  const idWithHid = make_id_bytes(id, hid);

  // QB = [H1(IDB || hid)] P1 + P_pub-e 属于 G1
  const h1Val = h1(idWithHid);
  const h1P1 = g1_mul(h1Val, SM9_P1);
  const QB = g1_to_affine(g1_add(h1P1, masterPublicKey));

  const g = precomputed_g ?? encrypt_precompute(masterPublicKey);

  // 随机标量 r 属于 [1, n - 1]
  const r = custom_r ?? random_scalar();

  // C1 = [r] QB 属于 G1
  const C1 = g1_to_affine(g1_mul(r, QB));

  // w = g^r 属于 GT
  const w = fp12_pow(g, r);

  // 拼接 KDF 输入: C1 (64 字节) || w (384 字节) || IDB
  const c1Bytes = g1_point_to_bytes(C1);
  const wBytes = fp12_to_bytes(w);

  const kdfInput = new Uint8Array(64 + 384 + idBytes.length);
  kdfInput.set(c1Bytes, 0);
  kdfInput.set(wBytes, 64);
  kdfInput.set(idBytes, 448);

  const key = kdf(kdfInput, keyLen);
  return { key, c1: C1 };
}

/**
 * 密钥解封装机制 (Key Decapsulation Mechanism - KEM)
 *
 * @param {{ x: [bigint, bigint], y: [bigint, bigint] }} userPrivateKey 接收者解密私钥 deB 属于 G2
 * @param {string | Uint8Array} id 接收者身份标识 IDB
 * @param {{ x: bigint, y: bigint } | Uint8Array} c1 密文点 C1 (对象或 64/65 字节数组)
 * @param {number} keyLen 待恢复对称密钥字节长度
 * @returns {Uint8Array} 恢复出的对称密钥
 */
export function unwrap_key(userPrivateKey, id, c1, keyLen) {
  const C1 = c1 instanceof Uint8Array ? g1_point_from_bytes(c1) : c1;
  if (!C1 || g1_is_zero(C1) || !g1_is_on_curve(C1)) {
    throw new Error('SM9 Decryption Error: invalid C1 point');
  }

  const idBytes = toUint8Array(id);

  // w' = e(C1, deB) 属于 GT
  const wPrime = pairing(C1, userPrivateKey);

  // 拼接 KDF 输入: C1 (64 字节) || w' (384 字节) || IDB
  const c1Bytes = g1_point_to_bytes(C1);
  const wPrimeBytes = fp12_to_bytes(wPrime);

  const kdfInput = new Uint8Array(64 + 384 + idBytes.length);
  kdfInput.set(c1Bytes, 0);
  kdfInput.set(wPrimeBytes, 64);
  kdfInput.set(idBytes, 448);

  return kdf(kdfInput, keyLen);
}

/**
 * SM9 标识加密算法 (基于序列密码与 MAC，GB/T 38635.2 第 8 节 / GM/T 0044.4 第 7 节)
 *
 * @param {{ x: bigint, y: bigint }} masterPublicKey 加密主公钥 P_pub-e 属于 G1
 * @param {string | Uint8Array} id 接收者身份标识 IDB
 * @param {string | Uint8Array} plaintext 明文数据 M
 * @param {bigint} [custom_r] 可选的指定随机数 r
 * @param {number} [hid=HID_ENCRYPT] 算法标识符 (默认 0x03)
 * @param {[any, any, any]} [precomputed_g] 可选的预计算 g
 * @returns {{ c1: { x: bigint, y: bigint }, c2: Uint8Array, c3: Uint8Array, ciphertext: Uint8Array }} 密文结构与字节流
 */
export function encrypt(masterPublicKey, id, plaintext, custom_r, hid = HID_ENCRYPT, precomputed_g) {
  const msgBytes = toUint8Array(plaintext);
  const klen = msgBytes.length;
  if (klen === 0) {
    throw new Error('SM9 Encryption Error: plaintext cannot be empty');
  }

  // 派生长度为 klen + 32 字节的密钥 (K1 用于异或，K2 用于 MAC)
  const { key, c1 } = wrap_key(masterPublicKey, id, klen + 32, custom_r, hid, precomputed_g);
  const K1 = key.subarray(0, klen);
  const K2 = key.subarray(klen, klen + 32);

  // C2 = M xor K1
  const C2 = new Uint8Array(klen);
  for (let i = 0; i < klen; i++) {
    C2[i] = msgBytes[i] ^ K1[i];
  }

  // C3 = MAC(K2, C2) = SM3(C2 || K2)
  const C3 = mac(K2, C2);

  // 构造标准密文字节流: C1 (64 字节) || C3 (32 字节) || C2 (klen 字节)
  const c1Bytes = g1_point_to_bytes(c1);
  const ciphertext = new Uint8Array(64 + 32 + klen);
  ciphertext.set(c1Bytes, 0);
  ciphertext.set(C3, 64);
  ciphertext.set(C2, 96);

  return {
    c1,
    c2: C2,
    c3: C3,
    ciphertext,
  };
}

/**
 * SM9 标识解密算法 (GB/T 38635.2 第 8 节 / GM/T 0044.4 第 8 节)
 *
 * @param {{ x: [bigint, bigint], y: [bigint, bigint] }} userPrivateKey 接收者解密私钥 deB 属于 G2
 * @param {string | Uint8Array} id 接收者身份标识 IDB
 * @param {Uint8Array | { c1: any, c2: Uint8Array, c3: Uint8Array }} cipherInput 密文数据 (标准 Uint8Array 或密文对象)
 * @returns {Uint8Array} 解密后的明文数据
 */
export function decrypt(userPrivateKey, id, cipherInput) {
  let c1, c2, c3;

  if (cipherInput instanceof Uint8Array) {
    // 解析 C1 (64 字节) || C3 (32 字节) || C2 (剩余部分)
    if (cipherInput.length < 97) {
      throw new Error('SM9 Decryption Error: ciphertext too short (minimum 97 bytes)');
    }
    c1 = g1_point_from_bytes(cipherInput.subarray(0, 64));
    c3 = cipherInput.subarray(64, 96);
    c2 = cipherInput.subarray(96);
  } else {
    c1 = cipherInput.c1;
    c2 = cipherInput.c2;
    c3 = cipherInput.c3;
  }

  const klen = c2.length;
  // 解封装获取 K1 || K2
  const key = unwrap_key(userPrivateKey, id, c1, klen + 32);
  const K1 = key.subarray(0, klen);
  const K2 = key.subarray(klen, klen + 32);

  // 验证 MAC: u = MAC(K2, C2) == C3
  const u = mac(K2, c2);

  let diff = 0;
  for (let i = 0; i < 32; i++) {
    diff |= u[i] ^ c3[i];
  }
  if (diff !== 0) {
    throw new Error('SM9 Decryption Error: MAC verification failed (ciphertext corrupted or wrong key)');
  }

  // 恢复明文 M = C2 xor K1
  const plaintext = new Uint8Array(klen);
  for (let i = 0; i < klen; i++) {
    plaintext[i] = c2[i] ^ K1[i];
  }

  return plaintext;
}

/**
 * 将密文对象编码为 GM/T 0044 标准字节序列 (C1 || C3 || C2)
 * @param {{ c1: { x: bigint, y: bigint }, c2: Uint8Array, c3: Uint8Array }} cipher
 * @returns {Uint8Array}
 */
export function encode_cipher(cipher) {
  const c1Bytes = g1_point_to_bytes(cipher.c1);
  const out = new Uint8Array(64 + 32 + cipher.c2.length);
  out.set(c1Bytes, 0);
  out.set(cipher.c3, 64);
  out.set(cipher.c2, 96);
  return out;
}

/**
 * 将 GM/T 0044 标准字节序列解码为密文对象
 * @param {Uint8Array} bytes
 * @returns {{ c1: { x: bigint, y: bigint }, c2: Uint8Array, c3: Uint8Array }}
 */
export function decode_cipher(bytes) {
  if (bytes.length < 96) {
    throw new Error('SM9 Decryption Error: ciphertext too short (minimum 96 bytes)');
  }
  const c1 = g1_point_from_bytes(bytes.subarray(0, 64));
  const c3 = bytes.subarray(64, 96);
  const c2 = bytes.subarray(96);
  return { c1, c2, c3 };
}
