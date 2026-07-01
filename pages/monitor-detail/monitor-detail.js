// pages/monitor-detail/monitor-detail.js
// 企业订阅详情：展示该监控企业下的所有标讯
// 数据来源：GET /bids?buyer={name} 模糊匹配该企业作为采购人的标讯
//   - 后端 dynamics 接口未返回 bid 详情（id/title/date 都缺失），无法直接展示
//   - 改用 buyer 模糊匹配查所有标讯，结果更可靠
const api = require('../../utils/api.js');

Page({
  data: {
    monitorId: '',
    companyName: '',
    bids: [],
    page: 1,
    pageSize: 20,
    loading: true,
    loadingMore: false,
    hasMore: true,
    total: 0
  },

  onLoad(options) {
    const monitorId = options.monitorId || '';
    const companyName = decodeURIComponent(options.name || '');
    this.setData({ monitorId, companyName });
    // 动态设置导航栏标题
    wx.setNavigationBarTitle({ title: companyName || '企业订阅' });
    if (companyName) {
      this.loadBids(true);
    } else {
      this.setData({ loading: false });
    }
  },

  onReachBottom() {
    if (this.data.loading || this.data.loadingMore || !this.data.hasMore) return;
    this.loadBids(false);
  },

  onPullDownRefresh() {
    this.loadBids(true).then(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadBids(reset) {
    if (this.data.loadingMore) return;
    const page = reset ? 1 : this.data.page;
    this.setData({ loading: reset, loadingMore: !reset });

    try {
      // 用 buyer 模糊匹配查该企业作为采购人的标讯
      // 按 publish_date 倒序，返回完整 bid 字段（id/title/publishDate）
      const res = await api.getBidList({
        page,
        page_size: this.data.pageSize,
        buyer: this.data.companyName,
        sort_by: 'publish_date',
        sort_order: 'desc'
      }, { silent: true });

      const items = (res && res.items) || [];
      const total = (res && res.pagination && res.pagination.total) || 0;

      // 标准化字段
      const normalized = items.map(it => this._normalizeBid(it));

      const list = reset ? normalized : this.data.bids.concat(normalized);
      // 判断是否还有更多
      const hasMore = total > 0
        ? list.length < total
        : normalized.length >= this.data.pageSize;

      this.setData({
        bids: list,
        page: page + 1,
        total,
        loading: false,
        loadingMore: false,
        hasMore
      });
    } catch (e) {
      console.error('[monitor-detail] 加载失败', e);
      this.setData({ loading: false, loadingMore: false, hasMore: false });
    }
  },

  // 统一标讯字段
  _normalizeBid(it) {
    return {
      id: it.id,
      title: api.cleanTitle(it.title || '未知标讯'),
      updateTime: this._formatTime(it.publishDate || it.publish_date)
    };
  },

  _formatTime(t) {
    if (!t) return '';
    let d;
    if (typeof t === 'number') {
      d = new Date(t < 1e12 ? t * 1000 : t);
    } else if (typeof t === 'string') {
      d = new Date(t.replace ? t.replace(' ', 'T') : t);
    } else {
      return String(t);
    }
    if (isNaN(d.getTime())) return String(t);
    const pad = (n) => (n < 10 ? '0' + n : '' + n);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  },

  onBidTap(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) {
      wx.showToast({ title: '标讯ID缺失', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id });
  }
});
