Page({
  data: {
    statusBarHeight: 20,
    settingsBtnTop: 0,
    isLoggedIn: false  // 未登录状态
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

  // 点击登录
  onLoginTap() {
    wx.showToast({ title: '登录功能开发中', icon: 'none' });
    // TODO: 接入微信登录
    // wx.login({ success: (res) => { ... } });
  },

  // 设置
  onSettingsTap() {
    wx.showToast({ title: '设置', icon: 'none' });
  },

  // 开通 VIP
  onOpenVip() {
    wx.navigateTo({ url: '/pages/more/more' });
  },

  // 快捷功能
  onActionTap(e) {
    const type = e.currentTarget.dataset.type;
    const map = {
      subscription: '我的订阅',
      favorite: '我的收藏',
      custom: '信息定制'
    };
    wx.showToast({ title: map[type] || '功能开发中', icon: 'none' });
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
    } else {
      const map = {
        orders: '购买记录',
        cooperation: '渠道合作',
        feedback: '意见反馈'
      };
      wx.showToast({ title: map[type] || '功能开发中', icon: 'none' });
    }
  }
})
