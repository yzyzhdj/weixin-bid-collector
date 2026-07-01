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
      console.log('[favorites] 原始数据:', JSON.stringify(res).slice(0, 2000));
      const items = (res && (res.items || res.list || res.records)) || [];
      const total = (res && (res.total || res.pagination && res.pagination.total)) || 0;
      console.log('[favorites] 解析 items 数量:', items.length);
      const mapped = items.map(it => this.mapItem(it));

      // 打印每条的 ID 映射关系，验证标讯对应是否正确
      console.table(items.map((raw, i) => {
        const it = raw.bid || raw.bidInfo || raw.bidDetail || raw.bidData || raw;
        return {
          序号: i,
          'raw.id(记录ID)': raw.id,
          'raw.bid_id(标讯ID)': raw.bid_id || raw.bidId,
          'bid对象.id': it && it.id,
          '映射后id': mapped[i].id,
          '标题': (mapped[i].title || '').slice(0, 20)
        };
      }));

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

  // 兼容多种后端返回结构
  mapItem(raw) {
    const it = raw.bid || raw.bidInfo || raw.bidDetail || raw.bidData || raw;
    const pick = (...keys) => {
      for (const k of keys) {
        if (it && it[k] !== undefined && it[k] !== null && it[k] !== '') return it[k];
        if (raw && raw[k] !== undefined && raw[k] !== null && raw[k] !== '') return raw[k];
      }
      return '';
    };
    // 注意：bid_id 优先于 id，因为收藏记录自身的 id 是记录ID，不是标讯ID
    const id = pick('bid_id', 'bidId', 'id');
    const title = pick('title', 'bidTitle', 'bid_title', 'name');
    const company = pick('buyer', 'agent', 'purchaser', 'company', 'companyName');
    // 注意：用户收藏时间优先用 created_at / create_time；标讯本身的 publishDate 作为最后兜底
    const time = pick('createdAt', 'created_at', 'createTime', 'create_time',
                     'addTime', 'add_time', 'favoritedAt', 'favorited_at',
                     'updateTime', 'update_time',
                     'publishDate', 'publish_date');
    return {
      id,
      title: api.cleanTitle(title || '未命名'),
      company: company || '',
      region: pick('province'),
      city: pick('city'),
      tag: pick('bidType', 'bid_type', 'type'),
      time: formatRelativeTime(time) || '时间未提供',
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
    const item = this.data.list.find(it => it.id == id);
    console.log('[favorites] 点击跳转 → id:', id, '标题:', item ? item.title : '未找到');
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
