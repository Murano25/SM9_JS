import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { kdf, mac } from '../src/kdf.js';
import { sm3 } from '../src/sm3.js';

describe('SM3-based KDF & MAC (GB/T 32918.4 / GB/T 38635)', () => {
  it('KDF 基础派生长度测试 (0, 16, 32, 40, 64, 100 字节)', () => {
    const z = new TextEncoder().encode('TestSharedSecretForSM9KDF');
    for (const len of [0, 16, 32, 40, 64, 100]) {
      const derived = kdf(z, len);
      assert.strictEqual(derived.length, len);
    }
  });

  it('KDF 前缀一致性测试: 前 32 字节与单次哈希加计数器 1 严格相等', () => {
    const z = new TextEncoder().encode('ArbitrarySecretKeyMaterial');
    const derived = kdf(z, 64);

    // 第 1 块应等于 SM3(z || 0x00000001)
    const block1Input = new Uint8Array(z.length + 4);
    block1Input.set(z, 0);
    block1Input[z.length + 3] = 1;
    const expectedBlock1 = sm3(block1Input);

    assert.deepStrictEqual(derived.subarray(0, 32), expectedBlock1);

    // 第 2 块应等于 SM3(z || 0x00000002)
    const block2Input = new Uint8Array(z.length + 4);
    block2Input.set(z, 0);
    block2Input[z.length + 3] = 2;
    const expectedBlock2 = sm3(block2Input);

    assert.deepStrictEqual(derived.subarray(32, 64), expectedBlock2);
  });

  it('MAC 函数测试: MAC(key, msg) == SM3(msg || key)', () => {
    const key = new TextEncoder().encode('macKey32BytesExactLength00000000');
    const msg = new TextEncoder().encode('SM9CiphertextPayloadData');

    const c3 = mac(key, msg);
    assert.strictEqual(c3.length, 32);

    const expectedInput = new Uint8Array(msg.length + key.length);
    expectedInput.set(msg, 0);
    expectedInput.set(key, msg.length);
    const expected = sm3(expectedInput);

    assert.deepStrictEqual(c3, expected);
  });
});
