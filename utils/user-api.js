/**
 * 用户中心 API 客户端 (utils/user-api.js)
 *
 * 对接 bid_user_API.md 文档中的 46 个接口
 *   认证基础路径：/api/auth（公开接口，仅需 X-Mini-Program）
 *   用户业务路径：/api/v1/user（需 X-Mini-Program + Bearer Token）
 *   旧版兼容路径：/api/user/center（仅需 Bearer Token）
 *
 * 鉴权策略（2026-06-26 鉴权改造后）：
 *   所有请求统一加 X-Mini-Program: 1 头（小程序渠道标识，替代旧 API Key）
 *   /api/auth/**     → 公开接口，无需 Authorization
 *   /api/v1/user/**  → X-Mini-Program: 1 + Authorization: Bearer {user_token}
 *   /api/user/center → Authorization: Bearer {user_token}
 */

// ============= 配置 =============

const USER_API_BASE_URL = 'https://www.sunbidinfo.com';
const AUTH_PREFIX = '/api/auth';
const API_PREFIX = '/api/v1/user';     // 新版用户业务接口
const OLD_PREFIX = '/api/user/center';  // 旧版兼容
const POINTS_PREFIX = '/api/v1/points'; // 积分充值（套餐 + 订单，见 POINT_RECHARGE_API.md）

// ============= Token 存储 =============

const TOKEN_KEY = 'user_token';
const USER_INFO_KEY = 'user_info';

function getToken() {
  try { return wx.getStorageSync(TOKEN_KEY) || ''; } catch (e) { return ''; }
}

function setToken(token) {
  try {
    if (token) wx.setStorageSync(TOKEN_KEY, token);
    else wx.removeStorageSync(TOKEN_KEY);
  } catch (e) { /* ignore */ }
}

function getUserInfo() {
  try { return wx.getStorageSync(USER_INFO_KEY) || null; } catch (e) { return null; }
}

function setUserInfo(info) {
  try {
    if (info) wx.setStorageSync(USER_INFO_KEY, info);
    else wx.removeStorageSync(USER_INFO_KEY);
  } catch (e) { /* ignore */ }
}

function clearAuth() {
  setToken('');
  setUserInfo(null);
  try {
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.token = '';
      app.globalData.userInfo = null;
      app.globalData.isLoggedIn = false;
    }
  } catch (e) { /* ignore */ }
}

// ============= CSRF Token（过渡期） =============
// 后端对 POST/PUT/DELETE 强制 CSRF 校验，但尚未豁免第三方渠道
// 从响应的 Set-Cookie 中捕获 csrf_token，并在状态变更请求中通过 X-CSRF-Token 头回传
// 后端完成渠道豁免后此段可移除
const CSRF_STORAGE_KEY = 'csrf_token';

function _getCsrfToken() {
  try { return wx.getStorageSync(CSRF_STORAGE_KEY) || ''; } catch (e) { return ''; }
}

function _captureCsrfToken(header, body) {
  // 1. 尝试从 Set-Cookie 头捕获（开发者工具可用，真机可能拿不到）
  if (header) {
    let setCookie = header['Set-Cookie'] || header['set-cookie'];
    if (setCookie) {
      if (Array.isArray(setCookie)) setCookie = setCookie.join('; ');
      const m = String(setCookie).match(/csrf_token=([^;]+)/);
      if (m && m[1]) {
        try { wx.setStorageSync(CSRF_STORAGE_KEY, m[1]); } catch (e) { /* ignore */ }
        console.log('[user-api] 捕获 CSRF Token（来自 Set-Cookie）');
        return;
      }
    }
  }
  // 2. 尝试从响应体中捕获（后端可能在 body 中返回 csrf_token）
  if (body) {
    const token = body.csrf_token || (body.data && body.data.csrf_token);
    if (token) {
      try { wx.setStorageSync(CSRF_STORAGE_KEY, token); } catch (e) { /* ignore */ }
      console.log('[user-api] 捕获 CSRF Token（来自响应体）');
    }
  }
}

// ============= 核心请求 =============

