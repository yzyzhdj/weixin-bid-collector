// 用户中心 API
const userApi = require('../../utils/user-api.js');

Page({
  data: {
    statusBarHeight: 20,
    settingsBtnTop: 0,
    isLoggedIn: false,
    userInfo: null,        // { id, phone, nickname, avatar, isVip, vipExpireAt, ... }
    unreadCount: 0,        // 未读消息数
    loading: false
  },

  onLoad() {
    // 获取状态栏高度 + 微信胶囊位置（适配刘海屏）
    const app = getApp();
    if (app && app.globalData) {
      const statusBarHeight = app.globalData.statusBarHeight || 20;
      const menuButton = app.globalData.menuButton;

      // 设置按钮 top = 胶囊底部 + 间距（避免和微信胶囊按钮重合）
      let settingsBtnTop = statusBarHeight + 40;
      if (menuButton && menuButton.height) {
        settingsBtnTop = menuButton.top + menuButton.height + 8;
      }

      this.setData({
        statusBarHeight,
        settingsBtnTop
      });
    }
  },

  onShow() {
    // 每次进入页面都刷新登录态
    this.checkLogin();
    if (userApi.getToken()) {
      this.loadProfile();
      this.loadUnreadCount();
    }
  },

  // 检查登录态
  checkLogin() {
    const token = userApi.getToken();
    const userInfo = userApi.getUserInfo();
    this.setData({
      isLoggedIn: !!token,
      userInfo: userInfo || null
    });
  },

  // 加载个人资料
  loadProfile() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    userApi.getProfile().then((profile) => {
      this.setData({
        userInfo: Object.assign({}, this.data.userInfo, profile),
        loading: false
      });
      // 同步到 storage
      userApi.setUserInfo(Object.assign({}, this.data.userInfo, profile));
      const app = getApp();
      if (app && app.globalData) {
        app.globalData.userInfo = this.data.userInfo;
      }
    }).catch((err) => {
      this.setData({ loading: false });
      console.error('[profile] 加载个人资料失败:', err);
      // 401 时 userApi 已自动清除登录态
      if (err && err.code === 401) {
        this.setData({ isLoggedIn: false, userInfo: null });
      }
    });
  },

  // 加载未读消息数
  loadUnreadCount() {
    userApi.getUnreadCount().then((count) => {
      const n = typeof count === 'number' ? count : (count && count.count) || 0;
      this.setData({ unreadCount: n });
    }).catch((err) => {
      console.error('[profile] 加载未读数失败:', err);
    });
  },

  // 点击登录
  onLoginTap() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  // 退出登录
  onLogoutTap() {
    if (!this.data.isLoggedIn) return;
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          userApi.logout().then(() => {
            this.setData({ isLoggedIn: false, userInfo: null, unreadCount: 0 });
            wx.showToast({ title: '已退出登录', icon: 'success' });
          }).catch(() => {
            // 即使后端失败也清本地
            userApi.clearAuth();
            this.setData({ isLoggedIn: false, userInfo: null, unreadCount: 0 });
          });
        }
      }
    });
  },

  // 设置
  onSettingsTap() {
    wx.navigateTo({ url: '/pages/settings/settings' });
  },

  // 消息
  onMessageTap() {
    wx.navigateTo({ url: '/pages/notifications/notifications' });
  },

  // 头像 - 暂时没编辑头像功能
  onAvatarTap() {
    // wx.showToast({ title: '暂不支持修改头像', icon: 'none' });
  },

  // 开通 VIP
  onOpenVip() {
    wx.navigateTo({ url: '/pages/more/more' });
  },

  // 快捷功能
  onActionTap(e) {
    const type = e.currentTarget.dataset.type;
    if (!this.data.isLoggedIn) {
      this.onLoginTap();
      return;
    }
    const map = {
      subscription: '/pages/subscriptions/subscriptions',
      favorite: '/pages/favorites/favorites',
      history: '/pages/history/history',
      monitor: '/pages/monitors/monitors',
      custom: '/pages/custom/custom',
      notification: '/pages/notifications/notifications'
    };
    if (map[type]) {
      wx.navigateTo({ url: map[type] });
    } else {
      wx.showToast({ title: '功能开发中', icon: 'none' });
    }
  },

  // 菜单
  onMenuTap(e) {
    const type = e.currentTarget.dataset.type;
    if (type === 'buy') {
      wx.navigateTo({ url: '/pages/more/more' });
    } else if (type === 'service') {
      wx.makePhoneCall({ phoneNumber: '19156012821', fail: () => {
        wx.showToast({ title: '客服热线：19156012821', icon: 'none' });
      }});
    } else if (type === 'orders') {
      wx.navigateTo({ url: '/pages/orders/orders' });
    } else if (type === 'cooperation') {
      wx.navigateTo({ url: '/pages/cooperation/cooperation' });
    } else if (type === 'feedback') {
      wx.navigateTo({ url: '/pages/feedback/feedback' });
    } else {
      wx.showToast({ title: '功能开发中', icon: 'none' });
    }
  }
})
