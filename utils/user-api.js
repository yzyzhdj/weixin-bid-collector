/**
 * 用户中心 API 客户端 (utils/user-api.js)
 *
 * 对接 PC 端 bid_user_API.md 中描述的 37 个接口
 *   认证基础路径：/api/auth
 *   用户中心路径：/api/user/center
 *   鉴权：Authorization: Bearer <token>（除登录相关接口外）
 *
 * 与 utils/api.js 的区别：
 *   - api.js 对接的是标讯数据接口（/api/v1/bids，API Key 鉴权）
 *   - user-api.js 对接的是用户中心接口（/api/auth + /api/user/center，Bearer Token 鉴权）
 */

// ============= 配置 =============

/** 用户中心基础 URL（不含 /api 前缀） */
const USER_API_BASE_URL = 'https://www.sunbidinfo.com';

/** 认证接口路径前缀 */
const AUTH_PREFIX = '/api/auth';

/** 用户中心接口路径前缀 */
const CENTER_PREFIX = '/api/user/center';

// ============= Token 存储 =============

const TOKEN_KEY = 'user_token';
const USER_INFO_KEY = 'user_info';

/**
 * 读取本地保存的 token
 */
function getToken() {
  try {
    return wx.getStorageSync(TOKEN_KEY) || '';
  } catch (e) {
    return '';
  }
}

/**
 * 保存 token
 */
function setToken(token) {
  try {
    if (token) {
      wx.setStorageSync(TOKEN_KEY, token);
    } else {
      wx.removeStorageSync(TOKEN_KEY);
    }
  } catch (e) { /* ignore */ }
}

/**
 * 读取本地保存的用户信息
 */
function getUserInfo() {
  try {
    return wx.getStorageSync(USER_INFO_KEY) || null;
  } catch (e) {
    return null;
  }
}

/**
 * 保存用户信息到本地
 */
function setUserInfo(userInfo) {
  try {
    if (userInfo) {
      wx.setStorageSync(USER_INFO_KEY, userInfo);
    } else {
      wx.removeStorageSync(USER_INFO_KEY);
    }
  } catch (e) { /* ignore */ }
}

/**
 * 清除登录态（退出登录时调用）
 */
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

// ============= 核心请求 =============

/**
 * 用户中心统一请求方法
 * @param {object} options
 * @param {string} options.url - 不含域名的路径（如 '/api/auth/login'）
 * @param {string} [options.method='GET']
 * @param {object} [options.data]
 * @param {boolean} [options.needAuth=true] - 是否需要带上 Bearer Token
 * @param {boolean} [options.silent=false]
 * @returns {Promise<object>} 后端 data 字段
 */
function request(options) {
  const { url, method, data, needAuth = true, silent = false } = options;
  const header = { 'Content-Type': 'application/json' };

  if (needAuth) {
    const token = getToken();
    if (token) {
      header['Authorization'] = 'Bearer ' + token;
    }
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: USER_API_BASE_URL + url,
      method: method || 'GET',
      data: data || {},
      header,
      timeout: 20000,
      success: (res) => {
        const body = res.data || {};
        if (res.statusCode === 200 && body.code === 200) {
          resolve(body.data);
        } else if (res.statusCode === 401) {
          // Token 失效
          if (needAuth) {
            clearAuth();
          }
          if (!silent) {
            wx.showToast({ title: body.message || '请先登录', icon: 'none' });
          }
          reject({ code: 401, message: body.message || '未登录或 Token 无效', httpStatus: 401, raw: body });
        } else {
          if (!silent) {
            wx.showToast({ title: body.message || ('HTTP ' + res.statusCode), icon: 'none' });
          }
          reject({ code: body.code || res.statusCode, message: body.message || ('HTTP ' + res.statusCode), httpStatus: res.statusCode, raw: body });
        }
      },
      fail: (err) => {
        if (!silent) {
          wx.showToast({ title: '网络错误，请重试', icon: 'none' });
        }
        reject({ code: -1, message: err.errMsg || '网络错误', err });
      }
    });
  });
}

// ============= 一、认证相关 =============

