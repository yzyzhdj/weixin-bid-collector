/**
 * 标讯 API 客户端 (utils/api.js)
 *
 * 对接：标讯对外 API v1
 *   Base URL: https://biaoxun.pandaorder.cn/api/v1
 *   鉴权：X-API-Key (推荐) / Authorization: Bearer / ?api_key=
 *   限流：默认 1000 次/小时，响应头 X-RateLimit-Limit / X-RateLimit-Remaining
 *
 * 功能：
 *   - 自动加 X-API-Key 请求头
 *   - 自动处理 401/403/404/429 等错误码
 *   - 自动将响应字段从 snake_case (后端) 转为 camelCase (前端)
 *   - 暴露响应头中的限流配额信息
 *   - 提供常量枚举（12 个业务小类 / 4 个采购分类 / 4 个采购人类型等）
 *   - 提供便捷查询函数（按省份/类型/搜索）
 */

// ============= 业务枚举常量 =============

/** 业务阶段 bid_phase（一级分类，2 个值）*/
const BID_PHASES = ['招标', '中标'];

/** 业务小类 bid_type（二级分类，12 个标准值）*/
const BID_TYPES = [
  '招标预告',    // 招标阶段 - 项目预告
  '招标公告',    // 招标阶段 - 正式招标
  '意见征集',    // 招标阶段 - 资格预审
  '重新招标',    // 招标阶段 - 流标后重新招标
  '信息变更',    // 招标阶段 - 内容变更/延期
  '答疑公告',    // 招标阶段 - 答疑/澄清
  '中标通知',    // 中标阶段 - 正式中标通知
  '开标公示',    // 中标阶段 - 开标记录公示
  '候选人公示',  // 中标阶段 - 中标候选人
  '合同公告',    // 中标阶段 - 合同签订/备案
  '废标公告',    // 中标阶段 - 废标/流标
  '其他公告'     // 中标阶段 - 成交/兜底
];

/** 采购分类 category（4 个值）*/
const CATEGORIES = ['工程类', '服务类', '货物类', '其他'];

/** 公告性质 notice_nature（4 个值）*/
const NOTICE_NATURES = ['正常公告', '变更公告', '澄清公告', '更正公告'];

/** 采购人类型 buyer_type（4 个值）*/
const BUYER_TYPES = ['政府机关', '事业单位', '国有企业', '其他'];

/** list_type 列表类型 */
const LIST_TYPES = {
  BIDS: 'bids',     // 最新招标（排除中标）
  WINS: 'wins'      // 最新中标（仅成交公示）
};

/** 排序字段 sort_by */
const SORT_FIELDS = ['id', 'publish_date', 'created_at'];

/** 排序方向 sort_order */
const SORT_ORDERS = ['asc', 'desc'];

/** 错误码 */
const ERROR_CODES = {
  SUCCESS: 0,        // 成功
  GENERAL: 1,        // 通用业务错误
  BAD_REQUEST: 400,  // 参数缺失/非法
  UNAUTHORIZED: 401, // 鉴权失败
  FORBIDDEN: 403,    // 无权访问（Key 过期）
  NOT_FOUND: 404,    // 资源不存在
  RATE_LIMIT: 429    // 限流
};

// ============= 调试开关 =============
// 设为 true 后，所有请求会打印 URL、Key、状态码到控制台
const DEBUG = true;

// ============= 配置读取 =============

/**
 * 统一读取 API 配置
 * 优先级: 本地 Storage 覆盖 > config.js
 * @returns {{API_BASE_URL: string, API_KEY: string, source: 'storage'|'config'|'empty'}}
 */
function getConfig() {
  const baseConfig = require('./config.js');
  let API_KEY = baseConfig.API_KEY;
  let API_BASE_URL = baseConfig.API_BASE_URL;
  let source = 'config';

  // 尝试读取本地 Storage 覆盖（用于"修改 Key"功能）
  try {
    const overrideKey = wx.getStorageSync('API_KEY_OVERRIDE');
    if (overrideKey && typeof overrideKey === 'string' && overrideKey.length > 0) {
      API_KEY = overrideKey;
      source = 'storage';
    }
  } catch (e) {
    // Storage 不可用时静默忽略
  }

  if (!API_KEY) {
    source = 'empty';
    if (DEBUG) console.warn('[API] ⚠️ API_KEY 为空，请检查 config.js 或在调试面板设置');
  }

  return { API_BASE_URL, API_KEY, source };
}