/**
 * 统一请求方法
 * @param {object} options
 * @param {string} options.url - 不含域名的路径
 * @param {string} [options.method='GET']
 * @param {object} [options.data] - 请求参数（GET 时作为 query，POST/PUT 时作为 body）
 * @param {object} [options.query] - 额外的 query 参数（用于 POST 时需把参数放 query 的场景）
 * @param {boolean} [options.needAuth=true]
 * @param {boolean} [options.silent=false]
 * @returns {Promise<object>} 后端 data 字段
 */
function request(options) {
  const { url, method, data, query, needAuth = true, silent = false } = options;
  // 所有请求统一带 X-Mini-Program 渠道标识头（替代旧 API Key / X-Web-Access）
  // 过渡期兼容：后端尚未部署 X-Mini-Program 识别，先用 web 渠道公开令牌兜底
  // 后端完成迁移后此头将变为冗余，可安全移除
  const header = {
    'Content-Type': 'application/json',
    'X-Mini-Program': '1',
    'X-Web-Access': 'bid_web_2026_public'
  };

  // 需要登录态的接口才加 Authorization（用户 token，不再是 API Key）
  if (needAuth) {
    const token = getToken();
    if (token) {
      header['Authorization'] = 'Bearer ' + token;
    }
  }

  // CSRF：状态变更请求需携带 X-CSRF-Token（过渡期后端尚未豁免第三方渠道）
  const httpMethod = (method || 'GET').toUpperCase();
  const needCsrf = (httpMethod !== 'GET' && httpMethod !== 'HEAD');
  const csrf = needCsrf ? _getCsrfToken() : '';
  if (needCsrf) {
    if (csrf) {
      header['X-CSRF-Token'] = csrf;
    } else {
      console.warn('[user-api] CSRF Token 缺失，POST/PUT/DELETE 可能 403');
    }
  }

  // 构建 URL：附加 query 参数
  let requestUrl = USER_API_BASE_URL + url;
  const queryParams = [];
  if (query) {
    Object.keys(query).forEach(k => {
      if (query[k] !== undefined && query[k] !== null) {
        queryParams.push(encodeURIComponent(k) + '=' + encodeURIComponent(query[k]));
      }
    });
  }
  // GET 请求的 data 也作为 query
  if ((method || 'GET') === 'GET' && data) {
    Object.keys(data).forEach(k => {
      if (data[k] !== undefined && data[k] !== null) {
        queryParams.push(encodeURIComponent(k) + '=' + encodeURIComponent(data[k]));
      }
    });
  }
  if (queryParams.length > 0) {
    requestUrl += (requestUrl.indexOf('?') === -1 ? '?' : '&') + queryParams.join('&');
  }

  // POST/PUT 的 data 作为 body（除非已放到 query）
  // POST/PUT/DELETE 至少发送空对象 {}，避免后端因 body 为空报错
  const bodyData = ((method || 'GET') === 'GET') ? undefined : (data === undefined || data === null ? {} : data);

  return new Promise((resolve, reject) => {
    wx.request({
      url: requestUrl,
      method: method || 'GET',
      data: bodyData,
      header,
      timeout: 20000,
      success: (res) => {
        const body = res.data || {};
        console.log('[user-api]', method || 'GET', requestUrl, '->', res.statusCode, body);
        // 捕获后端下发的 CSRF Token（供后续 POST/PUT/DELETE 使用）
        _captureCsrfToken(res.header, body);
        if (res.statusCode === 200 && (body.code === 200 || body.code === 0 || body.success === true)) {
          resolve(body.data);
        } else if (res.statusCode === 401) {
          // token 失效：清登录态 + 跳转登录页
          if (needAuth) clearAuth();
          if (!silent) {
            wx.showToast({ title: body.message || '请先登录', icon: 'none' });
            // 1 秒后跳登录页（避免 toast 未消失就被覆盖）
            setTimeout(() => {
              wx.navigateTo({
                url: '/pages/login/login',
                fail: () => {
                  // navigateTo 失败（可能是 tabBar 页或栈满）改用 reLaunch
                  wx.reLaunch({ url: '/pages/login/login' });
                }
              });
            }, 1000);
          }
          reject({ code: 401, message: body.message || '未登录或 Token 无效', httpStatus: 401, raw: body });
        } else if (res.statusCode === 429) {
          // 限流
          if (!silent) wx.showToast({ title: '请求过于频繁，请稍后再试', icon: 'none' });
          reject({ code: 429, message: body.message || '请求过于频繁', httpStatus: 429, raw: body });
        } else if (res.statusCode === 403) {
          // 访问被拒绝
          if (!silent) wx.showToast({ title: body.message || '访问被拒绝', icon: 'none' });
          reject({ code: 403, message: body.message || '访问被拒绝', httpStatus: 403, raw: body });
        } else {
          if (!silent) wx.showToast({ title: body.message || ('HTTP ' + res.statusCode), icon: 'none' });
          reject({ code: body.code || res.statusCode, message: body.message || ('HTTP ' + res.statusCode), httpStatus: res.statusCode, raw: body });
        }
      },
      fail: (err) => {
        console.error('[user-api] 请求失败:', method || 'GET', requestUrl, err);
        if (!silent) wx.showToast({ title: '网络错误，请重试', icon: 'none' });
        reject({ code: -1, message: err.errMsg || '网络错误', err });
      }
    });
  });
}

