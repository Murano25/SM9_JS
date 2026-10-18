/**
 * 四次扩域 Fp4 纯函数式代数实现
 * Fp4 = Fp2[v] / (v^2 - u), 即 v^2 = u (而 u^2 = -2)
 * 元素表示为长度为 2 的数组 [c0, c1]，代表 c0 + c1 * v，其中 c0, c1 属于 Fp2
 */

import {
  fp2_zero,
  fp2_one,
  fp2_is_zero,
  fp2_is_one,
  fp2_eq,
  fp2_add,
  fp2_sub,
  fp2_neg,
  fp2_dbl,
  fp2_mul,
  fp2_sqr,
  fp2_inv,
  fp2_mul_fp,
  fp2_mul_u,
  fp2_frobenius,
  fp2_to_hex,
  fp2_from_hex,
} from './fp2.js';

// Fp 中满足 gamma^2 = -1 (mod p) 的非残差映射常数:
// gamma = (v^p / v)
export const FP4_FROB_GAMMA = 0x6c648de5dc0a3f2cf55acc93ee0baf159f9d411806dc5177f5b21fd3da24d011n;

/**
 * 创建 Fp4 零元
 * @returns {[[bigint, bigint], [bigint, bigint]]}
 */
export function fp4_zero() {
  return [fp2_zero(), fp2_zero()];
}

/**
 * 创建 Fp4 幺元
 * @returns {[[bigint, bigint], [bigint, bigint]]}
 */
export function fp4_one() {
  return [fp2_one(), fp2_zero()];
}

/**
 * 创建 Fp4 生成元 v
 * @returns {[[bigint, bigint], [bigint, bigint]]}
 */
export function fp4_v() {
  return [fp2_zero(), fp2_one()];
}

/**
 * 判断是否为零元
 * @param {[[bigint, bigint], [bigint, bigint]]} a
 * @returns {boolean}
 */
export function fp4_is_zero(a) {
  return fp2_is_zero(a[0]) && fp2_is_zero(a[1]);
}

/**
 * 判断是否为幺元
 * @param {[[bigint, bigint], [bigint, bigint]]} a
 * @returns {boolean}
 */
export function fp4_is_one(a) {
  return fp2_is_one(a[0]) && fp2_is_zero(a[1]);
}

/**
 * 判断两个 Fp4 元素是否相等
 * @param {[[bigint, bigint], [bigint, bigint]]} a
 * @param {[[bigint, bigint], [bigint, bigint]]} b
 * @returns {boolean}
 */
export function fp4_eq(a, b) {
  return fp2_eq(a[0], b[0]) && fp2_eq(a[1], b[1]);
}

/**
 * Fp4 加法
 * @param {[[bigint, bigint], [bigint, bigint]]} a
 * @param {[[bigint, bigint], [bigint, bigint]]} b
 * @returns {[[bigint, bigint], [bigint, bigint]]}
 */
export function fp4_add(a, b) {
  return [fp2_add(a[0], b[0]), fp2_add(a[1], b[1])];
}

/**
 * Fp4 减法
 * @param {[[bigint, bigint], [bigint, bigint]]} a
 * @param {[[bigint, bigint], [bigint, bigint]]} b
 * @returns {[[bigint, bigint], [bigint, bigint]]}
 */
export function fp4_sub(a, b) {
  return [fp2_sub(a[0], b[0]), fp2_sub(a[1], b[1])];
}

/**
 * Fp4 取负
 * @param {[[bigint, bigint], [bigint, bigint]]} a
 * @returns {[[bigint, bigint], [bigint, bigint]]}
 */
export function fp4_neg(a) {
  return [fp2_neg(a[0]), fp2_neg(a[1])];
}

/**
 * Fp4 二倍
 * @param {[[bigint, bigint], [bigint, bigint]]} a
 * @returns {[[bigint, bigint], [bigint, bigint]]}
 */
export function fp4_dbl(a) {
  return [fp2_dbl(a[0]), fp2_dbl(a[1])];
}

/**
 * Fp4 乘以基域 Fp 标量
 * @param {[[bigint, bigint], [bigint, bigint]]} a
 * @param {bigint} k
 * @returns {[[bigint, bigint], [bigint, bigint]]}
 */
export function fp4_mul_fp(a, k) {
  return [fp2_mul_fp(a[0], k), fp2_mul_fp(a[1], k)];
}

/**
 * Fp4 乘以 Fp2 标量
 * @param {[[bigint, bigint], [bigint, bigint]]} a
 * @param {[bigint, bigint]} k
 * @returns {[[bigint, bigint], [bigint, bigint]]}
 */
