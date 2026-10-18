import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import sm9, {
  generate_sign_master_key,
  extract_sign_user_key,
  sign,
  verify,
  generate_encrypt_master_key,
  extract_encrypt_user_key,
  encrypt,
  decrypt,
  wrap_key,
  unwrap_key,
  pairing,
  generateSignMasterKey,
  extractSignUserKey,
  generateEncryptMasterKey,
  extractEncryptUserKey,
  wrapKey,
  unwrapKey,
  SM9_P1,
  SM9_P2,
} from '../src/index.js';

describe('SM9 Unified Index API & End-to-End Integration Tests', () => {
  it('should export all functions directly and via sm9 namespace', () => {
    assert.ok(typeof generate_sign_master_key === 'function');
    assert.ok(typeof generateSignMasterKey === 'function');
    assert.ok(typeof extractSignUserKey === 'function');
    assert.ok(typeof generateEncryptMasterKey === 'function');
    assert.ok(typeof extractEncryptUserKey === 'function');
    assert.ok(typeof wrapKey === 'function');
    assert.ok(typeof unwrapKey === 'function');
    assert.ok(typeof sign === 'function');
    assert.ok(typeof verify === 'function');
    assert.ok(typeof encrypt === 'function');
    assert.ok(typeof decrypt === 'function');
    assert.ok(typeof wrap_key === 'function');
    assert.ok(typeof unwrap_key === 'function');
    assert.ok(typeof pairing === 'function');

    assert.ok(typeof sm9.generateSignMasterKey === 'function');
    assert.ok(typeof sm9.sign === 'function');
    assert.ok(typeof sm9.verify === 'function');
    assert.ok(typeof sm9.encrypt === 'function');
    assert.ok(typeof sm9.decrypt === 'function');
    assert.ok(typeof sm9.wrapKey === 'function');
    assert.ok(typeof sm9.unwrapKey === 'function');
    assert.ok(typeof sm9.pairing === 'function');
    assert.ok(typeof sm9.sm3 === 'function');
    assert.ok(typeof sm9.kdf === 'function');
  });

  it('End-to-End Signature Workflow via sm9 namespace', () => {
    // 1. KGC 生成签名主密钥对
    const masterKey = sm9.generateSignMasterKey();

    // 2. 提取用户签名私钥 (Alice)
    const aliceId = 'Alice@example.com';
    const alicePrivKey = sm9.extractSignUserKey(masterKey.privateKey, aliceId);

    // 3. 用户 Alice 对消息签名
    const message = 'Confidential SM9 Document 2026';
    const signature = sm9.sign(masterKey.publicKey, alicePrivKey, message);

    // 4. 任意验证方使用主公钥 + Alice 标识验签
    const isValid = sm9.verify(masterKey.publicKey, aliceId, message, signature);
    assert.strictEqual(isValid, true);

    // 5. 篡改标识或消息时验签失败
    const isFakeValid = sm9.verify(masterKey.publicKey, 'Bob@example.com', message, signature);
    assert.strictEqual(isFakeValid, false);
  });

  it('End-to-End Encryption Workflow via sm9 namespace', () => {
    // 1. KGC 生成加密主密钥对
    const masterKey = sm9.generateEncryptMasterKey();

    // 2. 提取用户解密私钥 (Bob)
    const bobId = 'Bob@financial-corp.cn';
    const bobPrivKey = sm9.extractEncryptUserKey(masterKey.privateKey, bobId);

    // 3. 发送方使用主公钥 + Bob 标识进行加密
    const secretMessage = 'Secret key material: 0xDEADBEEF99998888';
    const cipher = sm9.encrypt(masterKey.publicKey, bobId, secretMessage);

    // 4. Bob 使用解密私钥解密
    const decryptedBytes = sm9.decrypt(bobPrivKey, bobId, cipher);
    const decryptedText = new TextDecoder().decode(decryptedBytes);
    assert.strictEqual(decryptedText, secretMessage);
  });

  it('End-to-End Key Encapsulation (KEM) via sm9 namespace', () => {
    const masterKey = sm9.generateEncryptMasterKey();
    const receiverId = 'Device-Node-42';
    const receiverKey = sm9.extractEncryptUserKey(masterKey.privateKey, receiverId);

    // 发送方封装 32 字节对称密钥
    const wrapped = sm9.wrapKey(masterKey.publicKey, receiverId, 32);
    assert.strictEqual(wrapped.key.length, 32);

    // 接收方解封对称密钥
    const recoveredKey = sm9.unwrapKey(receiverKey, receiverId, wrapped.c1, 32);
    assert.deepStrictEqual(recoveredKey, wrapped.key);
  });

  it('Ciphertext serialization & deserialization encodeCipher / decodeCipher', () => {
    const masterKey = sm9.generateEncryptMasterKey();
    const id = 'Charlie';
    const privKey = sm9.extractEncryptUserKey(masterKey.privateKey, id);

    const cipher = sm9.encrypt(masterKey.publicKey, id, 'Quick test payload');
    const encoded = sm9.encodeCipher(cipher);
    assert.ok(encoded instanceof Uint8Array);
    assert.strictEqual(encoded.length, 64 + 32 + cipher.c2.length);

    // 解码并解密
    const decoded = sm9.decodeCipher(encoded);
    const decryptedBytes = sm9.decrypt(privKey, id, decoded);
    assert.strictEqual(new TextDecoder().decode(decryptedBytes), 'Quick test payload');

    // 也可以直接将二进制密文传给 decrypt
    const directDecrypted = sm9.decrypt(privKey, id, encoded);
    assert.strictEqual(new TextDecoder().decode(directDecrypted), 'Quick test payload');
  });
});