// ============= 一、认证相关（/api/auth） =============

/** 1.1 用户注册 POST /api/auth/register */
function register(payload) {
  return request({ url: AUTH_PREFIX + '/register', method: 'POST', data: payload, needAuth: false });
}

/** 1.2 用户登录 POST /api/auth/login */
function login(payload) {
  return request({
    url: AUTH_PREFIX + '/login', method: 'POST', data: payload, needAuth: false, silent: true
  }).then((data) => {
    if (data && data.token) {
      setToken(data.token);
      const userInfo = {
        id: data.userId,
        userId: data.userId,
        nickname: data.nickname,
        avatar: data.avatar,
        phone: data.phone
      };
      setUserInfo(userInfo);
      // 缓存 openid（JSAPI 支付必需，后端如果返回的话）
      if (data.openid || data.openId) {
        try { wx.setStorageSync('user_openid', data.openid || data.openId); } catch (e) {}
      }
      const app = getApp();
      if (app && app.globalData) {
        app.globalData.token = data.token;
        app.globalData.userInfo = userInfo;
        app.globalData.isLoggedIn = true;
      }
    }
    return data;
  });
}

/**
 * 读取缓存的 openid（JSAPI 支付用）
 * @returns {string}
 */
function getOpenid() {
  try { return wx.getStorageSync('user_openid') || ''; } catch (e) { return ''; }
}

/** 1.3 退出登录 POST /api/auth/logout */
function logout() {
  return request({ url: AUTH_PREFIX + '/logout', method: 'POST' }).then((data) => {
    clearAuth();
    return data;
  });
}

/** 1.4 发送验证码 POST /api/auth/sms-code */
function sendSmsCode(phone, purpose) {
  return request({
    url: AUTH_PREFIX + '/sms-code', method: 'POST',
    data: { phone, purpose }, needAuth: false, silent: true
  });
}

/** 1.5 获取当前用户 GET /api/auth/me */
function getMe() {
  return request({ url: AUTH_PREFIX + '/me', method: 'GET' });
}

/** 1.6 重置密码 POST /api/auth/reset-password */
function resetPassword(payload) {
  return request({ url: AUTH_PREFIX + '/reset-password', method: 'POST', data: payload, needAuth: false });
}

// ============= 二、个人资料（/api/v1/user） =============

/** 2.1 获取个人资料 GET /api/v1/user/profile */
function getProfile() {
  return request({ url: API_PREFIX + '/profile', method: 'GET' });
}

/** 2.2 修改个人资料 PUT /api/v1/user/profile */
function updateProfile(payload) {
  return request({ url: API_PREFIX + '/profile', method: 'PUT', data: payload });
}

/** 2.3 修改密码 PUT /api/v1/user/password */
function changePassword(oldPassword, newPassword) {
  return request({ url: API_PREFIX + '/password', method: 'PUT', data: { oldPassword, newPassword } });
}

