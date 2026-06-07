const api = require('../../utils/api.js');
const user = require('../../utils/user.js');

// 格式化 ISO 日期为 YYYY-MM-DD
function formatDate(dateStr) {
  if (!dateStr) return '';
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
    loading: true,
    isFavorited: false
  },

  onLoad(options) {
    if (options.id) {
      this.bidId = options.id;
      this.loadDetail(options.id);
    }
  },

  onShow() {
    // 每次显示页面时检查收藏状态
    if (this.data.detail) {
      this.setData({ isFavorited: user.isFavorite(this.data.detail.id) });
    }
  },

  async loadDetail(id) {
    this.setData({ loading: true });
    try {
      const data = await api.getBidDetail(id);
      if (data.publishDate) data.publishDateFmt = formatDate(data.publishDate);
      if (data.parentBid && data.parentBid.publishDate) {
        data.parentBid.publishDateFmt = formatDate(data.parentBid.publishDate);
      }

      // 自动记录浏览历史
      user.addHistory({
        id: data.id,
        title: data.title,
        bidType: data.bidType,
        province: data.province,
        city: data.city,
        publishDate: data.publishDate
      });

      this.setData({
        detail: data,
        loading: false,
        isFavorited: user.isFavorite(data.id)
      });
    } catch (e) {
      console.error('加载详情失败', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  onCollect() {
    if (!this.data.detail) return;
    const detail = this.data.detail;
    const result = user.toggleFavorite(detail.id, '', {
      title: detail.title,
      bidType: detail.bidType,
      province: detail.province,
      city: detail.city,
      publishDate: detail.publishDate
    });

    this.setData({ isFavorited: result.favorited });

    wx.showToast({
      title: result.favorited ? '已收藏' : '已取消收藏',
      icon: 'success',
      duration: 1200
    });
  },

  onShare() {
    wx.showToast({ title: '点击右上角分享', icon: 'none' });
  },

  onSubscribe() {
    wx.showToast({ title: '订阅成功', icon: 'success' });
  },

  // 分享给好友
  onShareAppMessage() {
    if (!this.data.detail) return {};
    return {
      title: this.data.detail.title,
      path: '/pages/detail/detail?id=' + this.data.detail.id
    };
  }
})
