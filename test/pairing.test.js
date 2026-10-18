import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SM9_P, SM9_N, SM9_T, SM9_P1, SM9_P2
} from '../src/constants.js';
import {
  fp12_eq, fp12_one, fp12_sqr, fp12_pow, fp12_is_one
} from '../src/fp12.js';
import { g1_mul, g1_to_affine, g1_zero } from '../src/g1.js';
import { g2_mul, g2_to_affine, g2_zero } from '../src/g2.js';
import { pairing } from '../src/pairing.js';

describe('SM9 R-ate Bilinear Pairing (GB/T 38635 / GM/T 0044)', () => {
  // 标准算例 A2: pk * P2 与 P1 对运算测试向量
  const expected1 = [
    // z (c0): y (c00), x (c01)
    [
      [0xaab9f06a4eeba4323a7833db202e4e35639d93fa3305af73f0f071d7d284fcfbn, 0x84b87422330d7936eaba1109fa5a7a7181ee16f2438b0aeb2f38fd5f7554e57an],
      [0x4c744e69c4a2e1c8ed72f796d151a17ce2325b943260fc460b9f73cb57c9014bn, 0xb3129a75d31d17194675a1bc56947920898fbf390a5bf5d931ce6cbb3340f66dn]
    ],
    // y (c1): y (c10), x (c11)
    [
      [0x93634f44fa13af76169f3cc8fbea880adaff8475d5fd28a75deb83c44362b439n, 0x1604a3fcfa9783e667ce9fcb1062c2a5c6685c316dda62de0548baa6ba30038bn],
      [0x5a1ae172102efd95df7338dbc577c66d8d6c15e0a0158c7507228efb078f42a6n, 0x67e0e0c2eed7a6993dce28fe9aa2ef56834307860839677f96685f2b44d0911fn]
    ],
    // x (c2): y (c20), x (c21)
    [
      [0xa01f2c8bee81769609462c69c96aa923fd863e209d3ce26dd889b55e2e3873dbn, 0x38bffe40a22d529a0c66124b2c308dac9229912656f62b4facfced408e02380fn],
      [0x28b3404a61908f5d6198815c99af1990c8af38655930058c28c21bb539ce0000n, 0x4e378fb5561cd0668f906b731ac58fee25738edf09cadc7a29c0abc0177aea6dn]
    ]
  ];

  it('GM/T 0044 标准算例 A2: e(P1, [pk]P2) == expected1', () => {
    const pk = 0x0130E78459D78545CB54C587E02CF480CE0B66340F319F348A1D5B1F2DC5F4n;
    const g2 = g2_to_affine(g2_mul(pk, SM9_P2));
    const ret = pairing(SM9_P1, g2);

    assert.ok(fp12_eq(ret, expected1));
  });

  // 标准算例 B2: e(rA, deB) == expected_b2
  const expected_b2 = [
    [
      [0x6BA584CE742A2A3AB41C15D3EF94EDEB8EF74A2BDCDAAECC09ABA567981F6437n, 0x9B1CA08F64712E33AEDA3F44BD6CB633E0F722211E344D73EC9BBEBC92142765n],
      [0x861CCD9978617267CE4AD9789F77739E62F2E57B48C2FF26D2E90A79A1D86B93n, 0x8C8E9D8D905780D50E779067F2C4B1C8F83A8B59D735BB52AF35F56730BDE5ACn]
    ],
    [
      [0x0F63A071A6D62EA45B59A1942DFF5335D1A232C9C5664FAD5D6AF54C11418B0Dn, 0x73F21693C66FC23724DB26380C526223C705DAF6BA18B763A68623C86A632B05n],
      [0x647BA154C3E8E185DFC33657C1F128D480F3F7E3F16801208029E19434C733BBn, 0x4FEC93472DA33A4DB6599095C0CF895E3A7B993EE5E4EBE3B9AB7D7D5FF2A3D1n]
    ],
    [
      [0x3497477913AB89F5E2960F382B1B5C8EE09DE0FA498BA95C4409D630D343DA40n, 0xA1ABFCD30C57DB0F1A838E3A8F2BF823479C978BD137230506EA6249C891049En],
      [0x5E27C19FC02ED9AE37F5BB7BE9C03C2B87DE027539CCF03E6B7D36DE4AB45CD1n, 0x28542FB6954C84BE6A5F2988A31CB6817BA0781966FA83D9673A9577D3C0C134n]
    ]
  ];

  it('GM/T 0044 标准算例 B2: e(rA, deB) == expected_b2', () => {
    const deB = {
      x: [
        0x01092FF4DE89362670C21711B6DBE52DCD5F8E40C6654B3DECE573C2AB3D29B2n,
        0x74CCC3AC9C383C60AF083972B96D05C75F12C8907D128A17ADAFBAB8C5A4ACF7n,
      ],
      y: [
        0x8CFC48FB4FF37F1E27727464F3C34E2153861AD08E972D1625FC1A7BD18D5539n,
        0x44B0294AA04290E1524FF3E3DA8CFD432BB64DE3A8040B5B88D1B5FC86A4EBC1n,
      ],
    };

    const rA = {
      x: 0x7CBA5B19069EE66AA79D490413D11846B9BA76DD22567F809CF23B6D964BB265n,
      y: 0xA9760C99CB6F706343FED05637085864958D6C90902ABA7D405FBEDF7B781599n,
    };

    const ret = pairing(rA, deB);
    assert.ok(fp12_eq(ret, expected_b2));
  });

  it('双线性性质 1: e([2]P1, P2) == e(P1, P2)^2', () => {
    const g = pairing(SM9_P1, SM9_P2);
    const g_sqr = fp12_sqr(g);

    const two_P1 = g1_to_affine(g1_mul(2n, SM9_P1));
    const ret = pairing(two_P1, SM9_P2);

    assert.ok(fp12_eq(ret, g_sqr));
  });

  it('双线性性质 2: e(P1, [2]P2) == e(P1, P2)^2', () => {
    const g = pairing(SM9_P1, SM9_P2);
    const g_sqr = fp12_sqr(g);

    const two_P2 = g2_to_affine(g2_mul(2n, SM9_P2));
    const ret = pairing(SM9_P1, two_P2);

    assert.ok(fp12_eq(ret, g_sqr));
  });

  it('双线性性质 3: e([3]P1, [5]P2) == e(P1, P2)^15', () => {
    const g = pairing(SM9_P1, SM9_P2);
    const g_15 = fp12_pow(g, 15n);

    const three_P1 = g1_to_affine(g1_mul(3n, SM9_P1));
    const five_P2 = g2_to_affine(g2_mul(5n, SM9_P2));
    const ret = pairing(three_P1, five_P2);

    assert.ok(fp12_eq(ret, g_15));
  });

  it('非退化性与阶校验: e(P1, P2) != 1 且 e(P1, P2)^n == 1', () => {
    const g = pairing(SM9_P1, SM9_P2);
    assert.ok(!fp12_is_one(g));

    const g_n = fp12_pow(g, SM9_N);
    assert.ok(fp12_is_one(g_n));
  });

  it('无穷远点输入测试: e(O, P2) == 1 且 e(P1, O) == 1', () => {
    const O1 = g1_zero();
    const O2 = g2_zero();

    assert.ok(fp12_is_one(pairing(O1, SM9_P2)));
    assert.ok(fp12_is_one(pairing(SM9_P1, O2)));
    assert.ok(fp12_is_one(pairing(O1, O2)));
  });

  it('支持直接传入 Jacobian 坐标点', () => {
    // 传入未归一化的 Jacobian 坐标
    const P1_jac = g1_mul(3n, SM9_P1); // { X, Y, Z }
    const P2_jac = g2_mul(2n, SM9_P2); // { X, Y, Z }

    const ret = pairing(P1_jac, P2_jac);
    const expected = fp12_pow(pairing(SM9_P1, SM9_P2), 6n);

    assert.ok(fp12_eq(ret, expected));
  });
});
