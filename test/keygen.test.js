import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generate_sign_master_key,
  extract_sign_user_key,
  generate_encrypt_master_key,
  extract_encrypt_user_key,
  generate_encrypt_user_public_key,
  random_scalar,
} from '../src/keygen.js';
import { g1_is_on_curve, g1_to_hex } from '../src/g1.js';
import { g2_is_on_curve, g2_to_hex } from '../src/g2.js';
import { SM9_N } from '../src/constants.js';

describe('SM9 Key Generation & Extraction (GB/T 38635 / GM/T 0044)', () => {
  it('GB/T 38635.2 / GM/T 0044 附录 A: 签名主公钥与用户签名私钥提取', () => {
    const ks = 0x000130E78459D78545CB54C587E02CF480CE0B66340F319F348A1D5B1F2DC5F4n;
    const masterKey = generate_sign_master_key(ks);

    assert.ok(g2_is_on_curve(masterKey.publicKey));

    const dA = extract_sign_user_key(masterKey.privateKey, 'Alice', 0x01);
    assert.ok(g1_is_on_curve(dA));

    // 验证 dA 在 G1 上的仿射坐标与国标测试向量一致
    const daHex = g1_to_hex(dA);
    assert.strictEqual(
      daHex.slice(0, 64),
      'a5702f05cf1315305e2d6eb64b0deb923db1a0bcf0caff90523ac8754aa69820'
    );
    assert.strictEqual(
      daHex.slice(64, 128),
      '78559a844411f9825c109f5ee3f52d720dd01785392a727bb1556952b2b013d3'
    );
  });

  it('GB/T 38635.2 / GM/T 0044.4 附录 C/D: 加密主公钥、用户解密私钥与用户公钥', () => {
    const ke = 0x0001EDEE3778F441F8DEA3D9FA0ACC4E07EE36C93F9A08618AF4AD85CEDE1C22n;
    const masterKey = generate_encrypt_master_key(ke);

    assert.ok(g1_is_on_curve(masterKey.publicKey));

    // 验证主公钥 P_pub-e
    const ppubeHex = g1_to_hex(masterKey.publicKey);
    const expectedPpubHex = '787ed7b8a51f3ab84e0a66003f32da5c720b17eca7137d39abc66e3c80a892ff769de61791e5adc4b9ff85a31354900b202871279a8c49dc3f220f644c57a7b1';
    assert.strictEqual(ppubeHex, expectedPpubHex);

    // 验证用户解密私钥 deB 属于 G2
    const deB = extract_encrypt_user_key(masterKey.privateKey, 'Bob', 0x03);
    assert.ok(g2_is_on_curve(deB));

    const deHex = g2_to_hex(deB);
    const expectedDeHex = '94736acd2c8c8796cc4785e938301a139a059d3537b6414140b2d31eecf41683115bae85f5d8bc6c3dbd9e5342979acccf3c2f4f28420b1cb4f8c0b59a19b1587aa5e47570da7600cd760a0cf7beaf71c447f3844753fe74fa7ba92ca7d3b55f27538a62e7f7bfb51dce08704796d94c9d56734f119ea44732b50e31cdeb75c1';
    assert.strictEqual(deHex.x[1] + deHex.x[0] + deHex.y[1] + deHex.y[0], expectedDeHex);

    // 验证用户公钥 QB 属于 G1
    const QB = generate_encrypt_user_public_key(masterKey.publicKey, 'Bob', 0x03);
    assert.ok(g1_is_on_curve(QB));
    const qbHex = g1_to_hex(QB);
    const expectedQbHex = '709d165808b0a43e2574e203fa885abcbab16a240c4c1916552e7c43d09763b8693269a6be2456f43333758274786b6051ff87b7f198da4ba1a2c6e336f51fcc';
    assert.strictEqual(qbHex, expectedQbHex);
  });

  it('随机密钥生成有效性', () => {
    const k = random_scalar();
    assert.ok(k >= 1n && k < SM9_N);

    const signMaster = generate_sign_master_key();
    assert.ok(g2_is_on_curve(signMaster.publicKey));
    const userSignKey = extract_sign_user_key(signMaster.privateKey, 'User123');
    assert.ok(g1_is_on_curve(userSignKey));

    const encMaster = generate_encrypt_master_key();
    assert.ok(g1_is_on_curve(encMaster.publicKey));
    const userEncKey = extract_encrypt_user_key(encMaster.privateKey, 'User123');
    assert.ok(g2_is_on_curve(userEncKey));
  });
});
