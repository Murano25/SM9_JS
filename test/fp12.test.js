import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  fp12_zero,
  fp12_one,
  fp12_w,
  fp12_is_zero,
  fp12_is_one,
  fp12_eq,
  fp12_add,
  fp12_sub,
  fp12_neg,
  fp12_dbl,
  fp12_mul_fp,
  fp12_mul_fp4,
  fp12_mul_w,
  fp12_mul,
  fp12_sqr,
  fp12_inv,
  fp12_pow,
  fp12_frobenius,
  fp12_frobenius2,
  fp12_frobenius3,
  fp12_frobenius6,
  fp12_unitary_inv,
  fp12_to_hex,
  fp12_from_hex,
  FP12_FROB_W1,
} from '../src/fp12.js';
import { fp4_v, fp4_one, fp4_zero, fp4_is_zero } from '../src/fp4.js';
import { fp2_u, fp2_zero, fp2_one } from '../src/fp2.js';
import { SM9_P } from '../src/constants.js';

describe('Fp12 (Cubic Extension Field Fp4[w]/(w^3 - v))', () => {
  it('should verify basic constants and w^3 = v, w^6 = u, w^12 = -2', () => {
    const zero = fp12_zero();
    const one = fp12_one();
    const w = fp12_w();

    assert.equal(fp12_is_zero(zero), true);
    assert.equal(fp12_is_one(one), true);
    assert.equal(fp12_is_zero(one), false);

    // w^2
    const w2 = fp12_sqr(w);
    assert.equal(fp4_is_zero(w2[0]), true);
    assert.equal(fp4_is_zero(w2[1]), true);
    assert.deepEqual(w2[2], fp4_one());

    // w^3 = v in Fp12: [v, 0, 0]
    const w3 = fp12_mul(w2, w);
    assert.deepEqual(w3[0], fp4_v());
    assert.equal(fp4_is_zero(w3[1]), true);
    assert.equal(fp4_is_zero(w3[2]), true);

    // w^6 = v^2 = u in Fp12: [[u, 0], 0, 0]
    const w6 = fp12_sqr(w3);
    assert.deepEqual(w6[0][0], fp2_u());
    assert.deepEqual(w6[0][1], fp2_zero());

    // w^12 = u^2 = -2 in Fp12: [[[-2, 0], [0, 0]], 0, 0]
    const w12 = fp12_sqr(w6);
    assert.equal(w12[0][0][0], SM9_P - 2n);
    assert.equal(w12[0][0][1], 0n);

    // fp12_mul_w matches multiplication by w
    assert.deepEqual(fp12_mul_w(one), w);
    assert.deepEqual(fp12_mul_w(w), w2);
    assert.deepEqual(fp12_mul_w(w2), w3);
  });

  it('should perform addition, subtraction, and scaling', () => {
    const a = [
      [[1n, 2n], [3n, 4n]],
      [[5n, 6n], [7n, 8n]],
      [[9n, 10n], [11n, 12n]],
    ];
    const b = [
      [[10n, 20n], [30n, 40n]],
      [[50n, 60n], [70n, 80n]],
      [[90n, 100n], [110n, 120n]],
    ];

    const sum = fp12_add(a, b);
    assert.deepEqual(fp12_sub(sum, b), a);
    assert.deepEqual(fp12_add(a, fp12_neg(a)), fp12_zero());
    assert.deepEqual(fp12_dbl(a), fp12_add(a, a));
    assert.deepEqual(fp12_mul_fp(a, 2n), fp12_dbl(a));
    assert.deepEqual(fp12_mul_fp4(a, fp4_one()), a);
  });

  it('should verify multiplication and squaring consistency', () => {
    const a = [
      [[123n, 456n], [789n, 1011n]],
      [[222n, 333n], [444n, 555n]],
      [[666n, 777n], [888n, 999n]],
    ];
    const b = [
      [[11n, 22n], [33n, 44n]],
      [[55n, 66n], [77n, 88n]],
      [[99n, 10n], [20n, 30n]],
    ];

    // Commutativity
    assert.deepEqual(fp12_mul(a, b), fp12_mul(b, a));

    // Multiplicative identity and zero
    assert.deepEqual(fp12_mul(a, fp12_one()), a);
    assert.deepEqual(fp12_mul(a, fp12_zero()), fp12_zero());

    // Squaring: a^2 = a * a
    assert.deepEqual(fp12_sqr(a), fp12_mul(a, a));
    assert.deepEqual(fp12_sqr(b), fp12_mul(b, b));
  });

  it('should verify modular inversion in Fp12', () => {
    assert.deepEqual(fp12_inv(fp12_one()), fp12_one());

    const testElements = [
      fp12_w(),
      [
        [[1n, 2n], [3n, 4n]],
        [[5n, 6n], [7n, 8n]],
        [[9n, 10n], [11n, 12n]],
      ],
      [
        [[12345678901234567890n, 98765432109876543210n], [11111111111111111111n, 22222222222222222222n]],
        [[33333333333333333333n, 44444444444444444444n], [55555555555555555555n, 66666666666666666666n]],
        [[77777777777777777777n, 88888888888888888888n], [99999999999999999999n, 12345678912345678912n]],
      ],
    ];

    for (const elem of testElements) {
      const inv = fp12_inv(elem);
      const prod = fp12_mul(elem, inv);
      assert.equal(fp12_is_one(prod), true, 'Fp12 inverse failed');
    }

    assert.throws(() => fp12_inv(fp12_zero()), RangeError);
  });

  it('should verify Frobenius automorphisms pi, pi^2, pi^6 against modular powers', () => {
    const a = [
      [[123n, 456n], [789n, 1011n]],
      [[222n, 333n], [444n, 555n]],
      [[666n, 777n], [888n, 999n]],
    ];

    // pi(a) vs a^p
    const frob1 = fp12_frobenius(a);
    const pow1 = fp12_pow(a, SM9_P);
    assert.deepEqual(frob1, pow1, 'pi(a) matches a^p');

    // pi^2(a) vs a^(p^2)
    const frob2 = fp12_frobenius2(a);
    const pow2 = fp12_pow(a, SM9_P * SM9_P);
    assert.deepEqual(frob2, pow2, 'pi^2(a) matches a^(p^2)');

    // pi^6(a) vs a^(p^6)
    const frob6 = fp12_frobenius6(a);
    const pow6 = fp12_pow(a, SM9_P ** 6n);
    assert.deepEqual(frob6, pow6, 'pi^6(a) matches a^(p^6)');
  });

  it('should verify unitary inversion on cyclotomic element: a^(p^6) = a^(-1)', () => {
    // Generate an element in the cyclotomic subgroup via easy part of final exp:
    // f = x^(p^6 - 1)
    const x = [
      [[123n, 456n], [789n, 1011n]],
      [[222n, 333n], [444n, 555n]],
      [[666n, 777n], [888n, 999n]],
    ];

    // f = x^(p^6) * x^(-1)
    const x_p6 = fp12_frobenius6(x);
    const x_inv = fp12_inv(x);
    const f = fp12_mul(x_p6, x_inv);

    // Now f is in the unitary/cyclotomic subgroup, so f^(-1) = f^(p^6)
    const f_inv = fp12_inv(f);
    const f_unitary = fp12_unitary_inv(f);
    assert.deepEqual(f_unitary, f_inv, 'Unitary inverse matches full inverse');
    assert.equal(fp12_is_one(fp12_mul(f, f_unitary)), true);
  });

  it('should correctly serialize and deserialize to/from 12 hex strings array', () => {
    const val = [
      [[1n, 2n], [3n, 4n]],
      [[5n, 6n], [7n, 8n]],
      [[9n, 10n], [11n, 12n]],
    ];
    const hex = fp12_to_hex(val);
    assert.equal(hex.length, 12);
    for (const h of hex) {
      assert.equal(h.length, 64);
    }

    const parsed = fp12_from_hex(hex);
    assert.deepEqual(parsed, val);
  });
});
