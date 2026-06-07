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
  data: { notifications: [], unreadCount: 0 },
  onShow() { this.load(); },
  onPullDownRefresh() { this.load(); wx.stopPullDownRefresh(); },

  load() {
    const list = user.getNotifications().map(n =>
      Object.assign({}, n, { timeText: relTime(n.createdAt) })
    );
    this.setData({
      notifications: list,
      unreadCount: list.filter(n => !n.isRead).length
    });
  },

  onItemTap(e) {
    const id = e.currentTarget.dataset.id;
    user.markRead(id);
    this.load();
  },

  onMarkAll() {
    user.markAllRead();
    this.load();
    wx.showToast({ title: '已全部标记已读', icon: 'success' });
  }
});
