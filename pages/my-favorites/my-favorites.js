const user = require('../../utils/user.js');

function relTime(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  const diff = Date.now() - t;
  if (diff < 0) return '刚刚';
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return min + '分钟前';
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + '小时前';
  const day = Math.floor(hr / 24);
  if (day < 30) return day + '天前';
  return new Date(t).toLocaleDateString();
}

Page({
  data: { favorites: [] },

  onShow() {
    this.loadFavorites();
  },

  onPullDownRefresh() {
    this.loadFavorites();
    wx.stopPullDownRefresh();
  },

  loadFavorites() {
    const list = user.getFavorites().map(f => Object.assign({}, f, { timeText: relTime(f.createdAt) }));
    this.setData({ favorites: list });
  },

  onItemTap(e) {
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: '/pages/detail/detail?id=' + id });
  },

  onRemoveTap(e) {
    const id = e.currentTarget.dataset.id;
    const that = this;
    wx.showModal({
      title: '提示',
      content: '确定要取消这条收藏吗？',
      success(res) {
        if (res.confirm) {
          user.removeFavorite(id);
          that.loadFavorites();
          wx.showToast({ title: '已取消', icon: 'success' });
        }
      }
    });
  },

  onClearAll() {
    const that = this;
    wx.showModal({
      title: '清空收藏',
      content: '确定要清空所有收藏吗？此操作不可恢复。',
      success(res) {
        if (res.confirm) {
          wx.setStorageSync(user.STORAGE_KEYS.FAVORITES, []);
          that.loadFavorites();
          wx.showToast({ title: '已清空', icon: 'success' });
        }
      }
    });
  },

  onGoHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