// ============= 内部工具 =============

/**
 * 校验白名单枚举值
 * @param {string} value - 待校验值
 * @param {string[]} allowed - 允许的值列表
 * @param {string} name - 字段名（用于错误提示）
 * @returns {string|null} 错误信息；null = 通过
 */
function validateEnum(value, allowed, name) {
  if (value === undefined || value === null || value === '') return null;
  if (allowed.indexOf(value) === -1) {
    return `${name} 非法值 "${value}"，允许：${allowed.join(' / ')}`;
  }
  return null;
}

/**
 * 校验并清理分页参数
 * @param {object} params
 * @returns {object} {ok, error, data}
 */
function validatePagination(params) {
  const out = Object.assign({}, params);
  // page
  if (out.page !== undefined) {
    const p = parseInt(out.page, 10);
    if (isNaN(p) || p < 1) {
      return { ok: false, error: 'page 必须 >= 1' };
    }
    out.page = p;
  } else {
    out.page = 1;
  }
  // page_size
  if (out.page_size !== undefined) {
    const ps = parseInt(out.page_size, 10);
    if (isNaN(ps) || ps < 1 || ps > 100) {
      return { ok: false, error: 'page_size 必须在 1-100 之间' };
    }
    out.page_size = ps;
  } else {
    out.page_size = 20;
  }
  return { ok: true, data: out };
}

/**
 * 校验并清理排序参数
 */
function validateSort(params) {
  const out = Object.assign({}, params);
  if (out.sort_by !== undefined) {
    const err = validateEnum(out.sort_by, SORT_FIELDS, 'sort_by');
    if (err) return { ok: false, error: err };
  } else {
    out.sort_by = 'publish_date';
  }
  if (out.sort_order !== undefined) {
    const err = validateEnum(out.sort_order, SORT_ORDERS, 'sort_order');
    if (err) return { ok: false, error: err };
  } else {
    out.sort_order = 'desc';
  }
  return { ok: true, data: out };
}

/**
 * 校验所有白名单枚举字段
 */
function validateEnums(params) {
  const checks = [
    [params.bid_phase, BID_PHASES, 'bid_phase'],
    [params.bid_type, BID_TYPES, 'bid_type'],
    [params.notice_nature, NOTICE_NATURES, 'notice_nature'],
    [params.category, CATEGORIES, 'category'],
    [params.buyer_type, BUYER_TYPES, 'buyer_type']
  ];
  for (const [value, allowed, name] of checks) {
    const err = validateEnum(value, allowed, name);
    if (err) return { ok: false, error: err };
  }
  // list_type
  if (params.list_type !== undefined && params.list_type !== '') {
    const allowed = Object.values(LIST_TYPES);
    const err = validateEnum(params.list_type, allowed, 'list_type');
    if (err) return { ok: false, error: err };
  }
  return { ok: true };
}

/**
 * 将对象的所有 snake_case 键转为 camelCase
 * 仅处理一层 + 数组中的对象
 * @param {any} obj
 * @returns {any}
 */
function snakeToCamel(obj) {
  if (Array.isArray(obj)) {
    return obj.map(snakeToCamel);
  }
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    const out = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        out[camelKey] = snakeToCamel(obj[key]);
      }
    }
    return out;
  }
  return obj;
}

// ============= 核心请求 =============

let _lastRateInfo = { limit: null, remaining: null, reset: null };

/**
 * 统一请求方法
 * @param {object} options
 * @param {string} options.url - 不含 base 的相对路径（如 '/bids'）
 * @param {string} [options.method='GET']
 * @param {object} [options.data]
 * @param {object} [options.header] - 自定义头
 * @param {boolean} [options.silent=false] - true 则不弹错误 Toast
 * @param {boolean} [options.skipCamel=false] - true 则不转 camelCase
 * @returns {Promise<object>} 后端 data 字段
 */
