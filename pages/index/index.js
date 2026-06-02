const api = require('../../utils/api.js');

Page({
  data: {
    searchText: '',
    hotTags: ['热搜', '环保', '钢结构', '摄像', '安防系统', '公路'],
    functionList: [
      { name: '招标查询', type: 'bids', color: '#dbeafe', icon: '/images/func-bids.png' },
      { name: '中标查询', type: 'win', color: '#fef3c7', icon: '/images/func-win.png' },
      { name: '采购意向', type: 'intention', color: '#e0e7ff', icon: '/images/func-intention.png' },
      { name: '拟建查询', type: 'plan', color: '#dbeafe', icon: '/images/func-plan.png' },
      { name: '供应商库', type: 'suppliers', color: '#dcfce7', icon: '/images/func-suppliers.png' }
    ],
    statTabs: [
      { name: '全国' },
      { name: '全部订阅' },
      { name: 'APP' },
      { name: '网站' },
      { name: '软件开发' }
    ],
    currentStatTab: 0,
    stats: {},
    statsDate: ''
  },

  onLoad() {
    this.loadStats();
    this.setStatsDate();
  },

  setStatsDate() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    this.setData({
      statsDate: `${month}月${day}日`
    });
  },

  async loadStats() {
    try {
      const data = await api.getStats();
      this.setData({
        stats: data
      });
    } catch (e) {
      console.error('加载统计数据失败', e);
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    wx.showToast({
      title: `切换到${tab === 'bids' ? '查标识' : '查企业'}`,
      icon: 'none'
    });
  },

  onInput(e) {
    this.setData({
      searchText: e.detail.value
    });
  },

  onSearch() {
    if (!this.data.searchText.trim()) {
      return;
    }
    wx.navigateTo({
      url: `/pages/list/list?keyword=${encodeURIComponent(this.data.searchText)}`
    });
  },

  onTagClick(e) {
    const keyword = e.currentTarget.dataset.keyword;
    wx.navigateTo({
      url: `/pages/list/list?keyword=${encodeURIComponent(keyword)}`
    });
  },

  onFunctionClick(e) {
    const type = e.currentTarget.dataset.type;
    if (type === 'bids') {
      wx.navigateTo({
        url: '/pages/list/list'
      });
    } else {
      wx.showToast({
        title: '功能开发中',
        icon: 'none'
      });
    }
  },

  switchStatTab(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      currentStatTab: index
    });
  }
})
