const api = require('../../utils/api.js');

Page({
  data: {
    detail: null,
    loading: true
  },

  onLoad(options) {
    if (options.id) {
      this.loadDetail(options.id);
    }
  },

  async loadDetail(id) {
    this.setData({ loading: true });
    try {
      const data = await api.getBidDetail(id);
      this.setData({
        detail: data,
        loading: false
      });
    } catch (e) {
      console.error('加载详情失败', e);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
})
