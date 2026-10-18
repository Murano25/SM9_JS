import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  fp2_zero,
  fp2_one,
  fp2_u,
  fp2_is_zero,
  fp2_is_one,
  fp2_eq,
  fp2_add,
  fp2_sub,
  fp2_neg,
  fp2_dbl,
  fp2_tri,
  fp2_mul_fp,
  fp2_mul_u,
  fp2_mul,
  fp2_sqr,
  fp2_inv,
  fp2_frobenius,
  fp2_to_hex,
  fp2_from_hex,
} from '../src/fp2.js';
import { SM9_P, SM9_P2 } from '../src/constants.js';

describe('Fp2 (Quadratic Extension Field Fp[u]/(u^2 + 2))', () => {
  it('should verify basic constants and u^2 = -2', () => {
    const zero = fp2_zero();
    const one = fp2_one();
    const u = fp2_u();

    assert.equal(fp2_is_zero(zero), true);
    assert.equal(fp2_is_one(one), true);
    assert.equal(fp2_is_zero(one), false);

    // Verify u^2 = -2 mod p
    const u2 = fp2_sqr(u);
    assert.equal(u2[0], SM9_P - 2n);
    assert.equal(u2[1], 0n);

    // Verify fp2_mul_u(u) matches u^2
    const u_times_u = fp2_mul_u(u);
    assert.deepEqual(u_times_u, u2);
  });

  it('should perform addition, subtraction, and scalar multiplication', () => {
    const a = [123456789n, 987654321n];
    const b = [999999999n, 111111111n];

    const sum = fp2_add(a, b);
    assert.deepEqual(fp2_sub(sum, b), a);
    assert.deepEqual(fp2_add(a, fp2_neg(a)), fp2_zero());
    assert.deepEqual(fp2_dbl(a), fp2_add(a, a));
    assert.deepEqual(fp2_tri(a), fp2_add(fp2_dbl(a), a));
    assert.deepEqual(fp2_mul_fp(a, 3n), fp2_tri(a));
  });

  it('should verify multiplication and squaring consistency', () => {
    const a = SM9_P2.x;
    const b = SM9_P2.y;

    // Commutativity: a * b = b * a
    assert.deepEqual(fp2_mul(a, b), fp2_mul(b, a));

    // Multiplicative identity: a * 1 = a
    assert.deepEqual(fp2_mul(a, fp2_one()), a);

    // Multiplicative zero: a * 0 = 0
    assert.deepEqual(fp2_mul(a, fp2_zero()), fp2_zero());

    // Squaring: a^2 = a * a
    assert.deepEqual(fp2_sqr(a), fp2_mul(a, a));
    assert.deepEqual(fp2_sqr(b), fp2_mul(b, b));
  });

  it('should verify modular inversion in Fp2', () => {
    assert.deepEqual(fp2_inv(fp2_one()), fp2_one());

    const testElements = [
      fp2_u(),
      SM9_P2.x,
      SM9_P2.y,
      [12345678901234567890n, 98765432109876543210n],
      [SM9_P - 1n, SM9_P - 2n],
    ];

    for (const elem of testElements) {
      const inv = fp2_inv(elem);
      const prod = fp2_mul(elem, inv);
      assert.equal(fp2_is_one(prod), true, `Inverse failed for ${elem}`);
    }

    assert.throws(() => fp2_inv(fp2_zero()), RangeError);
  });

  it('should verify Frobenius automorphism (conjugation)', () => {
    const a = [12345n, 67890n];
    const frob = fp2_frobenius(a);
    assert.equal(frob[0], a[0]);
    assert.equal(frob[1], SM9_P - a[1]);

    // frob(frob(a)) = a (order 2 automorphism)
    assert.deepEqual(fp2_frobenius(frob), a);
  });

  it('should verify that SM9 P2 satisfies twist curve equation y^2 = x^3 + 5u', () => {
    const x = SM9_P2.x;
    const y = SM9_P2.y;

    const y2 = fp2_sqr(y);
    const x3 = fp2_mul(fp2_sqr(x), x);
    const b_twist = [0n, 5n]; // 5u
    const rhs = fp2_add(x3, b_twist);

    assert.deepEqual(y2, rhs);
  });

  it('should correctly serialize and deserialize to/from hex array', () => {
    const val = SM9_P2.x;
    const hex = fp2_to_hex(val);
    assert.equal(hex[0].length, 64);
    assert.equal(hex[1].length, 64);

    const parsed = fp2_from_hex(hex);
    assert.deepEqual(parsed, val);
  });
});
