// 订阅 TabBar 页
// 关键词订阅: GET /user/subscriptions
// 企业订阅:   GET /user/monitors
const userApi = require('../../utils/user-api.js');

Page({
  data: {
    activeTab: 'keyword',
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

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.activeTab) return;
    this.setData({ activeTab: tab }, () => this.refresh());
  },

  refresh() {
    this.setData({ page: 1, list: [], hasMore: true, loading: true });
    this.loadList();
  },

  loadList() {
    if (!this.data.hasMore) return;
    this.setData({ loading: true });
    const { activeTab } = this.data;

    const promise = activeTab === 'keyword'
      ? userApi.getSubscriptions(this.data.page, this.data.pageSize)
      : userApi.getMonitors(this.data.page, this.data.pageSize);

    promise.then((res) => {
      const items = (res && (res.items || res.list || res.records)) || [];
      const total = (res && (res.total || (res.pagination && res.pagination.total))) || 0;
      const mapped = items.map(it => this.mapItem(it));

      this.setData({
        list: this.data.page === 1 ? mapped : this.data.list.concat(mapped),
        loading: false,
        hasMore: this.data.list.length + mapped.length < total
      });

      // 企业订阅：补充获取动态信息
      if (activeTab === 'company' && mapped.length > 0) {
        this.loadDynamics(mapped);
      }
    }).catch((err) => {
      console.error('[subscribe] 加载失败:', err);
      this.setData({ loading: false });
    });
  },

  // 企业订阅 - 加载最新动态
  loadDynamics(items) {
    userApi.getMonitorDynamics(1, Math.max(20, items.length)).then((res) => {
      const dynamicsItems = (res && (res.items || res.list || res.records)) || [];
      const map = {};
      dynamicsItems.forEach(d => {
        const key = d.monitorId || d.monitor_id || d.id;
        if (key && !map[key]) {
          map[key] = d.title || d.summary || d.content || '';
        }
      });
      const newList = this.data.list.map(it => {
        const t = map[it.id];
        return t ? Object.assign({}, it, { dynamicsText: t }) : it;
      });
      this.setData({ list: newList });
    }).catch((err) => {
      console.warn('[subscribe] 加载动态失败:', err);
    });
  },

  mapItem(it) {
    if (this.data.activeTab === 'keyword') {
      return {
        id: it.id,
        name: it.name || '未命名订阅',
        keywords: it.keywords || '',
        createTime: this.formatTime(it.createTime || it.create_time || it.created_at),
        notifyEnabled: it.notifyEnabled !== false
      };
    } else {
      return {
        id: it.id,
        companyName: it.companyName || it.company_name || '未知企业',
        unifiedCode: it.unifiedCode || it.unified_code || '',
        createTime: this.formatTime(it.createTime || it.create_time || it.created_at),
        notifyEnabled: it.notifyEnabled !== false,
        dynamicsText: ''
      };
    }
  },

  formatTime(t) {
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
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
      + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
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

  // 列表底部操作
  onActionTap(e) {
    const { id, action } = e.currentTarget.dataset;
    if (action === 'delete') {
      this.confirmDelete(id);
    } else if (action === 'edit') {
      this.goEdit(id);
    } else if (action === 'view') {
      this.goDetail(id);
    }
  },

  goEdit(id) {
    if (this.data.activeTab === 'keyword') {
      wx.navigateTo({ url: '/pages/subscriptions/edit?id=' + id });
    } else {
      wx.navigateTo({ url: '/pages/subscriptions/edit-monitor?id=' + id });
    }
  },

  goDetail(id) {
    if (this.data.activeTab === 'keyword') {
      wx.navigateTo({ url: '/pages/subscriptions/edit?id=' + id + '&readonly=1' });
    } else {
      wx.navigateTo({ url: '/pages/subscriptions/edit-monitor?id=' + id + '&readonly=1' });
    }
  },

  confirmDelete(id) {
    wx.showModal({
      title: '提示',
      content: '确定要删除该订阅吗？',
      success: (res) => {
        if (res.confirm) this.doDelete(id);
      }
    });
  },

  doDelete(id) {
    const p = this.data.activeTab === 'keyword'
      ? userApi.deleteSubscription(id)
      : userApi.deleteMonitor(id);
    p.then(() => {
      wx.showToast({ title: '已删除', icon: 'success' });
      this.refresh();
    }).catch((err) => {
      console.error('[subscribe] 删除失败:', err);
      wx.showToast({ title: '删除失败', icon: 'none' });
    });
  },

  // 添加 / 立即订阅
  onAdd() {
    if (this.data.activeTab === 'keyword') {
      wx.navigateTo({ url: '/pages/subscriptions/edit?id=new' });
    } else {
      wx.navigateTo({ url: '/pages/subscriptions/edit-monitor?id=new' });
    }
  }
});
