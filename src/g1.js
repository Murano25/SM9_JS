/**
 * SM9 G1 群 (基曲线 E(Fp): y^2 = x^3 + 5) 纯函数式实现
 * 采用 Jacobian 射影坐标 (X : Y : Z) -> 仿射坐标 (X/Z^2, Y/Z^3)
 * 无穷远点 O: Z = 0
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
  fp_to_hex,
  fp_from_hex,
} from './fp.js';
import { SM9_P, SM9_N, SM9_B, SM9_P1 } from './constants.js';

/**
 * 创建 G1 无穷远点 (Identity)
 * @returns {{ X: bigint, Y: bigint, Z: bigint }}
 */
export function g1_zero() {
  return { X: 1n, Y: 1n, Z: 0n };
}

/**
 * 判断是否为无穷远点
 * @param {{ X: bigint, Y: bigint, Z: bigint }} P
 * @returns {boolean}
 */
export function g1_is_zero(P) {
  return P.Z === 0n;
}

/**
 * 从仿射坐标创建 Jacobian 坐标点
 * @param {{ x: bigint, y: bigint }} aff
 * @returns {{ X: bigint, Y: bigint, Z: bigint }}
 */
export function g1_from_affine(aff) {
  if (!aff || aff.infinity) return g1_zero();
  return { X: aff.x, Y: aff.y, Z: 1n };
}

/**
 * 将 Jacobian 坐标转换为仿射坐标 { x, y }
 * @param {{ X: bigint, Y: bigint, Z: bigint }} P
 * @returns {{ x: bigint, y: bigint, infinity?: boolean }}
 */
export function g1_to_affine(P) {
  if (P.Z === undefined) return P;
  if (P.Z === 0n) {
    return { x: 0n, y: 0n, infinity: true };
  }
  const zinv = fp_inv(P.Z);
  const zinv2 = fp_sqr(zinv);
  const zinv3 = fp_mul(zinv, zinv2);
  return {
    x: fp_mul(P.X, zinv2),
    y: fp_mul(P.Y, zinv3),
    infinity: false,
  };
}

/**
 * 判断两点是否相等
 * @param {{ X: bigint, Y: bigint, Z: bigint } | { x: bigint, y: bigint }} P1
 * @param {{ X: bigint, Y: bigint, Z: bigint } | { x: bigint, y: bigint }} P2
 * @returns {boolean}
 */
export function g1_eq(P1, P2) {
  const p1 = P1.Z !== undefined ? P1 : g1_from_affine(P1);
  const p2 = P2.Z !== undefined ? P2 : g1_from_affine(P2);
  if (p1.Z === 0n) return p2.Z === 0n;
  if (p2.Z === 0n) return false;

  const z1_2 = fp_sqr(p1.Z);
  const z2_2 = fp_sqr(p2.Z);
  const u1 = fp_mul(p1.X, z2_2);
  const u2 = fp_mul(p2.X, z1_2);
  if (u1 !== u2) return false;

  const s1 = fp_mul(p1.Y, fp_mul(p2.Z, z2_2));
  const s2 = fp_mul(p2.Y, fp_mul(p1.Z, z1_2));
  return s1 === s2;
}

/**
 * 点取负: -(X : Y : Z) = (X : -Y : Z)
 * @param {{ X: bigint, Y: bigint, Z: bigint } | { x: bigint, y: bigint }} P
 * @returns {{ X: bigint, Y: bigint, Z: bigint }}
 */
export function g1_neg(P) {
  const p = P.Z !== undefined ? P : g1_from_affine(P);
  if (p.Z === 0n) return p;
  return { X: p.X, Y: fp_neg(p.Y), Z: p.Z };
}

/**
 * G1 Jacobian 点倍点 (Double)
 * 当曲线方程 a = 0 时，复杂度仅为 3M + 4S
 * @param {{ X: bigint, Y: bigint, Z: bigint } | { x: bigint, y: bigint }} P
 * @returns {{ X: bigint, Y: bigint, Z: bigint }}
 */
export function g1_dbl(P) {
  const p = P.Z !== undefined ? P : g1_from_affine(P);
  if (p.Z === 0n || p.Y === 0n) return g1_zero();

  const A = fp_sqr(p.X);
  const B = fp_sqr(p.Y);
  const C = fp_sqr(B);
  const D = fp_dbl(fp_dbl(fp_mul(p.X, B)));
  const E = fp_tri(A);
  const F = fp_sqr(E);
  const X3 = fp_sub(F, fp_dbl(D));
  const Y3 = fp_sub(fp_mul(E, fp_sub(D, X3)), fp_mul(8n, C));
  const Z3 = fp_dbl(fp_mul(p.Y, p.Z));

  return { X: X3, Y: Y3, Z: Z3 };
}

/**
 * G1 Jacobian 与 Affine 混合点加 (Mixed Addition)
 * P 为 Jacobian 坐标，Q 为 Affine 坐标 (Q.x, Q.y)
 * @param {{ X: bigint, Y: bigint, Z: bigint }} P
 * @param {{ x: bigint, y: bigint, infinity?: boolean }} Q
 * @returns {{ X: bigint, Y: bigint, Z: bigint }}
 */
