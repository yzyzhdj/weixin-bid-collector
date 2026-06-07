const api = require('../../utils/api.js');

// 格式化当前日期
function formatDate() {
  const now = new Date();
  return `${now.getMonth() + 1}月${now.getDate()}日更新`;
}

Page({
  data: {
    activeType: 'bid',
    searchText: '',
    searchPlaceholder: '请输入产品、行业或项目名称',
    statusBarHeight: 20,
    hotTags: ['雪亮', '钢结构', '摄像', '防火墙', '安防系'],
    functionList: [
      { name: '招标查询', type: 'bid_query', color: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)', icon: '/images/icon-bid-query.svg' },
      { name: '中标查询', type: 'win_query', color: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)', icon: '/images/icon-win-query.svg' },
      { name: '采购意向', type: 'purchase', color: 'linear-gradient(135deg, #a855f7 0%, #c084fc 100%)', icon: '/images/icon-purchase.svg' },
      { name: '拟在建查询', type: 'plan_build', color: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)', icon: '/images/icon-plan-build.svg' },
      { name: '供应商库', type: 'supplier', color: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)', icon: '/images/icon-supplier.svg' }
    ],
    stats: {
      date: '加载中...',
      columns: [
        { name: '全部订阅' },
        { name: '交易公告' },
        { name: '交易结果' },
        { name: '中标公告' }
      ],
      today: [0, 0, 0, 0],
      total: [0, 0, 0, 0]
    },
    loading: false
  },

  onLoad() {
    this.loadStats();
  },

  onShow() {
    this.loadStats();
  },

  async loadStats() {
    try {
      const data = await api.getStats();

      // 解析 byType 为字典
      const typeMap = {};
      (data.byType || []).forEach(t => {
        typeMap[t.name] = t.cnt;
      });

      // 计算各类型数量
      const totalAll = data.total || 0;
      const totalTrading = typeMap['交易公告'] || 0;
      const totalResult = typeMap['交易结果'] || 0;
      const totalWinner = typeMap['中标公告'] || 0;

      // 今日数据（API 当前 today 为 0，使用 1/30 估算）
      const totalToday = data.today || 0;
      const todayTrading = Math.round(totalTrading * (totalToday / Math.max(totalAll, 1)));
      const todayResult = Math.round(totalResult * (totalToday / Math.max(totalAll, 1)));
      const todayWinner = Math.round(totalWinner * (totalToday / Math.max(totalAll, 1)));

      this.setData({
        'stats.date': formatDate(),
        'stats.today': [totalToday, todayTrading, todayResult, todayWinner],
        'stats.total': [totalAll, totalTrading, totalResult, totalWinner]
      });
    } catch (e) {
      console.error('加载统计数据失败', e);
      this.setData({ 'stats.date': '加载失败' });
    }
  },

  switchType(e) {
    const type = e.currentTarget.dataset.type;
    if (type === this.data.activeType) return;
    this.setData({
      activeType: type,
      searchText: '',
      searchPlaceholder: type === 'bid' ? '请输入产品、行业或项目名称' : '输入业务关键词或企业名称'
    });
  },

  onInput(e) {
    this.setData({ searchText: e.detail.value });
  },

  async onSearch() {
    const keyword = this.data.searchText.trim();
    if (!keyword) {
      wx.showToast({ title: '请输入关键词', icon: 'none' });
      return;
    }
    if (this.data.activeType === 'company') {
      wx.showToast({ title: '企业搜索功能开发中', icon: 'none' });
      return;
    }
    // 跳转到搜索结果页
    wx.navigateTo({
      url: `/pages/search/search?keyword=${encodeURIComponent(keyword)}`
    });
  },

  onTagClick(e) {
    const keyword = e.currentTarget.dataset.keyword;
    this.setData({ searchText: keyword });
  },

  onRefreshTags() {
    const allTags = ['雪亮', '钢结构', '摄像', '防火墙', '安防系', '智慧城市', '监控系统', '智能楼宇', '数据中心', '网络安全'];
    const shuffled = allTags.sort(() => Math.random() - 0.5).slice(0, 5);
    this.setData({ hotTags: shuffled });
  },

  onFunctionClick(e) {
    const type = e.currentTarget.dataset.type;
    const map = {
      bid_query: '招标查询',
      win_query: '中标查询',
      purchase: '采购意向',
      plan_build: '拟在建查询',
      supplier: '供应商库'
    };
    if (type === 'bid_query') {
      wx.switchTab({ url: '/pages/index/index' });
      return;
    }
    if (type === 'win_query') {
      wx.switchTab({ url: '/pages/index/index' });
      return;
    }
    wx.showToast({ title: map[type] || '功能开发中', icon: 'none' });
  },

  onPromoTap() {
    wx.showToast({ title: '找展会', icon: 'none' });
  },

  onMoreStats() {
    wx.showToast({ title: '查看更多统计', icon: 'none' });
  }
})
