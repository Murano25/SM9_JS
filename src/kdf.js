/**
 * 基于 SM3 的密钥派生函数 KDF 与消息认证码 MAC
 * 符合 GB/T 32918.4-2016 5.4.3 及 GB/T 38635.1
 */

import { SM3, sm3, toUint8Array } from './sm3.js';

/**
 * 密钥派生函数 KDF (基于 SM3)
 * @param {Uint8Array | string} z 共享输入比特串 Z
 * @param {number} klen 待派生密钥字节长度
 * @returns {Uint8Array} 长度为 klen 的密钥比特流
 */
export function kdf(z, klen) {
  if (klen <= 0) {
    return new Uint8Array(0);
  }

  const zBytes = toUint8Array(z);
  const out = new Uint8Array(klen);
  const countBytes = new Uint8Array(4);

  const iterations = Math.ceil(klen / 32);
  const hasher = new SM3();

  let offset = 0;
  for (let ct = 1; ct <= iterations; ct++) {
    // 32 位大端计数器 ct
    countBytes[0] = (ct >>> 24) & 0xff;
    countBytes[1] = (ct >>> 16) & 0xff;
    countBytes[2] = (ct >>> 8) & 0xff;
    countBytes[3] = ct & 0xff;

    hasher.reset();
    hasher.update(zBytes);
    hasher.update(countBytes);
    const block = hasher.digest();

    const copyLen = Math.min(32, klen - offset);
    out.set(block.subarray(0, copyLen), offset);
    offset += copyLen;
  }

  return out;
}

/**
 * SM9 加密标准消息认证码 MAC
 * MAC(K2, M) = SM3(M || K2)
 *
 * @param {Uint8Array} key 认证密钥 K2 (通常为 32 字节)
 * @param {Uint8Array} msg 密文数据 C2
 * @returns {Uint8Array} 32 字节认证码 C3
 */
export function mac(key, msg) {
  const kBytes = toUint8Array(key);
  const mBytes = toUint8Array(msg);

  const hasher = new SM3();
  hasher.update(mBytes);
  hasher.update(kBytes);
  return hasher.digest();
}
