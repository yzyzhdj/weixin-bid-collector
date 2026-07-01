// 签到规则页面
Page({
  data: {
    // 连续签到奖励配置（与首页弹窗保持一致）
    rewardList: [
      { day: '第1天', points: 15 },
      { day: '第2天', points: 20 },
      { day: '第3天', points: 25 },
      { day: '第4天', points: 30 },
      { day: '第5天', points: 40 },
      { day: '第6天', points: 50 },
      { day: '第7天', points: 120 }
    ]
  },

  onLoad() {
    // 静态页面，无需加载数据
  }
})
