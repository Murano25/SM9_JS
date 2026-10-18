/**
 * SM9 密钥生成与提取模块 (GB/T 38635 / GM/T 0044)
 * 纯 JavaScript (ES2020) 实现，零外部依赖
 *
 * 包含:
 * 1. 签名主密钥对生成与用户签名私钥提取 (GB/T 38635.2 / GM/T 0044.2)
 * 2. 加密主密钥对生成与用户解密私钥提取 (GB/T 38635.2 / GM/T 0044.4)
 * 3. 加密用户公钥计算
 */

import {
  SM9_N,
  SM9_P1,
  SM9_P2,
  HID_SIGN,
  HID_ENCRYPT,
} from './constants.js';
import { fp_inv } from './fp.js';
import { g1_mul, g1_add, g1_to_affine } from './g1.js';
import { g2_mul, g2_to_affine } from './g2.js';
import { h1, toUint8Array } from './hash_to_field.js';

/**
 * 生成安全的随机标量 k 属于 [1, n - 1]
 * 采用全局标准 Web Crypto API (Node.js 20+ 与现代浏览器均内置)
 * @returns {bigint}
 */
export function random_scalar() {
  const bytes = new Uint8Array(32);
  while (true) {
    globalThis.crypto.getRandomValues(bytes);
    let k = 0n;
    for (let i = 0; i < 32; i++) {
      k = (k << 8n) | BigInt(bytes[i]);
    }
    if (k >= 1n && k < SM9_N) {
      return k;
    }
  }
}

/**
 * 构造包含 ID 与 hid 的字节数组: ID || hid
 * @param {string | Uint8Array} id 用户身份标识
 * @param {number} hid 算法标识符
 * @returns {Uint8Array}
 */
export function make_id_bytes(id, hid) {
  const idBytes = toUint8Array(id);
  const out = new Uint8Array(idBytes.length + 1);
  out.set(idBytes, 0);
  out[idBytes.length] = hid & 0xff;
  return out;
}

/**
 * 生成 SM9 签名主密钥对 (KGC Master Key Pair for Digital Signature)
 * 主私钥: ks 属于 [1, n - 1]
 * 主公钥: P_pub-s = [ks] P2 属于 G2
 *
 * @param {bigint} [custom_ks] 可选的指定主私钥 (用于测试向量复现)
 * @returns {{ privateKey: bigint, publicKey: { x: [bigint, bigint], y: [bigint, bigint] } }}
 */
export function generate_sign_master_key(custom_ks) {
  const ks = custom_ks ?? random_scalar();
  const Ppub_s = g2_to_affine(g2_mul(ks, SM9_P2));
  return {
    privateKey: ks,
    publicKey: Ppub_s,
  };
}

/**
 * 提取用户数字签名私钥 (Extract User Signing Private Key)
 * d_A = [ ks * (H1(IDA || hid) + ks)^(-1) mod n ] P1 属于 G1
 *
 * @param {bigint} masterPrivateKey 签名主私钥 ks
 * @param {string | Uint8Array} id 用户身份标识 IDA
 * @param {number} [hid=HID_SIGN] 算法标识符 (默认 0x01)
 * @returns {{ x: bigint, y: bigint }} 用户签名私钥 d_A (G1 仿射坐标)
 */
export function extract_sign_user_key(masterPrivateKey, id, hid = HID_SIGN) {
  const idBytes = make_id_bytes(id, hid);
  const h1Val = h1(idBytes);

  // t1 = (H1(IDA || hid) + ks) mod n
  const t1 = (h1Val + masterPrivateKey) % SM9_N;
  if (t1 === 0n) {
    throw new Error('SM9 KeyGen Error: t1 is zero, master key regeneration required');
  }

  // t2 = ks * (t1)^(-1) mod n
  const t1_inv = fp_inv(t1, SM9_N);
  const t2 = (masterPrivateKey * t1_inv) % SM9_N;

  // dA = [t2] P1 in G1
  return g1_to_affine(g1_mul(t2, SM9_P1));
}

/**
 * 生成 SM9 加密主密钥对 (KGC Master Key Pair for Encryption)
 * 主私钥: ke 属于 [1, n - 1]
 * 主公钥: P_pub-e = [ke] P1 属于 G1
 *
 * @param {bigint} [custom_ke] 可选的指定主私钥
 * @returns {{ privateKey: bigint, publicKey: { x: bigint, y: bigint } }}
 */
export function generate_encrypt_master_key(custom_ke) {
  const ke = custom_ke ?? random_scalar();
  const Ppub_e = g1_to_affine(g1_mul(ke, SM9_P1));
  return {
    privateKey: ke,
    publicKey: Ppub_e,
  };
}

/**
 * 提取用户解密私钥 (Extract User Decryption Private Key)
 * de_B = [ ke * (H1(IDB || hid) + ke)^(-1) mod n ] P2 属于 G2
 *
 * @param {bigint} masterPrivateKey 加密主私钥 ke
 * @param {string | Uint8Array} id 接收者身份标识 IDB
 * @param {number} [hid=HID_ENCRYPT] 算法标识符 (默认 0x03)
 * @returns {{ x: [bigint, bigint], y: [bigint, bigint] }} 用户解密私钥 de_B (G2 仿射坐标)
 */
export function extract_encrypt_user_key(masterPrivateKey, id, hid = HID_ENCRYPT) {
  const idBytes = make_id_bytes(id, hid);
  const h1Val = h1(idBytes);

  // t1 = (H1(IDB || hid) + ke) mod n
  const t1 = (h1Val + masterPrivateKey) % SM9_N;
  if (t1 === 0n) {
    throw new Error('SM9 KeyGen Error: t1 is zero, master key regeneration required');
  }

  // t2 = ke * (t1)^(-1) mod n
  const t1_inv = fp_inv(t1, SM9_N);
  const t2 = (masterPrivateKey * t1_inv) % SM9_N;

  // deB = [t2] P2 in G2
  return g2_to_affine(g2_mul(t2, SM9_P2));
}

/**
 * 计算用户的加密公钥 QB 属于 G1
 * QB = [H1(IDB || hid)] P1 + P_pub-e 属于 G1
 *
 * @param {{ x: bigint, y: bigint }} masterPublicKey 加密主公钥 P_pub-e 属于 G1
 * @param {string | Uint8Array} id 接收者身份标识 IDB
 * @param {number} [hid=HID_ENCRYPT] 算法标识符 (默认 0x03)
 * @returns {{ x: bigint, y: bigint }} 接收者用户公钥 QB
 */
export function generate_encrypt_user_public_key(masterPublicKey, id, hid = HID_ENCRYPT) {
  const idBytes = make_id_bytes(id, hid);
  const h1Val = h1(idBytes);

  // [h1] P1 + P_pub-e in G1
  const h1P1 = g1_mul(h1Val, SM9_P1);
  return g1_to_affine(g1_add(h1P1, masterPublicKey));
}
