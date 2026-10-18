/**
 * SM9 密码杂凑函数 H1 与 H2 (映射到整数域 Z_n^*)
 * 符合 GB/T 38635.1-2020 第 5.4.2.2 节及 GM/T 0044.1
 *
 * 算法原理:
 * hlen = 8 * ceil((5 * ceil(log2(n))) / 32)
 * 对于 256 位群阶 n，hlen = 40 字节 (320 比特)
 * Ha = KDF( [v] || Z, 40 字节 )
 * h = (Ha mod (n - 1)) + 1 属于 [1, n - 1]
 *
 * 其中:
 * H1 取前缀标识 v = 0x01 (用于标识签名/加密密钥生成)
 * H2 取前缀标识 v = 0x02 (用于数字签名与密钥协商)
 */

import { SM9_N } from './constants.js';
import { kdf } from './kdf.js';
import { toUint8Array } from './sm3.js';
export { toUint8Array };

/**
 * 将大端字节数组转换为 BigInt
 * @param {Uint8Array} bytes
 * @returns {bigint}
 */
export function bytes_to_bigint(bytes) {
  let res = 0n;
  for (let i = 0; i < bytes.length; i++) {
    res = (res << 8n) | BigInt(bytes[i]);
  }
  return res;
}

/**
 * 将 BigInt 转换为固定长度的大端 Uint8Array
 * @param {bigint} val
 * @param {number} len 目标字节长度 (默认 32)
 * @returns {Uint8Array}
 */
export function bigint_to_bytes(val, len = 32) {
  const out = new Uint8Array(len);
  let v = val;
  for (let i = len - 1; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

/**
 * 密码杂凑函数 Hv(Z, n): 映射到 [1, n - 1]
 * @param {Uint8Array | string} z 输入比特串 (如 用户ID || hid 或 消息 || 双线性对结果)
 * @param {number} prefix 模式前缀 (0x01 对应 H1, 0x02 对应 H2)
 * @param {bigint} n 椭圆曲线群阶 (默认 SM9_N)
 * @returns {bigint} 整数 h 属于 [1, n - 1]
 */
export function hash_to_field(z, prefix, n = SM9_N) {
  const zBytes = toUint8Array(z);

  // 拼接 [prefix] || Z
  const input = new Uint8Array(1 + zBytes.length);
  input[0] = prefix & 0xff;
  input.set(zBytes, 1);

  // 对于 256 位 SM9，hlen 为 40 字节 (320 位)
  const haBytes = kdf(input, 40);
  const ha = bytes_to_bigint(haBytes);

  // h = (ha mod (n - 1)) + 1
  const h = (ha % (n - 1n)) + 1n;
  return h;
}

/**
 * SM9 密码杂凑函数 H1
 * @param {Uint8Array | string} z
 * @returns {bigint}
 */
export function h1(z) {
  return hash_to_field(z, 0x01);
}

/**
 * SM9 密码杂凑函数 H2
 * @param {Uint8Array | string} z
 * @returns {bigint}
 */
export function h2(z) {
  return hash_to_field(z, 0x02);
}
