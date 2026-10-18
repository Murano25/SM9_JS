/**
 * SM9 最佳双线性对 (R-ate Pairing) 实现
 * 对应国家标准 GB/T 38635 / 行业标准 GM/T 0044
 * 映射: e: G1 x G2 -> GT (其中 GT 为 Fp12 中的素数阶乘法子群)
 *
 * 算法原理:
 * 1. Miller 循环计算基于 BN 曲线参数 t = 0x600000000058f98a 的 6t+2 NAF 分解 (66 步迭代)
 * 2. 扭曲曲线 E'(Fp2): y^2 = x^3 + 5u 上的射影点倍乘与混合点加法线函数求值 (Line Function Evaluation)
 * 3. 循环结束后的 Frobenius 扭曲映射同构修正 (+Q1 - Q2)
 * 4. 稀疏乘法 mulLine 累积至 Fp12
 * 5. 最终幂运算 (Final Exponentiation): (p^12 - 1) / n
 *    - 容易部分: (p^6 - 1) * (p^2 + 1)
 *    - 困难部分: (p^4 - p^2 + 1) / n 采用 BN 优化的多项式展开与循环群酉求逆
 */

import { SM9_P, SM9_T } from './constants.js';
import {
  fp_mul,
  fp_inv,
  fp_sqr,
} from './fp.js';
import {
  fp2_zero,
  fp2_one,
  fp2_add,
  fp2_sub,
  fp2_neg,
  fp2_dbl,
  fp2_tri,
  fp2_mul,
  fp2_sqr,
  fp2_inv,
  fp2_mul_fp,
  fp2_mul_u,
  fp2_frobenius,
} from './fp2.js';
import {
  fp4_add,
  fp4_mul_v,
} from './fp4.js';
import {
  fp12_one,
  fp12_mul,
  fp12_sqr,
  fp12_inv,
  fp12_frobenius,
  fp12_frobenius2,
  fp12_frobenius3,
  fp12_frobenius6,
  fp12_unitary_inv,
} from './fp12.js';
import { g1_is_zero } from './g1.js';
import { g2_is_zero } from './g2.js';

// 6t + 2 的 66 位 NAF 展开表示:
// 6t + 2 = 0x2400000000215d93e
export const SIX_T_PLUS_2_NAF = [
  0, -1, 0, 0, 0, 0, 1, 0, 1, 0, 0, -1, 0, -1, 0, 0, 0, -1, 0, -1, 0, 1, 0, 0, 0, 1, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 1, 0, 0, 1
];

// Miller 循环后 Frobenius 扭曲映射修正点常数:
// betaToNegPPlus1Over3 = beta^((-p+1)/3) mod p
export const BETA_TO_NEG_P_PLUS_1_OVER_3 = 0xb640000002a3a6f0e303ab4ff2eb2052a9f02115caef75e70f738991676af24an;
// betaToNegPPlus1Over2 = beta^((-p+1)/2) mod p
export const BETA_TO_NEG_P_PLUS_1_OVER_2 = 0x49db721a269967c4e0a8debc0783182f82555233139e9d63efbd7b54092c756cn;
// betaToNegP2Plus1Over3 = beta^((-p^2+1)/3) mod p
export const BETA_TO_NEG_P2_PLUS_1_OVER_3 = 0xb640000002a3a6f0e303ab4ff2eb2052a9f02115caef75e70f738991676af249n;
// betaToNegP2Plus1Over2 = beta^((-p^2+1)/2) mod p
export const BETA_TO_NEG_P2_PLUS_1_OVER_2 = 0xb640000002a3a6f1d603ab4ff58ec74521f2934b1a7aeedbe56f9b27e351457cn;

/**
 * 射影坐标下的点倍乘线函数评估
 * @param {{ X: [bigint, bigint], Y: [bigint, bigint], Z: [bigint, bigint], T: [bigint, bigint] }} r
 * @param {{ x: bigint, y: bigint }} q G1 中的仿射点
 * @returns {{ a: [bigint, bigint], b: [bigint, bigint], c: [bigint, bigint], rOut: any }}
 */
