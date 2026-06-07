Page({
  data: {
    statusBarHeight: 20
  },

  onLoad() {
    // 获取状态栏高度（适配刘海屏）
    const app = getApp();
    if (app && app.globalData) {
      this.setData({ statusBarHeight: app.globalData.statusBarHeight || 20 });
    }
  },

  onSettingsTap() {
    wx.showToast({ title: '设置', icon: 'none' });
  },

  onOpenVip() {
    wx.navigateTo({ url: '/pages/more/more' });
  },

  onActionTap(e) {
    const type = e.currentTarget.dataset.type;
    const map = {
      subscription: '我的订阅',
      favorite: '我的收藏',
      custom: '信息定制'
    };
    wx.showToast({ title: map[type] || '功能开发中', icon: 'none' });
  },

  onMenuTap(e) {
    const type = e.currentTarget.dataset.type;
    if (type === 'buy') {
      wx.navigateTo({ url: '/pages/more/more' });
    } else if (type === 'service') {
      wx.makePhoneCall({ phoneNumber: '19156012821' });
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
