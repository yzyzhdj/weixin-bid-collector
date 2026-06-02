const api = require('../../utils/api.js');
const cityData = require('../../utils/city-data.js');

Page({
  data: {
    topTabs: [
      { name: '全部', type: '' },
      { name: '交易公告', type: '交易公告' },
      { name: '交易结果', type: '交易结果' },
      { name: '公开招标', type: '公开招标' },
      { name: '竞争性磋商', type: '竞争性磋商' },
      { name: '竞争性谈判', type: '竞争性谈判' },
      { name: '询价', type: '询价' }
    ],
    currentTab: 0,
    bidList: [],
    totalCount: 0,
    loading: false,
    noMore: false,
    page: 1,
    pageSize: 5,
    filterProvince: '',
    filterCity: '',
    filterBidType: '',
    filterMethod: '',
    activeFilter: '',
    provinceList: [],
    cityList: [],
    selectedProvince: '',
    bidTypeOptions: [],
    methodOptions: []
  },

  onLoad() {
    this.loadData();
    this.loadFilters();
  },

  onPullDownRefresh() {
    this.setData({
      page: 1,
      bidList: [],
      noMore: false
    });
    this.loadData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (!this.data.noMore && !this.data.loading) {
      this.loadMore();
    }
  },

  async loadFilters() {
    try {
      const data = await api.getFilters();
      const provinces = data.provinces || [];
      this.setData({
        provinceList: ['全部', ...provinces],
        bidTypeOptions: ['全部', ...(data.bid_types || [])],
        methodOptions: ['全部', ...(data.bidding_methods || [])]
      });
    } catch (e) {
      console.error('加载筛选选项失败', e);
    }
  },

  showFilter(e) {
    const field = e.currentTarget.dataset.field;
    if (this.data.activeFilter === field) {
      this.setData({ activeFilter: '' });
      return;
    }

    if (field === 'province') {
      const selProvince = this.data.filterProvince || this.data.provinceList[1] || '';
      const cities = selProvince ? (cityData[selProvince] || []) : [];
      this.setData({
        activeFilter: field,
        selectedProvince: selProvince,
        cityList: cities
      });
    } else {
      this.setData({ activeFilter: field });
    }
  },

  closeFilter() {
    this.setData({ activeFilter: '' });
  },

  selectProvince(e) {
    const province = e.currentTarget.dataset.province;
    if (province === '全部') {
      this.setData({
        filterProvince: '',
        filterCity: '',
        selectedProvince: '',
        cityList: [],
        activeFilter: '',
        page: 1,
        bidList: [],
        noMore: false
      });
      this.loadData();
      return;
    }

    const cities = cityData[province] || [];
    this.setData({
      selectedProvince: province,
      cityList: cities,
      filterProvince: province,
      filterCity: ''
    });
  },

  selectCity(e) {
    const city = e.currentTarget.dataset.city;
    this.setData({
      filterCity: city,
      activeFilter: '',
      page: 1,
      bidList: [],
      noMore: false
    });
    this.loadData();
  },

  selectSimpleFilter(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.currentTarget.dataset.value;

    if (value === '全部') {
      if (field === 'bid_type') {
        this.setData({ filterBidType: '', activeFilter: '' });
      } else if (field === 'method') {
        this.setData({ filterMethod: '', activeFilter: '' });
      }
    } else {
      if (field === 'bid_type') {
        this.setData({ filterBidType: value, activeFilter: '' });
      } else if (field === 'method') {
        this.setData({ filterMethod: value, activeFilter: '' });
      }
    }

    this.setData({
      page: 1,
      bidList: [],
      noMore: false
    });
    this.loadData();
  },

  clearAllFilters() {
    this.setData({
      filterProvince: '',
      filterCity: '',
      filterBidType: '',
      filterMethod: '',
      page: 1,
      bidList: [],
      noMore: false
    });
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      const params = {
        page: this.data.page,
        page_size: this.data.pageSize
      };
      if (this.data.filterBidType) {
        params.bid_type = this.data.filterBidType;
      }
      if (this.data.filterProvince) {
        params.province = this.data.filterProvince;
      }
      if (this.data.filterCity) {
        params.city = this.data.filterCity;
      }
      if (this.data.filterMethod) {
        params.bidding_method = this.data.filterMethod;
      }

      const data = await api.getBidList(params);
      this.setData({
        bidList: data.items || [],
        totalCount: data.pagination?.total || 0,
        loading: false,
        noMore: (data.items || []).length < this.data.pageSize
      });
    } catch (e) {
      console.error('加载数据失败', e);
      this.setData({ loading: false });
    }
  },

  async loadMore() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const nextPage = this.data.page + 1;
      const params = {
        page: nextPage,
        page_size: this.data.pageSize
      };
      if (this.data.filterBidType) {
        params.bid_type = this.data.filterBidType;
      }
      if (this.data.filterProvince) {
        params.province = this.data.filterProvince;
      }
      if (this.data.filterCity) {
        params.city = this.data.filterCity;
      }
      if (this.data.filterMethod) {
        params.bidding_method = this.data.filterMethod;
      }

      const data = await api.getBidList(params);
      const newItems = data.items || [];
      this.setData({
        bidList: [...this.data.bidList, ...newItems],
        page: nextPage,
        loading: false,
        noMore: newItems.length < this.data.pageSize
      });
    } catch (e) {
      console.error('加载更多失败', e);
      this.setData({ loading: false });
    }
  },

  switchTab(e) {
    const index = e.currentTarget.dataset.index;
    const type = e.currentTarget.dataset.type;
    this.setData({
      currentTab: index,
      page: 1,
      bidList: [],
      noMore: false,
      filterBidType: type
    });
    this.loadData();
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    });
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日`;
  }
})