export function fp4_mul_fp2(a, k) {
  return [fp2_mul(a[0], k), fp2_mul(a[1], k)];
}

/**
 * Fp4 乘以生成元 v
 * (c0 + c1*v)*v = c1*u + c0*v
 * @param {[[bigint, bigint], [bigint, bigint]]} a
 * @returns {[[bigint, bigint], [bigint, bigint]]}
 */
export function fp4_mul_v(a) {
  return [fp2_mul_u(a[1]), a[0]];
}

/**
 * Fp4 Karatsuba 乘法
 * (a0 + a1*v)(b0 + b1*v) = (a0*b0 + a1*b1*u) + ((a0+a1)(b0+b1) - a0*b0 - a1*b1)v
 * @param {[[bigint, bigint], [bigint, bigint]]} a
 * @param {[[bigint, bigint], [bigint, bigint]]} b
 * @returns {[[bigint, bigint], [bigint, bigint]]}
 */
export function fp4_mul(a, b) {
  const a0 = a[0];
  const a1 = a[1];
  const b0 = b[0];
  const b1 = b[1];

  const t0 = fp2_mul(a0, b0);
  const t1 = fp2_mul(a1, b1);
  const c0 = fp2_add(t0, fp2_mul_u(t1));

  const t2 = fp2_mul(fp2_add(a0, a1), fp2_add(b0, b1));
  const c1 = fp2_sub(fp2_sub(t2, t0), t1);

  return [c0, c1];
}

/**
 * Fp4 平方优化
 * (a0 + a1*v)^2 = (a0^2 + a1^2*u) + 2*a0*a1*v
 * @param {[[bigint, bigint], [bigint, bigint]]} a
 * @returns {[[bigint, bigint], [bigint, bigint]]}
 */
export function fp4_sqr(a) {
  const a0 = a[0];
  const a1 = a[1];

  const t0 = fp2_sqr(a0);
  const t1 = fp2_sqr(a1);
  const c0 = fp2_add(t0, fp2_mul_u(t1));
  const c1 = fp2_dbl(fp2_mul(a0, a1));

  return [c0, c1];
}

/**
 * Fp4 求逆
 * 1 / (a0 + a1*v) = (a0 - a1*v) / (a0^2 - a1^2*u)
 * @param {[[bigint, bigint], [bigint, bigint]]} a
 * @returns {[[bigint, bigint], [bigint, bigint]]}
 */
export function fp4_inv(a) {
  const a0 = a[0];
  const a1 = a[1];
  if (fp2_is_zero(a0) && fp2_is_zero(a1)) {
    throw new RangeError('Division by zero in Fp4 inversion');
  }

  // norm = a0^2 - a1^2 * u
  const norm = fp2_sub(fp2_sqr(a0), fp2_mul_u(fp2_sqr(a1)));
  const inv_norm = fp2_inv(norm);

  return [fp2_mul(a0, inv_norm), fp2_neg(fp2_mul(a1, inv_norm))];
}

/**
 * Fp4 Frobenius 映射: a^p
 * pi(a0 + a1*v) = pi(a0) + pi(a1)*v^p = bar(a0) + bar(a1) * (gamma * v)
 * 其中 gamma = sqrt(-1) mod p
 * @param {[[bigint, bigint], [bigint, bigint]]} a
 * @returns {[[bigint, bigint], [bigint, bigint]]}
 */
export function fp4_frobenius(a) {
  const c0 = fp2_frobenius(a[0]);
  const c1_bar = fp2_frobenius(a[1]);
  const c1 = fp2_mul_fp(c1_bar, FP4_FROB_GAMMA);
  return [c0, c1];
}

/**
 * 格式化为 4 个 64 字符十六进制大端字符串数组
 * @param {[[bigint, bigint], [bigint, bigint]]} a
 * @returns {[string, string, string, string]}
 */
export function fp4_to_hex(a) {
  const h0 = fp2_to_hex(a[0]);
  const h1 = fp2_to_hex(a[1]);
  return [h0[0], h0[1], h1[0], h1[1]];
}

/**
 * 从 4 个十六进制字符串数组解析 Fp4
 * @param {[string, string, string, string]} hexArray
 * @returns {[[bigint, bigint], [bigint, bigint]]}
 */
export function fp4_from_hex(hexArray) {
  return [
    fp2_from_hex([hexArray[0], hexArray[1]]),
    fp2_from_hex([hexArray[2], hexArray[3]]),
  ];
}
