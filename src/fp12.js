/**
 * 十二次扩域 Fp12 纯函数式代数实现
 * Fp12 = Fp4[w] / (w^3 - v), 即 w^3 = v (而 v^2 = u, u^2 = -2)
 * 元素表示为长度为 3 的数组 [c0, c1, c2]，代表 c0 + c1*w + c2*w^2，其中 c0, c1, c2 属于 Fp4
 */

import {
  fp2_zero,
  fp2_one,
  fp2_neg,
  fp2_to_hex,
  fp2_from_hex,
} from './fp2.js';
import {
  fp4_zero,
  fp4_one,
  fp4_is_zero,
  fp4_is_one,
  fp4_eq,
  fp4_add,
  fp4_sub,
  fp4_neg,
  fp4_dbl,
  fp4_mul,
  fp4_sqr,
  fp4_inv,
  fp4_mul_fp,
  fp4_mul_v,
  fp4_frobenius,
  fp4_to_hex,
  fp4_from_hex,
} from './fp4.js';
import { SM9_P } from './constants.js';

// Fp 中满足 w^p = W1 * w 的 12 次本原单位根常数:
// W1^3 = gamma = sqrt(-1) mod p, W1^6 = -1 mod p, W1^12 = 1 mod p
export const FP12_FROB_W1 = 0x3f23ea58e5720bdb843c6cfa9c08674947c5c86e0ddd04eda91d8354377b698bn;
export const FP12_FROB_W2 = (FP12_FROB_W1 * FP12_FROB_W1) % SM9_P;
export const FP12_FROB_W3 = (FP12_FROB_W2 * FP12_FROB_W1) % SM9_P;
export const FP12_FROB_W4 = (FP12_FROB_W2 * FP12_FROB_W2) % SM9_P;

/**
 * 创建 Fp12 零元
 * @returns {[any, any, any]}
 */
export function fp12_zero() {
  return [fp4_zero(), fp4_zero(), fp4_zero()];
}

/**
 * 创建 Fp12 幺元
 * @returns {[any, any, any]}
 */
export function fp12_one() {
  return [fp4_one(), fp4_zero(), fp4_zero()];
}

/**
 * 创建 Fp12 生成元 w
 * @returns {[any, any, any]}
 */
export function fp12_w() {
  return [fp4_zero(), fp4_one(), fp4_zero()];
}

/**
 * 判断是否为零元
 * @param {[any, any, any]} a
 * @returns {boolean}
 */
export function fp12_is_zero(a) {
  return fp4_is_zero(a[0]) && fp4_is_zero(a[1]) && fp4_is_zero(a[2]);
}

/**
 * 判断是否为幺元
 * @param {[any, any, any]} a
 * @returns {boolean}
 */
export function fp12_is_one(a) {
  return fp4_is_one(a[0]) && fp4_is_zero(a[1]) && fp4_is_zero(a[2]);
}

/**
 * 判断两个 Fp12 元素是否相等
 * @param {[any, any, any]} a
 * @param {[any, any, any]} b
 * @returns {boolean}
 */
export function fp12_eq(a, b) {
  return fp4_eq(a[0], b[0]) && fp4_eq(a[1], b[1]) && fp4_eq(a[2], b[2]);
}

/**
 * Fp12 加法
 * @param {[any, any, any]} a
 * @param {[any, any, any]} b
 * @returns {[any, any, any]}
 */
export function fp12_add(a, b) {
  return [
    fp4_add(a[0], b[0]),
    fp4_add(a[1], b[1]),
    fp4_add(a[2], b[2]),
  ];
}

/**
 * Fp12 减法
 * @param {[any, any, any]} a
 * @param {[any, any, any]} b
 * @returns {[any, any, any]}
 */
export function fp12_sub(a, b) {
  return [
    fp4_sub(a[0], b[0]),
    fp4_sub(a[1], b[1]),
    fp4_sub(a[2], b[2]),
  ];
}

