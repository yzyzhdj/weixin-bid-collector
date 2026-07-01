// 用户中心 API
const userApi = require('../../utils/user-api.js');

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

  onMarkAllRead() {
    userApi.markAllNotificationsRead().then(() => {
      wx.showToast({ title: '已全部已读', icon: 'success' });
      this.refresh();
    });
  },

  refresh() {
    this.setData({ page: 1, list: [], hasMore: true, loading: true });
    this.loadList();
  },

  loadList() {
    if (!this.data.hasMore) return;
    this.setData({ loading: true });

    userApi.getNotifications(this.data.page, this.data.pageSize).then((res) => {
      const items = (res && (res.items || res.list || res.records)) || [];
      const total = (res && (res.total || res.pagination && res.pagination.total)) || 0;
      const mapped = items.map(it => this.mapItem(it));

      this.setData({
        list: this.data.page === 1 ? mapped : this.data.list.concat(mapped),
        loading: false,
        hasMore: this.data.list.length + mapped.length < total,
        emptyText: mapped.length === 0 && this.data.page === 1 ? '暂无消息' : ''
      });
    }).catch((err) => {
      console.error('[notifications] 加载失败:', err);
      this.setData({ loading: false, emptyText: '加载失败，请下拉重试' });
    });
  },

  mapItem(it) {
    const type = it.type || 'system';
    // 判断是否为积分变动类消息
    const isPointType = type === 'points' || type === 'point_change' || type === 'point'
      || (type === 'view_bid') || (type === 'sign') || (type === 'recharge')
      || (type === 'admin_adjust') || (type === 'admin_deduct');
    // 积分变动金额（正数为增加，负数为消耗）
    const amount = it.amount !== undefined ? it.amount
      : (it.points !== undefined ? it.points : null);
    // 跳转目标：bid → 详情页；points → 积分页
    let linkType = it.linkType || it.link_type || '';
    let linkId = it.linkId || it.link_id || it.relatedId || it.related_id || '';
    if (!linkType) {
      if (isPointType) {
        linkType = 'points';
      } else if (linkId || it.bidId || it.bid_id) {
        linkType = 'bid';
        linkId = linkId || it.bidId || it.bid_id;
      }
    }
    return {
      id: it.id,
      title: it.title || it.subject || '系统消息',
      content: it.content || it.body || '',
      type: type,
      isPoint: isPointType,
      amount: amount,
      isIncome: amount !== null && amount > 0,
      linkType: linkType,
      linkId: linkId,
      isRead: it.isRead || it.is_read || it.read || false,
      time: formatRelativeTime(it.createdAt || it.createTime || it.create_time || it.time)
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
    const { id, index } = e.currentTarget.dataset;
    const item = this.data.list[index];
    if (!item) return;
    if (!item.isRead) {
      // 标记已读
      userApi.markNotificationRead(id).then(() => {
        const key = 'list[' + index + '].isRead';
        this.setData({ [key]: true });
      });
    }
    // 根据链接类型跳转
    if (item.linkType === 'points') {
      // 积分变动消息 → 跳转积分明细页
      wx.navigateTo({ url: '/pages/points/points' });
    } else if (item.linkType === 'bid' && item.linkId) {
      // 标讯相关消息 → 跳转详情页
      wx.navigateTo({ url: '/pages/detail/detail?id=' + item.linkId });
    }
  }
})
