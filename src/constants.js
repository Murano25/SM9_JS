/**
 * SM9 标准曲线与数论常量 (GB/T 38635 / GM/T 0044)
 * 采用原生 BigInt (ES2020) 表示 256 位大整数
 */

// 1. 基域特征数 p (256-bit 素数)
// p = 36*t^4 + 36*t^3 + 24*t^2 + 6*t + 1
export const SM9_P = 0xb640000002a3a6f1d603ab4ff58ec74521f2934b1a7aeedbe56f9b27e351457dn;

// 2. 椭圆曲线群阶 n (256-bit 素数)
// n = 36*t^4 + 36*t^3 + 18*t^2 + 6*t + 1
export const SM9_N = 0xb640000002a3a6f1d603ab4ff58ec74449f2934b18ea8beee56ee19cd69ecf25n;

// 3. BN 曲线参数 t (64-bit 正整数)
export const SM9_T = 0x600000000058f98an;

// 4. 曲线方程系数 b: y^2 = x^3 + 5 (mod p)
export const SM9_B = 5n;

// 5. 循环控制参数 6t + 2 (十六进制: 0x2400000000215D93E)
export const SM9_6T_PLUS_2 = 6n * SM9_T + 2n;

// 6. G1 基点 P1 (定义在 Fp 上的仿射坐标 (x, y))
export const SM9_P1 = {
  x: 0x93de051d62bf718ff5ed0704487d01d6e1e4086909dc3280e8c4e4817c66ddddn,
  y: 0x21fe8dda4f21e607631065125c395bbc1c1c00cbfa6024350c464cd70a3ea616n,
};

// 7. G2 基点 P2 (定义在 Fp2 上的仿射坐标 (x, y))
// 每个坐标为二元组 [c0, c1]，表示 c0 + c1 * u，其中 u^2 = -2
// 扭曲曲线方程为: y^2 = x^3 + 5u
export const SM9_P2 = {
  x: [
    0x3722755292130b08d2aab97fd34ec120ee265948d19c17abf9b7213baf82d65bn,
    0x85aef3d078640c98597b6027b441a01ff1dd2c190f5e93c454806c11d8806141n,
  ],
  y: [
    0xa7cf28d519be3da65f3170153d278ff247efba98a71a08116215bba5c999a7c7n,
    0x17509b092e845c1266ba0d262cbee6ed0736a96fa347c8bd856dc76b84ebeb96n,
  ],
};

// 8. 算法识别标识符 (hid: Hash Identifier)
export const HID_SIGN = 0x01;         // 签名与验签算法标识
export const HID_KEY_EXCHANGE = 0x02; // 密钥交换协议标识
export const HID_ENCRYPT = 0x03;      // 标识加解密算法标识
