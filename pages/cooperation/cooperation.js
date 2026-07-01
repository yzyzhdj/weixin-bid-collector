// pages/cooperation/cooperation.js
Page({
  data: {
    statusBarHeight: 20
  },

  onLoad() {
    const app = getApp();
    if (app && app.globalData) {
      this.setData({ statusBarHeight: app.globalData.statusBarHeight || 20 });
    }
  },

  onBackTap() {
    wx.navigateBack({ delta: 1, fail: () => {
      wx.switchTab({ url: '/pages/profile/profile' });
    }});
  },

  // 我要代理 - 显示表单/联系信息
  onApplyTap() {
    wx.showModal({
      title: '渠道代理申请',
      content: '申请渠道代理请添加商务微信 sunbidinfo 或致电 400-0931-030',
      confirmText: '复制微信',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          wx.setClipboardData({
            data: 'sunbidinfo',
            success: () => wx.showToast({ title: '微信号已复制', icon: 'success' })
          });
        }
      }
    });
  }
})
