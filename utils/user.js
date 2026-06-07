/**
 * 用户中心 - 本地存储实现
 *
 * 由于后端 /user/* 接口暂未部署，本模块使用 wx.setStorageSync
 * 模拟用户中心全部功能。后端接口可用时，把 fetch/save 调用切换到 api.js 即可。
 *
 * 数据结构与 API_DOC.md 保持一致：
 *   - profile   : 资料对象
 *   - favorites : [{ bidId, remark, createdAt }]
 *   - history   : [{ bidId, bidTitle, browseAt }]
 *   - notifications : [{ id, type, title, content, isRead, createdAt }]
 *   - settings  : { notifyBid, notifyWin, pushSwitch, ... }
 *   - userToken : string
 */

const STORAGE_KEYS = {
  PROFILE: 'userProfile',
  TOKEN: 'userToken',
  FAVORITES: 'userFavorites',
  HISTORY: 'userHistory',
  NOTIFICATIONS: 'userNotifications',
  SETTINGS: 'userSettings',
  LOGIN_INFO: 'userLoginInfo'
};

const DEFAULT_PROFILE = {
  id: 0,
  phone: '',
  nickname: '未登录用户',
  avatar: '',
  gender: 0,           // 0 未知 1 男 2 女
  email: '',
  wechatNumber: '',
  bio: '',
  company: '',
  position: '',
  companyAddress: '',
  companySize: '',
  realName: '',
  isActive: false,
  vipLevel: 0,         // 0 普通 1 VIP
  vipExpireAt: '',
  createdAt: ''
};

const DEFAULT_SETTINGS = {
  notifyBid: true,        // 招标通知
  notifyWin: true,        // 中标通知
  pushSwitch: true,       // 推送总开关
  emailNotify: false,     // 邮件通知
  smsNotify: false,       // 短信通知
  region: '',             // 偏好地区
  language: 'zh-CN'       // 语言
};

function get(key, fallback = null) {
  try {
    const v = wx.getStorageSync(key);
    return v !== '' && v !== null && v !== undefined ? v : fallback;
  } catch (e) {
    return fallback;
  }
}

function set(key, val) {
  try {
    wx.setStorageSync(key, val);
    return true;
  } catch (e) {
    return false;
  }
}

function genId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

function formatNow() {
  return new Date().toISOString();
}

/* ============================================================
   登录态
   ============================================================ */
function isLoggedIn() {
  return !!get(STORAGE_KEYS.TOKEN);
}

function getToken() {
  return get(STORAGE_KEYS.TOKEN, '');
}

function setLogin(token, profile) {
  set(STORAGE_KEYS.TOKEN, token);
  if (profile) {
    set(STORAGE_KEYS.PROFILE, Object.assign({}, DEFAULT_PROFILE, profile));
  }
}

function logout() {
  set(STORAGE_KEYS.TOKEN, '');
}

/* ============================================================
   个人资料
   ============================================================ */
function getProfile() {
  return Object.assign({}, DEFAULT_PROFILE, get(STORAGE_KEYS.PROFILE, {}));
}

function saveProfile(patch) {
  const cur = getProfile();
  const next = Object.assign({}, cur, patch);
  set(STORAGE_KEYS.PROFILE, next);
  return next;
}

/* ============================================================
   收藏
   ============================================================ */
function getFavorites() {
  return get(STORAGE_KEYS.FAVORITES, []);
}

function isFavorite(bidId) {
  return getFavorites().some(f => String(f.bidId) === String(bidId));
}

function addFavorite(bidId, remark = '', extra = {}) {
  const list = getFavorites();
  if (isFavorite(bidId)) return list;
  list.unshift({
    bidId: String(bidId),
    remark,
    createdAt: formatNow(),
    ...extra
  });
  set(STORAGE_KEYS.FAVORITES, list);
  return list;
}

function removeFavorite(bidId) {
  const list = getFavorites().filter(f => String(f.bidId) !== String(bidId));
  set(STORAGE_KEYS.FAVORITES, list);
  return list;
}

function toggleFavorite(bidId, remark, extra) {
  if (isFavorite(bidId)) {
    removeFavorite(bidId);
    return { favorited: false };
  }
  addFavorite(bidId, remark, extra);
  return { favorited: true };
}

