const api = require('../../utils/api.js');

Page({
  data: {
    topTabs: [
      { name: '招标' },
      { name: '中标' },
      { name: '企业' },
      { name: '前期标识' },
      { name: '采购意向' },
      { name: '拟在建' }
    ],
    currentTopTab: 0,
    bidList: [],
    totalCount: 0,
    loading: false,
    page: 1,
    pageSize: 20,
    keyword: ''
  },

  onLoad(options) {
    if (options.keyword) {
      this.setData({
        keyword: decodeURIComponent(options.keyword)
      });
    }
    this.loadData();
  },

  onPullDownRefresh() {
    this.setData({
      page: 1,
      bidList: []
    });
    this.loadData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    this.loadMore();
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      let data;
      if (this.data.keyword) {
        data = await api.searchBids({
          keyword: this.data.keyword,
          page: this.data.page,
          page_size: this.data.pageSize
        });
      } else {
        data = await api.getBidList({
          page: this.data.page,
          page_size: this.data.pageSize
        });
      }
      this.setData({
        bidList: data.items || [],
        totalCount: data.pagination?.total || 0,
        loading: false
      });
    } catch (e) {
      console.error('加载数据失败', e);
      this.setData({ loading: false });
    }
  },

  async loadMore() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const nextPage = this.data.page + 1;
      let data;
      if (this.data.keyword) {
        data = await api.searchBids({
          keyword: this.data.keyword,
          page: nextPage,
          page_size: this.data.pageSize
        });
      } else {
        data = await api.getBidList({
          page: nextPage,
          page_size: this.data.pageSize
        });
      }
      this.setData({
        bidList: [...this.data.bidList, ...(data.items || [])],
        page: nextPage,
        loading: false
      });
    } catch (e) {
      console.error('加载更多失败', e);
      this.setData({ loading: false });
    }
  },

  switchTopTab(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      currentTopTab: index,
      page: 1,
      bidList: []
    });
    this.loadData();
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    });
  },

  showFilter() {
    wx.showToast({
      title: '筛选功能开发中',
      icon: 'none'
    });
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}-${day}`;
  }
})
