/**
 * SM9 G2 群 (扭曲曲线 E'(Fp2): y^2 = x^3 + 5u) 纯函数式实现
 * 采用 Jacobian 射影坐标 (X : Y : Z)，坐标元素属于 Fp2
 * 无穷远点 O: Z = [0, 0]
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
  fp2_tri,
  fp2_mul,
  fp2_sqr,
  fp2_inv,
  fp2_mul_fp,
  fp2_to_hex,
  fp2_from_hex,
} from './fp2.js';
import { SM9_N, SM9_P2 } from './constants.js';

// 扭曲曲线方程常数 b' = 5u: [0, 5]
export const B_TWIST = [0n, 5n];

/**
 * 创建 G2 无穷远点 (Identity)
 * @returns {{ X: [bigint, bigint], Y: [bigint, bigint], Z: [bigint, bigint] }}
 */
export function g2_zero() {
  return { X: fp2_one(), Y: fp2_one(), Z: fp2_zero() };
}

/**
 * 判断是否为无穷远点
 * @param {{ X: any, Y: any, Z: any }} Q
 * @returns {boolean}
 */
export function g2_is_zero(Q) {
  return fp2_is_zero(Q.Z);
}

/**
 * 从仿射坐标创建 Jacobian 坐标点
 * @param {{ x: [bigint, bigint], y: [bigint, bigint], infinity?: boolean }} aff
 * @returns {{ X: [bigint, bigint], Y: [bigint, bigint], Z: [bigint, bigint] }}
 */
export function g2_from_affine(aff) {
  if (!aff || aff.infinity) return g2_zero();
  return { X: aff.x, Y: aff.y, Z: fp2_one() };
}

/**
 * 将 Jacobian 坐标转换为仿射坐标 { x, y }
 * @param {{ X: any, Y: any, Z: any }} Q
 * @returns {{ x: [bigint, bigint], y: [bigint, bigint], infinity?: boolean }}
 */
export function g2_to_affine(Q) {
  if (Q.Z === undefined) return Q;
  if (fp2_is_zero(Q.Z)) {
    return { x: fp2_zero(), y: fp2_zero(), infinity: true };
  }
  const zinv = fp2_inv(Q.Z);
  const zinv2 = fp2_sqr(zinv);
  const zinv3 = fp2_mul(zinv, zinv2);
  return {
    x: fp2_mul(Q.X, zinv2),
    y: fp2_mul(Q.Y, zinv3),
    infinity: false,
  };
}

/**
 * 判断两个 G2 点是否相等
 * @param {{ X: any, Y: any, Z: any } | { x: any, y: any }} Q1
 * @param {{ X: any, Y: any, Z: any } | { x: any, y: any }} Q2
 * @returns {boolean}
 */
export function g2_eq(Q1, Q2) {
  const q1 = Q1.Z !== undefined ? Q1 : g2_from_affine(Q1);
  const q2 = Q2.Z !== undefined ? Q2 : g2_from_affine(Q2);
  if (fp2_is_zero(q1.Z)) return fp2_is_zero(q2.Z);
  if (fp2_is_zero(q2.Z)) return false;

  const z1_2 = fp2_sqr(q1.Z);
  const z2_2 = fp2_sqr(q2.Z);
  const u1 = fp2_mul(q1.X, z2_2);
  const u2 = fp2_mul(q2.X, z1_2);
  if (!fp2_eq(u1, u2)) return false;

  const s1 = fp2_mul(q1.Y, fp2_mul(q2.Z, z2_2));
  const s2 = fp2_mul(q2.Y, fp2_mul(q1.Z, z1_2));
  return fp2_eq(s1, s2);
}

/**
 * 点取负: -(X : Y : Z) = (X : -Y : Z)
 * @param {{ X: any, Y: any, Z: any } | { x: any, y: any }} Q
 * @returns {{ X: any, Y: any, Z: any }}
 */
export function g2_neg(Q) {
  const q = Q.Z !== undefined ? Q : g2_from_affine(Q);
  if (fp2_is_zero(q.Z)) return q;
  return { X: q.X, Y: fp2_neg(q.Y), Z: q.Z };
}