function request(options) {
  const { API_BASE_URL, API_KEY, source } = getConfig();
  return new Promise((resolve, reject) => {
    const header = Object.assign(
      {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      },
      options.header || {}
    );

    if (DEBUG) {
      console.log('[API] ' + options.method + ' ' + API_BASE_URL + options.url);
      console.log('[API] X-API-Key: ' + (API_KEY ? API_KEY.slice(0, 12) + '...' + API_KEY.slice(-4) : '(空)') + ' (来源: ' + source + ')');
    }

    wx.request({
      url: API_BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      timeout: options.timeout || 30000,
      header,
      success: (res) => {
        if (DEBUG) {
          console.log('[API] ← ' + res.statusCode + ' (' + (res.data ? JSON.stringify(res.data).length : 0) + ' bytes)');
        }
        // 记录限流信息
        if (res.header) {
          _lastRateInfo.limit = res.header['X-RateLimit-Limit'] || null;
          _lastRateInfo.remaining = res.header['X-RateLimit-Remaining'] || null;
          _lastRateInfo.reset = res.header['X-RateLimit-Reset'] || null;
        }

        const body = res.data || {};
        if (res.statusCode === 200 && body.code === 0) {
          const data = options.skipCamel ? body.data : snakeToCamel(body.data);
          resolve(data);
          return;
        }

        // 错误分类
        const errCode = body.code;
        let errMsg = body.message || `请求失败 (${res.statusCode})`;

        if (errCode === 401 || res.statusCode === 401) {
          errMsg = 'API Key 无效或已禁用';
        } else if (errCode === 403 || res.statusCode === 403) {
          errMsg = 'API Key 已过期或无权访问';
        } else if (errCode === 404 || res.statusCode === 404) {
          errMsg = body.message || '资源不存在';
        } else if (errCode === 429 || res.statusCode === 429) {
          errMsg = '请求频率超限，请稍后重试';
        } else if (errCode === 400 || res.statusCode === 400) {
          errMsg = body.message || '请求参数错误';
        }

        if (DEBUG) {
          console.error('[API] ✗ ' + errMsg, { httpStatus: res.statusCode, body });
        }

        if (!options.silent) {
          wx.showToast({ title: errMsg, icon: 'none', duration: 2500 });
        }
        reject({ code: errCode, message: errMsg, httpStatus: res.statusCode, raw: body });
      },
      fail: (err) => {
        const isTimeout = err.errMsg && err.errMsg.indexOf('timeout') !== -1;
        const msg = isTimeout ? '请求超时，请重试' : '网络错误，请检查网络';
        if (DEBUG) {
          console.error('[API] ✗ ' + msg, err);
        }
        if (!options.silent) {
          wx.showToast({ title: msg, icon: 'none' });
        }
        reject({ code: -1, message: msg, raw: err });
      }
    });
  });
}

/**
 * 测试 API 连接
 * 自动尝试 3 种鉴权方式: X-API-Key / Authorization Bearer / ?api_key=
 * @returns {Promise<{success, url, keyPreview, method, status, message}>}
 */
