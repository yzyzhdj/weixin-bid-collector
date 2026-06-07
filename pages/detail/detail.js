const api = require('../../utils/api.js');

// 格式化 ISO 日期为 YYYY-MM-DD
function formatDate(dateStr) {
  if (!dateStr) return '';
  // 处理 ISO 8601 格式: 2027-10-17T16:00:00
  const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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
      // 格式化日期字段
      if (data.publishDate) data.publishDateFmt = formatDate(data.publishDate);
      if (data.parentBid && data.parentBid.publishDate) {
        data.parentBid.publishDateFmt = formatDate(data.parentBid.publishDate);
      }
      this.setData({
        detail: data,
        loading: false
      });
    } catch (e) {
      console.error('加载详情失败', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  onCollect() {
    wx.showToast({ title: '收藏功能开发中', icon: 'none' });
  },

  onShare() {
    wx.showToast({ title: '点击右上角分享', icon: 'none' });
  },

  onSubscribe() {
    wx.showToast({ title: '订阅成功', icon: 'success' });
  }
})