/**
 * 1.1 用户注册
 * POST /api/auth/register
 * @param {object} payload { phone, password, nickname?, smsCode? }
 */
function register(payload) {
  return request({
    url: AUTH_PREFIX + '/register',
    method: 'POST',
    data: payload,
    needAuth: false
  });
}

/**
 * 1.2 用户登录（支持 password / sms / wechat 三种方式）
 * POST /api/auth/login
 * @param {object} payload { loginType, phone, password?, smsCode?, wechatCode? }
 * @returns {Promise<{token, userInfo, expiresIn}>}
 */
function login(payload) {
  return request({
    url: AUTH_PREFIX + '/login',
    method: 'POST',
    data: payload,
    needAuth: false
  }).then((data) => {
    if (data && data.token) {
      setToken(data.token);
      if (data.userInfo) {
        setUserInfo(data.userInfo);
        const app = getApp();
        if (app && app.globalData) {
          app.globalData.token = data.token;
          app.globalData.userInfo = data.userInfo;
          app.globalData.isLoggedIn = true;
        }
      }
    }
    return data;
  });
}

/**
 * 1.3 退出登录
 * POST /api/auth/logout
 */
function logout() {
  return request({
    url: AUTH_PREFIX + '/logout',
    method: 'POST'
  }).then((data) => {
    clearAuth();
    return data;
  });
}

/**
 * 1.4 发送手机验证码
 * POST /api/auth/sms-code
 * @param {string} phone
 * @param {string} purpose - 'login' / 'register' / 'reset'
 */
function sendSmsCode(phone, purpose) {
  return request({
    url: AUTH_PREFIX + '/sms-code',
    method: 'POST',
    data: { phone, purpose },
    needAuth: false
  });
}

/**
 * 1.5 获取当前登录用户信息
 * GET /api/auth/me
 */
function getMe() {
  return request({
    url: AUTH_PREFIX + '/me',
    method: 'GET'
  });
}

/**
 * 1.6 重置密码
 * POST /api/auth/reset-password
 * @param {object} payload { phone, smsCode, newPassword }
 */
function resetPassword(payload) {
  return request({
    url: AUTH_PREFIX + '/reset-password',
    method: 'POST',
    data: payload,
    needAuth: false
  });
}

// ============= 二、个人资料 =============

/**
 * 2.1 获取个人资料
 * GET /api/user/center/profile
 */
function getProfile() {
  return request({
    url: CENTER_PREFIX + '/profile',
    method: 'GET'
  });
}

// ============= 三、浏览记录 =============

/**
 * 3.1 查询浏览记录
 * GET /api/user/center/browse-history?page=1&pageSize=20
 */
function getBrowseHistory(page = 1, pageSize = 20) {
  return request({
    url: CENTER_PREFIX + '/browse-history',
    method: 'GET',
    data: { page, pageSize }
  });
}

/**
 * 3.2 添加浏览记录
 * POST /api/user/center/browse-history?bidId=123
 */
function addBrowseHistory(bidId) {
  return request({
    url: CENTER_PREFIX + '/browse-history',
    method: 'POST',
    data: { bidId },
    silent: true
  });
}

/**
 * 3.3 删除单条浏览记录
 * DELETE /api/user/center/browse-history/{bidId}
 */
function deleteBrowseHistory(bidId) {
  return request({
    url: CENTER_PREFIX + '/browse-history/' + bidId,
    method: 'DELETE',
    silent: true
  });
}

/**
 * 3.4 清空全部浏览记录
 * DELETE /api/user/center/browse-history
 */
function clearBrowseHistory() {
  return request({
    url: CENTER_PREFIX + '/browse-history',
    method: 'DELETE'
  });
}

// ============= 四、收藏 =============

/**
 * 4.1 查询收藏列表
 * GET /api/user/center/favorites?page=1&pageSize=20
 */
function getFavorites(page = 1, pageSize = 20) {
  return request({
    url: CENTER_PREFIX + '/favorites',
    method: 'GET',
    data: { page, pageSize }
  });
}

/**
 * 4.2 添加收藏
 * POST /api/user/center/favorites?bidId=123&remark=...
 */
