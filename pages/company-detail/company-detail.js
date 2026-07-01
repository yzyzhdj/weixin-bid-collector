// pages/company-detail/company-detail.js
const userApi = require('../../utils/user-api.js');

Page({
  data: {
    name: '',
    bids: [],
    page: 1,
    pageSize: 20,
    loading: true,
    loadingMore: false,
    finished: false,
    total: 0
  },

  onLoad(options) {
    const name = decodeURIComponent(options.name || '');
    this.setData({ name });
    if (name) {
      this.loadBids(true);
    } else {
      this.setData({ loading: false });
    }
  },

  onReachBottom() {
    if (this.data.finished || this.data.loading || this.data.loadingMore) return;
    this.loadBids(false);
  },

  async loadBids(reset) {
    if (this.data.loadingMore) return;
    const page = reset ? 1 : this.data.page;
    this.setData({
      loading: reset,
      loadingMore: !reset
    });

    try {
      const data = await userApi.getWinnerBids(this.data.name, {
        page,
        page_size: this.data.pageSize
      });
      const rawItems = data.items || [];
      console.log('[company-detail] 返回', rawItems.length, '条, 总计', data.total);

      const items = rawItems.map(item => ({
        id: item.id,
        title: item.title || '未知标讯',
        publishDate: item.publishDate || item.publish_date || '',
        budget: item.budget || '',
        buyer: item.buyer || '未提供'
      }));

      const list = reset ? items : this.data.bids.concat(items);
      const total = data.total || 0;
      const finished = list.length >= total || rawItems.length < this.data.pageSize;

      this.setData({
        bids: list,
        page: page + 1,
        total,
        loading: false,
        loadingMore: false,
        finished
      });
    } catch (e) {
      console.error('[company-detail] 加载失败', e);
      this.setData({ loading: false, loadingMore: false, finished: true });
    }
  },

  onBidTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  }
});
