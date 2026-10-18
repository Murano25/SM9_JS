# SM9-JS

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Standards](https://img.shields.io/badge/standard-GB%2FT%2038635-red.svg)](http://openstd.samr.gov.cn/)
[![Zero-Dependency](https://img.shields.io/badge/dependencies-0-brightgreen.svg)]()
[![AI-Assisted](https://img.shields.io/badge/AI--Assisted-Pair%20Programming-blueviolet.svg)](https://github.com/)

[中文](./README_CN.md) | [English](./README.md)

纯 **JavaScript (ES2020 / 原生 `BigInt`)** 实现的国密 **SM9 标识密码算法 (Identity-based Cryptography)** 库。

严格遵循国家标准 **GB/T 38635-2020** 与密码行业标准 **GM/T 0044-2016**，涵盖数字签名、标识加解密、密钥封装机制（KEM）、R-ate 双线性对运算与 SM3 密码杂凑算法。

---

## ✨ 核心特性

- **零外部依赖 (0 Dependencies)**：无任何第三方 npm 依赖，开箱即用；
- **高性能**：深度基于 ES2020 原生 `BigInt` 与 `TypedArray`，采用 4-bit 窗口 wNAF 标量乘法、66 位 NAF Miller 循环稀疏乘法与双线性对预计算；
  - **R-ate 双线性配对**：Node.js V8 引擎实测单次计算仅 **~11 ms**；
  - **数字签名**：~18 ms / 验签预计算 ~15 ms；
  - **标识加解密**：加密 ~14 ms / 解密仅 **~6.9 ms**；
- **标准合规**：100% 通过 GB/T 38635.2 与 GM/T 0044 附录标准算例与测试向量（附录 A、B、C、D）；
- **跨运行时支持**：兼容 Node.js 20+、现代浏览器 (Chrome/Firefox/Safari/Edge)、Deno、Bun 及 Cloudflare Workers，内置 Web Crypto API 安全随机数源；
- **TypeScript 友好**：自带完整的 [`index.d.ts`](./index.d.ts) 类型声明文件。

---

## 📦 安装与导入

```bash
npm install sm9-js
```

### ESM 导入
```javascript
import sm9 from 'sm9-js';

// 或按需解构导入（同时支持 camelCase 与 snake_case 命名风格）
import {
  generateSignMasterKey,
  extractSignUserKey,
  sign,
  verify,
  generateEncryptMasterKey,
  extractEncryptUserKey,
  encrypt,
  decrypt,
  wrapKey,
  unwrapKey,
  pairing,
} from 'sm9-js';
```

---

## 🚀 快速上手

### 1. 数字签名与验证 (GB/T 38635.2 / GM/T 0044.2)

```javascript
import sm9 from 'sm9-js';

// 1. KGC 中心生成签名主密钥对
const masterKey = sm9.generateSignMasterKey();

// 2. 为用户 (Alice) 提取签名私钥
const aliceId = 'Alice@company.com';
const alicePrivKey = sm9.extractSignUserKey(masterKey.privateKey, aliceId);

// 3. 用户使用私钥对消息签名
const message = '支付指令：转账 1000 元至 0x1234...';
const signature = sm9.sign(masterKey.publicKey, alicePrivKey, message);

// 4. 任意接收方使用 KGC 主公钥与 Alice 身份标识验签
const isValid = sm9.verify(masterKey.publicKey, aliceId, message, signature);
console.log('验签结果:', isValid); // true
```

#### 验签预计算加速（高吞吐场景）
在批量验证同一主公钥下的签名时，可预先计算配对值 $g = e(P_1, P_{pub-s})$：
```javascript
const precomputedG = sm9.signPrecompute(masterKey.publicKey);

// 验签时直接传入预计算值，耗时由 22ms 骤降至 15ms
const isValid = sm9.verify(masterKey.publicKey, aliceId, message, signature, sm9.HID_SIGN, precomputedG);
```

---

### 2. 标识加密与解密 (GB/T 38635.2 / GM/T 0044.4)

发送方无需提前索取接收方的数字证书或公钥，直接使用其**邮箱、手机号或唯一身份标识**即可完成端到端加密：

```javascript
import sm9 from 'sm9-js';

// 1. KGC 中心生成加密主密钥对
const encMasterKey = sm9.generateEncryptMasterKey();

// 2. 接收方 (Bob) 向 KGC 申请其身份解密私钥
const bobId = 'Bob@financial-dept.cn';
const bobPrivKey = sm9.extractEncryptUserKey(encMasterKey.privateKey, bobId);

// 3. 发送方仅需知道 Bob 的身份标识即可加密明文
const plaintext = '核心绝密商业机密：2026战略规划';
const cipher = sm9.encrypt(encMasterKey.publicKey, bobId, plaintext);

// 4. Bob 使用其解密私钥解密
const decryptedBytes = sm9.decrypt(bobPrivKey, bobId, cipher);
const decryptedText = new TextDecoder().decode(decryptedBytes);
console.log('解密明文:', decryptedText); // '核心绝密商业机密：2026战略规划'
```

---

### 3. 密钥封装机制 (KEM - WrapKey / UnwrapKey, GB/T 38635.2 / GM/T 0044.4)

用于在身份两端协商固定长度的高强度对称会话密钥：

```javascript
import sm9 from 'sm9-js';

const encMasterKey = sm9.generateEncryptMasterKey();
const receiverId = 'IOT-Device-007';
const receiverKey = sm9.extractEncryptUserKey(encMasterKey.privateKey, receiverId);

// 发送端封装 32 字节对称密钥
const { key: sessionKey, c1 } = sm9.wrapKey(encMasterKey.publicKey, receiverId, 32);

// 接收端解封恢复对称密钥
const recoveredKey = sm9.unwrapKey(receiverKey, receiverId, c1, 32);
// sessionKey 与 recoveredKey 完全一致
```

---

### 4. 密文序列化与反序列化

密文包含三部分：$C_1$（椭圆曲线点，64 字节）、$C_3$（SM3 校验码，32 字节）、$C_2$（对称密文流）。库内置了标准字节流编解码支持：

```javascript
// 编码为 Uint8Array 二进制密文字节流 (64 + 32 + len(M) 字节)
const encodedBytes = sm9.encodeCipher(cipher);

// 解码恢复为密文对象
const decodedCipher = sm9.decodeCipher(encodedBytes);

// decrypt 亦可直接传入 Uint8Array 密文字节流
const plaintextBytes = sm9.decrypt(bobPrivKey, bobId, encodedBytes);
```

---

## ⚡ 性能基准测试

测试环境：Intel Core i7 / Linux x86_64, Node.js v20 (V8 引擎), 纯 JS 运算 (无 C++ 插件)：

```bash
npm run benchmark
```

| 密码原语 / 协议操作 | 单次耗时 (ms/op) | 吞吐量 (ops/sec) | 说明 |
| :--- | :--- | :--- | :--- |
| **R-ate 双线性对配对 $e(P_1, P_2)$** | **11.09 ms** | **90.2 ops/s** | 66-bit NAF 稀疏配对与 BN 最终幂 |
| **用户签名私钥提取 ($d_A$)** | **1.25 ms** | **802.7 ops/s** | $G_1$ 标量乘与扩展欧几里得求逆 |
| **用户解密私钥提取 ($de_B$)** | **3.50 ms** | **285.6 ops/s** | $G_2$ 标量乘与扩展欧几里得求逆 |
| **数字签名 (`sign`)** | **18.95 ms** | **52.8 ops/s** | 含 $g^r \in G_T$ 幂运算与点乘 |
| **签名验证 (`verify` 完整配对)** | **22.21 ms** | **45.0 ops/s** | 含 2 次双线性配对 |
| **签名验证 (`verify` 带预计算)** | **15.53 ms** | **64.4 ops/s** | 预计算基点配对加速 |
| **密钥封装 (`wrapKey` - KEM)** | **6.75 ms** | **148.1 ops/s** | 标量乘与 $g^r$ 幂运算 + KDF |
| **密钥解封 (`unwrapKey` - KEM)** | **6.82 ms** | **146.6 ops/s** | 单次配对与 KDF |
| **标识加密 (`encrypt`)** | **14.10 ms** | **70.9 ops/s** | 密钥封装 + 流密码加密 + MAC 认证 |
| **标识解密 (`decrypt`)** | **6.95 ms** | **143.9 ops/s** | 密钥解封 + 流密码解密 + MAC 校验 |
| **SM3 密码杂凑 (1 KB)** | **0.01 ms** | **143,828 ops/s** | TypedArray 内存直接处理 |
| **KDF 密钥派生 (1KB $\to$ 256B)** | **0.06 ms** | **17,450 ops/s** | 标准计数器迭代 |

---

## 🧪 单元测试

运行项目全套 75 项单元测试（覆盖群运算、双线性配对、哈希、KDF、全标准向量与防篡改）：

```bash
npm test
```

```
ℹ tests 75
ℹ suites 14
ℹ pass 75
ℹ fail 0
ℹ duration_ms ~440ms
```

---

## 📜 遵循规范

- **GB/T 38635.1-2020**：《信息安全技术 SM9标识密码算法 第1部分：总则》
- **GB/T 38635.2-2020**：《信息安全技术 SM9标识密码算法 第2部分：算法》（涵盖数字签名算法、密钥交换协议、密钥封装机制与公钥加密算法）
- **GB/T 32905-2016**：《信息安全技术 SM3密码杂凑算法》
- **GM/T 0044-2016**：《SM9标识密码算法》（包含第1部分：总则、第2部分：数字签名算法、第3部分：密钥交换协议、第4部分：密钥封装机制和公钥加密算法、第5部分：参数定义）

---

## 🤖 AI 辅助开发与透明度声明 (AI Disclosure)

本项目由人类开发者全程把控设计、数学推导与架构规划，并与先进 AI 编码助手协同生成。

为确保密码学实现的准确性与可靠性，代码通过了严格且完备的工程化测试矩阵：
- **标准测试向量对齐**：完整实现并覆盖国密标准 **GB/T 38635 / GM/T 0044** 附录中的全部标准测试向量（包括签名、验签、密钥封装与标识加解密）；
- **全生命周期闭环测试**：包含有限域自同构、双线性与非退化性质验证、防篡改异常阻断测试以及大吞吐量加解密端到端闭环。

### ⚠️ 安全声明与免责提示 (Security Disclaimer)
1. **商业级生产建议**：尽管本库算法实现已在数学逻辑和标准算例层面对齐国家密码管理局规范，但在部署到对安全要求极为苛刻的生产系统前，仍建议由独立密码安全评估机构开展第三方代码审计；
2. **侧信道防护 (Side-Channel Attacks)**：纯 JavaScript 在现代 JIT 引擎（如 V8）中由于内部优化、垃圾回收及大整数位运算机制，难以对时间攻击（Timing Attacks）等物理侧信道做出绝对的常数时间（Constant-time）执行保障。在对物理侧信道高度敏感的客户端硬件场景中，建议结合特定硬件保护环境评估使用。

---

## 📄 开源许可证

本项目采用 [Apache-2.0](LICENSE) 许可证开源。
