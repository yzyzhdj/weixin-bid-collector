Page({
  data: {
    memberType: 'personal',
    selectedPlan: 0,
    plans: [
      { name: '全国12个月', price: 699, original: 2388, save: 1689 },
      { name: '全国24个月', price: 999, original: 4776, save: 3777 },
      { name: '全国36个月', price: 1299, original: 6076, save: 4776 }
    ],
    benefits: [
      { name: '招标信息查询', emoji: '📄' },
      { name: '中标信息查询', emoji: '🎯' },
      { name: '采购信息查询', emoji: '📑' },
      { name: '招标阶段追踪', emoji: '📍' },
      { name: '招标文件下载', emoji: '☁️' },
      { name: '资深客服服务', emoji: '🎧' },
      { name: '企业工商信息', emoji: '🆔' },
      { name: '企业资质证书', emoji: '📜' },
      { name: '企业从业人员', emoji: '👤' }
    ]
  },

  onLoad() {
    // 获取状态栏高度（适配刘海屏）
    const app = getApp();
    if (app && app.globalData) {
      this.setData({ statusBarHeight: app.globalData.statusBarHeight || 20 });
    }
  },

  onBack() {
    wx.navigateBack();
  },

  switchMemberType(e) {
    this.setData({ memberType: e.currentTarget.dataset.type });
  },

  selectPlan(e) {
    this.setData({ selectedPlan: e.currentTarget.dataset.index });
  },

  onPay() {
    const plan = this.data.plans[this.data.selectedPlan];
    wx.showModal({
      title: '确认支付',
      content: `您选择了${plan.name}，需支付¥${plan.price}`,
      success: (res) => {
        if (res.confirm) {
          wx.showToast({ title: '支付功能开发中', icon: 'none' });
        }
      }
    });
  }
})