function getFavoriteCount() {
  return getFavorites().length;
}

/* ============================================================
   浏览历史
   ============================================================ */
const HISTORY_MAX = 100;

function getHistory() {
  return get(STORAGE_KEYS.HISTORY, []);
}

function addHistory(bid) {
  if (!bid || !bid.id) return getHistory();
  const list = getHistory().filter(h => String(h.bidId) !== String(bid.id));
  list.unshift({
    bidId: String(bid.id),
    bidTitle: bid.title || '',
    bidType: bid.bidType || '',
    province: bid.province || '',
    city: bid.city || '',
    publishDate: bid.publishDate || '',
    browseAt: formatNow()
  });
  // 截断到 HISTORY_MAX 条
  if (list.length > HISTORY_MAX) list.length = HISTORY_MAX;
  set(STORAGE_KEYS.HISTORY, list);
  return list;
}

function removeHistory(bidId) {
  const list = getHistory().filter(h => String(h.bidId) !== String(bidId));
  set(STORAGE_KEYS.HISTORY, list);
  return list;
}

function clearHistory() {
  set(STORAGE_KEYS.HISTORY, []);
  return [];
}

function getHistoryCount() {
  return getHistory().length;
}

/* ============================================================
   消息通知（本地模拟）
   ============================================================ */
function getNotifications() {
  return get(STORAGE_KEYS.NOTIFICATIONS, []);
}

function getUnreadNotifications() {
  return getNotifications().filter(n => !n.isRead);
}

function getUnreadCount() {
  return getUnreadNotifications().length;
}

function addNotification(n) {
  const list = getNotifications();
  list.unshift(Object.assign({
    id: genId(),
    type: 'system',
    title: '',
    content: '',
    link: '',
    isRead: false,
    createdAt: formatNow()
  }, n));
  // 只保留最近 200 条
  if (list.length > 200) list.length = 200;
  set(STORAGE_KEYS.NOTIFICATIONS, list);
  return list;
}

function markRead(id) {
  const list = getNotifications().map(n => {
    if (n.id === id) return Object.assign({}, n, { isRead: true });
    return n;
  });
  set(STORAGE_KEYS.NOTIFICATIONS, list);
  return list;
}

function markAllRead() {
  const list = getNotifications().map(n => Object.assign({}, n, { isRead: true }));
  set(STORAGE_KEYS.NOTIFICATIONS, list);
  return list;
}

/* ============================================================
   用户设置
   ============================================================ */
function getSettings() {
  return Object.assign({}, DEFAULT_SETTINGS, get(STORAGE_KEYS.SETTINGS, {}));
}

function saveSettings(patch) {
  const cur = getSettings();
  const next = Object.assign({}, cur, patch);
  set(STORAGE_KEYS.SETTINGS, next);
  return next;
}

/* ============================================================
   演示数据生成（首次安装时填充）
   ============================================================ */
function seedDemoData() {
  // 仅在收藏/历史/通知都为空时填充
  const favs = getFavorites();
  const history = getHistory();
  const notifs = getNotifications();
  if (favs.length === 0 && history.length === 0 && notifs.length === 0) {
    // 演示通知
    addNotification({
      type: 'system',
      title: '欢迎使用标讯管家',
      content: '感谢您使用标讯管家！您可以收藏感兴趣的招标，及时关注最新动态。'
    });
    addNotification({
      type: 'bid',
      title: '新订阅匹配提醒',
      content: '您订阅的关键词"北京·工程"有 3 条新发布的招标信息'
    });
    addNotification({
      type: 'message',
      title: '系统升级通知',
      content: '标讯管家 v1.1.0 已发布，新增收藏和历史功能'
    });
  }
}

module.exports = {
  STORAGE_KEYS,
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS,
  isLoggedIn, getToken, setLogin, logout,
  getProfile, saveProfile,
  getFavorites, isFavorite, addFavorite, removeFavorite, toggleFavorite, getFavoriteCount,
  getHistory, addHistory, removeHistory, clearHistory, getHistoryCount,
  getNotifications, getUnreadNotifications, getUnreadCount,
  addNotification, markRead, markAllRead,
  getSettings, saveSettings,
  seedDemoData
};
