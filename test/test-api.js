/**
 * 单元测试: utils/api.js 智能鉴权缓存逻辑
 *
 * 覆盖场景:
 *   1. X-API-Key 成功 → 缓存
 *   2. 缓存优先 (不重复尝试)
 *   3. 缓存失败 → 自动回退到下一种
 *   4. Bearer 成功 → 缓存
 *   5. Query 成功 → 缓存
 *   6. 全部失败 → 抛出错误
 *   7. 非鉴权错误(404) → 不触发回退
 *   8. testConnection 找到的鉴权方式被 request 复用
 *
 * 运行: node test/test-api.js
 */

'use strict';

// ============= 断言库（不依赖外部） =============
let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log('  \x1b[32m✓\x1b[0m ' + msg);
  } else {
    failed++;
    failures.push(msg);
    console.log('  \x1b[31m✗\x1b[0m ' + msg);
  }
}
function assertEq(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  assert(a === e, msg + ' (期望 ' + e + ', 实际 ' + a + ')');
}
function section(name) {
  console.log('\n\x1b[1m\x1b[36m▶ ' + name + '\x1b[0m');
}

// ============= 模拟 wx 全局对象 =============

function makeMockWx(requestHandler) {
  const calls = [];
  return {
    calls,
    request: function(opts) {
      calls.push({
        url: opts.url,
        method: opts.method,
        header: opts.header,
        data: opts.data
      });
      const result = requestHandler(opts);
      // 异步模拟
      if (result.success) {
        setTimeout(() => opts.success(result.success), 0);
      } else {
        setTimeout(() => opts.fail(result.fail), 0);
      }
    },
    getStorageSync: function(key) {
      if (key === 'API_KEY_OVERRIDE') return undefined;  // 测试中不模拟覆盖
      return '';
    },
    setStorageSync: function() {},
    removeStorageSync: function() {},
    showToast: function() {}  // 不弹 toast
  };
}

// 设置 wx 全局（必须在 require api.js 之前）
function setupGlobalWx(handler) {
  global.wx = makeMockWx(handler);
}

// 卸载 api.js 模块缓存
function reloadApi() {
  delete require.cache[require.resolve('../utils/api.js')];
  return require('../utils/api.js');
}

// 等待异步操作完成
function nextTick() {
  return new Promise((r) => setTimeout(r, 10));
}

// ============= 测试用例 =============

