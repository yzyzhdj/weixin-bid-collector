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

  onClearAll() {
    if (this.data.list.length === 0) return;
    wx.showModal({
      title: '提示',
      content: '确定要清空所有浏览记录吗？',
      success: (res) => {
        if (res.confirm) {
          userApi.clearBrowseHistory().then(() => {
            wx.showToast({ title: '已清空', icon: 'success' });
            this.refresh();
          });
        }
      }
    });
  },

  refresh() {
    this.setData({ page: 1, list: [], hasMore: true, loading: true });
    this.loadList();
  },

  loadList() {
    if (!this.data.hasMore) return;
    this.setData({ loading: true });

    userApi.getBrowseHistory(this.data.page, this.data.pageSize).then((res) => {
      console.log('[history] 原始数据:', JSON.stringify(res).slice(0, 2000));
      const items = (res && (res.items || res.list || res.records)) || [];
      const total = (res && (res.total || res.pagination && res.pagination.total)) || 0;
      console.log('[history] 解析 items 数量:', items.length, 'total:', total);
      if (items.length > 0) {
        console.log('[history] 第一条原始数据:', JSON.stringify(items[0]));
      }
      const mapped = items.map(it => this.mapItem(it));
      if (mapped.length > 0) {
        console.log('[history] 第一条映射后:', JSON.stringify(mapped[0]));
      }

      this.setData({
        list: this.data.page === 1 ? mapped : this.data.list.concat(mapped),
        loading: false,
        hasMore: this.data.list.length + mapped.length < total,
        emptyText: mapped.length === 0 && this.data.page === 1 ? '暂无浏览记录' : ''
      });
    }).catch((err) => {
      console.error('[history] 加载失败:', err);
      this.setData({ loading: false, emptyText: '加载失败，请下拉重试' });
    });
  },

  mapItem(raw) {
    // 兼容多种后端返回结构：直接是 bid 详情 / { bid: {...} } / { bidInfo: {...} } / 扁平字段
    const it = raw.bid || raw.bidInfo || raw.bidDetail || raw.bidData || raw;
    // 找第一个非空值
    const pick = (...keys) => {
      for (const k of keys) {
        if (it && it[k] !== undefined && it[k] !== null && it[k] !== '') return it[k];
        if (raw && raw[k] !== undefined && raw[k] !== null && raw[k] !== '') return raw[k];
      }
      return '';
    };
    const id = pick('id', 'bidId', 'bid_id');
    const title = pick('title', 'bidTitle', 'bid_title', 'name');
    const company = pick('buyer', 'agent', 'purchaser', 'company', 'companyName');
    // 注意：用户浏览时间优先用 browse_time；created_at / view_time 作为兼容字段
    const time = pick('browseTime', 'browse_time',
                     'viewedAt', 'viewed_at',
                     'viewTime', 'view_time',
                     'createdAt', 'created_at', 'createTime', 'create_time',
                     'addTime', 'add_time',
                     'updateTime', 'update_time',
                     'publishDate', 'publish_date');
    return {
      id,
      title: api.cleanTitle(title || '未命名'),
      company: company || '',
      region: pick('province', 'city', 'region'),
      tag: pick('bidType', 'bid_type', 'type'),
      time: formatRelativeTime(time) || '时间未提供'
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

  onItemLongPress(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.showActionSheet({
      itemList: ['删除该条'],
      success: (res) => {
        if (res.tapIndex === 0) {
          userApi.deleteBrowseHistory(id).then(() => {
            wx.showToast({ title: '已删除', icon: 'success' });
            this.refresh();
          });
        }
      }
    });
  }
})