/**
 * G2 Jacobian 点倍点 (Double)
 * @param {{ X: any, Y: any, Z: any } | { x: any, y: any }} Q
 * @returns {{ X: any, Y: any, Z: any }}
 */
export function g2_dbl(Q) {
  const q = Q.Z !== undefined ? Q : g2_from_affine(Q);
  if (fp2_is_zero(q.Z) || fp2_is_zero(q.Y)) return g2_zero();

  const A = fp2_sqr(q.X);
  const B = fp2_sqr(q.Y);
  const C = fp2_sqr(B);
  const D = fp2_dbl(fp2_dbl(fp2_mul(q.X, B)));
  const E = fp2_tri(A);
  const F = fp2_sqr(E);
  const X3 = fp2_sub(F, fp2_dbl(D));
  const Y3 = fp2_sub(fp2_mul(E, fp2_sub(D, X3)), fp2_mul_fp(C, 8n));
  const Z3 = fp2_dbl(fp2_mul(q.Y, q.Z));

  return { X: X3, Y: Y3, Z: Z3 };
}

/**
 * G2 Jacobian 与 Affine 混合点加 (Mixed Addition)
 * @param {{ X: any, Y: any, Z: any }} P
 * @param {{ x: any, y: any, infinity?: boolean }} Q
 * @returns {{ X: any, Y: any, Z: any }}
 */
export function g2_add_affine(P, Q) {
  if (Q.infinity) return P;
  if (fp2_is_zero(P.Z)) return { X: Q.x, Y: Q.y, Z: fp2_one() };

  const Z1_2 = fp2_sqr(P.Z);
  const U2 = fp2_mul(Q.x, Z1_2);
  const S2 = fp2_mul(Q.y, fp2_mul(P.Z, Z1_2));

  const H = fp2_sub(U2, P.X);
  const r = fp2_sub(S2, P.Y);

  if (fp2_is_zero(H)) {
    if (fp2_is_zero(r)) return g2_dbl(P);
    return g2_zero();
  }

  const H2 = fp2_sqr(H);
  const H3 = fp2_mul(H, H2);
  const V = fp2_mul(P.X, H2);

  const X3 = fp2_sub(fp2_sub(fp2_sqr(r), H3), fp2_dbl(V));
  const Y3 = fp2_sub(fp2_mul(r, fp2_sub(V, X3)), fp2_mul(P.Y, H3));
  const Z3 = fp2_mul(P.Z, H);

  return { X: X3, Y: Y3, Z: Z3 };
}

/**
 * G2 Jacobian 点与 Jacobian 点全加
 * @param {{ X: any, Y: any, Z: any } | { x: any, y: any }} Q1
 * @param {{ X: any, Y: any, Z: any } | { x: any, y: any }} Q2
 * @returns {{ X: any, Y: any, Z: any }}
 */
export function g2_add(Q1, Q2) {
  const q1 = Q1.Z !== undefined ? Q1 : g2_from_affine(Q1);
  const q2 = Q2.Z !== undefined ? Q2 : g2_from_affine(Q2);
  if (fp2_is_zero(q1.Z)) return q2;
  if (fp2_is_zero(q2.Z)) return q1;

  const Z1_2 = fp2_sqr(q1.Z);
  const Z2_2 = fp2_sqr(q2.Z);
  const U1 = fp2_mul(q1.X, Z2_2);
  const U2 = fp2_mul(q2.X, Z1_2);
  const S1 = fp2_mul(q1.Y, fp2_mul(q2.Z, Z2_2));
  const S2 = fp2_mul(q2.Y, fp2_mul(q1.Z, Z1_2));

  const H = fp2_sub(U2, U1);
  const r = fp2_sub(S2, S1);

  if (fp2_is_zero(H)) {
    if (fp2_is_zero(r)) return g2_dbl(q1);
    return g2_zero();
  }

  const H2 = fp2_sqr(H);
  const H3 = fp2_mul(H, H2);
  const V = fp2_mul(U1, H2);

  const X3 = fp2_sub(fp2_sub(fp2_sqr(r), H3), fp2_dbl(V));
  const Y3 = fp2_sub(fp2_mul(r, fp2_sub(V, X3)), fp2_mul(S1, H3));
  const Z3 = fp2_mul(fp2_mul(q1.Z, q2.Z), H);

  return { X: X3, Y: Y3, Z: Z3 };
}

