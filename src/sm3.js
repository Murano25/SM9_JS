/**
 * SM3 密码杂凑算法 (GB/T 32905-2016)
 * 纯 JavaScript (ES2020) 实现，零外部依赖
 *
 * 输出: 256 位杂凑值 (32 字节)
 * 分组长度: 512 位 (64 字节)
 */

// 初始向量 IV (256 位，8 个 32 位大端字)
const IV = new Uint32Array([
  0x7380166f, 0x4914b2b9, 0x172442d7, 0xda8a0600,
  0xa96f30bc, 0x163138aa, 0xe38dee4d, 0xb0fb0e4e,
]);

// 循环左移 (32 位无符号整数)
function rotl(x, n) {
  return ((x << n) | (x >>> (32 - n))) >>> 0;
}

// 布尔函数 FF_j
function FF(X, Y, Z, j) {
  if (j < 16) {
    return (X ^ Y ^ Z) >>> 0;
  }
  return ((X & Y) | (X & Z) | (Y & Z)) >>> 0;
}

// 布尔函数 GG_j
function GG(X, Y, Z, j) {
  if (j < 16) {
    return (X ^ Y ^ Z) >>> 0;
  }
  return ((X & Y) | ((~X) & Z)) >>> 0;
}

// 置换函数 P_0
function P0(X) {
  return (X ^ rotl(X, 9) ^ rotl(X, 17)) >>> 0;
}

// 置换函数 P_1
function P1(X) {
  return (X ^ rotl(X, 15) ^ rotl(X, 23)) >>> 0;
}

// 预计算 Tj 常量表 (左移后)
const W = new Uint32Array(68);
const W1 = new Uint32Array(64);

/**
 * SM3 压缩函数 CF
 * @param {Uint32Array} V 状态向量 (8 个 32 位字)
 * @param {Uint8Array} B 消息分组 (64 字节)
 * @param {number} offset 偏移量
 */
function compress(V, B, offset) {
  // 1. 消息扩展
  // 将 64 字节分组加载为 16 个大端 32 位字 W[0..15]
  for (let i = 0; i < 16; i++) {
    const idx = offset + (i << 2);
    W[i] = ((B[idx] << 24) | (B[idx + 1] << 16) | (B[idx + 2] << 8) | B[idx + 3]) >>> 0;
  }

  for (let j = 16; j < 68; j++) {
    const tmp = W[j - 16] ^ W[j - 9] ^ rotl(W[j - 3], 15);
    W[j] = (P1(tmp) ^ rotl(W[j - 13], 7) ^ W[j - 6]) >>> 0;
  }

  for (let j = 0; j < 64; j++) {
    W1[j] = (W[j] ^ W[j + 4]) >>> 0;
  }

  // 2. 压缩迭代
  let A = V[0], B_reg = V[1], C = V[2], D = V[3];
  let E = V[4], F = V[5], G = V[6], H = V[7];

  for (let j = 0; j < 64; j++) {
    const SS1 = rotl((rotl(A, 12) + E + (j < 16 ? rotl(0x79cc4519, j) : rotl(0x7a879d8a, j % 32))) >>> 0, 7);
    const SS2 = (SS1 ^ rotl(A, 12)) >>> 0;
    const TT1 = (FF(A, B_reg, C, j) + D + SS2 + W1[j]) >>> 0;
    const TT2 = (GG(E, F, G, j) + H + SS1 + W[j]) >>> 0;

    D = C;
    C = rotl(B_reg, 9);
    B_reg = A;
    A = TT1;
    H = G;
    G = rotl(F, 19);
    F = E;
    E = P0(TT2);
  }

  V[0] = (V[0] ^ A) >>> 0;
  V[1] = (V[1] ^ B_reg) >>> 0;
  V[2] = (V[2] ^ C) >>> 0;
  V[3] = (V[3] ^ D) >>> 0;
  V[4] = (V[4] ^ E) >>> 0;
  V[5] = (V[5] ^ F) >>> 0;
  V[6] = (V[6] ^ G) >>> 0;
  V[7] = (V[7] ^ H) >>> 0;
}

/**
 * 将输入转换为 Uint8Array
 * @param {Uint8Array | string} data
 * @returns {Uint8Array}
 */
