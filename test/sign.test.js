import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generate_sign_master_key,
  extract_sign_user_key,
} from '../src/keygen.js';
import {
  sign,
  verify,
  sign_precompute,
} from '../src/sign.js';
import { g1_to_hex } from '../src/g1.js';

describe('SM9 Digital Signature & Verification (GB/T 38635.2 / GM/T 0044.2)', () => {
  it('GB/T 38635.2 附录 A 标准算例: 签名生成与验证端到端严格比对', () => {
    const ks = 0x000130E78459D78545CB54C587E02CF480CE0B66340F319F348A1D5B1F2DC5F4n;
    const masterKey = generate_sign_master_key(ks);

    const uid = 'Alice';
    const hid = 0x01;
    const dA = extract_sign_user_key(masterKey.privateKey, uid, hid);

    const message = 'Chinese IBS standard';
    const r = 0x033c8616b06704813203dfd00965022ed15975c662337aed648835dc4b1cben;

    // 生成签名
    const sig = sign(masterKey.publicKey, dA, message, r);

    // 1. 验证 h
    const expectedH = 0x823c4b21e4bd2dfe1ed92c606653e996668563152fc33f55d7bfbb9bd9705adbn;
    assert.strictEqual(sig.h, expectedH);

    // 2. 验证 S (G1 仿射坐标)
    const sHex = g1_to_hex(sig.s);
    assert.strictEqual(
      sHex.slice(0, 64),
      '73bf96923ce58b6ad0e13e9643a406d8eb98417c50ef1b29cef9adb48b6d598c'
    );
    assert.strictEqual(
      sHex.slice(64, 128),
      '856712f1c2e0968ab7769f42a99586aed139d5b8b3e15891827cc2aced9baa05'
    );

    // 3. 验证验签通过
    const isValid = verify(masterKey.publicKey, uid, message, sig, hid);
    assert.ok(isValid);
  });

  it('防篡改检测: 篡改消息、签名值、用户标识均应验签失败', () => {
    const masterKey = generate_sign_master_key();
    const uid = 'Alice';
    const dA = extract_sign_user_key(masterKey.privateKey, uid);
    const message = 'Original confidential statement';

    const sig = sign(masterKey.publicKey, dA, message);

    // 正确签名应通过
    assert.ok(verify(masterKey.publicKey, uid, message, sig));

    // 篡改消息内容
    assert.strictEqual(verify(masterKey.publicKey, uid, 'Tampered message', sig), false);

    // 篡改身份标识
    assert.strictEqual(verify(masterKey.publicKey, 'Bob', message, sig), false);

    // 篡改签名 h
    assert.strictEqual(
      verify(masterKey.publicKey, uid, message, { h: sig.h ^ 1n, s: sig.s }),
      false
    );

    // 篡改签名 S 坐标
    assert.strictEqual(
      verify(masterKey.publicKey, uid, message, { h: sig.h, s: { x: sig.s.x ^ 1n, y: sig.s.y } }),
      false
    );
  });

  it('随机主密钥全流程端到端闭环测试 (签名与预计算加速)', () => {
    const masterKey = generate_sign_master_key();
    const g = sign_precompute(masterKey.publicKey);

    const userKey = extract_sign_user_key(masterKey.privateKey, 'User2026');
    const msg = 'Benchmark high performance SM9 signature test';

    const sig = sign(masterKey.publicKey, userKey, msg, undefined, g);
    const valid = verify(masterKey.publicKey, 'User2026', msg, sig, undefined, g);

    assert.ok(valid);
  });
});
