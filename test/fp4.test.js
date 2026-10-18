import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  fp4_zero,
  fp4_one,
  fp4_v,
  fp4_is_zero,
  fp4_is_one,
  fp4_eq,
  fp4_add,
  fp4_sub,
  fp4_neg,
  fp4_dbl,
  fp4_mul_fp,
  fp4_mul_fp2,
  fp4_mul_v,
  fp4_mul,
  fp4_sqr,
  fp4_inv,
  fp4_frobenius,
  fp4_to_hex,
  fp4_from_hex,
  FP4_FROB_GAMMA,
} from '../src/fp4.js';
import { fp2_u, fp2_one, fp2_zero, fp2_to_hex, fp2_eq } from '../src/fp2.js';
import { SM9_P } from '../src/constants.js';

describe('Fp4 (Quadratic Extension Field Fp2[v]/(v^2 - u))', () => {
  it('should verify basic constants and v^2 = u', () => {
    const zero = fp4_zero();
    const one = fp4_one();
    const v = fp4_v();

    assert.equal(fp4_is_zero(zero), true);
    assert.equal(fp4_is_one(one), true);
    assert.equal(fp4_is_zero(one), false);

    // v^2 = u in Fp4: [u, 0]
    const v2 = fp4_sqr(v);
    assert.deepEqual(v2[0], fp2_u());
    assert.deepEqual(v2[1], fp2_zero());

    // v^4 = u^2 = -2 in Fp4: [-2, 0]
    const v4 = fp4_sqr(v2);
    assert.equal(v4[0][0], SM9_P - 2n);
    assert.equal(v4[0][1], 0n);

    // fp4_mul_v(v) matches v^2
    assert.deepEqual(fp4_mul_v(v), v2);
  });

  it('should perform addition, subtraction, and scaling', () => {
    const a = [[10n, 20n], [30n, 40n]];
    const b = [[100n, 200n], [300n, 400n]];

    const sum = fp4_add(a, b);
    assert.deepEqual(fp4_sub(sum, b), a);
    assert.deepEqual(fp4_add(a, fp4_neg(a)), fp4_zero());
    assert.deepEqual(fp4_dbl(a), fp4_add(a, a));
    assert.deepEqual(fp4_mul_fp(a, 2n), fp4_dbl(a));
    assert.deepEqual(fp4_mul_fp2(a, fp2_one()), a);
  });

  it('should verify multiplication and squaring consistency', () => {
    const a = [[1234567n, 7654321n], [9876543n, 3456789n]];
    const b = [[1112223n, 3334445n], [5556667n, 7778889n]];

    // Commutativity
    assert.deepEqual(fp4_mul(a, b), fp4_mul(b, a));

    // Multiplicative identity and zero
    assert.deepEqual(fp4_mul(a, fp4_one()), a);
    assert.deepEqual(fp4_mul(a, fp4_zero()), fp4_zero());

    // Squaring: a^2 = a * a
    assert.deepEqual(fp4_sqr(a), fp4_mul(a, a));
    assert.deepEqual(fp4_sqr(b), fp4_mul(b, b));
  });

  it('should verify modular inversion in Fp4', () => {
    assert.deepEqual(fp4_inv(fp4_one()), fp4_one());

    const testElements = [
      fp4_v(),
      [[1n, 2n], [3n, 4n]],
      [[12345678901234567890n, 98765432109876543210n], [11111111111111111111n, 22222222222222222222n]],
    ];

    for (const elem of testElements) {
      const inv = fp4_inv(elem);
      const prod = fp4_mul(elem, inv);
      assert.equal(fp4_is_one(prod), true, 'Fp4 inverse failed');
    }

    assert.throws(() => fp4_inv(fp4_zero()), RangeError);
  });

  it('should verify Frobenius automorphism on Fp4 against modular exponentiation', () => {
    const a = [[123n, 456n], [789n, 1011n]];
    const frob = fp4_frobenius(a);

    // Compute a^p via square-and-multiply
    let pow_p = fp4_one();
    let base = a;
    let exp = SM9_P;
    while (exp > 0n) {
      if (exp & 1n) pow_p = fp4_mul(pow_p, base);
      base = fp4_sqr(base);
      exp >>= 1n;
    }

    assert.deepEqual(frob, pow_p, 'Frobenius map matches a^p');
  });

  it('should correctly serialize and deserialize to/from hex array', () => {
    const val = [[123n, 456n], [789n, 1011n]];
    const hex = fp4_to_hex(val);
    assert.equal(hex.length, 4);
    for (const h of hex) {
      assert.equal(h.length, 64);
    }

    const parsed = fp4_from_hex(hex);
    assert.deepEqual(parsed, val);
  });
});
