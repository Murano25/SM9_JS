import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generate_encrypt_master_key,
  extract_encrypt_user_key,
} from '../src/keygen.js';
import {
  wrap_key,
  unwrap_key,
  encrypt,
  decrypt,
  g1_point_to_bytes,
} from '../src/encrypt.js';

function toHex(bytes) {
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

describe('SM9 Identity-based Encryption & Decryption (GB/T 38635.2 / GM/T 0044.4)', () => {
  it('GB/T 38635.2 / GM/T 0044.4 附录 C 标准算例: 密钥封装与解封装 (KEM)', () => {
    const ke = 0x0001EDEE3778F441F8DEA3D9FA0ACC4E07EE36C93F9A08618AF4AD85CEDE1C22n;
    const masterKey = generate_encrypt_master_key(ke);

    const uid = 'Bob';
    const hid = 0x03;
    const deB = extract_encrypt_user_key(masterKey.privateKey, uid, hid);

    const r = 0x74015F8489C01EF4270456F9E6475BFB602BDE7F33FD482AB4E3684A6722n;

    // 封装 32 字节密钥
    const { key, c1 } = wrap_key(masterKey.publicKey, uid, 32, r, hid);

    // 验证派生密钥与国标附录 C 一致
    const expectedKey = '4ff5cf86d2ad40c8f4bac98d76abdbde0c0e2f0a829d3f911ef5b2bce0695480';
    assert.strictEqual(toHex(key), expectedKey);

    // 验证密文点 C1
    const expectedC1 = '1edee2c3f465914491de44cefb2cb434ab02c308d9dc5e2067b4fed5aaac8a0f1c9b4c435eca35ab83bb734174c0f78fde81a53374aff3b3602bbc5e37be9a4c';
    assert.strictEqual(toHex(g1_point_to_bytes(c1)), expectedC1);

    // 解封装恢复密钥
    const recoveredKey = unwrap_key(deB, uid, c1, 32);
    assert.deepStrictEqual(recoveredKey, key);
  });

  it('GB/T 38635.2 / GM/T 0044.4 附录 D 标准算例: 加密与解密全流程严格比对', () => {
    const ke = 0x0001EDEE3778F441F8DEA3D9FA0ACC4E07EE36C93F9A08618AF4AD85CEDE1C22n;
    const masterKey = generate_encrypt_master_key(ke);

    const uid = 'Bob';
    const hid = 0x03;
    const deB = extract_encrypt_user_key(masterKey.privateKey, uid, hid);

    const plaintext = 'Chinese IBE standard';
    const r = 0xAAC0541779C8FC45E3E2CB25C12B5D2576B2129AE8BB5EE2CBE5EC9E785Cn;

    const cipher = encrypt(masterKey.publicKey, uid, plaintext, r, hid);

    // 1. 验证 C1
    const expectedC1 = '2445471164490618e1ee20528ff1d545b0f14c8bcaa44544f03dab5dac07d8ff42ffca97d57cddc05ea405f2e586feb3a6930715532b8000759f13059ed59ac0';
    assert.strictEqual(toHex(g1_point_to_bytes(cipher.c1)), expectedC1);

    // 2. 验证 C3 (MAC)
    const expectedC3 = 'ba672387bcd6de5016a158a52bb2e7fc429197bcab70b25afee37a2b9db9f367';
    assert.strictEqual(toHex(cipher.c3), expectedC3);

    // 3. 验证 C2 (密文载荷)
    const expectedC2 = '1b5f5b0e951489682f3e64e1378cdd5da9513b1c';
    assert.strictEqual(toHex(cipher.c2), expectedC2);

    // 4. 验证完整密文字节流 C1 || C3 || C2
    const expectedCiphertext = expectedC1 + expectedC3 + expectedC2;
    assert.strictEqual(toHex(cipher.ciphertext), expectedCiphertext);

    // 5. 验证字节流解密还原明文
    const decryptedBytes = decrypt(deB, uid, cipher.ciphertext);
    const decryptedText = new TextDecoder().decode(decryptedBytes);
    assert.strictEqual(decryptedText, plaintext);

    // 6. 验证对象结构解密还原明文
    const decryptedObj = decrypt(deB, uid, cipher);
    assert.strictEqual(new TextDecoder().decode(decryptedObj), plaintext);
  });

  it('防篡改检测: 密文损坏或私钥不匹配应拒绝解密', () => {
    const masterKey = generate_encrypt_master_key();
    const deAlice = extract_encrypt_user_key(masterKey.privateKey, 'Alice');
    const deBob = extract_encrypt_user_key(masterKey.privateKey, 'Bob');

    const msg = 'Highly secret financial contract details 2026';
    const cipher = encrypt(masterKey.publicKey, 'Alice', msg);

    // 合法解密应成功
    const dec = decrypt(deAlice, 'Alice', cipher.ciphertext);
    assert.strictEqual(new TextDecoder().decode(dec), msg);

    // 非法接收者私钥解密 (Bob 试图解密发给 Alice 的密文)
    assert.throws(() => {
      decrypt(deBob, 'Bob', cipher.ciphertext);
    }, /SM9 Decryption Error/);

    // 密文数据 C2 遭到篡改
    const corruptedC2 = new Uint8Array(cipher.ciphertext);
    corruptedC2[100] ^= 0xff;
    assert.throws(() => {
      decrypt(deAlice, 'Alice', corruptedC2);
    }, /SM9 Decryption Error/);

    // 认证码 C3 遭到篡改
    const corruptedC3 = new Uint8Array(cipher.ciphertext);
    corruptedC3[70] ^= 0x01;
    assert.throws(() => {
      decrypt(deAlice, 'Alice', corruptedC3);
    }, /SM9 Decryption Error/);
  });

  it('随机大数据端到端加解密测试 (长文本 & 二进制)', () => {
    const masterKey = generate_encrypt_master_key();
    const uid = 'Device_IoT_9988';
    const userKey = extract_encrypt_user_key(masterKey.privateKey, uid);

    // 1024 字节随机二进制数据
    const binaryData = new Uint8Array(1024);
    for (let i = 0; i < binaryData.length; i++) binaryData[i] = (i * 17 + 5) & 0xff;

    const cipher = encrypt(masterKey.publicKey, uid, binaryData);
    const recovered = decrypt(userKey, uid, cipher.ciphertext);

    assert.deepStrictEqual(recovered, binaryData);
  });
});