export function lineFunctionDouble(r, q) {
  // A = Xr^2, B = Yr^2, C = Yr^4
  const A = fp2_sqr(r.X);
  const B = fp2_sqr(r.Y);
  const C = fp2_sqr(B);

  // D = 2 * ((Xr + B)^2 - A - C)
  const tD = fp2_add(r.X, B);
  const D = fp2_dbl(fp2_sub(fp2_sub(fp2_sqr(tD), A), C));

  // E = 3 * A, G = E^2 = 9 * Xr^4
  const E = fp2_tri(A);
  const G = fp2_sqr(E);

  // X3 = G - 2*D
  const X3 = fp2_sub(fp2_sub(G, D), D);
  // Z3 = (Yr + Zr)^2 - Yr^2 - Zr^2 = 2 * Yr * Zr
  const Z3 = fp2_sub(fp2_sub(fp2_sqr(fp2_add(r.Y, r.Z)), B), r.T);

  // Y3 = E * (D - X3) - 8 * C
  const Y3 = fp2_sub(fp2_mul(E, fp2_sub(D, X3)), fp2_mul_fp(C, 8n));
  const T3 = fp2_sqr(Z3);

  const rOut = { X: X3, Y: Y3, Z: Z3, T: T3 };

  // 线函数评估系数:
  // b = -2 * (E * Tr) * Xq
  const tB = fp2_dbl(fp2_mul(E, r.T));
  const b = fp2_mul_fp(fp2_neg(tB), q.x);

  // a = (Xr + E)^2 - A - G - 4*B
  const tA = fp2_sqr(fp2_add(r.X, E));
  const a = fp2_sub(fp2_sub(fp2_sub(tA, A), G), fp2_mul_fp(B, 4n));

  // c = 2 * Z3 * Tr * Yq
  const c = fp2_mul_fp(fp2_dbl(fp2_mul(rOut.Z, r.T)), q.y);

  return { a, b, c, rOut };
}

/**
 * 射影坐标与仿射坐标混合点加法线函数评估
 * @param {{ X: [bigint, bigint], Y: [bigint, bigint], Z: [bigint, bigint], T: [bigint, bigint] }} r
 * @param {{ x: [bigint, bigint], y: [bigint, bigint] }} p G2 仿射点
 * @param {{ x: bigint, y: bigint }} q G1 仿射点
 * @param {[bigint, bigint]} r2 p.y^2
 * @returns {{ a: [bigint, bigint], b: [bigint, bigint], c: [bigint, bigint], rOut: any }}
 */
export function lineFunctionAdd(r, p, q, r2) {
  const B = fp2_mul(p.x, r.T);
  const D_pre = fp2_add(p.y, r.Z);
  const D = fp2_mul(fp2_sub(fp2_sub(fp2_sqr(D_pre), r2), r.T), r.T);

  const H = fp2_sub(B, r.X);
  const I = fp2_sqr(H);
  const E = fp2_dbl(fp2_dbl(I));
  const J = fp2_mul(H, E);

  const L1 = fp2_sub(D, fp2_dbl(r.Y));
  const V = fp2_mul(r.X, E);

  const X3 = fp2_sub(fp2_sub(fp2_sub(fp2_sqr(L1), J), V), V);
  const Z3 = fp2_sub(fp2_sub(fp2_sqr(fp2_add(r.Z, H)), r.T), I);

  const t = fp2_mul(L1, fp2_sub(V, X3));
  const t2 = fp2_dbl(fp2_mul(r.Y, J));
  const Y3 = fp2_sub(t, t2);
  const T3 = fp2_sqr(Z3);

  const rOut = { X: X3, Y: Y3, Z: Z3, T: T3 };

  // a = 2*L1*Xp - 2*Yp*Z3
  const tA1 = fp2_dbl(fp2_mul(L1, p.x));
  const tA2 = fp2_sub(fp2_sub(fp2_sqr(fp2_add(p.y, rOut.Z)), r2), rOut.T);
  const a = fp2_sub(tA1, tA2);

  // b = -2 * L1 * Xq
  const b = fp2_mul_fp(fp2_dbl(fp2_neg(L1)), q.x);

  // c = 2 * Z3 * Yq
  const c = fp2_mul_fp(fp2_dbl(rOut.Z), q.y);

  return { a, b, c, rOut };
}

/**
 * 稀疏乘法: ret = ret * ((c*v + a) + b*w^2)
 * ret 位于 Fp12 = Fp4[w] / (w^3 - v)
 * @param {[any, any, any]} ret
 * @param {[bigint, bigint]} a
 * @param {[bigint, bigint]} b
 * @param {[bigint, bigint]} c
 * @returns {[any, any, any]}
 */
