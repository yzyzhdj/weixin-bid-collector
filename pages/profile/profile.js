const user = require('../../utils/user.js');

function formatRelativeTime(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  const diff = Date.now() - t;
  if (diff < 0) return '刚刚';
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return '刚刚';
  const min = Math.floor(sec / 60);
  if (min < 60) return min + '分钟前';
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + '小时前';
  const day = Math.floor(hr / 24);
  if (day < 30) return day + '天前';
  const mon = Math.floor(day / 30);
  if (mon < 12) return mon + '个月前';
  return Math.floor(mon / 12) + '年前';
}

Page({
  data: {
    statusBarHeight: 20,
    settingsBtnTop: 0,
    user: user.DEFAULT_PROFILE,
    isLoggedIn: false,
    stats: { favoriteCount: 0, historyCount: 0, unreadCount: 0 },
    latestNotification: null
  },

  onLoad() {
    const app = getApp();
    if (app && app.globalData) {
      const statusBarHeight = app.globalData.statusBarHeight || 20;
      const menuButton = app.globalData.menuButton;
      let settingsBtnTop = statusBarHeight + 40;
      if (menuButton && menuButton.height) {
        settingsBtnTop = menuButton.top + menuButton.height + 8;
      }
      this.setData({ statusBarHeight, settingsBtnTop });
    }
  },

  onShow() {
    // 每次显示页面都刷新用户数据
    this.refreshUserData();
  },

  refreshUserData() {
    // 首次安装时填充演示数据
    user.seedDemoData();

    const profile = user.getProfile();
    const isLoggedIn = user.isLoggedIn();
    const favoriteCount = user.getFavoriteCount();
    const historyCount = user.getHistoryCount();
    const unreadCount = user.getUnreadCount();

    // 最新通知
    const notifs = user.getNotifications();
    let latest = null;
    if (notifs.length > 0) {
      const n = notifs[0];
      latest = {
        id: n.id,
        title: n.title,
        content: n.content || n.title,
        timeText: formatRelativeTime(n.createdAt)
      };
    }

    this.setData({
      user: profile,
      isLoggedIn,
      stats: { favoriteCount, historyCount, unreadCount },
      latestNotification: latest
    });
  },

  /* ============================================================
     交互事件
     ============================================================ */
  onUserTap() {
    // 未登录时引导去登录（这里复用 more 页的会员中心作为登录入口）
    if (!this.data.isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '当前为游客模式，数据保存在本设备。登录后可同步到云端。',
        confirmText: '我知道了',
        showCancel: false
      });
    } else {
      wx.showToast({ title: '编辑资料功能开发中', icon: 'none' });
    }
  },

  onSettingsTap() {
    wx.showToast({ title: '设置功能开发中', icon: 'none' });
  },

  onOpenVip() {
    wx.navigateTo({ url: '/pages/more/more' });
  },

  onNoticeTap() {
    wx.navigateTo({ url: '/pages/notifications/notifications' });
  },

  onActionTap(e) {
    const type = e.currentTarget.dataset.type;
    switch (type) {
      case 'subscription':
        wx.switchTab({ url: '/pages/subscribe/subscribe' });
        break;
      case 'favorite':
        wx.navigateTo({ url: '/pages/my-favorites/my-favorites' });
        break;
      case 'history':
        wx.navigateTo({ url: '/pages/my-history/my-history' });
        break;
      case 'custom':
        wx.navigateTo({ url: '/pages/my-custom/my-custom' });
        break;
    }
  },

  onMenuTap(e) {
    const type = e.currentTarget.dataset.type;
    const map = {
      orders: { title: '购买记录开发中' },
      service: { title: '客服微信：19156012821' },
      cooperation: { title: '渠道合作开发中' },
      feedback: { url: '/pages/feedback/feedback', title: '意见反馈' }
    };
    const item = map[type];
    if (!item) return;
    if (item.url) {
      wx.navigateTo({ url: item.url });
    } else {
      wx.showToast({ title: item.title, icon: 'none' });
    }
  }
});
