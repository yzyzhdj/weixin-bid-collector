Page({
  data: {
    activeTab: 'keyword',
    statusBarHeight: 20
  },

  onLoad() {
    // 获取状态栏高度（适配刘海屏）
    const app = getApp();
    if (app && app.globalData) {
      this.setData({ statusBarHeight: app.globalData.statusBarHeight || 20 });
    }
  },

  onBack() {
    wx.navigateBack({ delta: 1 });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
  },

  onSubscribe() {
    wx.showToast({ title: '跳转订阅配置', icon: 'none' });
  },

  onAdd() {
    wx.showToast({ title: '添加订阅', icon: 'none' });
  }
})
