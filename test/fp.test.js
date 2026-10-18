import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  fp_add,
  fp_sub,
  fp_dbl,
  fp_tri,
  fp_neg,
  fp_mul,
  fp_sqr,
  fp_div2,
  fp_inv,
  fp_pow,
  fp_eq,
  fp_is_zero,
  fp_is_one,
  fp_from_hex,
  fp_to_hex,
  fp_from_bytes,
  fp_to_bytes,
  P,
} from '../src/fp.js';
import { SM9_P, SM9_P1, SM9_B } from '../src/constants.js';

describe('Fp (Prime Field Arithmetic)', () => {
  it('should verify basic constants and properties', () => {
    assert.equal(P, SM9_P);
    assert.equal(fp_is_zero(0n), true);
    assert.equal(fp_is_zero(1n), false);
    assert.equal(fp_is_one(1n), true);
    assert.equal(fp_is_one(0n), false);
  });

  it('should perform modular addition and subtraction correctly', () => {
    const a = 0x123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0n;
    const b = 0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210n;

    assert.equal(fp_add(a, 0n), a);
    assert.equal(fp_sub(a, 0n), a);
    assert.equal(fp_sub(a, a), 0n);
    assert.equal(fp_add(a, fp_neg(a)), 0n);

    // Overflow boundary test
    const max = P - 1n;
    assert.equal(fp_add(max, 1n), 0n);
    assert.equal(fp_add(max, 2n), 1n);
    assert.equal(fp_sub(0n, 1n), max);

    // dbl and tri
    assert.equal(fp_dbl(a), fp_add(a, a));
    assert.equal(fp_tri(a), fp_add(fp_dbl(a), a));
    assert.equal(fp_dbl(max), max - 1n);
  });

  it('should perform division by 2 correctly', () => {
    const a = 123456789n;
    const b = 123456788n;
    assert.equal(fp_mul(fp_div2(a), 2n), a);
    assert.equal(fp_mul(fp_div2(b), 2n), b);
    assert.equal(fp_div2(0n), 0n);
  });

  it('should perform multiplication and squaring correctly', () => {
    const a = 0x93de051d62bf718ff5ed0704487d01d6e1e4086909dc3280e8c4e4817c66ddddn;
    assert.equal(fp_sqr(a), fp_mul(a, a));
    assert.equal(fp_mul(a, 1n), a);
    assert.equal(fp_mul(a, 0n), 0n);
  });

  it('should calculate modular inverse correctly via ExtGCD', () => {
    assert.equal(fp_inv(1n), 1n);
    assert.equal(fp_inv(P - 1n), P - 1n);

    const testValues = [
      2n,
      3n,
      12345678901234567890n,
      SM9_P1.x,
      SM9_P1.y,
      P - 2n,
    ];

    for (const val of testValues) {
      const inv = fp_inv(val);
      assert.equal(fp_mul(val, inv), 1n, `Inverse failed for ${val.toString(16)}`);
    }

    assert.throws(() => fp_inv(0n), RangeError);
  });

  it('should verify Fermat little theorem with modular exponentiation', () => {
    const a = SM9_P1.x;
    assert.equal(fp_pow(a, P - 1n), 1n);
    // Compare pow(a, P - 2) with extgcd inv
    assert.equal(fp_pow(a, P - 2n), fp_inv(a));
  });

  it('should correctly serialize and deserialize to/from hex and bytes', () => {
    const val = SM9_P1.x;
    const hex = fp_to_hex(val);
    assert.equal(hex.length, 64);
    assert.equal(fp_from_hex(hex), val);
    assert.equal(fp_from_hex('0x' + hex), val);

    const bytes = fp_to_bytes(val);
    assert.equal(bytes.length, 32);
    assert.equal(fp_from_bytes(bytes), val);
  });

  it('should verify SM9 P1 satisfies curve equation y^2 = x^3 + 5 (mod p)', () => {
    const y2 = fp_sqr(SM9_P1.y);
    const x3_plus_5 = fp_add(fp_mul(fp_sqr(SM9_P1.x), SM9_P1.x), SM9_B);
    assert.equal(y2, x3_plus_5);
  });
});
