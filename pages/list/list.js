Page({
  data: {
    statusBarHeight: 20,
    templateItems: [
      { name: '标书模版', type: 'template', icon: '/images/icon-template-w.svg', color: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)' },
      { name: '标书代写', type: 'write', icon: '/images/icon-write-w.svg', color: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)' }
    ],
    businessItems: [
      { name: '附近项目', type: 'nearby', icon: '/images/icon-nearby-w.svg', color: 'linear-gradient(135deg, #14b8a6 0%, #2dd4bf 100%)' },
      { name: '供求市场', type: 'market', icon: '/images/icon-market-w.svg', color: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)' },
      { name: '行业展会', type: 'exhibition', icon: '/images/icon-exhibition-w.svg', color: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)', badge: '热' },
      { name: 'AI推荐', type: 'ai', icon: '/images/icon-ai-w.svg', color: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)', badge: '新' }
    ],
    dataItems: [
      { name: '投标风险评估', type: 'risk', icon: '/images/icon-risk-w.svg', color: 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)' },
      { name: '投标信用报告', type: 'credit', icon: '/images/icon-credit-w.svg', color: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)', badge: '查' },
      { name: '中标动态', type: 'dynamic', icon: '/images/icon-dynamic-w.svg', color: 'linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%)' },
      { name: '政府采购中心', type: 'government', icon: '/images/icon-government-w.svg', color: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)' },
      { name: '工程交易中心', type: 'engineering', icon: '/images/icon-engineering-w.svg', color: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)' }
    ]
  },

  onLoad() {},

  onItemTap(e) {
    const type = e.currentTarget.dataset.type;
    const nameMap = {
      template: '标书模版',
      write: '标书代写',
      nearby: '附近项目',
      market: '供求市场',
      exhibition: '行业展会',
      ai: 'AI推荐',
      risk: '投标风险评估',
      credit: '投标信用报告',
      dynamic: '中标动态',
      government: '政府采购中心',
      engineering: '工程交易中心'
    };
    wx.showToast({ title: nameMap[type] || '功能开发中', icon: 'none' });
  }
})
