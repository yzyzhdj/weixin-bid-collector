// 用户中心 API
const userApi = require('../../utils/user-api.js');
// 标讯数据 API
const api = require('../../utils/api.js');

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
  if (diff < 86400 * 7) return Math.floor(diff / 86400) + '天前';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

Page({
  data: {
    statusBarHeight: 20,
    list: [],
    loading: true,
    page: 1,
    pageSize: 20,
    hasMore: true,
    emptyText: ''
  },

  onLoad() {
    const app = getApp();
    if (app && app.globalData) {
      this.setData({ statusBarHeight: app.globalData.statusBarHeight || 20 });
    }
  },

  onShow() {
    this.refresh();
  },

  onBackTap() {
    wx.navigateBack({ delta: 1, fail: () => {
      wx.switchTab({ url: '/pages/profile/profile' });
    }});
  },

  refresh() {
    this.setData({ page: 1, list: [], hasMore: true, loading: true });
    this.loadList();
  },

  loadList() {
    if (!this.data.hasMore) return;
    this.setData({ loading: true });

    userApi.getFavorites(this.data.page, this.data.pageSize).then((res) => {
      const items = (res && (res.items || res.list || res.records)) || [];
      const total = (res && (res.total || res.pagination && res.pagination.total)) || 0;
      const mapped = items.map(it => this.mapItem(it));

      this.setData({
        list: this.data.page === 1 ? mapped : this.data.list.concat(mapped),
        loading: false,
        hasMore: this.data.list.length + mapped.length < total,
        emptyText: mapped.length === 0 && this.data.page === 1 ? '暂无收藏' : ''
      });
    }).catch((err) => {
      console.error('[favorites] 加载失败:', err);
      this.setData({ loading: false, emptyText: '加载失败，请下拉重试' });
    });
  },

  // 兼容多种后端返回结构：直接是 bid 详情 或 { bid: {...}, remark, ... }
  mapItem(raw) {
    const it = raw.bid || raw.bidInfo || raw;
    return {
      id: it.id || raw.bidId,
      title: api.cleanTitle(it.title || raw.title || '未命名'),
      company: it.buyer || it.agent || '未提供',
      region: it.province || '',
      city: it.city || '',
      tag: it.bidType || '',
      time: formatRelativeTime(it.publishDate || it.publish_date || raw.createTime),
      remark: raw.remark || ''
    };
  },

  onReachBottom() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ page: this.data.page + 1 });
    this.loadList();
  },

  onPullDownRefresh() {
    this.refresh();
    setTimeout(() => wx.stopPullDownRefresh(), 800);
  },

  onItemTap(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id });
  },

  // 取消收藏（长按或点击右上角删除）
  onRemoveTap(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.showModal({
      title: '提示',
      content: '确定要取消收藏吗？',
      success: (res) => {
        if (res.confirm) {
          userApi.removeFavorite(id).then(() => {
            wx.showToast({ title: '已取消收藏', icon: 'success' });
            this.refresh();
          });
        }
      }
    });
  },

  onItemLongPress(e) {
    this.onRemoveTap(e);
  }
})