export function mulLine(ret, a, b, c) {
  const c0 = ret[0], c1 = ret[1], c2 = ret[2];

  // 乘以 L0 = (a + c*v) 属于 Fp4:
  // (x0 + x1*v)*(a + c*v) = (x0*a + x1*c*u) + (x0*c + x1*a)*v
  function mul_L0(x) {
    const x0 = x[0], x1 = x[1];
    const r0 = fp2_add(fp2_mul(x0, a), fp2_mul_u(fp2_mul(x1, c)));
    const r1 = fp2_add(fp2_mul(x0, c), fp2_mul(x1, a));
    return [r0, r1];
  }

  // 乘以标量 b 属于 Fp2:
  function mul_b(x) {
    return [fp2_mul(x[0], b), fp2_mul(x[1], b)];
  }

  const c0_L0 = mul_L0(c0);
  const c1_L0 = mul_L0(c1);
  const c2_L0 = mul_L0(c2);

  const c1_b = mul_b(c1);
  const c2_b = mul_b(c2);
  const c0_b = mul_b(c0);

  // 展开重组:
  // new_c0 = c0 * L0 + (c1 * b) * v
  // new_c1 = c1 * L0 + (c2 * b) * v
  // new_c2 = c2 * L0 + (c0 * b)
  const new_c0 = fp4_add(c0_L0, fp4_mul_v(c1_b));
  const new_c1 = fp4_add(c1_L0, fp4_mul_v(c2_b));
  const new_c2 = fp4_add(c2_L0, c0_b);

  return [new_c0, new_c1, new_c2];
}

/**
 * Miller 循环计算
 * @param {{ x: [bigint, bigint], y: [bigint, bigint] }} Q_aff G2 仿射点
 * @param {{ x: bigint, y: bigint }} P_aff G1 仿射点
 * @returns {[any, any, any]}
 */
export function miller(Q_aff, P_aff) {
  let ret = fp12_one();
  let r = { X: Q_aff.x, Y: Q_aff.y, Z: fp2_one(), T: fp2_one() };
  const r2 = fp2_sqr(Q_aff.y);
  const minusQ = { x: Q_aff.x, y: fp2_neg(Q_aff.y) };

  for (let i = SIX_T_PLUS_2_NAF.length - 1; i > 0; i--) {
    const dbl = lineFunctionDouble(r, P_aff);
    if (i !== SIX_T_PLUS_2_NAF.length - 1) {
      ret = fp12_sqr(ret);
    }
    ret = mulLine(ret, dbl.a, dbl.b, dbl.c);
    r = dbl.rOut;

    const nafVal = SIX_T_PLUS_2_NAF[i - 1];
    if (nafVal === 1) {
      const add = lineFunctionAdd(r, Q_aff, P_aff, r2);
      ret = mulLine(ret, add.a, add.b, add.c);
      r = add.rOut;
    } else if (nafVal === -1) {
      const add = lineFunctionAdd(r, minusQ, P_aff, r2);
      ret = mulLine(ret, add.a, add.b, add.c);
      r = add.rOut;
    }
  }

  // 循环结束后的 Frobenius 扭曲映射同构修正:
  // Q1 = (bar(xQ) * betaToNegPPlus1Over3, bar(yQ) * betaToNegPPlus1Over2)
  const q1 = {
    x: fp2_mul_fp(fp2_frobenius(Q_aff.x), BETA_TO_NEG_P_PLUS_1_OVER_3),
    y: fp2_mul_fp(fp2_frobenius(Q_aff.y), BETA_TO_NEG_P_PLUS_1_OVER_2),
  };
  const r2_q1 = fp2_sqr(q1.y);
  const add_q1 = lineFunctionAdd(r, q1, P_aff, r2_q1);
  ret = mulLine(ret, add_q1.a, add_q1.b, add_q1.c);
  r = add_q1.rOut;

  // -Q2 = (xQ * betaToNegP2Plus1Over3, -yQ * betaToNegP2Plus1Over2)
  const minusQ2 = {
    x: fp2_mul_fp(Q_aff.x, BETA_TO_NEG_P2_PLUS_1_OVER_3),
    y: fp2_mul_fp(fp2_neg(Q_aff.y), BETA_TO_NEG_P2_PLUS_1_OVER_2),
  };
  const r2_minusQ2 = fp2_sqr(minusQ2.y);
  const add_q2 = lineFunctionAdd(r, minusQ2, P_aff, r2_minusQ2);
  ret = mulLine(ret, add_q2.a, add_q2.b, add_q2.c);

  return ret;
}

/**
 * 最终幂运算 (Final Exponentiation): f^((p^12 - 1) / n)
 * @param {[any, any, any]} f
 * @returns {[any, any, any]}
 */