// ============= 三、浏览记录 =============

/** 3.1 查询浏览记录 GET /api/v1/user/browse-history?page=1&page_size=20 */
function getBrowseHistory(page = 1, pageSize = 20) {
  return request({ url: API_PREFIX + '/browse-history', method: 'GET', data: { page, page_size: pageSize } });
}

/** 3.2 添加浏览记录 POST /api/v1/user/browse-history?bid_id=123 */
function addBrowseHistory(bidId) {
  // POST 前 CSRF Token 预热（真机 wx.request 不暴露 Set-Cookie，
  // 如果后端在响应体中下发 token，此步可确保拿到）
  if (!_getCsrfToken()) {
    return request({ url: API_PREFIX + '/points', method: 'GET', silent: true })
      .then(() => request({ url: API_PREFIX + '/browse-history', method: 'POST', query: { bid_id: bidId }, silent: true }));
  }
  return request({ url: API_PREFIX + '/browse-history', method: 'POST', query: { bid_id: bidId }, silent: true });
}

/** 3.3 删除单条浏览记录 DELETE /api/v1/user/browse-history/{bid_id} */
function deleteBrowseHistory(bidId) {
  return request({ url: API_PREFIX + '/browse-history/' + bidId, method: 'DELETE', silent: true });
}

/** 3.4 清空全部浏览记录 DELETE /api/v1/user/browse-history */
function clearBrowseHistory() {
  return request({ url: API_PREFIX + '/browse-history', method: 'DELETE' });
}

// ============= 四、每日查看限制 =============

/** 4.1 查询每日查看限制 GET /api/v1/user/daily-view-limit?bid_id=123 */
function getDailyViewLimit(bidId) {
  return request({ url: API_PREFIX + '/daily-view-limit', method: 'GET', data: { bid_id: bidId }, silent: true });
}

// ============= 五、我的收藏 =============

/** 5.1 查询收藏列表 GET /api/v1/user/favorites?page=1&page_size=20 */
function getFavorites(page = 1, pageSize = 20) {
  return request({ url: API_PREFIX + '/favorites', method: 'GET', data: { page, page_size: pageSize } });
}

/** 5.2 添加收藏 POST /api/v1/user/favorites?bid_id=123&remark=... */
function addFavorite(bidId, remark) {
  const query = { bid_id: bidId };
  if (remark) query.remark = remark;
  return request({ url: API_PREFIX + '/favorites', method: 'POST', query, silent: true });
}

/** 5.3 取消收藏 DELETE /api/v1/user/favorites/{bid_id} */
function removeFavorite(bidId) {
  return request({ url: API_PREFIX + '/favorites/' + bidId, method: 'DELETE', silent: true });
}

/** 5.4 检查是否已收藏 GET /api/v1/user/favorites/check?bid_id=123 */
function checkFavorite(bidId) {
  return request({ url: API_PREFIX + '/favorites/check', method: 'GET', data: { bid_id: bidId }, silent: true });
}

// ============= 六、我的发布 =============

/** 6.1 查询我的发布 GET /api/v1/user/publishments?type=bid&page=1&page_size=20 */
function getPublishments(type, page = 1, pageSize = 20) {
  const data = { page, page_size: pageSize };
  if (type) data.type = type;
  return request({ url: API_PREFIX + '/publishments', method: 'GET', data });
}

/** 6.2 新建发布 POST /api/v1/user/publishments */
function createPublishment(payload) {
  return request({ url: API_PREFIX + '/publishments', method: 'POST', data: payload });
}

/** 6.3 修改发布 PUT /api/v1/user/publishments/{id} */
function updatePublishment(id, payload) {
  return request({ url: API_PREFIX + '/publishments/' + id, method: 'PUT', data: payload });
}

/** 6.4 删除发布 DELETE /api/v1/user/publishments/{id} */
function deletePublishment(id) {
  return request({ url: API_PREFIX + '/publishments/' + id, method: 'DELETE' });
}

// ============= 七、我的订阅 =============

