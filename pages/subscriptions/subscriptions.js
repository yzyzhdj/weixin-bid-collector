// 用户中心 API
const userApi = require('../../utils/user-api.js');

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

    userApi.getSubscriptions(this.data.page, this.data.pageSize).then((res) => {
      const items = (res && (res.items || res.list || res.records)) || [];
      const total = (res && (res.total || res.pagination && res.pagination.total)) || 0;
      const mapped = items.map(it => this.mapItem(it));

      this.setData({
        list: this.data.page === 1 ? mapped : this.data.list.concat(mapped),
        loading: false,
        hasMore: this.data.list.length + mapped.length < total,
        emptyText: mapped.length === 0 && this.data.page === 1 ? '暂无订阅' : ''
      });
    }).catch((err) => {
      console.error('[subscriptions] 加载失败:', err);
      this.setData({ loading: false, emptyText: '加载失败，请下拉重试' });
    });
  },

  mapItem(it) {
    return {
      id: it.id,
      name: it.name || '未命名订阅',
      keywords: it.keywords || '',
      provinces: it.provinces || it.province || '',
      bidTypes: it.bidTypes || it.bid_type || '',
      industries: it.industries || it.industry || '',
      budgetMin: it.budgetMin || it.budget_min || 0,
      budgetMax: it.budgetMax || it.budget_max || 0,
      notifyEnabled: it.notifyEnabled !== false,
      createTime: it.createTime || it.create_time || ''
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

  // 跳转到新建订阅
  onCreateTap() {
    wx.navigateTo({ url: '/pages/subscriptions/edit?id=new' });
  },

  onItemTap(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/subscriptions/edit?id=' + id });
  },

  onItemLongPress(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.showActionSheet({
      itemList: ['编辑', '删除'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({ url: '/pages/subscriptions/edit?id=' + id });
        } else if (res.tapIndex === 1) {
          this.deleteItem(id);
        }
      }
    });
  },

  onDeleteTap(e) {
    const id = e.currentTarget.dataset.id;
    if (id) this.deleteItem(id);
  },

  deleteItem(id) {
    wx.showModal({
      title: '提示',
      content: '确定要删除该订阅吗？',
      success: (res) => {
        if (res.confirm) {
          userApi.deleteSubscription(id).then(() => {
            wx.showToast({ title: '已删除', icon: 'success' });
            this.refresh();
          });
        }
      }
    });
  },

  // 切换推送开关
  onToggleNotify(e) {
    const id = e.currentTarget.dataset.id;
    const enabled = e.detail.value;
    userApi.updateSubscription(id, { notifyEnabled: enabled }).then(() => {
      wx.showToast({ title: enabled ? '已开启推送' : '已关闭推送', icon: 'success' });
    }).catch((err) => {
      console.error('[subscriptions] 切换推送失败:', err);
      this.refresh(); // 回滚
    });
  }
})
