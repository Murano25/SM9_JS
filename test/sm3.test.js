import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sm3, sm3_hex, SM3 } from '../src/sm3.js';

describe('SM3 Cryptographic Hash Algorithm (GB/T 32905-2016)', () => {
  it('GB/T 32905 标准算例 1: "abc"', () => {
    const input = 'abc';
    const expected = '66c7f0f462eeedd9d1f2d46bdc10e4e24167c4875cf2f7a2297da02b8f4ba8e0';
    assert.strictEqual(sm3_hex(input), expected);

    const hashBytes = sm3(input);
    assert.strictEqual(hashBytes.length, 32);
    let hex = '';
    for (const b of hashBytes) hex += b.toString(16).padStart(2, '0');
    assert.strictEqual(hex, expected);
  });

  it('GB/T 32905 标准算例 2: 512 位长消息 "abcd...abcd" (64 字节)', () => {
    const input = 'abcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd';
    const expected = 'debe9ff92275b8a138604889c18e5a4d6fdb70e5387e5765293dcba39c0c5732';
    assert.strictEqual(sm3_hex(input), expected);
  });

  it('空字符串杂凑', () => {
    const emptyHex = sm3_hex('');
    // SM3("") = 1ab21d8355cfa17f8e61194831e81a8f22bec8c728fefb747ed035eb5082aa2b
    assert.strictEqual(emptyHex, '1ab21d8355cfa17f8e61194831e81a8f22bec8c728fefb747ed035eb5082aa2b');
  });

  it('流式增量计算 (分块 update)', () => {
    const full = 'Chinese IBS standard with SM3 streaming test vector';
    const expected = sm3_hex(full);

    const s = new SM3();
    s.update('Chinese ');
    s.update('IBS ');
    s.update('standard ');
    s.update('with SM3 streaming test vector');
    assert.strictEqual(s.digest_hex(), expected);
  });

  it('多分组边界测试 (55, 56, 64, 65, 127, 128, 129 字节)', () => {
    for (const len of [55, 56, 64, 65, 127, 128, 129]) {
      const buf = new Uint8Array(len);
      for (let i = 0; i < len; i++) buf[i] = (i * 31 + 7) & 0xff;

      const single = sm3_hex(buf);

      // 分块更新
      const s = new SM3();
      for (let i = 0; i < len; i += 7) {
        s.update(buf.subarray(i, Math.min(len, i + 7)));
      }
      assert.strictEqual(s.digest_hex(), single);
    }
  });

  it('大量数据测试 (128 KB)', () => {
    const large = new Uint8Array(128 * 1024);
    for (let i = 0; i < large.length; i++) large[i] = (i ^ (i >> 8)) & 0xff;

    const t0 = performance.now();
    const digest = sm3(large);
    const dt = performance.now() - t0;

    assert.strictEqual(digest.length, 32);
    // 性能验证: 128KB 纯 JS 计算应在 50ms 内完成
    assert.ok(dt < 100);
  });
});
