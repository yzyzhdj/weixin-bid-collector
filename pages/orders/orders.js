const userApi = require('../../utils/user-api.js');

// 格式化时间：2026-07-01T21:03:46 → 2026-07-01 21:03
function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const m = String(dateStr).match(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5];
  return String(dateStr).slice(0, 16);
}

// 订单状态映射
function mapStatus(status) {
  const map = {
    'pending':  { text: '待支付', key: 'pending' },
    'paid':     { text: '已支付', key: 'paid' },
    'closed':   { text: '已关闭', key: 'closed' },
    'refunded': { text: '已退款', key: 'refunded' }
  };
  return map[status] || { text: status || '未知', key: 'unknown' };
}

Page({
  data: {
    statusBarHeight: 20,
    list: [],
    loading: true,
    page: 1,
    pageSize: 20,
    hasMore: true
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

  onPullDownRefresh() {
    this.refresh().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.loading || !this.data.hasMore) return;
    this.loadList();
  },

  onBackTap() {
    wx.navigateBack({ delta: 1, fail: () => {
      wx.switchTab({ url: '/pages/profile/profile' });
    }});
  },

  refresh() {
    this.setData({ page: 1, list: [], hasMore: true, loading: true });
    return this.loadList();
  },

  loadList() {
    if (!this.data.hasMore) return Promise.resolve();
    this.setData({ loading: true });

    return userApi.getOrderList(this.data.page, this.data.pageSize).then((res) => {
      console.log('[orders] 后端原始返回:', JSON.stringify(res).slice(0, 500));

      // 兼容多种返回结构：
      // 1. res 直接是数组 → [...]
      // 2. res.items / res.list / res.records / res.data / res.orders / res.rows
      let items = [];
      if (Array.isArray(res)) {
        items = res;
      } else if (res) {
        items = res.items || res.list || res.records || res.data || res.orders || res.rows || [];
        if (!Array.isArray(items)) items = [];
      }
      const pagination = (res && res.pagination) || {};
      const total = pagination.total || (res && res.total) || 0;
      console.log('[orders] 解析 items 数量:', items.length, 'total:', total);
      if (items.length > 0) console.log('[orders] 第一条:', JSON.stringify(items[0]));

      const mapped = items.map(it => {
        const st = mapStatus(it.status);
        // 只有已支付状态才入账，积分部分才有意义
        const isPaid = st.key === 'paid';
        return {
          orderNo: it.order_no || it.orderNo || '',
          packageName: it.package_name || it.packageName || '积分套餐',
          yuan: it.yuan || 0,
          pointsTotal: it.points_total || it.pointsTotal || 0,
          showPoints: isPaid,         // 只有已支付才显示积分
          statusText: st.text,
          statusKey: st.key,
          timeText: formatDateTime(it.paid_at || it.created_at || it.createdAt)
        };
      });

      const list = this.data.page === 1 ? mapped : this.data.list.concat(mapped);
      let hasMore;
      if (total > 0) {
        hasMore = list.length < total;
      } else {
        hasMore = mapped.length >= this.data.pageSize;
      }

      this.setData({
        list,
        page: this.data.page + 1,
        loading: false,
        hasMore
      });
    }).catch((err) => {
      console.error('[orders] 加载订单列表失败:', err);
      this.setData({ loading: false, hasMore: false });
      if (this.data.page === 1) {
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    });
  }
});
