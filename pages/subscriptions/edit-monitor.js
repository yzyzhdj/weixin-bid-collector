// 添加/编辑企业监控
// 列表：GET /user/monitors/recommendations?limit=20&keyword=xxx
// 新增：POST /user/monitors
// 修改：PUT /user/monitors/{id}
// 删除：DELETE /user/monitors/{id}
const userApi = require('../../utils/user-api.js');

Page({
  data: {
    statusBarHeight: 20,
    isEdit: false,
    editingId: null,
    readonly: false,
    searchKey: '',
    companies: [],
    selectedId: null,
    selectedName: '',
    selectedCode: '',
    selectedExtra: null,
    loading: false,
    searched: false
  },

  onLoad(options) {
    const app = getApp();
    if (app && app.globalData) {
      this.setData({ statusBarHeight: app.globalData.statusBarHeight || 20 });
    }
    const id = options && options.id;
    this.setData({ readonly: options && options.readonly === '1' });
    if (id && id !== 'new') {
      this.setData({ isEdit: true, editingId: id });
    }
    this.loadRecommendations('');
  },

  onBackTap() {
    wx.navigateBack({ delta: 1 });
  },

  onSearchInput(e) {
    this.setData({ searchKey: e.detail.value });
  },

  onSearch() {
    this.loadRecommendations(this.data.searchKey);
  },

  // 推荐企业
  loadRecommendations(keyword) {
    this.setData({ loading: true, searched: true });
    const limit = 20;
    // 简化：关键词暂作为额外参数传递（后端可选择忽略）
    userApi.getMonitorRecommendations(limit).then((res) => {
      let items = (res && (res.items || res.list || res.records)) || [];
      if (keyword) {
        const k = keyword.toLowerCase();
        items = items.filter(it => {
          const n = (it.companyName || it.name || '').toLowerCase();
          return n.indexOf(k) >= 0;
        });
      }
      this.setData({ companies: items, loading: false });
    }).catch((err) => {
      console.error('[edit-monitor] 加载推荐失败:', err);
      this.setData({ companies: [], loading: false });
    });
  },

  onPickCompany(e) {
    const { id, name, code, extra } = e.currentTarget.dataset;
    this.setData({
      selectedId: id,
      selectedName: name,
      selectedCode: code,
      selectedExtra: extra
    });
  },

  onConfirm() {
    if (!this.data.selectedId) {
      wx.showToast({ title: '请选择一个企业', icon: 'none' });
      return;
    }
    const payload = {
      companyName: this.data.selectedName,
      unifiedCode: this.data.selectedCode
    };

    if (this.data.isEdit) {
      userApi.updateMonitor(this.data.editingId, payload).then(() => {
        wx.showToast({ title: '已更新', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 600);
      }).catch(err => {
        console.error(err);
        wx.showToast({ title: '更新失败', icon: 'none' });
      });
    } else {
      userApi.createMonitor(payload).then(() => {
        wx.showToast({ title: '已添加', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 600);
      }).catch(err => {
        console.error(err);
        wx.showToast({ title: '添加失败', icon: 'none' });
      });
    }
  }
});
