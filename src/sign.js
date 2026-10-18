/**
 * SM9 数字签名与验证协议 (GB/T 38635.2-2020 / GM/T 0044.2)
 * 纯 JavaScript (ES2020) 实现，零外部依赖
 *
 * 签名生成: 基于 G1 上的用户签名私钥 dA
 * 签名验证: 基于 G2 上的 KGC 签名主公钥 P_pub-s 与用户标识 IDA
 */

import {
  SM9_N,
  SM9_P1,
  SM9_P2,
  HID_SIGN,
} from './constants.js';
import {
  g1_mul,
  g1_to_affine,
  g1_is_on_curve,
  g1_is_zero,
} from './g1.js';
import {
  g2_mul,
  g2_add,
  g2_to_affine,
} from './g2.js';
import {
  fp12_mul,
  fp12_pow,
  fp12_to_bytes,
} from './fp12.js';
import { pairing } from './pairing.js';
import { h1, h2, toUint8Array } from './hash_to_field.js';
import { random_scalar, make_id_bytes } from './keygen.js';

/**
 * 预计算双线性对 g = e(P1, P_pub-s)
 * 系统中签名主公钥确定后，g 可预计算并复用，大幅提升签名与验签吞吐
 * @param {{ x: [bigint, bigint], y: [bigint, bigint] }} masterPublicKey 签名主公钥
 * @returns {[any, any, any]} GT 元素 g
 */
export function sign_precompute(masterPublicKey) {
  return pairing(SM9_P1, masterPublicKey);
}

/**
 * SM9 数字签名算法 (GB/T 38635.2 第 6 节)
 *
 * @param {{ x: [bigint, bigint], y: [bigint, bigint] }} masterPublicKey 签名主公钥 P_pub-s
 * @param {{ x: bigint, y: bigint }} userPrivateKey 用户签名私钥 dA 属于 G1
 * @param {string | Uint8Array} message 待签名消息 M
 * @param {bigint} [custom_r] 可选的指定随机数 r (用于国标测试向量验证)
 * @param {[any, any, any]} [precomputed_g] 可选的预计算 g = e(P1, P_pub-s)
 * @returns {{ h: bigint, s: { x: bigint, y: bigint } }} 签名值 (h, S)
 */
export function sign(masterPublicKey, userPrivateKey, message, custom_r, precomputed_g) {
  const msgBytes = toUint8Array(message);
  const g = precomputed_g ?? sign_precompute(masterPublicKey);

  while (true) {
    // 步骤 A1: 产生随机数 r 属于 [1, n - 1]
    const r = custom_r ?? random_scalar();

    // 步骤 A2: 计算 w = g^r 属于 GT
    const w = fp12_pow(g, r);
    const wBytes = fp12_to_bytes(w);

    // 步骤 A3: 计算 h = H2(M || w, n)
    const z = new Uint8Array(msgBytes.length + wBytes.length);
    z.set(msgBytes, 0);
    z.set(wBytes, msgBytes.length);
    const h = h2(z);

    // 步骤 A4: 计算 l = (r - h) mod n，若 l = 0 则重选 r
    let l = (r - h) % SM9_N;
    if (l < 0n) l += SM9_N;
    if (l === 0n) {
      if (custom_r !== undefined) {
        throw new Error('SM9 Sign Error: (r - h) mod n is zero with provided r');
      }
      continue;
    }

    // 步骤 A5: 计算 S = [l] dA 属于 G1
    const S = g1_to_affine(g1_mul(l, userPrivateKey));

    return { h, s: S };
  }
}

/**
 * SM9 数字签名验证算法 (GB/T 38635.2 第 7 节)
 *
 * @param {{ x: [bigint, bigint], y: [bigint, bigint] }} masterPublicKey 签名主公钥 P_pub-s 属于 G2
 * @param {string | Uint8Array} id 签名者身份标识 IDA
 * @param {string | Uint8Array} message 待验签消息 M
 * @param {{ h: bigint, s: { x: bigint, y: bigint } }} signature 签名值 (h, S)
 * @param {number} [hid=HID_SIGN] 算法标识符 (默认 0x01)
 * @param {[any, any, any]} [precomputed_g] 可选的预计算 g = e(P1, P_pub-s)
 * @returns {boolean} 签名是否有效
 */
export function verify(masterPublicKey, id, message, signature, hid = HID_SIGN, precomputed_g) {
  const { h, s } = signature;

  // 步骤 B1: 检验 h 属于 [1, n - 1]
  if (h < 1n || h >= SM9_N) {
    return false;
  }

  // 步骤 B2: 检验 S 是 G1 中的非零点
  if (!s || g1_is_zero(s) || !g1_is_on_curve(s)) {
    return false;
  }

  const msgBytes = toUint8Array(message);

  // 步骤 B3: 计算 g = e(P1, P_pub-s)
  const g = precomputed_g ?? sign_precompute(masterPublicKey);

  // 步骤 B4: 计算 t = g^h 属于 GT
  const t = fp12_pow(g, h);

  // 步骤 B5: 计算 h1 = H1(IDA || hid, n)
  const idBytes = make_id_bytes(id, hid);
  const h1Val = h1(idBytes);

  // 步骤 B6: 计算 P = [h1] P2 + P_pub-s 属于 G2
  const h1P2 = g2_mul(h1Val, SM9_P2);
  const P = g2_to_affine(g2_add(h1P2, masterPublicKey));

  // 步骤 B7: 计算 u = e(S, P) 属于 GT
  const u = pairing(s, P);

  // 步骤 B8: 计算 w' = u * t 属于 GT
  const wPrime = fp12_mul(u, t);
  const wPrimeBytes = fp12_to_bytes(wPrime);

  // 步骤 B9: 计算 h2 = H2(M || w', n)，检验 h2 == h
  const z = new Uint8Array(msgBytes.length + wPrimeBytes.length);
  z.set(msgBytes, 0);
  z.set(wPrimeBytes, msgBytes.length);
  const h2Val = h2(z);

  return h2Val === h;
}