export function g1_add_affine(P, Q) {
  if (Q.infinity) return P;
  if (P.Z === 0n) return { X: Q.x, Y: Q.y, Z: 1n };

  const Z1_2 = fp_sqr(P.Z);
  const U2 = fp_mul(Q.x, Z1_2);
  const S2 = fp_mul(Q.y, fp_mul(P.Z, Z1_2));

  const H = fp_sub(U2, P.X);
  const r = fp_sub(S2, P.Y);

  if (H === 0n) {
    if (r === 0n) return g1_dbl(P);
    return g1_zero();
  }

  const H2 = fp_sqr(H);
  const H3 = fp_mul(H, H2);
  const V = fp_mul(P.X, H2);

  const X3 = fp_sub(fp_sub(fp_sqr(r), H3), fp_dbl(V));
  const Y3 = fp_sub(fp_mul(r, fp_sub(V, X3)), fp_mul(P.Y, H3));
  const Z3 = fp_mul(P.Z, H);

  return { X: X3, Y: Y3, Z: Z3 };
}

/**
 * G1 Jacobian 点与 Jacobian 点全加 (Point Addition)
 * @param {{ X: bigint, Y: bigint, Z: bigint } | { x: bigint, y: bigint }} P1
 * @param {{ X: bigint, Y: bigint, Z: bigint } | { x: bigint, y: bigint }} P2
 * @returns {{ X: bigint, Y: bigint, Z: bigint }}
 */
export function g1_add(P1, P2) {
  const p1 = P1.Z !== undefined ? P1 : g1_from_affine(P1);
  const p2 = P2.Z !== undefined ? P2 : g1_from_affine(P2);

  if (p1.Z === 0n) return p2;
  if (p2.Z === 0n) return p1;

  const Z1_2 = fp_sqr(p1.Z);
  const Z2_2 = fp_sqr(p2.Z);
  const U1 = fp_mul(p1.X, Z2_2);
  const U2 = fp_mul(p2.X, Z1_2);
  const S1 = fp_mul(p1.Y, fp_mul(p2.Z, Z2_2));
  const S2 = fp_mul(p2.Y, fp_mul(p1.Z, Z1_2));

  const H = fp_sub(U2, U1);
  const r = fp_sub(S2, S1);

  if (H === 0n) {
    if (r === 0n) return g1_dbl(p1);
    return g1_zero();
  }

  const H2 = fp_sqr(H);
  const H3 = fp_mul(H, H2);
  const V = fp_mul(U1, H2);

  const X3 = fp_sub(fp_sub(fp_sqr(r), H3), fp_dbl(V));
  const Y3 = fp_sub(fp_mul(r, fp_sub(V, X3)), fp_mul(S1, H3));
  const Z3 = fp_mul(fp_mul(p1.Z, p2.Z), H);

  return { X: X3, Y: Y3, Z: Z3 };
}

/**
 * G1 标量乘法: [k] P
 * 采用 4-bit 窗口 wNAF 加速运算
 * @param {bigint} k
 * @param {{ X: bigint, Y: bigint, Z: bigint } | { x: bigint, y: bigint }} P
 * @returns {{ X: bigint, Y: bigint, Z: bigint }}
 */
export function g1_mul(k, P) {
  const scalar = ((k % SM9_N) + SM9_N) % SM9_N;
  if (scalar === 0n) return g1_zero();

  const P_aff = P.Z !== undefined ? g1_to_affine(P) : P;
  if (P_aff.infinity) return g1_zero();

  // 预计算表 [P, 3P, 5P, 7P, 9P, 11P, 13P, 15P]
  const table = [P_aff];
  const P2 = g1_to_affine(g1_dbl(g1_from_affine(P_aff)));
  let curr = g1_from_affine(P_aff);
  for (let i = 1; i < 8; i++) {
    curr = g1_add_affine(curr, P2);
    table.push(g1_to_affine(curr));
  }

  // 计算 4-bit NAF 展开
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

  let R = g1_zero();
  for (let i = naf.length - 1; i >= 0; i--) {
    R = g1_dbl(R);
    const val = naf[i];
    if (val > 0) {
      const idx = (val - 1) >> 1;
      R = g1_add_affine(R, table[idx]);
    } else if (val < 0) {
      const idx = (-val - 1) >> 1;
      const negPoint = { x: table[idx].x, y: fp_neg(table[idx].y) };
      R = g1_add_affine(R, negPoint);
    }
  }

  return R;
}

/**
 * 检验点是否在椭圆曲线 E(Fp) 上
 * y^2 = x^3 + 5 (mod p)
 * @param {{ x: bigint, y: bigint, infinity?: boolean } | { X: bigint, Y: bigint, Z: bigint }} point
 * @returns {boolean}
 */
export function g1_is_on_curve(point) {
  const aff = point.Z !== undefined ? g1_to_affine(point) : point;
  if (aff.infinity) return true;
  const lhs = fp_sqr(aff.y);
  const rhs = fp_add(fp_mul(fp_sqr(aff.x), aff.x), SM9_B);
  return lhs === rhs;
}

/**
 * 将 G1 仿射点序列化为 128 字符十六进制大端字符串 (对应 64 字节 x || y)
 * @param {{ x: bigint, y: bigint }} aff
 * @returns {string}
 */
export function g1_to_hex(aff) {
  return fp_to_hex(aff.x) + fp_to_hex(aff.y);
}

/**
 * 从 128 字符十六进制字符串 (64 字节) 反序列化 G1 仿射点
 * @param {string} hex
 * @returns {{ x: bigint, y: bigint }}
 */
export function g1_from_hex(hex) {
  const clean = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
  if (clean.length !== 128) {
    throw new Error(`Invalid G1 hex length: expected 128 characters, got ${clean.length}`);
  }
  const x = fp_from_hex(clean.slice(0, 64));
  const y = fp_from_hex(clean.slice(64, 128));
  const pt = { x, y, infinity: false };
  if (!g1_is_on_curve(pt)) {
    throw new Error('Point does not lie on G1 curve');
  }
  return pt;
}
