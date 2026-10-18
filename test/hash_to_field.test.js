import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SM9_N } from '../src/constants.js';
import {
  h1,
  h2,
  hash_to_field,
  bytes_to_bigint,
  bigint_to_bytes
} from '../src/hash_to_field.js';

describe('SM9 Hash-to-Field Functions H1 & H2 (GB/T 38635.1 / GM/T 0044)', () => {
  it('GB/T 38635 / GM/T 0044 标准算例 H1: Alice || hid(0x01)', () => {
    // 字符串 "Alice" (0x41, 0x6c, 0x69, 0x63, 0x65) 与 hid = 0x01
    const aliceId = new Uint8Array([0x41, 0x6c, 0x69, 0x63, 0x65, 0x01]);
    const h1Val = h1(aliceId);

    // 标准期望值: 2acc468c3926b0bdb2767e99ff26e084de9ced8dbc7d5fbf418027b667862fab
    const expected = 0x2acc468c3926b0bdb2767e99ff26e084de9ced8dbc7d5fbf418027b667862fabn;
    assert.strictEqual(h1Val, expected);
  });

  it('GB/T 38635 / GM/T 0044 标准算例 H2: 签名消息与双线性对群元素映射', () => {
    // 消息 "Chinese IBS standard" || g (Fp12 元素序列化)
    const zHex = '4368696E65736520494253207374616E6461726481377B8FDBC2839B4FA2D0E0F8AA6853BBBE9E9C4099608F8612C6078ACD7563815AEBA217AD502DA0F48704CC73CABB3C06209BD87142E14CBD99E8BCA1680F30DADC5CD9E207AEE32209F6C3CA3EC0D800A1A42D33C73153DED47C70A39D2E8EAF5D179A1836B359A9D1D9BFC19F2EFCDB829328620962BD3FDF15F2567F58A543D25609AE943920679194ED30328BB33FD15660BDE485C6B79A7B32B013983F012DB04BA59FE88DB889321CC2373D4C0C35E84F7AB1FF33679BCA575D67654F8624EB435B838CCA77B2D0347E65D5E46964412A096F4150D8C5EDE5440DDF0656FCB663D24731E80292188A2471B8B68AA993899268499D23C89755A1A89744643CEAD40F0965F28E1CD2895C3D118E4F65C9A0E3E741B6DD52C0EE2D25F5898D60848026B7EFB8FCC1B2442ECF0795F8A81CEE99A6248F294C82C90D26BD6A814AAF475F128AEF43A128E37F80154AE6CB92CAD7D1501BAE30F750B3A9BD1F96B08E97997363911314705BFB9A9DBB97F75553EC90FBB2DDAE53C8F68E42';
    const zBytes = new Uint8Array(zHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

    const h2Val = h2(zBytes);

    // 标准期望值: 823c4b21e4bd2dfe1ed92c606653e996668563152fc33f55d7bfbb9bd9705adb
    const expected = 0x823c4b21e4bd2dfe1ed92c606653e996668563152fc33f55d7bfbb9bd9705adbn;
    assert.strictEqual(h2Val, expected);
  });

  it('取值范围严格位于 [1, n - 1]', () => {
    for (let i = 0; i < 20; i++) {
      const randomInput = new Uint8Array([i, i * 7, i * 13]);
      const v1 = h1(randomInput);
      const v2 = h2(randomInput);

      assert.ok(v1 >= 1n && v1 < SM9_N);
      assert.ok(v2 >= 1n && v2 < SM9_N);
    }
  });

  it('bytes_to_bigint 与 bigint_to_bytes 互逆性', () => {
    const testVal = 0x123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0n;
    const bytes = bigint_to_bytes(testVal, 32);
    assert.strictEqual(bytes.length, 32);
    const restored = bytes_to_bigint(bytes);
    assert.strictEqual(restored, testVal);
  });
});