/** 7.1 查询订阅 GET /api/v1/user/subscriptions?page=1&page_size=20 */
function getSubscriptions(page = 1, pageSize = 20) {
  return request({ url: API_PREFIX + '/subscriptions', method: 'GET', data: { page, page_size: pageSize } });
}

/** 7.2 创建订阅 POST /api/v1/user/subscriptions */
function createSubscription(payload) {
  return request({ url: API_PREFIX + '/subscriptions', method: 'POST', data: payload });
}

/** 7.3 修改订阅 PUT /api/v1/user/subscriptions/{id} */
function updateSubscription(id, payload) {
  return request({ url: API_PREFIX + '/subscriptions/' + id, method: 'PUT', data: payload });
}

/** 7.4 删除订阅 DELETE /api/v1/user/subscriptions/{id} */
function deleteSubscription(id) {
  return request({ url: API_PREFIX + '/subscriptions/' + id, method: 'DELETE' });
}

// ============= 八、企业监控 =============

/** 8.1 查询监控企业 GET /api/v1/user/monitors?page=1&page_size=20 */
function getMonitors(page = 1, pageSize = 20) {
  return request({ url: API_PREFIX + '/monitors', method: 'GET', data: { page, page_size: pageSize } });
}

/** 8.2 新增监控 POST /api/v1/user/monitors */
function createMonitor(payload) {
  return request({ url: API_PREFIX + '/monitors', method: 'POST', data: payload });
}

/** 8.3 修改监控 PUT /api/v1/user/monitors/{id} */
function updateMonitor(id, payload) {
  return request({ url: API_PREFIX + '/monitors/' + id, method: 'PUT', data: payload });
}

/** 8.4 删除监控 DELETE /api/v1/user/monitors/{id} */
function deleteMonitor(id) {
  return request({ url: API_PREFIX + '/monitors/' + id, method: 'DELETE' });
}

/** 8.5 监控企业最新动态 GET /api/v1/user/monitors/dynamics?page=1&page_size=20&monitor_id=1 */
function getMonitorDynamics(page = 1, pageSize = 20, monitorId) {
  const data = { page, page_size: pageSize };
  if (monitorId !== undefined && monitorId !== null && monitorId !== '') {
    data.monitor_id = monitorId;
  }
  return request({ url: API_PREFIX + '/monitors/dynamics', method: 'GET', data, silent: true });
}

/** 8.6 推荐企业 GET /api/v1/user/monitors/recommendations?limit=5 */
function getMonitorRecommendations(limit = 5) {
  return request({ url: API_PREFIX + '/monitors/recommendations', method: 'GET', data: { limit } });
}

// ============= 九、我的下载 =============

/** 9.1 查询下载记录 GET /api/v1/user/downloads?page=1&page_size=20 */
function getDownloads(page = 1, pageSize = 20) {
  return request({ url: API_PREFIX + '/downloads', method: 'GET', data: { page, page_size: pageSize } });
}

// ============= 十、消息通知 =============

/** 10.1 查询消息通知 GET /api/v1/user/notifications?page=1&page_size=20 */
function getNotifications(page = 1, pageSize = 20) {
  return request({ url: API_PREFIX + '/notifications', method: 'GET', data: { page, page_size: pageSize } });
}

/** 10.2 未读消息数量 GET /api/v1/user/notifications/unread-count */
function getUnreadCount() {
  return request({ url: API_PREFIX + '/notifications/unread-count', method: 'GET', silent: true });
}

/** 10.3 标记单条已读 PUT /api/v1/user/notifications/{id}/read */
function markNotificationRead(id) {
  return request({ url: API_PREFIX + '/notifications/' + id + '/read', method: 'PUT', silent: true });
}

/** 10.4 全部标记已读 PUT /api/v1/user/notifications/read-all */
function markAllNotificationsRead() {
  return request({ url: API_PREFIX + '/notifications/read-all', method: 'PUT' });
}

// ============= 十一、签到与积分（/api/v1/user/points） =============

/**
 * 11.1 积分账户信息 GET /api/v1/user/points
 * @returns {Promise<{balance, totalEarned, totalSpent, totalSignDays, continuousSignDays, lastSignDate, signedToday, signInPoints, viewBidCost, yuanPerPoint, pointEnabled}>}
 */
