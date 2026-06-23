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
    emptyText: '',
    showAdd: false,
    addForm: {
      companyName: '',
      unifiedCode: '',
      alias: '',
      province: '',
      city: '',
      notifyEnabled: true
    },
    saving: false,
    provinceOptions: ['北京', '上海', '广东', '江苏', '浙江', '山东', '河南', '四川', '湖北', '湖南'],
    provincePickerShow: false,
    provincePickerText: ''
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

    userApi.getMonitors(this.data.page, this.data.pageSize).then((res) => {
      const items = (res && (res.items || res.list || res.records)) || [];
      const total = (res && (res.total || res.pagination && res.pagination.total)) || 0;
      const mapped = items.map(it => this.mapItem(it));

      this.setData({
        list: this.data.page === 1 ? mapped : this.data.list.concat(mapped),
        loading: false,
        hasMore: this.data.list.length + mapped.length < total,
        emptyText: mapped.length === 0 && this.data.page === 1 ? '暂未监控任何企业' : ''
      });
    }).catch((err) => {
      console.error('[monitors] 加载失败:', err);
      this.setData({ loading: false, emptyText: '加载失败，请下拉重试' });
    });
  },

  mapItem(it) {
    return {
      id: it.id,
      companyName: it.companyName || it.company_name || '未命名企业',
      unifiedCode: it.unifiedCode || it.unified_code || '',
      alias: it.alias || '',
      province: it.province || '',
      city: it.city || '',
      notifyEnabled: it.notifyEnabled !== false
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

  onAddTap() {
    this.setData({
      showAdd: true,
      addForm: { companyName: '', unifiedCode: '', alias: '', province: '', city: '', notifyEnabled: true },
      provincePickerText: ''
    });
  },

  onCancelAdd() {
    this.setData({ showAdd: false });
  },

  onAddInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ ['addForm.' + field]: e.detail.value });
  },

  showProvincePicker() {
    this.setData({ provincePickerShow: true });
  },
  hideProvincePicker() {
    this.setData({ provincePickerShow: false });
  },
  onPickProvince(e) {
    const v = e.currentTarget.dataset.value;
    this.setData({
      'addForm.province': v,
      provincePickerText: v,
      provincePickerShow: false
    });
  },

  onAddSwitch(e) {
    this.setData({ 'addForm.notifyEnabled': e.detail.value });
  },

  onSaveAdd() {
    const f = this.data.addForm;
    if (!f.companyName.trim()) {
      wx.showToast({ title: '请输入企业名称', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    userApi.createMonitor({
      companyName: f.companyName.trim(),
      unifiedCode: f.unifiedCode.trim(),
      alias: f.alias.trim(),
      province: f.province,
      city: f.city.trim(),
      notifyEnabled: f.notifyEnabled
    }).then(() => {
      this.setData({ saving: false, showAdd: false });
      wx.showToast({ title: '添加成功', icon: 'success' });
      this.refresh();
    }).catch((err) => {
      this.setData({ saving: false });
      console.error('[monitors] 添加失败:', err);
    });
  },

  onItemLongPress(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.showActionSheet({
      itemList: ['查看动态', '取消监控'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({ url: '/pages/monitors/dynamics?id=' + id });
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
      content: '确定要取消监控该企业吗？',
      success: (res) => {
        if (res.confirm) {
          userApi.deleteMonitor(id).then(() => {
            wx.showToast({ title: '已取消监控', icon: 'success' });
            this.refresh();
          });
        }
      }
    });
  },

  onToggleNotify(e) {
    const id = e.currentTarget.dataset.id;
    const enabled = e.detail.value;
    userApi.updateMonitor(id, { notifyEnabled: enabled }).then(() => {
      wx.showToast({ title: enabled ? '已开启推送' : '已关闭推送', icon: 'success' });
    }).catch(() => {
      this.refresh();
    });
  }
})