function testConnection() {
  const { API_BASE_URL, API_KEY, source } = getConfig();
  const keyPreview = API_KEY ? API_KEY.slice(0, 12) + '...' + API_KEY.slice(-4) : '(空)';
  if (DEBUG) console.log('[API] 测试连接: ' + API_BASE_URL + '/filters (key 来源: ' + source + ')');

  // 3 种鉴权方式 (按 API 文档)
  const methods = [
    { name: 'X-API-Key', useHeader: true, useQuery: false, bearer: false },
    { name: 'Authorization Bearer', useHeader: true, useQuery: false, bearer: true },
    { name: '?api_key=', useHeader: false, useQuery: true, bearer: false }
  ];

  // 顺序尝试每种方式,直到找到成功的
  return tryNextMethod(0);

  function tryNextMethod(idx) {
    if (idx >= methods.length) {
      return Promise.resolve({
        success: false,
        url: API_BASE_URL,
        keyPreview: keyPreview,
        keySet: !!API_KEY,
        keySource: source,
        status: 0,
        method: 'all-failed',
        message: '所有鉴权方式都失败，请检查后端 API Key 是否正确',
        response: null
      });
    }
    const m = methods[idx];
    return new Promise((resolve) => {
      const header = { 'Content-Type': 'application/json' };
      let url = API_BASE_URL + '/filters';
      if (m.useHeader) {
        header['X-API-Key'] = API_KEY;
        if (m.bearer) header['Authorization'] = 'Bearer ' + API_KEY;
      }
      if (m.useQuery) {
        url += (url.indexOf('?') === -1 ? '?' : '&') + 'api_key=' + encodeURIComponent(API_KEY);
      }
      if (DEBUG) {
        console.log('[API] 尝试方式 ' + (idx + 1) + '/3: ' + m.name);
        if (m.useHeader) console.log('[API] Header: X-API-Key=' + (API_KEY ? '***' : '(空)') + (m.bearer ? ' + Authorization' : ''));
        if (m.useQuery) console.log('[API] URL: ' + url.replace(API_KEY, '***'));
      }
      wx.request({
        url: url,
        method: 'GET',
        header: header,
        timeout: 10000,
        success: (res) => {
          const body = res.data || {};
          const ok = res.statusCode === 200 && body.code === 0;
          if (ok) {
            resolve({
              success: true,
              url: API_BASE_URL,
              keyPreview: keyPreview,
              keySet: !!API_KEY,
              keySource: source,
              status: 200,
              method: m.name,
              message: '✓ 连接成功! (使用 ' + m.name + ' 鉴权)',
              response: body
            });
          } else {
            // 失败,尝试下一种
            if (DEBUG) {
              console.log('[API] ' + m.name + ' 失败: ' + res.statusCode + ' - ' + (body.message || ''));
            }
            tryNextMethod(idx + 1).then(resolve);
          }
        },
        fail: (err) => {
          if (DEBUG) console.log('[API] ' + m.name + ' 网络错误: ' + err.errMsg);
          tryNextMethod(idx + 1).then(resolve);
        }
      });
    });
  }
}

// ============= 业务 API =============

/**
 * GET /api/v1/bids — 列表查询
 *
 * @param {object} params - 完整支持 16 个查询参数
 * @param {number} [params.page=1] - 页码
 * @param {number} [params.page_size=20] - 每页 1-100
 * @param {string} [params.keyword] - 模糊匹配 title/buyer/agent
 * @param {string} [params.source] - 数据来源精确匹配
 * @param {string} [params.bid_phase] - 招标/中标
 * @param {string} [params.bid_type] - 12 个标准值之一
 * @param {string} [params.notice_nature] - 4 个标准值之一
 * @param {string} [params.category] - 4 个标准值之一
 * @param {string} [params.industry] - 行业
 * @param {string} [params.buyer_type] - 4 个标准值之一
 * @param {string} [params.bidding_method] - 招标方式
 * @param {string} [params.province] - 省份
 * @param {string} [params.city] - 城市
 * @param {string} [params.buyer] - 采购人模糊匹配
 * @param {string} [params.publish_date_start] - YYYY-MM-DD
 * @param {string} [params.publish_date_end] - YYYY-MM-DD
 * @param {string} [params.sort_by=publish_date] - id/publish_date/created_at
 * @param {string} [params.sort_order=desc] - asc/desc
 * @param {string} [params.list_type] - bids（最新招标）/ wins（最新中标）
 * @param {object} [options] - { silent, skipCamel }
 * @returns {Promise<{items: array, pagination: {total, page, page_size, total_pages}}>}
 */
function getBidList(params = {}, options = {}) {
  // 校验分页
  const pg = validatePagination(params);
  if (!pg.ok) return Promise.reject({ code: 400, message: pg.error });
  // 校验排序
  const sort = validateSort(pg.data);
  if (!sort.ok) return Promise.reject({ code: 400, message: sort.error });
  // 校验枚举
  const enums = validateEnums(sort.data);
  if (!enums.ok) return Promise.reject({ code: 400, message: enums.error });

  return request({
    url: '/bids',
    method: 'GET',
    data: sort.data,
    silent: options.silent,
    skipCamel: options.skipCamel
  });
}

/**
 * GET /api/v1/bids/{id} — 详情查询
 * @param {number|string} bidId
 * @param {object} [options] - { silent }
 * @returns {Promise<object>} 包含 37 个业务字段 + sections + attachments + parent_bid + child_bids
 */