function getPoints() {
  return request({ url: API_PREFIX + '/points', method: 'GET', silent: true });
}

/**
 * 11.2 每日签到 POST /api/v1/user/points/sign
 * @returns {Promise} 签到后的最新积分账户信息（同 11.1）
 */
function signIn() {
  // 签到前先发 GET 预热 CSRF Token（真机 wx.request 不暴露 Set-Cookie，
  // 如果后端在响应体中下发 token，此步可确保拿到）
  if (!_getCsrfToken()) {
    return request({ url: API_PREFIX + '/points', method: 'GET', silent: true })
      .then(() => request({ url: API_PREFIX + '/points/sign', method: 'POST', data: {}, silent: true }));
  }
  return request({ url: API_PREFIX + '/points/sign', method: 'POST', data: {}, silent: true });
}

/**
 * 11.3 积分流水分页查询 GET /api/v1/user/points/transactions?page=1&pageSize=20&type=sign
 * @param {string} [type] - sign/recharge/view_bid/admin_adjust/admin_deduct
 */
function getPointTransactions(page = 1, pageSize = 20, type) {
  const data = { page, pageSize };
  if (type) data.type = type;
  return request({ url: API_PREFIX + '/points/transactions', method: 'GET', data, silent: true });
}

/**
 * 11.4 获取充值套餐列表 GET /api/v1/points/packages
 *
 * 对应 POINT_RECHARGE_API.md §4.1，公开接口无需登录。
 * 返回数组：[{id, name, yuan, points, bonus, points_total, sort_order, visible, remark, ...}]
 */
function getRechargePlans() {
  return request({ url: POINTS_PREFIX + '/packages', method: 'GET', needAuth: false, silent: true });
}

/**
 * 11.5 创建充值订单 POST /api/v1/points/orders
 *
 * 对应 POINT_RECHARGE_API.md §5.1，需登录。
 * 前端优先传 openid（来自登录缓存）；若无则传 wechatCode（wx.login 拿到的 code），
 * 后端用 code 调 jscode2session 换取 openid。
 *
 * @param {Object} payload
 *   - packageId/package_id: 套餐 ID（来自 4.1）
 *   - tradeType/trade_type: 'JSAPI'（小程序）或 'NATIVE'（PC 扫码）
 *   - openid: 小程序用户 openid（若已缓存）
 *   - wechatCode/code: wx.login 拿到的 code（后端用此换 openid）
 * @returns {Promise<Object>} 订单对象，含 order_no、jsapi_pay、code_url 等
 */
function createRechargeOrder(payload) {
  // 兼容 camelCase 入参，统一转为后端期望的 snake_case
  const data = {
    package_id: payload.packageId || payload.package_id,
    trade_type: payload.tradeType || payload.trade_type || 'JSAPI'
  };
  if (payload.openid) data.openid = payload.openid;
  // 同时传多个字段名，方便后端识别（后端二选一即可）
  // ⚠️ 必须包含 login_code，这是虚拟支付刷新 session_key 的关键字段
  const wxCode = payload.login_code || payload.loginCode || payload.wechatCode || payload.code;
  if (wxCode) {
    data.login_code = wxCode;      // 主字段名（虚拟支付用）
    data.wechat_code = wxCode;     // 兼容字段名
    data.jscode = wxCode;          // 兼容字段名
  }
  return request({ url: POINTS_PREFIX + '/orders', method: 'POST', data, silent: true });
}

/**
 * 11.5.1 用 wx.login 的 code 换取 openid（备用方案）
 *
 * 如果后端实现了独立的 jscode2session 接口，前端可以先用 code 换 openid 再调创建订单。
 * 调用此函数前请先确认后端是否实现了 `POST /api/auth/jscode2session` 接口。
 *
 * @param {string} code wx.login 拿到的 code
 * @returns {Promise<string>} openid
 */