/**
 * Fp12 取负
 * @param {[any, any, any]} a
 * @returns {[any, any, any]}
 */
export function fp12_neg(a) {
  return [
    fp4_neg(a[0]),
    fp4_neg(a[1]),
    fp4_neg(a[2]),
  ];
}

/**
 * Fp12 二倍
 * @param {[any, any, any]} a
 * @returns {[any, any, any]}
 */
export function fp12_dbl(a) {
  return [
    fp4_dbl(a[0]),
    fp4_dbl(a[1]),
    fp4_dbl(a[2]),
  ];
}

/**
 * Fp12 乘以 Fp 标量
 * @param {[any, any, any]} a
 * @param {bigint} k
 * @returns {[any, any, any]}
 */
export function fp12_mul_fp(a, k) {
  return [
    fp4_mul_fp(a[0], k),
    fp4_mul_fp(a[1], k),
    fp4_mul_fp(a[2], k),
  ];
}

/**
 * Fp12 乘以 Fp4 标量
 * @param {[any, any, any]} a
 * @param {any} k
 * @returns {[any, any, any]}
 */
export function fp12_mul_fp4(a, k) {
  return [
    fp4_mul(a[0], k),
    fp4_mul(a[1], k),
    fp4_mul(a[2], k),
  ];
}

/**
 * Fp12 乘以生成元 w
 * (c0 + c1*w + c2*w^2)*w = c2*v + c0*w + c1*w^2
 * @param {[any, any, any]} a
 * @returns {[any, any, any]}
 */
export function fp12_mul_w(a) {
  return [fp4_mul_v(a[2]), a[0], a[1]];
}

/**
 * Fp12 Karatsuba 乘法 (三次扩展 6 次乘法)
 * a = a0 + a1*w + a2*w^2, b = b0 + b1*w + b2*w^2
 * @param {[any, any, any]} a
 * @param {[any, any, any]} b
 * @returns {[any, any, any]}
 */
export function fp12_mul(a, b) {
  const a0 = a[0];
  const a1 = a[1];
  const a2 = a[2];

  const b0 = b[0];
  const b1 = b[1];
  const b2 = b[2];

  const v0 = fp4_mul(a0, b0);
  const v1 = fp4_mul(a1, b1);
  const v2 = fp4_mul(a2, b2);

  // t12 = (a1 + a2)(b1 + b2) - v1 - v2 = a1*b2 + a2*b1
  const t12 = fp4_sub(fp4_sub(fp4_mul(fp4_add(a1, a2), fp4_add(b1, b2)), v1), v2);
  // c0 = v0 + v * t12
  const c0 = fp4_add(v0, fp4_mul_v(t12));

  // t01 = (a0 + a1)(b0 + b1) - v0 - v1 = a0*b1 + a1*b0
  const t01 = fp4_sub(fp4_sub(fp4_mul(fp4_add(a0, a1), fp4_add(b0, b1)), v0), v1);
  // c1 = t01 + v * v2
  const c1 = fp4_add(t01, fp4_mul_v(v2));

  // t02 = (a0 + a2)(b0 + b2) - v0 - v2 = a0*b2 + a2*b0
  const t02 = fp4_sub(fp4_sub(fp4_mul(fp4_add(a0, a2), fp4_add(b0, b2)), v0), v2);
  // c2 = v1 + t02
  const c2 = fp4_add(v1, t02);

  return [c0, c1, c2];
}

/**
 * Fp12 平方优化
 * c0 = a0^2 + 2*v*(a1*a2)
 * c1 = 2*a0*a1 + v*a2^2
 * c2 = a1^2 + 2*a0*a2
 * @param {[any, any, any]} a
 * @returns {[any, any, any]}
 */