export function finalExponentiation(f) {
  // 1. 容易部分 (Easy Part): f^((p^6 - 1) * (p^2 + 1))
  const f_p6 = fp12_frobenius6(f);
  const f_inv = fp12_inv(f);
  let t1 = fp12_mul(f_p6, f_inv);

  const t2 = fp12_frobenius2(t1);
  t1 = fp12_mul(t1, t2);

  // 2. 困难部分 (Hard Part): t1^((p^4 - p^2 + 1) / n)
  // 利用参数 u = SM9_T 展开 (Devegili et al. / Beuchat et al.)
  function pow_u(x) {
    let res = fp12_one();
    let b = x;
    let e = SM9_T;
    while (e > 0n) {
      if (e & 1n) res = fp12_mul(res, b);
      b = fp12_sqr(b);
      e >>= 1n;
    }
    return res;
  }

  const fu = pow_u(t1);
  const fu2 = pow_u(fu);
  const fu3 = pow_u(fu2);

  const fu2p = fp12_frobenius(fu2);
  const fu3p = fp12_frobenius(fu3);

  const fp = fp12_frobenius(t1);
  const fp2 = fp12_frobenius2(t1);
  const fp3 = fp12_frobenius3(t1);

  const y0 = fp12_mul(fp12_mul(fp, fp2), fp3);
  const y1 = fp12_unitary_inv(t1);
  const y2 = fp12_frobenius2(fu2);
  const y3 = fp12_unitary_inv(fp12_frobenius(fu));
  const y4 = fp12_unitary_inv(fp12_mul(fu, fu2p));
  const y5 = fp12_unitary_inv(fu2);
  const y6 = fp12_unitary_inv(fp12_mul(fu3, fu3p));

  let t0 = fp12_sqr(y6);
  t0 = fp12_mul(t0, y4);
  t0 = fp12_mul(t0, y5);

  t1 = fp12_mul(fp12_mul(y3, y5), t0);

  t0 = fp12_mul(t0, y2);
  t1 = fp12_sqr(t1);
  t1 = fp12_mul(t1, t0);
  t1 = fp12_sqr(t1);

  t0 = fp12_mul(t1, y1);
  t1 = fp12_mul(t1, y0);
  t0 = fp12_sqr(t0);
  t0 = fp12_mul(t0, t1);

  return t0;
}

/**
 * SM9 最佳双线性对主计算函数
 * e: G1 x G2 -> GT
 *
 * @param {{ x: bigint, y: bigint } | { X: bigint, Y: bigint, Z: bigint }} P G1 点 (仿射或 Jacobian)
 * @param {{ x: [bigint, bigint], y: [bigint, bigint] } | { X: [bigint, bigint], Y: [bigint, bigint], Z: [bigint, bigint] }} Q G2 点 (仿射或 Jacobian)
 * @returns {[any, any, any]} GT 中的双线性对计算结果 (Fp12 元素)
 */
export function pairing(P, Q) {
  // 1. G1 点规范化与无穷远点检测
  if (!P || P.infinity || (P.Z !== undefined && P.Z === 0n)) {
    return fp12_one();
  }
  let P_aff;
  if (P.Z !== undefined) {
    if (P.Z === 1n) {
      P_aff = { x: P.X, y: P.Y };
    } else {
      const zInv = fp_inv(P.Z);
      const zInv2 = fp_sqr(zInv);
      const zInv3 = fp_mul(zInv2, zInv);
      P_aff = {
        x: fp_mul(P.X, zInv2),
        y: fp_mul(P.Y, zInv3),
      };
    }
  } else {
    P_aff = P;
  }

  // 2. G2 点规范化与无穷远点检测
  if (!Q || Q.infinity || (Q.Z !== undefined && (Q.Z[0] === 0n && Q.Z[1] === 0n))) {
    return fp12_one();
  }
  let Q_aff;
  if (Q.Z !== undefined) {
    if (Q.Z[0] === 1n && Q.Z[1] === 0n) {
      Q_aff = { x: Q.X, y: Q.Y };
    } else {
      const zInv = fp2_inv(Q.Z);
      const zInv2 = fp2_sqr(zInv);
      const zInv3 = fp2_mul(zInv2, zInv);
      Q_aff = {
        x: fp2_mul(Q.X, zInv2),
        y: fp2_mul(Q.Y, zInv3),
      };
    }
  } else {
    Q_aff = Q;
  }

  const m = miller(Q_aff, P_aff);
  return finalExponentiation(m);
}
