const api = require('../../utils/api.js');
const cityData = require('../../utils/city-data.js');

// 相对时间格式化
function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
  if (diff < 604800) return Math.floor(diff / 86400) + '天前';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTypeTag(bidType) {
  const map = {
    '交易公告': { bg: '#fff7ed', color: '#c2410c' },
    '交易结果': { bg: '#ecfdf5', color: '#047857' },
    '中标公告': { bg: '#eff6ff', color: '#1d4ed8' }
  };
  return map[bidType] || { bg: '#f1f5f9', color: '#475569' };
}

Page({
  data: {
    region: '全国',
    city: '',
    searchText: '',
    hotTags: ['热搜', '门禁', '装修', '物业', '光伏'],
    functionList: [
      { name: '查招标', type: 'bids', color: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)', icon: '/images/icon-bid.svg' },
      { name: '查中标', type: 'win', color: 'linear-gradient(135deg, #a855f7 0%, #c084fc 100%)', icon: '/images/icon-win.svg' },
      { name: '查拟建', type: 'plan', color: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)', icon: '/images/icon-plan.svg' },
      { name: '查企业', type: 'company', color: 'linear-gradient(135deg, #14b8a6 0%, #2dd4bf 100%)', icon: '/images/icon-company.svg' },
      { name: '审批项目', type: 'approval', color: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)', icon: '/images/icon-approval.svg' },
      { name: '精选项目', type: 'featured', color: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)', icon: '/images/icon-star.svg' },
      { name: '政府项目', type: 'gov', color: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)', icon: '/images/icon-gov.svg' },
      { name: '更多功能', type: 'more', color: 'linear-gradient(135deg, #a855f7 0%, #c084fc 100%)', icon: '/images/icon-more.svg' }
    ],
    infoTabs: ['最新招标', '最新中标', '拟建项目'],
    currentInfoTab: 0,
    infoList: [],
    loading: true,
    regionPickerShow: false,
    provinces: Object.keys(cityData),
    cities: [],
    selectedProvince: '',
    selectedCity: ''
  },

  onLoad() {
    // 获取状态栏高度
    const app = getApp();
    if (app && app.globalData) {
      this.setData({ statusBarHeight: app.globalData.statusBarHeight || 20 });
    }
    this.loadBidList();
  },

  onShow() {
    this.loadBidList();
  },

  onPullDownRefresh() {
    this.loadBidList().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadBidList() {
    this.setData({ loading: true });
    try {
      // API 实际返回 snake_case 字段，api.js 已自动转 camelCase
      const params = {
        page: 1,
        page_size: 20,
        sort_by: 'created_at',  // 修正：snake_case (之前是 createdAt)
        sort_order: 'desc'
      };

      // Tab 映射（使用 list_type 简化）
      // Tab 0: 最新招标 (list_type=bids 排除中标)
      // Tab 1: 最新中标 (list_type=wins 仅成交公示)
      // Tab 2: 拟建项目 (category=工程类)
      const tab = this.data.currentInfoTab;
      if (tab === 0) {
        params.list_type = 'bids';
      } else if (tab === 1) {
        params.list_type = 'wins';
      } else if (tab === 2) {
        params.category = '工程类';
      }

      if (this.data.selectedProvince) params.province = this.data.selectedProvince;
      if (this.data.selectedCity) params.city = this.data.selectedCity;

      console.log('[loadBidList] 请求参数:', params);

      const data = await api.getBidList(params);

      // api.js 已将 snake_case 转 camelCase（publishDate, bidType 等）
      const items = (data.items || []).map(item => {
        const tag = getTypeTag(item.bidType);
        return {
          id: item.id,
          title: item.title,
          company: item.buyer || item.agent || '未提供',
          region: item.province || '全国',
          region2: item.city || '',
          tag: item.bidType || item.biddingMethod || '',
          tagBg: tag.bg,
          tagColor: tag.color,
          time: formatRelativeTime(item.publishDate),
          budget: item.budget || ''
        };
      });

      this.setData({ infoList: items, loading: false });
    } catch (e) {
      console.error('加载招标列表失败', e);
      this.setData({ loading: false, infoList: [] });
    }
  },

  // 打开省市选择器
  showRegionPicker() {
    this.setData({ regionPickerShow: true });
  },

  // 关闭省市选择器
  hideRegionPicker() {
    this.setData({ regionPickerShow: false });
  },

  // 选择省份（不立即关闭弹窗，用户可继续选择城市）
  selectProvince(e) {
    const province = e.currentTarget.dataset.province;
    this.setData({
      selectedProvince: province,
      selectedCity: '',
      cities: province ? (cityData[province] || []) : [],
      region: province || '全国',
      city: ''
    });
  },

  // 选择城市（不立即关闭弹窗，等用户点确认）
  selectCity(e) {
    const city = e.currentTarget.dataset.city;
    this.setData({
      selectedCity: city,
      city: city
    });
  },

  // 确认筛选（关闭弹窗并加载数据）
  onConfirmRegion() {
    this.hideRegionPicker();
    this.loadBidList();
  },

  // 重置筛选（在弹窗中）
  onResetFilter() {
    this.setData({
      selectedProvince: '',
      selectedCity: '',
      cities: [],
      region: '全国',
      city: ''
    });
  },

  // 清除筛选（在筛选条上）
  onClearFilter() {
    this.setData({
      selectedProvince: '',
      selectedCity: '',
      cities: [],
      region: '全国',
      city: ''
    });
    this.loadBidList();
  },

  onInput(e) {
    this.setData({ searchText: e.detail.value });
  },

  onSearch() {
    if (!this.data.searchText.trim()) {
      wx.showToast({ title: '请输入关键词', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/search/search?keyword=${encodeURIComponent(this.data.searchText)}`
    });
  },

  onTagClick(e) {
    const keyword = e.currentTarget.dataset.keyword;
    wx.navigateTo({
      url: `/pages/search/search?keyword=${encodeURIComponent(keyword)}`
    });
  },

  onFunctionClick(e) {
    const type = e.currentTarget.dataset.type;
    if (type === 'bids') {
      // 查招标 → 跳转到搜索结果页，带上当前选中的省市 + type=bids
      const province = this.data.selectedProvince || '';
      const city = this.data.selectedCity || '';
      let url = '/pages/search/search';
      const params = ['type=bids'];
      if (province) params.push(`province=${encodeURIComponent(province)}`);
      if (city) params.push(`city=${encodeURIComponent(city)}`);
      url += '?' + params.join('&');
      wx.navigateTo({ url });
    } else if (type === 'win') {
      const province = this.data.selectedProvince || '';
      const city = this.data.selectedCity || '';
      let url = '/pages/search/search';
      const params = ['type=win'];
      if (province) params.push(`province=${encodeURIComponent(province)}`);
      if (city) params.push(`city=${encodeURIComponent(city)}`);
      url += '?' + params.join('&');
      wx.navigateTo({ url });
    } else if (type === 'company') {
      wx.switchTab({ url: '/pages/subscription/subscription' });
    } else if (type === 'plan') {
      const province = this.data.selectedProvince || '';
      const city = this.data.selectedCity || '';
      let url = '/pages/search/search';
      const params = ['type=plan'];
      if (province) params.push(`province=${encodeURIComponent(province)}`);
      if (city) params.push(`city=${encodeURIComponent(city)}`);
      url += '?' + params.join('&');
      wx.navigateTo({ url });
    } else {
      wx.showToast({ title: '功能开发中', icon: 'none' });
    }
  },

  onPromoTap() {
    wx.switchTab({ url: '/pages/subscription/subscription' });
  },

  switchInfoTab(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ currentInfoTab: index });
    this.loadBidList();
  },

  onItemTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  }
})