export function fp12_sqr(a) {
  const a0 = a[0];
  const a1 = a[1];
  const a2 = a[2];

  const s0 = fp4_sqr(a0);
  const s1 = fp4_sqr(a1);
  const s2 = fp4_sqr(a2);

  const m01 = fp4_dbl(fp4_mul(a0, a1));
  const m02 = fp4_dbl(fp4_mul(a0, a2));
  const m12 = fp4_dbl(fp4_mul(a1, a2));

  const c0 = fp4_add(s0, fp4_mul_v(m12));
  const c1 = fp4_add(m01, fp4_mul_v(s2));
  const c2 = fp4_add(s1, m02);

  return [c0, c1, c2];
}

/**
 * Fp12 求逆
 * 利用伴随矩阵与模除行列式算法，仅需 1 次 Fp4 求逆
 * @param {[any, any, any]} a
 * @returns {[any, any, any]}
 */
export function fp12_inv(a) {
  const c0 = a[0];
  const c1 = a[1];
  const c2 = a[2];

  if (fp4_is_zero(c0) && fp4_is_zero(c1) && fp4_is_zero(c2)) {
    throw new RangeError('Division by zero in Fp12 inversion');
  }

  const d0 = fp4_sub(fp4_sqr(c0), fp4_mul_v(fp4_mul(c1, c2)));
  const d1 = fp4_sub(fp4_mul_v(fp4_sqr(c2)), fp4_mul(c0, c1));
  const d2 = fp4_sub(fp4_sqr(c1), fp4_mul(c0, c2));

  // det = c0*d0 + v*(c1*d2 + c2*d1)
  const det = fp4_add(
    fp4_mul(c0, d0),
    fp4_mul_v(fp4_add(fp4_mul(c1, d2), fp4_mul(c2, d1)))
  );
  const inv_det = fp4_inv(det);

  return [
    fp4_mul(d0, inv_det),
    fp4_mul(d1, inv_det),
    fp4_mul(d2, inv_det),
  ];
}

/**
 * Fp12 快速幂
 * @param {[any, any, any]} base
 * @param {bigint} exp
 * @returns {[any, any, any]}
 */
export function fp12_pow(base, exp) {
  let res = fp12_one();
  let b = base;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) res = fp12_mul(res, b);
    b = fp12_sqr(b);
    e >>= 1n;
  }
  return res;
}

/**
 * Fp12 Frobenius 映射: a^p
 * pi(c0 + c1*w + c2*w^2) = pi(c0) + W1*pi(c1)*w + W2*pi(c2)*w^2
 * @param {[any, any, any]} a
 * @returns {[any, any, any]}
 */
export function fp12_frobenius(a) {
  const c0 = fp4_frobenius(a[0]);
  const c1 = fp4_mul_fp(fp4_frobenius(a[1]), FP12_FROB_W1);
  const c2 = fp4_mul_fp(fp4_frobenius(a[2]), FP12_FROB_W2);
  return [c0, c1, c2];
}

/**
 * Fp12 二次 Frobenius 映射: a^(p^2)
 * pi^2(c0 + c1*w + c2*w^2) = c0^(p^2) + W2*c1^(p^2)*w + W4*c2^(p^2)*w^2
 * @param {[any, any, any]} a
 * @returns {[any, any, any]}
 */
export function fp12_frobenius2(a) {
  // c_i^(p^2) in Fp4: [c_i0, -c_i1]
  const c0_p2 = [a[0][0], fp2_neg(a[0][1])];
  const c1_p2 = [a[1][0], fp2_neg(a[1][1])];
  const c2_p2 = [a[2][0], fp2_neg(a[2][1])];
  return [
    c0_p2,
    fp4_mul_fp(c1_p2, FP12_FROB_W2),
    fp4_mul_fp(c2_p2, FP12_FROB_W4),
  ];
}

/**
 * Fp12 三次 Frobenius 映射: a^(p^3)
 * @param {[any, any, any]} a
 * @returns {[any, any, any]}
 */