function getOpenidByCode(code) {
  return request({
    url: AUTH_PREFIX + '/jscode2session',
    method: 'POST',
    data: { code },
    needAuth: false,
    silent: true
  }).then((data) => {
    const openid = (data && (data.openid || data.openId)) || '';
    if (openid) {
      try { wx.setStorageSync('user_openid', openid); } catch (e) {}
    }
    return openid;
  });
}

/**
 * 11.6 查询订单状态 GET /api/v1/points/orders/{orderNo}
 *
 * 对应 POINT_RECHARGE_API.md §5.2，用于支付成功后轮询确认积分已入账。
 * @param {string} orderNo 订单号（创建订单时返回的 order_no）
 * @returns {Promise<Object>} { status, paid_at, transaction_id, points_total, yuan }
 */
function getOrderStatus(orderNo) {
  return request({ url: POINTS_PREFIX + '/orders/' + orderNo, method: 'GET', silent: true });
}

/**
 * 11.6.1 获取用户订单列表 GET /api/v1/points/orders
 *
 * 用于"我的-购买记录"页面展示充值订单列表。
 * @param {number} page 页码（从 1 开始）
 * @param {number} pageSize 每页条数
 * @returns {Promise<Object>} { items: [...], pagination: { total, page, pageSize, totalPages } }
 */
function getOrderList(page, pageSize) {
  const query = {
    page: page || 1,
    page_size: pageSize || 20
  };
  return request({ url: POINTS_PREFIX + '/orders', method: 'GET', data: query, silent: true });
}

/**
 * 11.7 主动关闭订单 POST /api/v1/points/orders/{orderNo}/close
 *
 * 对应 POINT_RECHARGE_API.md §5.3，用户取消支付时调用。
 */
function closeOrder(orderNo) {
  return request({ url: POINTS_PREFIX + '/orders/' + orderNo + '/close', method: 'POST', silent: true });
}

// ============= 十二、通知设置 =============

/** 12.1 获取通用设置 GET /api/v1/user/settings */
function getSettings() {
  return request({ url: API_PREFIX + '/settings', method: 'GET' });
}

/** 12.2 更新通用设置 PUT /api/v1/user/settings */
function updateSettings(payload) {
  return request({ url: API_PREFIX + '/settings', method: 'PUT', data: payload });
}

/** 12.3 获取推送设置 GET /api/v1/user/push-settings */
function getPushSettings() {
  return request({ url: API_PREFIX + '/push-settings', method: 'GET' });
}

/** 12.4 保存推送设置 PUT /api/v1/user/push-settings */
function updatePushSettings(payload) {
  return request({ url: API_PREFIX + '/push-settings', method: 'PUT', data: payload });
}

// ============= 十三、帮助与反馈 =============

/** 13.1 查询我的反馈 GET /api/v1/user/feedbacks?page=1&page_size=20 */
function getFeedbacks(page = 1, pageSize = 20) {
  return request({ url: API_PREFIX + '/feedbacks', method: 'GET', data: { page, page_size: pageSize } });
}

/** 13.2 提交反馈 POST /api/v1/user/feedbacks */
function addFeedback(payload) {
  return request({ url: API_PREFIX + '/feedbacks', method: 'POST', data: payload });
}

// ============= 其他（旧版兼容接口） =============

/** 关于我们（旧版接口，可能不存在） */
function getAboutInfo() {
  return request({ url: OLD_PREFIX + '/about', method: 'GET', silent: true });
}

/** 注销账号（旧版接口，可能不存在） */
function deleteAccount() {
  return request({ url: OLD_PREFIX + '/delete-account', method: 'POST' });
}

// ============= 十四、邀请好友 =============

/**
 * 14.1 上报邀请码（好友登录/注册成功后调用） POST /api/v1/user/invite/report
 * @param {string} inviteCode - 邀请码（邀请人的 userId 字符串）
 * @returns {Promise<{inviterReward:number, inviteeReward:number, message:string}>}
 *   错误：400（邀请码为空/无效/不能邀请自己/邀请人不存在/积分系统未开启）、409（已被邀请过）
 */
function reportInvite(inviteCode) {
  return request({
    url: API_PREFIX + '/invite/report',
    method: 'POST',
    data: { invite_code: inviteCode },
    silent: true
  });
}

