/**
 * 基域 Fp (256-bit 素数域) 纯函数式代数实现
 * 特征数 p = 0xb640000002a3a6f1d603ab4ff58ec74521f2934b1a7aeedbe56f9b27e351457d
 */

import { SM9_P } from './constants.js';

export const P = SM9_P;
export const P_MINUS_2 = SM9_P - 2n;

/**
 * 模加 (无除法模运算分支优化)
 * @param {bigint} a
 * @param {bigint} b
 * @returns {bigint} (a + b) mod P
 */
export function fp_add(a, b) {
  const s = a + b;
  return s >= P ? s - P : s;
}

/**
 * 模减
 * @param {bigint} a
 * @param {bigint} b
 * @returns {bigint} (a - b) mod P
 */
export function fp_sub(a, b) {
  return a >= b ? a - b : P + a - b;
}

/**
 * 模二倍 (2 * a mod P)
 * @param {bigint} a
 * @returns {bigint}
 */
export function fp_dbl(a) {
  const s = a + a;
  return s >= P ? s - P : s;
}

/**
 * 模三倍 (3 * a mod P)
 * @param {bigint} a
 * @returns {bigint}
 */
export function fp_tri(a) {
  const s = a + a + a;
  return s >= 2n * P ? s - 2n * P : (s >= P ? s - P : s);
}

/**
 * 模求相反数 (-a mod P)
 * @param {bigint} a
 * @returns {bigint}
 */
export function fp_neg(a) {
  return a === 0n ? 0n : P - a;
}

/**
 * 模乘
 * @param {bigint} a
 * @param {bigint} b
 * @returns {bigint} (a * b) mod P
 */
export function fp_mul(a, b) {
  return (a * b) % P;
}

/**
 * 模平方
 * @param {bigint} a
 * @returns {bigint} a^2 mod P
 */
export function fp_sqr(a) {
  return (a * a) % P;
}

/**
 * 模除以 2 (a / 2 mod P)
 * @param {bigint} a
 * @returns {bigint}
 */
export function fp_div2(a) {
  return (a & 1n) === 0n ? (a >> 1n) : ((a + P) >> 1n);
}

/**
 * 扩展欧几里得求逆 (Extended Euclidean Inversion)
 * 相比费马小定理 (a^(p-2)) 提升约 5 倍速度
 * @param {bigint} a
 * @returns {bigint} a^(-1) mod P
 */
export function fp_inv(a, m = P) {
  if (a === 0n) {
    throw new RangeError('Division by zero in inversion');
  }
  let u = ((a % m) + m) % m;
  let v = m;
  let x1 = 1n;
  let x2 = 0n;

  while (u > 1n) {
    const q = v / u;
    const r = v - q * u;
    const x = x2 - q * x1;
    v = u;
    u = r;
    x2 = x1;
    x1 = x;
  }

  const res = x1 % m;
  return res < 0n ? res + m : res;
}

/**
 * 模快速幂
 * @param {bigint} base
 * @param {bigint} exp
 * @returns {bigint} base^exp mod P
 */
export function fp_pow(base, exp) {
  let res = 1n;
  let b = base % P;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) res = (res * b) % P;
    b = (b * b) % P;
    e >>= 1n;
  }
  return res;
}

/**
 * 判断两个 Fp 元素是否相等
 * @param {bigint} a
 * @param {bigint} b
 * @returns {boolean}
 */
export function fp_eq(a, b) {
  return a === b;
}

/**
 * 是否为零元
 * @param {bigint} a
 * @returns {boolean}
 */
export function fp_is_zero(a) {
  return a === 0n;
}

/**
 * 是否为幺元
 * @param {bigint} a
 * @returns {boolean}
 */
export function fp_is_one(a) {
  return a === 1n;
}

/**
 * 从十六进制字符串解析 Fp
 * @param {string} hex
 * @returns {bigint}
 */
export function fp_from_hex(hex) {
  const clean = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
  return BigInt('0x' + clean) % P;
}

/**
 * 将 Fp 格式化为 64 字符大端十六进制字符串 (256 位 / 32 字节)
 * @param {bigint} a
 * @returns {string}
 */
export function fp_to_hex(a) {
  return (a % P).toString(16).padStart(64, '0');
}

/**
 * 从字节数组 (Uint8Array) 大端解析 Fp
 * @param {Uint8Array} bytes
 * @returns {bigint}
 */
export function fp_from_bytes(bytes) {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return BigInt('0x' + (hex || '0')) % P;
}

/**
 * 将 Fp 转换为 32 字节的大端 Uint8Array
 * @param {bigint} a
 * @returns {Uint8Array}
 */
export function fp_to_bytes(a) {
  const hex = fp_to_hex(a);
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