export function fp12_frobenius3(a) {
  return fp12_frobenius(fp12_frobenius2(a));
}

/**
 * Fp12 六次 Frobenius 映射 (共轭): a^(p^6)
 * c0^(p^6) = [c00, -c01]
 * c1^(p^6) * (-w) = [-c10, c11] * w
 * c2^(p^6) * w^2 = [c20, -c21] * w^2
 * 零乘法开销，仅 4 次 Fp2 取负!
 * @param {[any, any, any]} a
 * @returns {[any, any, any]}
 */
export function fp12_frobenius6(a) {
  return [
    [a[0][0], fp2_neg(a[0][1])],
    [fp2_neg(a[1][0]), a[1][1]],
    [a[2][0], fp2_neg(a[2][1])],
  ];
}

/**
 * 单模群 (Cyclotomic Subgroup / G_T) 元素求逆
 * 对于双线性映射结果等元素，a^(-1) = a^(p^6)
 * 瞬间完成求逆，极大加速最终幂运算
 * @param {[any, any, any]} a
 * @returns {[any, any, any]}
 */
export function fp12_unitary_inv(a) {
  return fp12_frobenius6(a);
}

/**
 * 格式化为 12 个 64 字符十六进制大端字符串数组
 * @param {[any, any, any]} a
 * @returns {string[]}
 */
export function fp12_to_hex(a) {
  return [
    ...fp4_to_hex(a[0]),
    ...fp4_to_hex(a[1]),
    ...fp4_to_hex(a[2]),
  ];
}

/**
 * 从 12 个十六进制字符串数组解析 Fp12
 * @param {string[]} hexArray
 * @returns {[any, any, any]}
 */
export function fp12_from_hex(hexArray) {
  return [
    fp4_from_hex(hexArray.slice(0, 4)),
    fp4_from_hex(hexArray.slice(4, 8)),
    fp4_from_hex(hexArray.slice(8, 12)),
  ];
}

/**
 * 按照 GB/T 38635 / GM/T 0044 标准序列化 GT 元素 (384 字节)
 * 顺序: w2_v1_u1, w2_v1_u0, w2_v0_u1, w2_v0_u0, w1_v1_u1, ..., w0_v0_u0
 * @param {[any, any, any]} a Fp12 元素
 * @returns {Uint8Array} 384 字节 Uint8Array
 */
export function fp12_to_bytes(a) {
  const out = new Uint8Array(384);
  const elements = [
    a[2][1][1], a[2][1][0], a[2][0][1], a[2][0][0],
    a[1][1][1], a[1][1][0], a[1][0][1], a[1][0][0],
    a[0][1][1], a[0][1][0], a[0][0][1], a[0][0][0],
  ];

  for (let i = 0; i < 12; i++) {
    let val = elements[i];
    const offset = i * 32;
    for (let j = 31; j >= 0; j--) {
      out[offset + j] = Number(val & 0xffn);
      val >>= 8n;
    }
  }
  return out;
}

/**
 * 从 384 字节标准序列化字节数组解析 Fp12 元素
 * @param {Uint8Array} bytes
 * @returns {[any, any, any]}
 */
export function fp12_from_bytes(bytes) {
  if (bytes.length < 384) {
    throw new Error('fp12_from_bytes: input must be at least 384 bytes');
  }
  const elements = new Array(12);
  for (let i = 0; i < 12; i++) {
    let val = 0n;
    const offset = i * 32;
    for (let j = 0; j < 32; j++) {
      val = (val << 8n) | BigInt(bytes[offset + j]);
    }
    elements[i] = val;
  }

  return [
    // c0
    [
      [elements[11], elements[10]],
      [elements[9], elements[8]],
    ],
    // c1
    [
      [elements[7], elements[6]],
      [elements[5], elements[4]],
    ],
    // c2
    [
      [elements[3], elements[2]],
      [elements[1], elements[0]],
    ],
  ];
}