/**
 * G2 标量乘法: [k] Q
 * 采用 4-bit 窗口 wNAF 加速运算
 * @param {bigint} k
 * @param {{ X: any, Y: any, Z: any } | { x: any, y: any }} Q
 * @returns {{ X: any, Y: any, Z: any }}
 */
export function g2_mul(k, Q) {
  const scalar = ((k % SM9_N) + SM9_N) % SM9_N;
  if (scalar === 0n) return g2_zero();

  const Q_aff = Q.Z !== undefined ? g2_to_affine(Q) : Q;
  if (Q_aff.infinity) return g2_zero();

  // 预计算表 [Q, 3Q, 5Q, 7Q, 9Q, 11Q, 13Q, 15Q]
  const table = [Q_aff];
  const Q2 = g2_to_affine(g2_dbl(g2_from_affine(Q_aff)));
  let curr = g2_from_affine(Q_aff);
  for (let i = 1; i < 8; i++) {
    curr = g2_add_affine(curr, Q2);
    table.push(g2_to_affine(curr));
  }

  // 4-bit NAF 展开
  const naf = [];
  let e = scalar;
  while (e > 0n) {
    if (e & 1n) {
      let mod16 = Number(e & 15n);
      if (mod16 >= 8) mod16 -= 16;
      naf.push(mod16);
      e -= BigInt(mod16);
    } else {
      naf.push(0);
    }
    e >>= 1n;
  }

  let R = g2_zero();
  for (let i = naf.length - 1; i >= 0; i--) {
    R = g2_dbl(R);
    const val = naf[i];
    if (val > 0) {
      const idx = (val - 1) >> 1;
      R = g2_add_affine(R, table[idx]);
    } else if (val < 0) {
      const idx = (-val - 1) >> 1;
      const negPoint = { x: table[idx].x, y: fp2_neg(table[idx].y) };
      R = g2_add_affine(R, negPoint);
    }
  }

  return R;
}

/**
 * 检验点是否在扭曲曲线 E'(Fp2) 上
 * y^2 = x^3 + 5u
 * @param {{ x: any, y: any, infinity?: boolean } | { X: any, Y: any, Z: any }} point
 * @returns {boolean}
 */
export function g2_is_on_curve(point) {
  const aff = point.Z !== undefined ? g2_to_affine(point) : point;
  if (aff.infinity) return true;
  const lhs = fp2_sqr(aff.y);
  const rhs = fp2_add(fp2_mul(fp2_sqr(aff.x), aff.x), B_TWIST);
  return fp2_eq(lhs, rhs);
}

/**
 * 将 G2 仿射点序列化为 4 个 64 字符十六进制大端字符串的数组: [x0, x1, y0, y1]
 * @param {{ x: [bigint, bigint], y: [bigint, bigint] }} aff
 * @returns {[string, string, string, string]}
 */
export function g2_to_hex(aff) {
  const hx = fp2_to_hex(aff.x);
  const hy = fp2_to_hex(aff.y);
  const res = [hx[0], hx[1], hy[0], hy[1]];
  res.x = hx;
  res.y = hy;
  return res;
}

/**
 * 从十六进制字符串数组反序列化 G2 仿射点
 * @param {[string, string, string, string]} hexArray
 * @returns {{ x: [bigint, bigint], y: [bigint, bigint] }}
 */
export function g2_from_hex(hexArray) {
  const x = fp2_from_hex([hexArray[0], hexArray[1]]);
  const y = fp2_from_hex([hexArray[2], hexArray[3]]);
  const pt = { x, y, infinity: false };
  if (!g2_is_on_curve(pt)) {
    throw new Error('Point does not lie on G2 curve');
  }
  return pt;
}
