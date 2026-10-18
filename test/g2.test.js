import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  g2_zero,
  g2_is_zero,
  g2_from_affine,
  g2_to_affine,
  g2_eq,
  g2_neg,
  g2_dbl,
  g2_add_affine,
  g2_add,
  g2_mul,
  g2_is_on_curve,
  g2_to_hex,
  g2_from_hex,
} from '../src/g2.js';
import { SM9_P2, SM9_N } from '../src/constants.js';

describe('G2 (Twist Elliptic Curve Group on E\'(Fp2): y^2 = x^3 + 5u)', () => {
  it('should verify basic point properties and generator P2', () => {
    assert.equal(g2_is_zero(g2_zero()), true);
    assert.equal(g2_is_on_curve(g2_zero()), true);
    assert.equal(g2_is_on_curve(SM9_P2), true);

    const P2_jac = g2_from_affine(SM9_P2);
    assert.equal(g2_is_zero(P2_jac), false);
    assert.deepEqual(g2_to_affine(P2_jac), { ...SM9_P2, infinity: false });
  });

  it('should verify point doubling and addition on twist curve', () => {
    const Q = g2_from_affine(SM9_P2);
    const Q_dbl = g2_dbl(Q);
    const Q_add_aff = g2_add_affine(Q, SM9_P2);
    const Q_add_jac = g2_add(Q, Q);

    assert.equal(g2_eq(Q_dbl, Q_add_aff), true);
    assert.equal(g2_eq(Q_dbl, Q_add_jac), true);

    const Q_dbl_aff = g2_to_affine(Q_dbl);
    assert.equal(g2_is_on_curve(Q_dbl_aff), true);
  });

  it('should verify point negation and subtraction to infinity', () => {
    const Q = g2_from_affine(SM9_P2);
    const negQ = g2_neg(Q);
    const sum = g2_add(Q, negQ);
    assert.equal(g2_is_zero(sum), true);
  });

  it('should verify scalar multiplication [k] Q and subgroup order n * P2 = O', () => {
    // 0 * P2 = O
    assert.equal(g2_is_zero(g2_mul(0n, SM9_P2)), true);

    // 1 * P2 = P2
    assert.equal(g2_eq(g2_mul(1n, SM9_P2), g2_from_affine(SM9_P2)), true);

    // 2 * P2 = P2 + P2
    assert.equal(g2_eq(g2_mul(2n, SM9_P2), g2_dbl(g2_from_affine(SM9_P2))), true);

    // [n] P2 = O (G2 Subgroup Order!)
    const nP2 = g2_mul(SM9_N, SM9_P2);
    assert.equal(g2_is_zero(nP2), true, 'n * P2 must be point at infinity');

    // [n + 1] P2 = P2
    const nPlus1P2 = g2_mul(SM9_N + 1n, SM9_P2);
    assert.equal(g2_eq(nPlus1P2, g2_from_affine(SM9_P2)), true);

    // Distributivity: [a]Q + [b]Q = [a + b]Q
    const a = 123456n;
    const b = 654321n;
    const aQ = g2_mul(a, SM9_P2);
    const bQ = g2_mul(b, SM9_P2);
    const sumQ = g2_add(aQ, bQ);
    const abQ = g2_mul(a + b, SM9_P2);
    assert.equal(g2_eq(sumQ, abQ), true);
  });

  it('should correctly serialize and deserialize to/from hex array', () => {
    const hex = g2_to_hex(SM9_P2);
    assert.equal(hex.length, 4);
    for (const h of hex) {
      assert.equal(h.length, 64);
    }

    const parsed = g2_from_hex(hex);
    assert.deepEqual(parsed.x, SM9_P2.x);
    assert.deepEqual(parsed.y, SM9_P2.y);
  });
});
