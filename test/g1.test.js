import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  g1_zero,
  g1_is_zero,
  g1_from_affine,
  g1_to_affine,
  g1_eq,
  g1_neg,
  g1_dbl,
  g1_add_affine,
  g1_add,
  g1_mul,
  g1_is_on_curve,
  g1_to_hex,
  g1_from_hex,
} from '../src/g1.js';
import { SM9_P1, SM9_N } from '../src/constants.js';

describe('G1 (Elliptic Curve Group on E(Fp): y^2 = x^3 + 5)', () => {
  it('should verify basic point properties and generator P1', () => {
    assert.equal(g1_is_zero(g1_zero()), true);
    assert.equal(g1_is_on_curve(g1_zero()), true);
    assert.equal(g1_is_on_curve(SM9_P1), true);

    const P1_jac = g1_from_affine(SM9_P1);
    assert.equal(g1_is_zero(P1_jac), false);
    assert.deepEqual(g1_to_affine(P1_jac), { ...SM9_P1, infinity: false });
  });

  it('should verify point doubling and addition', () => {
    const P = g1_from_affine(SM9_P1);
    const P_dbl = g1_dbl(P);
    const P_add_aff = g1_add_affine(P, SM9_P1);
    const P_add_jac = g1_add(P, P);

    assert.equal(g1_eq(P_dbl, P_add_aff), true);
    assert.equal(g1_eq(P_dbl, P_add_jac), true);

    const P_dbl_aff = g1_to_affine(P_dbl);
    assert.equal(g1_is_on_curve(P_dbl_aff), true);
  });

  it('should verify point negation and subtraction to infinity', () => {
    const P = g1_from_affine(SM9_P1);
    const negP = g1_neg(P);
    const sum = g1_add(P, negP);
    assert.equal(g1_is_zero(sum), true);
  });

  it('should verify scalar multiplication [k] P and subgroup order n * P1 = O', () => {
    // 0 * P1 = O
    assert.equal(g1_is_zero(g1_mul(0n, SM9_P1)), true);

    // 1 * P1 = P1
    assert.equal(g1_eq(g1_mul(1n, SM9_P1), g1_from_affine(SM9_P1)), true);

    // 2 * P1 = P1 + P1
    assert.equal(g1_eq(g1_mul(2n, SM9_P1), g1_dbl(g1_from_affine(SM9_P1))), true);

    // [n] P1 = O (Subgroup Order!)
    const nP1 = g1_mul(SM9_N, SM9_P1);
    assert.equal(g1_is_zero(nP1), true, 'n * P1 must be point at infinity');

    // [n + 1] P1 = P1
    const nPlus1P1 = g1_mul(SM9_N + 1n, SM9_P1);
    assert.equal(g1_eq(nPlus1P1, g1_from_affine(SM9_P1)), true);

    // Distributivity: [a]P + [b]P = [a + b]P
    const a = 1234567n;
    const b = 7654321n;
    const aP = g1_mul(a, SM9_P1);
    const bP = g1_mul(b, SM9_P1);
    const sumP = g1_add(aP, bP);
    const abP = g1_mul(a + b, SM9_P1);
    assert.equal(g1_eq(sumP, abP), true);
  });

  it('should correctly serialize and deserialize to/from hex string', () => {
    const hex = g1_to_hex(SM9_P1);
    assert.equal(hex.length, 128);

    const parsed = g1_from_hex(hex);
    assert.equal(parsed.x, SM9_P1.x);
    assert.equal(parsed.y, SM9_P1.y);

    assert.throws(() => g1_from_hex('1234'), Error);
  });
});