function addFavorite(bidId, remark) {
  const data = { bidId };
  if (remark) data.remark = remark;
  return request({
    url: CENTER_PREFIX + '/favorites',
    method: 'POST',
    data
  });
}

/**
 * 4.3 取消收藏
 * DELETE /api/user/center/favorites/{bidId}
 */
function removeFavorite(bidId) {
  return request({
    url: CENTER_PREFIX + '/favorites/' + bidId,
    method: 'DELETE'
  });
}

/**
 * 4.4 检查是否已收藏
 * GET /api/user/center/favorites/check?bidId=123
 * @returns {Promise<boolean>}
 */
function checkFavorite(bidId) {
  return request({
    url: CENTER_PREFIX + '/favorites/check',
    method: 'GET',
    data: { bidId }
  });
}

// ============= 五、我的发布 =============

/**
 * 5.1 查询我的发布
 * GET /api/user/center/publishments?type=bid&page=1&pageSize=20
 */
function getPublishments(type, page = 1, pageSize = 20) {
  const data = { page, pageSize };
  if (type) data.type = type;
  return request({
    url: CENTER_PREFIX + '/publishments',
    method: 'GET',
    data
  });
}

/**
 * 5.2 新建发布
 * POST /api/user/center/publishments
 * @param {object} payload { type, title, content?, province?, city?, budget?, deadline? }
 */
function createPublishment(payload) {
  return request({
    url: CENTER_PREFIX + '/publishments',
    method: 'POST',
    data: payload
  });
}

/**
 * 5.3 修改发布
 * PUT /api/user/center/publishments/{id}
 */
function updatePublishment(id, payload) {
  return request({
    url: CENTER_PREFIX + '/publishments/' + id,
    method: 'PUT',
    data: payload
  });
}

/**
 * 5.4 删除发布
 * DELETE /api/user/center/publishments/{id}
 */
function deletePublishment(id) {
  return request({
    url: CENTER_PREFIX + '/publishments/' + id,
    method: 'DELETE'
  });
}

// ============= 六、我的订阅 =============

/**
 * 6.1 查询订阅
 * GET /api/user/center/subscriptions?page=1&pageSize=20
 */
function getSubscriptions(page = 1, pageSize = 20) {
  return request({
    url: CENTER_PREFIX + '/subscriptions',
    method: 'GET',
    data: { page, pageSize }
  });
}

/**
 * 6.2 创建订阅
 * POST /api/user/center/subscriptions
 */
function createSubscription(payload) {
  return request({
    url: CENTER_PREFIX + '/subscriptions',
    method: 'POST',
    data: payload
  });
}

/**
 * 6.3 修改订阅
 * PUT /api/user/center/subscriptions/{id}
 */
function updateSubscription(id, payload) {
  return request({
    url: CENTER_PREFIX + '/subscriptions/' + id,
    method: 'PUT',
    data: payload
  });
}

/**
 * 6.4 删除订阅
 * DELETE /api/user/center/subscriptions/{id}
 */
function deleteSubscription(id) {
  return request({
    url: CENTER_PREFIX + '/subscriptions/' + id,
    method: 'DELETE'
  });
}

// ============= 七、企业监控 =============

/**
 * 7.1 查询监控企业
 * GET /api/user/center/monitors?page=1&pageSize=20
 */
function getMonitors(page = 1, pageSize = 20) {
  return request({
    url: CENTER_PREFIX + '/monitors',
    method: 'GET',
    data: { page, pageSize }
  });
}

/**
 * 7.2 新增监控
 * POST /api/user/center/monitors
 */
function createMonitor(payload) {
  return request({
    url: CENTER_PREFIX + '/monitors',
    method: 'POST',
    data: payload
  });
}

/**
 * 7.3 修改监控
 * PUT /api/user/center/monitors/{id}
 */
function updateMonitor(id, payload) {
  return request({
    url: CENTER_PREFIX + '/monitors/' + id,
    method: 'PUT',
    data: payload
  });
}

/**
 * 7.4 删除监控
 * DELETE /api/user/center/monitors/{id}
 */