async function runTests() {
  // 关闭 DEBUG 日志（让测试输出干净）
  const savedConsole = console.log;
  // 不屏蔽 console.log，因为我们用 console.log 输出测试进度

  // ---------------------------------------
  section('场景 1: X-API-Key 成功 → 缓存');
  // ---------------------------------------
  setupGlobalWx(() => ({
    success: { statusCode: 200, header: {}, data: { code: 0, data: { items: [], pagination: {} } } }
  }));
  let api = reloadApi();
  await api.request({ url: '/bids', method: 'GET' });
  await nextTick();
  // 第一次请求应该用 X-API-Key
  assertEq(global.wx.calls[0].header['X-API-Key'], 'test_key_12345', '首次请求使用 X-API-Key header');
  assertEq(global.wx.calls[0].header['Authorization'], undefined, '首次请求不带 Authorization header');
  assertEq(global.wx.calls[0].url.indexOf('api_key=') === -1, true, '首次请求 URL 不含 api_key');

  // ---------------------------------------
  section('场景 2: 缓存优先 (不重复尝试)');
  // ---------------------------------------
  setupGlobalWx(() => ({
    success: { statusCode: 200, header: {}, data: { code: 0, data: { items: [] } } }
  }));
  api = reloadApi();
  // 模拟缓存已存在: 第一次请求让 _workingAuthMethod 变成 'X-API-Key'
  await api.request({ url: '/bids', method: 'GET' });
  await nextTick();
  const callsAfterFirst = global.wx.calls.length;
  // 第二次请求: 应该只用 X-API-Key (不再试 bearer/query)
  await api.request({ url: '/bids', method: 'GET' });
  await nextTick();
  assertEq(global.wx.calls.length - callsAfterFirst, 1, '缓存后第 2 次请求只发 1 次 (不重复尝试)');
  assertEq(global.wx.calls[callsAfterFirst].header['X-API-Key'] !== undefined, true, '缓存后仍用 X-API-Key');

  // ---------------------------------------
  section('场景 3: X-API-Key 401 → 回退到 Bearer');
  // ---------------------------------------
  setupGlobalWx((opts) => {
    // X-API-Key header 存在 → 401
    if (opts.header['X-API-Key'] !== undefined) {
      return { success: { statusCode: 401, header: {}, data: { code: 401, message: 'invalid key' } } };
    }
    // Authorization header 存在 → 200
    if (opts.header['Authorization'] !== undefined) {
      return { success: { statusCode: 200, header: {}, data: { code: 0, data: { ok: true } } } };
    }
    return { fail: { errMsg: 'no auth' } };
  });
  api = reloadApi();
  const r = await api.request({ url: '/bids', method: 'GET' });
  await nextTick();
  assertEq(r.ok, true, 'X-API-Key 失败时回退到 Bearer 并成功');
  assertEq(global.wx.calls.length, 2, '共发 2 次请求 (X-API-Key 失败 + Bearer 成功)');
  assertEq(global.wx.calls[0].header['X-API-Key'] !== undefined, true, '第 1 次用 X-API-Key');
  assertEq(global.wx.calls[1].header['Authorization'] !== undefined, true, '第 2 次用 Authorization');

  // ---------------------------------------
  section('场景 4: 缓存后,缓存方式 401 → 自动重新发现');
  // ---------------------------------------
  setupGlobalWx((opts) => {
    // 模拟后端改了鉴权方式: X-API-Key 突然失败, Bearer 成功
    if (opts.header['X-API-Key'] !== undefined) {
      return { success: { statusCode: 401, header: {}, data: { code: 401 } } };
    }
    if (opts.header['Authorization'] !== undefined) {
      return { success: { statusCode: 200, header: {}, data: { code: 0, data: { ok: true } } } };
    }
    return { fail: { errMsg: 'no auth' } };
  });
  api = reloadApi();
  // 强制让缓存设为 'X-API-Key'
  // 通过第一次请求, 模拟缓存被设
  // (因为 _workingAuthMethod 是模块内部变量, 没法直接 set)
  // 这里用 tryAuthRequest 的副作用: 第一次请求 401, 第二次请求 200
  // 验证第二次请求时缓存被更新为 bearer
  await api.request({ url: '/bids', method: 'GET' });
  await nextTick();
  // 再发一次请求: 这次应该直接用 Bearer (不再试 X-API-Key)
  const callsBefore = global.wx.calls.length;
  await api.request({ url: '/bids', method: 'GET' });
  await nextTick();
  const newCalls = global.wx.calls.length - callsBefore;
  assertEq(newCalls, 1, '缓存更新后, 第 2 次请求只发 1 次 (用新缓存 Bearer)');
  assertEq(global.wx.calls[callsBefore].header['Authorization'] !== undefined, true, '新缓存是 Authorization Bearer');

  // ---------------------------------------
  section('场景 5: X-API-Key + Bearer 都失败 → 回退到 ?api_key=');
  // ---------------------------------------
  setupGlobalWx((opts) => {
    if (opts.header['X-API-Key'] !== undefined) {
      return { success: { statusCode: 401, header: {}, data: { code: 401 } } };
    }
    if (opts.header['Authorization'] !== undefined) {
      return { success: { statusCode: 403, header: {}, data: { code: 403 } } };
    }
    // query 参数方式
    if (opts.url.indexOf('api_key=') !== -1) {
      return { success: { statusCode: 200, header: {}, data: { code: 0, data: { ok: 'query' } } } };
    }
    return { fail: { errMsg: 'no auth' } };
  });
  api = reloadApi();
  const r5 = await api.request({ url: '/bids', method: 'GET' });
  await nextTick();
  assertEq(r5.ok, 'query', 'X-API-Key + Bearer 都失败时回退到 ?api_key= 并成功');
  assertEq(global.wx.calls.length, 3, '共发 3 次请求');
  assertEq(global.wx.calls[2].url.indexOf('api_key=') !== -1, true, '第 3 次用 query 参数');

  // ---------------------------------------
  section('场景 6: 全部 3 种方式失败 → 抛出"所有鉴权方式都失败"');
  // ---------------------------------------
  setupGlobalWx((opts) => {
    // 所有方式都返回 401
    return { success: { statusCode: 401, header: {}, data: { code: 401, message: 'invalid' } } };
  });
  api = reloadApi();
  let threw = false;
  let errMsg = '';
  try {
    await api.request({ url: '/bids', method: 'GET' });
  } catch (e) {
    threw = true;
    errMsg = e.message;
  }
  await nextTick();
  assert(threw, '全部失败时抛出错误');
  assertEq(errMsg, '所有鉴权方式都失败', '错误消息正确');
  assertEq(global.wx.calls.length, 3, '共尝试 3 种方式后放弃');

  // ---------------------------------------
  section('场景 7: 非鉴权错误 (404) 不触发回退');
  // ---------------------------------------
  setupGlobalWx(() => ({
    success: { statusCode: 404, header: {}, data: { code: 404, message: 'Not Found' } }
  }));
  api = reloadApi();
  threw = false;
  try {
    await api.request({ url: '/bids', method: 'GET' });
  } catch (e) {
    threw = true;
    errMsg = e.message;
  }
  await nextTick();
  assert(threw, '404 错误抛出');
  assertEq(global.wx.calls.length, 1, '非鉴权错误不发额外请求 (不触发回退)');

  // ---------------------------------------
  section('场景 8: testConnection 找到方式 → request() 复用');
  // ---------------------------------------
  setupGlobalWx((opts) => {
    // 模拟后端只支持 ?api_key=
    if (opts.url.indexOf('api_key=') !== -1) {
      return { success: { statusCode: 200, header: {}, data: { code: 0, data: { filters: [] } } } };
    }
    return { success: { statusCode: 401, header: {}, data: { code: 401 } } };
  });
  api = reloadApi();
  // 1. 调 testConnection 找能用的方式
  const tResult = await api.testConnection();
  await nextTick();
  assertEq(tResult.success, true, 'testConnection 找到能用的方式');
  assertEq(tResult.method, 'query', '找到的方式是 query');
  // 2. 再调 request, 应该直接用 query
  const callsAfterTest = global.wx.calls.length;
  await api.request({ url: '/bids', method: 'GET' });
  await nextTick();
  const newRequestCalls = global.wx.calls.length - callsAfterTest;
  assertEq(newRequestCalls, 1, 'request() 直接用缓存的 query 方式 (1 次请求)');
  assertEq(global.wx.calls[callsAfterTest].url.indexOf('api_key=') !== -1, true, 'request() URL 含 api_key=');

  // ---------------------------------------
  section('场景 9: getConfig() 优先级 (Storage > config.js)');
  // ---------------------------------------
  // 重置 wx 让 getStorageSync 返回覆盖值
  global.wx.getStorageSync = function(key) {
    if (key === 'API_KEY_OVERRIDE') return 'override_key_99999';
    return '';
  };
  api = reloadApi();
  // 调用 getConfig 间接通过 testConnection
  setupGlobalWx((opts) => {
    if (opts.header['X-API-Key'] === 'override_key_99999') {
      return { success: { statusCode: 200, header: {}, data: { code: 0, data: { ok: true } } } };
    }
    return { success: { statusCode: 401, header: {}, data: { code: 401 } } };
  });
  const t9 = await api.testConnection();
  await nextTick();
  assertEq(t9.success, true, 'Storage 覆盖的 Key 生效');
  assertEq(t9.keySource, 'storage', 'key 来源标记为 storage');

  // ---------------------------------------
  // 输出汇总
  // ---------------------------------------
  console.log('\n' + '='.repeat(50));
  if (failed === 0) {
    console.log('\x1b[32m✓ 全部 ' + passed + ' 个测试通过\x1b[0m');
  } else {
    console.log('\x1b[31m✗ ' + failed + ' 个测试失败 / 共 ' + (passed + failed) + '\x1b[0m');
    failures.forEach((m, i) => console.log('  ' + (i + 1) + '. ' + m));
  }
  console.log('='.repeat(50));

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error('测试运行异常:', e);
  process.exit(1);
});
