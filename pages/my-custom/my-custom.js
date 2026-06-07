const user = require('../../utils/user.js');

const DEFAULT_KEYWORDS = [
  { value: '医院' }, { value: '学校' }, { value: '工程' }, { value: '道路' },
  { value: '绿化' }, { value: '设备采购' }
];

const ALL_REGIONS = ['北京', '上海', '广州', '深圳', '杭州', '南京', '武汉', '成都', '重庆', '西安', '天津', '苏州', '青岛', '济南', '合肥'];

const ALL_TYPES = [
  { value: '招标公告', label: '招标公告' },
  { value: '中标公告', label: '中标公告' },
  { value: '交易公告', label: '交易公告' },
  { value: '交易结果', label: '交易结果' },
  { value: '工程类', label: '拟建项目' }
];

Page({
  data: {
    keywords: [],
    allRegions: ALL_REGIONS,
    selectedRegions: [],
    allTypes: ALL_TYPES,
    settings: user.DEFAULT_SETTINGS
  },

  onShow() {
    this.loadSettings();
  },

  loadSettings() {
    const settings = user.getSettings();
    const keywords = settings.keywords || DEFAULT_KEYWORDS;
    const selectedRegions = settings.regions || [];
    this.setData({ settings, keywords, selectedRegions });
  },

  onAddKeyword() {
    const that = this;
    if (this.data.keywords.length >= 10) {
      wx.showToast({ title: '最多 10 个关键词', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '添加关键词',
      editable: true,
      placeholderText: '请输入关键词',
      success(res) {
        if (res.confirm && res.content && res.content.trim()) {
          const v = res.content.trim();
          if (that.data.keywords.some(k => k.value === v)) {
            wx.showToast({ title: '已存在', icon: 'none' });
            return;
          }
          const list = [{ value: v }, ...that.data.keywords];
          that.setData({ keywords: list });
        }
      }
    });
  },

  onRemoveKeyword(e) {
    const value = e.currentTarget.dataset.value;
    const list = this.data.keywords.filter(k => k.value !== value);
    this.setData({ keywords: list });
  },

  onToggleRegion(e) {
    const region = e.currentTarget.dataset.region;
    let list = this.data.selectedRegions.slice();
    const idx = list.indexOf(region);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(region);
    this.setData({ selectedRegions: list });
  },

  onSelectType(e) {
    const value = e.currentTarget.dataset.value;
    const settings = Object.assign({}, this.data.settings, { bidType: value });
    this.setData({ settings });
  },

  onSwitchChange(e) {
    const key = e.currentTarget.dataset.key;
    const value = e.detail.value;
    const settings = Object.assign({}, this.data.settings, { [key]: value });
    this.setData({ settings });
  },

  onSave() {
    const { keywords, selectedRegions, settings } = this.data;
    user.saveSettings(Object.assign({}, settings, { keywords, regions: selectedRegions }));
    wx.showToast({ title: '已保存', icon: 'success' });
  }
});