function deleteMonitor(id) {
  return request({
    url: CENTER_PREFIX + '/monitors/' + id,
    method: 'DELETE'
  });
}

/**
 * 7.5 监控企业最新动态
 * GET /api/user/center/monitors/dynamics?page=1&pageSize=20
 */
function getMonitorDynamics(page = 1, pageSize = 20) {
  return request({
    url: CENTER_PREFIX + '/monitors/dynamics',
    method: 'GET',
    data: { page, pageSize }
  });
}

// ============= 八、我的下载 =============

/**
 * 8.1 查询下载记录
 * GET /api/user/center/downloads?page=1&pageSize=20
 */
function getDownloads(page = 1, pageSize = 20) {
  return request({
    url: CENTER_PREFIX + '/downloads',
    method: 'GET',
    data: { page, pageSize }
  });
}

// ============= 九、消息通知 =============

/**
 * 9.1 查询消息通知
 * GET /api/user/center/notifications?page=1&pageSize=20
 */
function getNotifications(page = 1, pageSize = 20) {
  return request({
    url: CENTER_PREFIX + '/notifications',
    method: 'GET',
    data: { page, pageSize }
  });
}

/**
 * 9.2 未读消息数量
 * GET /api/user/center/notifications/unread-count
 * @returns {Promise<number>}
 */
function getUnreadCount() {
  return request({
    url: CENTER_PREFIX + '/notifications/unread-count',
    method: 'GET',
    silent: true
  });
}

/**
 * 9.3 标记单条已读
 * PUT /api/user/center/notifications/{id}/read
 */
function markNotificationRead(id) {
  return request({
    url: CENTER_PREFIX + '/notifications/' + id + '/read',
    method: 'PUT',
    silent: true
  });
}

/**
 * 9.4 全部标记已读
 * PUT /api/user/center/notifications/read-all
 */
function markAllNotificationsRead() {
  return request({
    url: CENTER_PREFIX + '/notifications/read-all',
    method: 'PUT'
  });
}

// ============= 十、通知设置 =============

/**
 * 10.1 获取通用设置
 * GET /api/user/center/settings
 */
function getSettings() {
  return request({
    url: CENTER_PREFIX + '/settings',
    method: 'GET'
  });
}

/**
 * 10.2 更新通用设置
 * PUT /api/user/center/settings
 */
function updateSettings(payload) {
  return request({
    url: CENTER_PREFIX + '/settings',
    method: 'PUT',
    data: payload
  });
}

/**
 * 10.3 获取推送设置
 * GET /api/user/center/push-settings
 */
function getPushSettings() {
  return request({
    url: CENTER_PREFIX + '/push-settings',
    method: 'GET'
  });
}

/**
 * 10.4 保存推送设置
 * PUT /api/user/center/push-settings
 */
function updatePushSettings(payload) {
  return request({
    url: CENTER_PREFIX + '/push-settings',
    method: 'PUT',
    data: payload
  });
}

// ============= 导出 =============

module.exports = {
  // Token / 用户信息管理
  getToken,
  setToken,
  getUserInfo,
  setUserInfo,
  clearAuth,

  // 一、认证 (6)
  register,
  login,
  logout,
  sendSmsCode,
  getMe,
  resetPassword,

  // 二、个人资料 (1)
  getProfile,

  // 三、浏览记录 (4)
  getBrowseHistory,
  addBrowseHistory,
  deleteBrowseHistory,
  clearBrowseHistory,

  // 四、收藏 (4)
  getFavorites,
  addFavorite,
  removeFavorite,
  checkFavorite,

  // 五、我的发布 (4)
  getPublishments,
  createPublishment,
  updatePublishment,
  deletePublishment,

  // 六、我的订阅 (4)
  getSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,

  // 七、企业监控 (5)
  getMonitors,
  createMonitor,
  updateMonitor,
  deleteMonitor,
  getMonitorDynamics,

  // 八、我的下载 (1)
  getDownloads,

  // 九、消息通知 (4)
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,

  // 十、通知设置 (4)
  getSettings,
  updateSettings,
  getPushSettings,
  updatePushSettings
};