/**
 * 14.2 获取邀请信息 GET /api/v1/user/invite/info
 * @returns {Promise<{inviteCode:string, invitedCount:number, totalReward:number}>}
 */
function getInviteInfo() {
  return request({ url: API_PREFIX + '/invite/info', method: 'GET', silent: true });
}

/**
 * 14.3 获取邀请记录 GET /api/v1/user/invite/records?page=1&page_size=20
 * @param {object} [params] - { page, page_size }
 * @returns {Promise<{items:Array<{inviteeUserId,inviteeNickname,inviteeAvatar,inviterReward,inviteeReward,status,createdAt}>, total, page, pageSize, totalPages}>}
 */
function getInviteRecords(params = {}) {
  return request({
    url: API_PREFIX + '/invite/records',
    method: 'GET',
    data: { page: params.page || 1, page_size: params.page_size || 20 },
    silent: true
  });
}

// ============= 十五、中标方企业 =============

/**
 * 15.1 中标方企业列表 GET /api/v1/companies/winners
 * 仅需 X-Mini-Program，无需登录
 * @param {object} [params] - { keyword, page, page_size }
 * @returns {Promise<{items:Array<{name,bidCount,profile,contact}>, total, page, pageSize, totalPages}>}
 */
function getWinnerCompanies(params = {}) {
  const data = { page: params.page || 1, page_size: params.page_size || 15 };
  if (params.keyword) data.keyword = params.keyword;
  return request({
    url: '/api/v1/companies/winners',
    method: 'GET',
    data,
    needAuth: false,
    silent: true
  });
}

/**
 * 15.2 中标方企业中标项目列表 GET /api/v1/companies/winners/{name}/bids
 * 仅需 X-Mini-Program，无需登录
 * @param {string} name - 中标方名称（URL编码）
 * @param {object} [params] - { page, page_size }
 * @returns {Promise<{items:Array<{id,title,publishDate,budget,buyer}>, total, page, pageSize, totalPages}>}
 */
function getWinnerBids(name, params = {}) {
  const data = { page: params.page || 1, page_size: params.page_size || 20 };
  return request({
    url: '/api/v1/companies/winners/' + encodeURIComponent(name) + '/bids',
    method: 'GET',
    data,
    needAuth: false,
    silent: true
  });
}

// ============= 导出 =============

module.exports = {
  // Token / 用户信息管理
  getToken, setToken, getOpenid, getUserInfo, setUserInfo, clearAuth,

  // 一、认证 (6)
  register, login, logout, sendSmsCode, getMe, resetPassword,

  // 二、个人资料 (3)
  getProfile, updateProfile, changePassword,

  // 三、浏览记录 (4)
  getBrowseHistory, addBrowseHistory, deleteBrowseHistory, clearBrowseHistory,

  // 四、每日查看限制 (1)
  getDailyViewLimit,

  // 五、收藏 (4)
  getFavorites, addFavorite, removeFavorite, checkFavorite,

  // 六、我的发布 (4)
  getPublishments, createPublishment, updatePublishment, deletePublishment,

  // 七、我的订阅 (4)
  getSubscriptions, createSubscription, updateSubscription, deleteSubscription,

  // 八、企业监控 (6)
  getMonitors, createMonitor, updateMonitor, deleteMonitor, getMonitorDynamics, getMonitorRecommendations,

  // 九、我的下载 (1)
  getDownloads,

  // 十、消息通知 (4)
  getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead,

  // 十一、签到与积分 (8)
  getPoints, signIn, getPointTransactions, createRechargeOrder, getRechargePlans, getOrderStatus, getOrderList, closeOrder, getOpenidByCode,

  // 十二、通知设置 (4)
  getSettings, updateSettings, getPushSettings, updatePushSettings,

  // 十三、帮助与反馈 (2)
  getFeedbacks, addFeedback,

  // 其他（旧版兼容）
  getAboutInfo, deleteAccount,

  // 十四、邀请好友 (3)
  reportInvite, getInviteInfo, getInviteRecords,

  // 十五、中标方企业 (2)
  getWinnerCompanies, getWinnerBids
};
