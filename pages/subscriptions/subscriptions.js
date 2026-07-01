// 我的订阅页
// 关键词订阅: GET /user/subscriptions
// 企业订阅:   GET /user/monitors
const userApi = require('../../utils/user-api.js');
const api = require('../../utils/api.js');

Page({
  data: {
    statusBarHeight: 20,
    activeTab: 'keyword',     // keyword | company
    list: [],
    loading: true,
    page: 1,
    pageSize: 20,
    hasMore: true,
    dynamicsMap: {}            // 监控id -> 动态文案
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

  onBackTap() {
    wx.navigateBack({ delta: 1, fail: () => {
      wx.switchTab({ url: '/pages/profile/profile' });
    }});
  },

  refresh() {
    this.setData({ page: 1, list: [], hasMore: true, loading: true, dynamicsMap: {} });
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
      console.error('[subscriptions] 加载失败:', err);
      this.setData({ loading: false });
    });
  },

  // 企业订阅 - 加载每个 monitor 的最新动态 + 真实总条数
  //   用 buyer 模糊匹配查每家企业作为采购人的标讯，pagination.total 是真实总数
  //   拿首页第一条作为最新动态文本
  loadDynamics(items) {
    // 并发查每个 monitor 的标讯总数 + 最新一条
    const promises = items.map(it => {
      const name = it.companyName || '';
      if (!name) return Promise.resolve({ id: it.id, count: 0, latest: '' });
      return api.getBidList({
        page: 1,
        page_size: 1,            // 只要第一条（最新）
        buyer: name,
        sort_by: 'publish_date',
        sort_order: 'desc'
      }, { silent: true }).then(res => {
        const total = (res && res.pagination && res.pagination.total) || 0;
        const first = (res && res.items && res.items[0]) || null;
        return {
          id: it.id,
          count: total,
          latest: first ? (first.title || '') : ''
        };
      }).catch(err => {
        console.warn('[subscriptions] 查询 monitor 标讯失败:', name, err);
        return { id: it.id, count: 0, latest: '' };
      });
    });
    Promise.all(promises).then(results => {
      const map = {};
      results.forEach(r => { map[r.id] = { text: r.latest, count: r.count }; });
      const newList = this.data.list.map(it => {
        const t = map[it.id];
        if (!t) return it;
        return Object.assign({}, it, { dynamicsText: t.text, bidCount: t.count });
      });
      this.setData({ list: newList, dynamicsMap: map });
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
      // 企业订阅：bidCount/dynamicsText 由 loadDynamics 异步填充
      return {
        id: it.id,
        companyName: it.companyName || it.company_name || '未知企业',
        unifiedCode: it.unifiedCode || it.unified_code || '',
        alias: it.alias || '',
        province: it.province || '',
        city: it.city || '',
        createTime: this.formatTime(it.createTime || it.create_time || it.created_at),
        notifyEnabled: it.notifyEnabled !== false,
        dynamicsText: '',
        bidCount: 0
      };
    }
  },

  formatTime(t) {
    if (!t) return '';
    // 处理 ISO 8601 或秒级时间戳
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
      + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
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

  // 列表底部操作：查看详情/修改/删除
  onActionTap(e) {
    const { id, action, keywords, name } = e.currentTarget.dataset;
    if (action === 'delete') {
      this.confirmDelete(id);
    } else if (action === 'edit') {
      this.goEdit(id);
    } else if (action === 'view') {
      this.goDetail(id, keywords, name);
    }
  },

  goEdit(id) {
    if (this.data.activeTab === 'keyword') {
      wx.navigateTo({ url: '/pages/subscriptions/edit?id=' + id });
    } else {
      wx.navigateTo({ url: '/pages/subscriptions/edit-monitor?id=' + id });
    }
  },

  // 查看详情：
  //   关键词订阅 → 跳搜索页（前端会把关键词按分隔符拆开，分别并发查询再 OR 合并去重）
  //   企业订阅   → 跳 monitor-detail 详情页，展示该企业所有标讯
  goDetail(id, keywords, name) {
    if (this.data.activeTab === 'keyword') {
      const kw = encodeURIComponent(keywords || name || '');
      if (!kw) {
        wx.showToast({ title: '订阅关键词为空', icon: 'none' });
        return;
      }
      wx.navigateTo({ url: '/pages/search/search?keyword=' + kw });
    } else {
      const companyName = encodeURIComponent(name || '');
      const monitorId = encodeURIComponent(id || '');
      wx.navigateTo({ url: '/pages/monitor-detail/monitor-detail?monitorId=' + monitorId + '&name=' + companyName });
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
      console.error('[subscriptions] 删除失败:', err);
      wx.showToast({ title: '删除失败', icon: 'none' });
    });
  },

  // 浮动添加按钮
  onAddTap() {
    if (this.data.activeTab === 'keyword') {
      wx.navigateTo({ url: '/pages/subscriptions/edit?id=new' });
    } else {
      wx.navigateTo({ url: '/pages/subscriptions/edit-monitor?id=new' });
    }
  },

  showTimeFilter() {
    wx.showActionSheet({
      itemList: ['全部时间', '最近7天', '最近30天', '最近90天'],
      success: (res) => {
        // 简化：仅切换提示
        wx.showToast({ title: '时间筛选已应用', icon: 'none' });
      }
    });
  }
});
