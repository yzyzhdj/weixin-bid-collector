// pages/companies/companies.js
const userApi = require('../../utils/user-api.js');

Page({
  data: {
    keyword: '',
    list: [],
    page: 1,
    pageSize: 15,
    loading: false,
    loadingMore: false,
    finished: false,
    total: 0
  },

  searchTimer: null,

  onLoad() {
    this.loadList(true);
  },

  onSearchInput(e) {
    this.setData({ keyword: e.detail.value });
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.loadList(true);
    }, 400);
  },

  onSearchClear() {
    this.setData({ keyword: '' });
    this.loadList(true);
  },

  onReachBottom() {
    if (this.data.finished || this.data.loading || this.data.loadingMore) return;
    this.loadList(false);
  },

  onPullDownRefresh() {
    this.loadList(true).then(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadList(reset) {
    if (this.data.loading) return;
    const page = reset ? 1 : this.data.page;
    this.setData({
      loading: reset,
      loadingMore: !reset
    });

    try {
      const params = {
        page,
        page_size: this.data.pageSize
      };
      if (this.data.keyword.trim()) params.keyword = this.data.keyword.trim();

      console.log('[companies] 请求:', params);
      const data = await userApi.getWinnerCompanies(params);
      const rawItems = data.items || [];
      console.log('[companies] 返回', rawItems.length, '条, 总计', data.total);

      const items = rawItems.map(item => ({
        name: item.name || '未命名',
        bidCount: item.bidCount || 0,
        profile: item.profile || '',
        contact: item.contact || ''
      }));

      const list = reset ? items : this.data.list.concat(items);
      const finished = list.length >= (data.total || 0) || rawItems.length < this.data.pageSize;

      this.setData({
        list,
        page: page + 1,
        total: data.total || 0,
        loading: false,
        loadingMore: false,
        finished
      });
    } catch (e) {
      console.error('[companies] 加载失败', e);
      this.setData({ loading: false, loadingMore: false, finished: true });
    }
  },

  // 拨打电话
  onCallTap(e) {
    const contact = e.currentTarget.dataset.contact || '';
    if (!contact) {
      wx.showToast({ title: '暂无联系方式', icon: 'none' });
      return;
    }
    // 取第一个电话号码
    const phones = contact.match(/1[3-9]\d{9}/g) || [];
    const phone = phones[0] || contact.split(',')[0].trim();
    if (phone) {
      wx.makePhoneCall({ phoneNumber: phone });
    } else {
      wx.setClipboardData({
        data: contact,
        success: () => wx.showToast({ title: '联系方式已复制', icon: 'success' })
      });
    }
  },

  // 点击企业卡片，跳转到中标项目列表
  onCompanyTap(e) {
    const name = e.currentTarget.dataset.name || '';
    if (!name) return;
    wx.navigateTo({
      url: `/pages/company-detail/company-detail?name=${encodeURIComponent(name)}`
    });
  }
});
