Page({
  data: {
    statusBarHeight: 20,
    templateItems: [
      { name: '标书模版', type: 'template', icon: '/images/icon-template.svg', bgClass: 'bg-orange-diamond' },
      { name: '标书代写', type: 'write', icon: '/images/icon-write.svg', bgClass: 'bg-blue-doc' }
    ],
    businessItems: [
      { name: '附近项目', type: 'nearby', icon: '/images/icon-nearby.svg', bgClass: 'bg-orange-pin' },
      { name: '供求市场', type: 'market', icon: '/images/icon-market.svg', bgClass: 'bg-blue-case' },
      { name: '行业展会', type: 'exhibition', icon: '/images/icon-exhibition.svg', bgClass: 'bg-blue-exhibition', badge: '展合', badgeClass: 'badge-red' },
      { name: 'AI推荐', type: 'ai', icon: '/images/icon-ai.svg', bgClass: 'bg-orange-ai' }
    ],
    dataItems: [
      { name: '投标风险评估', type: 'risk', icon: '/images/icon-risk.svg', bgClass: 'bg-red-shield' },
      { name: '投标信用报告', type: 'credit', icon: '/images/icon-credit.svg', bgClass: 'bg-blue-credit', badge: '芝麻信用', badgeClass: 'badge-orange' },
      { name: '中标动态', type: 'dynamic', icon: '/images/icon-dynamic.svg', bgClass: 'bg-red-dynamic' },
      { name: '政府采购中心', type: 'government', icon: '/images/icon-government.svg', bgClass: 'bg-blue-gov' },
      { name: '工程交易中心', type: 'engineering', icon: '/images/icon-engineering.svg', bgClass: 'bg-green-eng' }
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
