// 添加/编辑关键词订阅
const userApi = require('../../utils/user-api.js');
const cityData = require('../../utils/city-data.js');

Page({
  data: {
    statusBarHeight: 20,
    isEdit: false,
    id: '',
    keywordInput: '',
    form: {
      name: '',
      keywordList: [],
      searchMode: 'full',
      searchModeLabel: '全文检索',
      bidType: '',
      bidTypeLabel: '',
      region: '',
      regionLabel: '',
      notifyEnabled: true,
      pushType: 'daily'
    },
    canSave: false,
    saving: false,
    modalShow: false,
    modalTitle: '',
    modalOptions: [],
    modalField: ''
  },

  onLoad(options) {
    const app = getApp();
    if (app && app.globalData) {
      this.setData({ statusBarHeight: app.globalData.statusBarHeight || 20 });
    }
    if (options.id && options.id !== 'new') {
      this.setData({ isEdit: true, id: options.id });
      wx.setNavigationBarTitle({ title: '编辑订阅' });
      this.loadItem(options.id);
    } else {
      wx.setNavigationBarTitle({ title: '添加订阅' });
    }
  },

  onBackTap() {
    wx.navigateBack({ delta: 1 });
  },

  loadItem(id) {
    userApi.getSubscriptions(1, 100).then((res) => {
      const item = (res.items || res.list || []).find(it => String(it.id) === String(id));
      if (item) {
        const keywords = item.keywords || '';
        const keywordList = keywords ? keywords.split(/\s+/).filter(Boolean) : [];
        const bidTypeLabel = item.bidTypes || item.bid_type || '';
        const regionLabel = item.provinces || item.province || '';
        this.setData({
          form: {
            name: item.name || '',
            keywordList: keywordList,
            searchMode: item.searchMode || 'full',
            searchModeLabel: this.searchModeText(item.searchMode || 'full'),
            bidType: bidTypeLabel,
            bidTypeLabel: bidTypeLabel,
            region: regionLabel,
            regionLabel: regionLabel,
            notifyEnabled: item.notifyEnabled !== false,
            pushType: item.pushType || 'daily'
          }
        });
        this.checkCanSave();
      }
    });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ ['form.' + field]: e.detail.value }, () => this.checkCanSave());
  },

  onKeywordInput(e) {
    this.setData({ keywordInput: e.detail.value });
  },

  onAddKeyword() {
    const v = (this.data.keywordInput || '').trim();
    if (!v) {
      wx.showToast({ title: '请输入关键词', icon: 'none' });
      return;
    }
    if (v.length > 10) {
      wx.showToast({ title: '关键词不超过10字', icon: 'none' });
      return;
    }
    const list = this.data.form.keywordList.slice();
    if (list.indexOf(v) >= 0) {
      wx.showToast({ title: '该关键词已存在', icon: 'none' });
      return;
    }
    list.push(v);
    this.setData({
      'form.keywordList': list,
      keywordInput: ''
    }, () => this.checkCanSave());
  },

  onRemoveKeyword(e) {
    const idx = e.currentTarget.dataset.index;
    const list = this.data.form.keywordList.slice();
    list.splice(idx, 1);
    this.setData({ 'form.keywordList': list }, () => this.checkCanSave());
  },

  onToggleSwitch(e) {
    this.setData({ 'form.notifyEnabled': e.detail.value });
  },

  // 弹窗选择 - 检索模式
  onPickSearchMode() {
    this.setData({
      modalShow: true,
      modalTitle: '选择检索模式',
      modalField: 'searchMode',
      modalOptions: ['全文检索', '标题检索', '模糊检索', '精确检索']
    });
  },

  // 弹窗选择 - 信息类型
  onPickBidType() {
    this.setData({
      modalShow: true,
      modalTitle: '选择信息类型',
      modalField: 'bidType',
      modalOptions: ['招标公告', '中标公告', '招标预告', '开标公示', '候选人公示', '合同公告', '变更公告', '全部']
    });
  },

  // 弹窗选择 - 信息地区
  onPickRegion() {
    const provinces = Object.keys(cityData || {});
    this.setData({
      modalShow: true,
      modalTitle: '选择地区',
      modalField: 'region',
      modalOptions: provinces
    });
  },

  hideModal() {
    this.setData({ modalShow: false });
  },

  onPickModal(e) {
    const v = e.currentTarget.dataset.value;
    const field = this.data.modalField;
    if (field === 'searchMode') {
      const map = { '全文检索': 'full', '标题检索': 'title', '模糊检索': 'fuzzy', '精确检索': 'exact' };
      this.setData({
        'form.searchMode': map[v] || 'full',
        'form.searchModeLabel': v,
        modalShow: false
      });
    } else if (field === 'bidType') {
      this.setData({
        'form.bidType': v,
        'form.bidTypeLabel': v,
        modalShow: false
      });
    } else if (field === 'region') {
      this.setData({
        'form.region': v,
        'form.regionLabel': v,
        modalShow: false
      });
    }
  },

  onPickPushType(e) {
    this.setData({ 'form.pushType': e.currentTarget.dataset.type });
  },

  searchModeText(mode) {
    return ({ full: '全文检索', title: '标题检索', fuzzy: '模糊检索', exact: '精确检索' })[mode] || '全文检索';
  },

  checkCanSave() {
    const f = this.data.form;
    this.setData({ canSave: !!(f.name && f.name.trim()) });
  },

  onSave() {
    const f = this.data.form;
    if (!f.name.trim()) {
      wx.showToast({ title: '请输入订阅名称', icon: 'none' });
      return;
    }
    const payload = {
      name: f.name.trim(),
      keywords: (f.keywordList || []).join(' '),
      provinces: f.region,
      bidTypes: f.bidType,
      notifyEnabled: f.notifyEnabled,
      // 扩展字段：后端可选存储
      searchMode: f.searchMode,
      pushType: f.pushType
    };

    this.setData({ saving: true });
    const action = this.data.isEdit
      ? userApi.updateSubscription(this.data.id, payload)
      : userApi.createSubscription(payload);

    action.then(() => {
      this.setData({ saving: false });
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 800);
    }).catch((err) => {
      this.setData({ saving: false });
      console.error('[subscription-edit] 保存失败:', err);
    });
  }
});