export function toUint8Array(data) {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (typeof data === 'string') {
    return new TextEncoder().encode(data);
  }
  throw new TypeError('SM3 input must be Uint8Array or string');
}

/**
 * 流式 / 增量 SM3 状态对象
 */
export class SM3 {
  constructor() {
    this.V = new Uint32Array(IV);
    this.buffer = new Uint8Array(64);
    this.bufferLength = 0;
    this.totalLength = 0n; // 消息总长度（字节）
  }

  /**
   * 重置状态
   * @returns {SM3}
   */
  reset() {
    this.V.set(IV);
    this.bufferLength = 0;
    this.totalLength = 0n;
    return this;
  }

  /**
   * 写入数据
   * @param {Uint8Array | string} data
   * @returns {SM3}
   */
  update(data) {
    const bytes = toUint8Array(data);
    const len = bytes.length;
    if (len === 0) return this;

    this.totalLength += BigInt(len);

    let offset = 0;
    if (this.bufferLength > 0) {
      const needed = 64 - this.bufferLength;
      if (len >= needed) {
        this.buffer.set(bytes.subarray(0, needed), this.bufferLength);
        compress(this.V, this.buffer, 0);
        this.bufferLength = 0;
        offset = needed;
      } else {
        this.buffer.set(bytes, this.bufferLength);
        this.bufferLength += len;
        return this;
      }
    }

    while (offset + 64 <= len) {
      compress(this.V, bytes, offset);
      offset += 64;
    }

    if (offset < len) {
      const remaining = bytes.subarray(offset);
      this.buffer.set(remaining, 0);
      this.bufferLength = remaining.length;
    }

    return this;
  }

  /**
   * 完成杂凑计算并输出 32 字节摘要
   * @returns {Uint8Array} 32 字节摘要
   */
  digest() {
    // 拷贝当前状态，保证对象可复用
    const V = new Uint32Array(this.V);
    const buf = new Uint8Array(64);
    buf.set(this.buffer.subarray(0, this.bufferLength));

    // 填充 0x80
    buf[this.bufferLength] = 0x80;
    const padStart = this.bufferLength + 1;

    // 总位数 = totalLength * 8
    const bitLen = this.totalLength * 8n;

    if (padStart > 56) {
      // 当前分组放不下 64 位长度，填充 0 后压缩当前组，开启新组
      buf.fill(0, padStart);
      compress(V, buf, 0);
      buf.fill(0);
    } else {
      buf.fill(0, padStart, 56);
    }

    // 写入 64 位大端总位数
    const high = Number((bitLen >> 32n) & 0xffffffffn);
    const low = Number(bitLen & 0xffffffffn);
    buf[56] = (high >>> 24) & 0xff;
    buf[57] = (high >>> 16) & 0xff;
    buf[58] = (high >>> 8) & 0xff;
    buf[59] = high & 0xff;
    buf[60] = (low >>> 24) & 0xff;
    buf[61] = (low >>> 16) & 0xff;
    buf[62] = (low >>> 8) & 0xff;
    buf[63] = low & 0xff;

    compress(V, buf, 0);

    // 输出 32 字节
    const out = new Uint8Array(32);
    for (let i = 0; i < 8; i++) {
      const val = V[i];
      const idx = i << 2;
      out[idx] = (val >>> 24) & 0xff;
      out[idx + 1] = (val >>> 16) & 0xff;
      out[idx + 2] = (val >>> 8) & 0xff;
      out[idx + 3] = val & 0xff;
    }
    return out;
  }

  /**
   * 输出 64 字符十六进制大写/小写字符串
   * @returns {string}
   */
  digest_hex() {
    const bytes = this.digest();
    let hex = '';
    for (let i = 0; i < 32; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
  }
}

/**
 * 单次计算 SM3 杂凑值
 * @param {Uint8Array | string} data
 * @returns {Uint8Array} 32 字节 Uint8Array
 */
export function sm3(data) {
  return new SM3().update(data).digest();
}

/**
 * 单次计算 SM3 杂凑十六进制字符串 (小写 64 字符)
 * @param {Uint8Array | string} data
 * @returns {string}
 */
export function sm3_hex(data) {
  return new SM3().update(data).digest_hex();
}
