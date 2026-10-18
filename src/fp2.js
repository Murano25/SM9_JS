/**
 * 二次扩域 Fp2 纯函数式代数实现
 * Fp2 = Fp[u] / (u^2 + 2), 即 u^2 = -2
 * 元素表示为长度为 2 的数组 [c0, c1]，代表 c0 + c1 * u, c0, c1 属于 Fp
 */

import {
  fp_add,
  fp_sub,
  fp_dbl,
  fp_tri,
  fp_neg,
  fp_mul,
  fp_sqr,
  fp_inv,
  fp_is_zero,
  fp_is_one,
  fp_from_hex,
  fp_to_hex,
  P,
} from './fp.js';

/**
 * 创建 Fp2 零元 [0, 0]
 * @returns {[bigint, bigint]}
 */
export function fp2_zero() {
  return [0n, 0n];
}

/**
 * 创建 Fp2 幺元 [1, 0]
 * @returns {[bigint, bigint]}
 */
export function fp2_one() {
  return [1n, 0n];
}

/**
 * 创建 Fp2 生成元 u: [0, 1]
 * @returns {[bigint, bigint]}
 */
export function fp2_u() {
  return [0n, 1n];
}

/**
 * 判断是否为零元
 * @param {[bigint, bigint]} a
 * @returns {boolean}
 */
export function fp2_is_zero(a) {
  return a[0] === 0n && a[1] === 0n;
}

/**
 * 判断是否为幺元
 * @param {[bigint, bigint]} a
 * @returns {boolean}
 */
export function fp2_is_one(a) {
  return a[0] === 1n && a[1] === 0n;
}

/**
 * 判断两个 Fp2 元素是否相等
 * @param {[bigint, bigint]} a
 * @param {[bigint, bigint]} b
 * @returns {boolean}
 */
export function fp2_eq(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

/**
 * Fp2 加法: (a0 + b0) + (a1 + b1)u
 * @param {[bigint, bigint]} a
 * @param {[bigint, bigint]} b
 * @returns {[bigint, bigint]}
 */
export function fp2_add(a, b) {
  return [fp_add(a[0], b[0]), fp_add(a[1], b[1])];
}

/**
 * Fp2 减法: (a0 - b0) + (a1 - b1)u
 * @param {[bigint, bigint]} a
 * @param {[bigint, bigint]} b
 * @returns {[bigint, bigint]}
 */
export function fp2_sub(a, b) {
  return [fp_sub(a[0], b[0]), fp_sub(a[1], b[1])];
}

/**
 * Fp2 取负: (-a0) + (-a1)u
 * @param {[bigint, bigint]} a
 * @returns {[bigint, bigint]}
 */
export function fp2_neg(a) {
  return [fp_neg(a[0]), fp_neg(a[1])];
}

/**
 * Fp2 二倍: 2 * a
 * @param {[bigint, bigint]} a
 * @returns {[bigint, bigint]}
 */
export function fp2_dbl(a) {
  return [fp_dbl(a[0]), fp_dbl(a[1])];
}

/**
 * Fp2 三倍: 3 * a
 * @param {[bigint, bigint]} a
 * @returns {[bigint, bigint]}
 */
export function fp2_tri(a) {
  return [fp_tri(a[0]), fp_tri(a[1])];
}

/**
 * Fp2 乘标量 k 属于 Fp
 * @param {[bigint, bigint]} a
 * @param {bigint} k
 * @returns {[bigint, bigint]}
 */
export function fp2_mul_fp(a, k) {
  return [fp_mul(a[0], k), fp_mul(a[1], k)];
}

/**
 * Fp2 乘以虚数单位 u
 * 因为 u^2 = -2，所以 (a0 + a1*u)*u = -2*a1 + a0*u
 * @param {[bigint, bigint]} a
 * @returns {[bigint, bigint]}
 */
export function fp2_mul_u(a) {
  return [fp_neg(fp_dbl(a[1])), a[0]];
}

/**
 * Fp2 乘法
 * (a0 + a1*u)(b0 + b1*u) = (a0*b0 - 2*a1*b1) + (a0*b1 + a1*b0)u
 * @param {[bigint, bigint]} a
 * @param {[bigint, bigint]} b
 * @returns {[bigint, bigint]}
 */
export function fp2_mul(a, b) {
  const a0 = a[0];
  const a1 = a[1];
  const b0 = b[0];
  const b1 = b[1];

  const t0 = fp_mul(a0, b0);
  const t1 = fp_mul(a1, b1);
  const c0 = fp_sub(t0, fp_dbl(t1));

  // (a0 + a1)*(b0 + b1) - t0 - t1
  const t2 = fp_mul(fp_add(a0, a1), fp_add(b0, b1));
  const c1 = fp_sub(fp_sub(t2, t0), t1);

  return [c0, c1];
}

/**
 * Fp2 平方优化
 * (a0 + a1*u)^2 = (a0^2 - 2*a1^2) + 2*a0*a1*u
 * @param {[bigint, bigint]} a
 * @returns {[bigint, bigint]}
 */
export function fp2_sqr(a) {
  const a0 = a[0];
  const a1 = a[1];

  const t0 = fp_sqr(a0);
  const t1 = fp_sqr(a1);
  const c0 = fp_sub(t0, fp_dbl(t1));
  const c1 = fp_dbl(fp_mul(a0, a1));

  return [c0, c1];
}

/**
 * Fp2 求逆
 * 1 / (a0 + a1*u) = (a0 - a1*u) / (a0^2 + 2*a1^2)
 * @param {[bigint, bigint]} a
 * @returns {[bigint, bigint]}
 */
export function fp2_inv(a) {
  const a0 = a[0];
  const a1 = a[1];
  if (a0 === 0n && a1 === 0n) {
    throw new RangeError('Division by zero in Fp2 inversion');
  }

  // norm = a0^2 + 2*a1^2
  const norm = fp_add(fp_sqr(a0), fp_dbl(fp_sqr(a1)));
  const inv_norm = fp_inv(norm);

  return [fp_mul(a0, inv_norm), fp_neg(fp_mul(a1, inv_norm))];
}

/**
 * Fp2 Frobenius 映射 (共轭: a^p = a0 - a1*u)
 * @param {[bigint, bigint]} a
 * @returns {[bigint, bigint]}
 */
export function fp2_frobenius(a) {
  return [a[0], fp_neg(a[1])];
}

/**
 * 格式化为两个 64 字符十六进制大端字符串的数组
 * @param {[bigint, bigint]} a
 * @returns {[string, string]}
 */
export function fp2_to_hex(a) {
  return [fp_to_hex(a[0]), fp_to_hex(a[1])];
}

/**
 * 从十六进制字符串数组解析 Fp2
 * @param {[string, string]} hexArray
 * @returns {[bigint, bigint]}
 */
export function fp2_from_hex(hexArray) {
  return [fp_from_hex(hexArray[0]), fp_from_hex(hexArray[1])];
}
