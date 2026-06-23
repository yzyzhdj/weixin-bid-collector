// 用户中心 API
const userApi = require('../../utils/user-api.js');

Page({
  data: {
    statusBarHeight: 20,
    isEdit: false,
    id: '',
    form: {
      name: '',
      keywords: '',
      provinces: '',
      bidTypes: '',
      industries: '',
      budgetMin: '',
      budgetMax: '',
      notifyEnabled: true
    },
    bidTypeOptions: ['招标公告', '中标公告', '招标预告', '开标公示', '候选人公示', '合同公告'],
    industryOptions: ['工程建筑', '信息技术', '医疗卫生', '教育培训', '金融服务', '能源化工'],
    provinceOptions: ['北京', '上海', '广东', '江苏', '浙江', '山东', '河南', '四川', '湖北', '湖南'],
    bidTypePickerShow: false,
    bidTypePickerText: '',
    provincePickerShow: false,
    provincePickerText: '',
    industryPickerShow: false,
    industryPickerText: '',
    saving: false
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
      wx.setNavigationBarTitle({ title: '新建订阅' });
    }
  },

  onBackTap() {
    wx.navigateBack({ delta: 1 });
  },

  loadItem(id) {
    userApi.getSubscriptions(1, 100).then((res) => {
      const item = (res.items || res.list || []).find(it => String(it.id) === String(id));
      if (item) {
        this.setData({
          form: {
            name: item.name || '',
            keywords: item.keywords || '',
            provinces: item.provinces || item.province || '',
            bidTypes: item.bidTypes || item.bid_type || '',
            industries: item.industries || item.industry || '',
            budgetMin: item.budgetMin || item.budget_min || '',
            budgetMax: item.budgetMax || item.budget_max || '',
            notifyEnabled: item.notifyEnabled !== false
          },
          bidTypePickerText: item.bidTypes || item.bid_type || '',
          provincePickerText: item.provinces || item.province || '',
          industryPickerText: item.industries || item.industry || ''
        });
      }
    });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ ['form.' + field]: e.detail.value });
  },

  onToggleSwitch(e) {
    this.setData({ 'form.notifyEnabled': e.detail.value });
  },

  showBidTypePicker() {
    this.setData({ bidTypePickerShow: true });
  },
  hideBidTypePicker() {
    this.setData({ bidTypePickerShow: false });
  },
  onPickBidType(e) {
    const v = e.currentTarget.dataset.value;
    this.setData({
      'form.bidTypes': v,
      bidTypePickerText: v,
      bidTypePickerShow: false
    });
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
      'form.provinces': v,
      provincePickerText: v,
      provincePickerShow: false
    });
  },

  showIndustryPicker() {
    this.setData({ industryPickerShow: true });
  },
  hideIndustryPicker() {
    this.setData({ industryPickerShow: false });
  },
  onPickIndustry(e) {
    const v = e.currentTarget.dataset.value;
    this.setData({
      'form.industries': v,
      industryPickerText: v,
      industryPickerShow: false
    });
  },

  onSave() {
    const f = this.data.form;
    if (!f.name.trim()) {
      wx.showToast({ title: '请输入订阅名称', icon: 'none' });
      return;
    }
    const payload = {
      name: f.name.trim(),
      keywords: f.keywords.trim(),
      provinces: f.provinces,
      bidTypes: f.bidTypes,
      industries: f.industries,
      budgetMin: parseFloat(f.budgetMin) || 0,
      budgetMax: parseFloat(f.budgetMax) || 0,
      notifyEnabled: f.notifyEnabled
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
})