function getBidDetail(bidId, options = {}) {
  if (!bidId) {
    return Promise.reject({ code: 400, message: 'bidId 不能为空' });
  }
  return request({
    url: `/bids/${bidId}`,
    method: 'GET',
    silent: options.silent
  });
}

/**
 * GET /api/v1/bids/search — 全文搜索
 * @param {object} params - { keyword, page, page_size }
 * @param {object} [options] - { silent }
 * @returns {Promise<{keyword, items, pagination}>}
 */
function searchBids(params = {}, options = {}) {
  if (!params.keyword || String(params.keyword).trim() === '') {
    return Promise.reject({ code: 400, message: '搜索关键词不能为空' });
  }
  // 复用分页校验
  const pg = validatePagination(params);
  if (!pg.ok) return Promise.reject({ code: 400, message: pg.error });

  return request({
    url: '/bids/search',
    method: 'GET',
    data: pg.data,
    silent: options.silent
  });
}

/**
 * GET /api/v1/stats — 统计信息
 * @param {object} [options]
 * @returns {Promise<object>}
 */
function getStats(options = {}) {
  return request({
    url: '/stats',
    method: 'GET',
    silent: options.silent
  });
}

/**
 * GET /api/v1/filters — 筛选项枚举
 * @param {object} [options]
 * @returns {Promise<{bid_phases, bid_types, notice_natures, categories, industries, buyer_types, ...}>}
 */
function getFilters(options = {}) {
  return request({
    url: '/filters',
    method: 'GET',
    silent: options.silent
  });
}

// ============= 便捷查询封装 =============

/**
 * 按业务阶段 + 业务小类查询（首页 3 个 Tab 专用）
 * @param {string} bidPhase - 招标/中标
 * @param {object} [extraParams] - 额外参数（如 province/city）
 * @param {object} [options]
 * @returns {Promise<{items, pagination}>}
 */
function getBidsByPhase(bidPhase, extraParams = {}, options = {}) {
  return getBidList(Object.assign({ bid_phase: bidPhase }, extraParams), options);
}

/**
 * 查询最新招标（list_type=bids，排除中标）
 */
function getLatestBids(extraParams = {}, options = {}) {
  return getBidList(Object.assign({ list_type: LIST_TYPES.BIDS }, extraParams), options);
}

/**
 * 查询最新中标（list_type=wins，仅成交公示）
 */
function getLatestWins(extraParams = {}, options = {}) {
  return getBidList(Object.assign({ list_type: LIST_TYPES.WINS }, extraParams), options);
}

/**
 * 按省份 + 城市查询
 * @param {string} province - 如 "北京"/"北京·市"
 * @param {string} [city] - 如 "海淀区"（可选）
 * @param {object} [extraParams] - 额外参数
 */
function getBidsByRegion(province, city, extraParams = {}, options = {}) {
  const p = Object.assign({}, extraParams);
  if (province) p.province = province;
  if (city) p.city = city;
  return getBidList(p, options);
}

/**
 * 按关键词搜索 + 可选地区
 */
function searchByKeyword(keyword, extraParams = {}, options = {}) {
  return searchBids(Object.assign({ keyword }, extraParams), options);
}

// ============= 限流信息 =============

/**
 * 获取上一次请求的限流信息
 * @returns {{limit, remaining, reset}}
 */
function getLastRateInfo() {
  return Object.assign({}, _lastRateInfo);
}

// ============= 导出 =============

module.exports = {
  // 核心方法
  request,
  testConnection,
  // 业务 API
  getBidList,
  getBidDetail,
  searchBids,
  getStats,
  getFilters,
  // 便捷查询
  getBidsByPhase,
  getLatestBids,
  getLatestWins,
  getBidsByRegion,
  searchByKeyword,
  // 工具
  getLastRateInfo,
  // 常量
  BID_PHASES,
  BID_TYPES,
  CATEGORIES,
  NOTICE_NATURES,
  BUYER_TYPES,
  LIST_TYPES,
  SORT_FIELDS,
  SORT_ORDERS,
  ERROR_CODES
};
