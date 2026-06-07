const { API_BASE_URL, API_KEY } = require('./config.js');

// 通用请求函数
function request(options) {
  return new Promise((resolve, reject) => {
    const wxHeaders = options.header || {};
    const headers = {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...wxHeaders
    };

    // 如果已登录，附加用户 token
    try {
      const userToken = wx.getStorageSync('userToken');
      if (userToken) headers['Authorization'] = `Bearer ${userToken}`;
    } catch (e) {}

    wx.request({
      url: API_BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      timeout: options.timeout || 30000,
      header: headers,
      success: (res) => {
        if (res.statusCode === 200 && res.data.code === 0) {
          resolve(res.data.data);
        } else {
          // 非 0 业务错误不在此弹 toast，由调用方决定
          reject({ code: res.data.code, message: res.data.message, statusCode: res.statusCode });
        }
      },
      fail: (err) => reject({ code: -1, message: err.errMsg || '网络错误', raw: err })
    });
  });
}

/* ============================================================
   标讯接口（已有）
   ============================================================ */
function getBidList(params = {}) {
  return request({ url: '/bids', method: 'GET', data: params });
}
function getBidDetail(bidId) {
  return request({ url: `/bids/${bidId}`, method: 'GET' });
}
function searchBids(params) {
  return request({ url: '/bids/search', method: 'GET', data: params });
}
function getStats() {
  return request({ url: '/stats', method: 'GET' });
}
function getFilters() {
  return request({ url: '/filters', method: 'GET' });
}

/* ============================================================
   用户中心接口（按 API_DOC.md 实现，后端可用时生效）
   ============================================================ */

// 9.1 用户注册
function register(data) {
  return request({ url: '/user/register', method: 'POST', data });
}

// 9.2 用户登录（密码/短信/微信 三种方式）
function login(data) {
  return request({ url: '/user/login', method: 'POST', data });
}

// 9.3 微信登录
function loginByWechat(wechatCode) {
  return request({ url: '/user/login/wechat', method: 'POST', data: { wechatCode } });
}

// 9.4 发送短信验证码
function sendSmsCode(phone, purpose = 'register') {
  return request({ url: '/user/sms-code', method: 'POST', data: { phone, purpose } });
}

// 9.5 重置密码
function resetPassword(phone, smsCode, newPassword) {
  return request({ url: '/user/reset-password', method: 'POST', data: { phone, smsCode, newPassword } });
}

// 9.6 获取个人资料
function getProfile() {
  return request({ url: '/user/profile', method: 'GET' });
}

// 9.7 更新个人资料
function updateProfile(data) {
  return request({ url: '/user/profile', method: 'PUT', data });
}

// 9.8 修改密码
function changePassword(oldPassword, newPassword) {
  return request({ url: '/user/password', method: 'PUT', data: { oldPassword, newPassword } });
}

// 9.9 浏览历史
function getBrowseHistory(params = {}) {
  return request({ url: '/user/browse-history', method: 'GET', data: params });
}
function addBrowseHistory(bidId) {
  return request({ url: '/user/browse-history', method: 'POST', data: { bid_id: bidId } });
}
function removeBrowseHistory(bidId) {
  return request({ url: `/user/browse-history/${bidId}`, method: 'DELETE' });
}
function clearBrowseHistory() {
  return request({ url: '/user/browse-history', method: 'DELETE' });
}

// 9.10 收藏
function getFavorites(params = {}) {
  return request({ url: '/user/favorites', method: 'GET', data: params });
}
function addFavorite(bidId, remark) {
  return request({ url: '/user/favorites', method: 'POST', data: { bid_id: bidId, remark } });
}
function removeFavorite(bidId) {
  return request({ url: `/user/favorites/${bidId}`, method: 'DELETE' });
}
function checkFavorite(bidId) {
  return request({ url: '/user/favorites/check', method: 'GET', data: { bid_id: bidId } });
}

// 9.11 我的发布
function getPublishments(params = {}) {
  return request({ url: '/user/publishments', method: 'GET', data: params });
}
function createPublishment(data) {
  return request({ url: '/user/publishments', method: 'POST', data });
}
function updatePublishment(id, data) {
  return request({ url: `/user/publishments/${id}`, method: 'PUT', data });
}
function deletePublishment(id) {
  return request({ url: `/user/publishments/${id}`, method: 'DELETE' });
}

// 9.12 我的下载
function getDownloads(params = {}) {
  return request({ url: '/user/downloads', method: 'GET', data: params });
}

// 9.13 消息通知
function getNotifications(params = {}) {
  return request({ url: '/user/notifications', method: 'GET', data: params });
}
function getUnreadCount() {
  return request({ url: '/user/notifications/unread-count', method: 'GET' });
}
function markNotificationRead(id) {
  return request({ url: `/user/notifications/${id}/read`, method: 'PUT' });
}
function markAllNotificationsRead() {
  return request({ url: '/user/notifications/read-all', method: 'PUT' });
}

// 9.14 用户设置
function getSettings() {
  return request({ url: '/user/settings', method: 'GET' });
}
function updateSettings(data) {
  return request({ url: '/user/settings', method: 'PUT', data });
}

// 9.15 反馈
function getFeedbacks(params = {}) {
  return request({ url: '/user/feedbacks', method: 'GET', data: params });
}
function createFeedback(data) {
  return request({ url: '/user/feedbacks', method: 'POST', data });
}

module.exports = {
  // 标讯
  getBidList, getBidDetail, searchBids, getStats, getFilters,
  // 用户认证
  register, login, loginByWechat, sendSmsCode, resetPassword,
  // 个人资料
  getProfile, updateProfile, changePassword,
  // 浏览历史
  getBrowseHistory, addBrowseHistory, removeBrowseHistory, clearBrowseHistory,
  // 收藏
  getFavorites, addFavorite, removeFavorite, checkFavorite,
  // 我的发布
  getPublishments, createPublishment, updatePublishment, deletePublishment,
  // 我的下载
  getDownloads,
  // 通知
  getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead,
  // 设置
  getSettings, updateSettings,
  // 反馈
  getFeedbacks, createFeedback
};
