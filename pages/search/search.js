const api = require('../../utils/api.js');

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

Page({
  data: {
    keyword: '',
    loading: false,
    resultList: [],
    emptyText: '请输入关键词进行搜索',
    pageTitle: '查招标',
    statusBarHeight: 20,
    headerContentHeight: 32,
    currentFilters: {
      bidType: '',
      industry: '',
      region: '',
      time: ''
    },
    filterPanel: {
      show: false,
      type: '',
      title: '',
      options: [],
      selected: ''
    }
  },

  onLoad(options) {
    // 获取状态栏高度 + 微信胶囊位置，精确计算标题区位置
    const app = getApp();
    if (app && app.globalData) {
      const statusBarHeight = app.globalData.statusBarHeight || 20;
      const menuButton = app.globalData.menuButton;
      // 标题区高度 = 微信胶囊高度，与胶囊居中对齐
      const headerContentHeight = menuButton ? menuButton.height : 32;
      this.setData({ statusBarHeight, headerContentHeight });
    }

    // 接收传入的参数
    const updates = {};
    if (options.keyword) updates.keyword = decodeURIComponent(options.keyword);
    if (options.province) {
      updates.selectedProvince = decodeURIComponent(options.province);
      const newFilters = { ...this.data.currentFilters };
      newFilters.region = decodeURIComponent(options.province);
      updates.currentFilters = newFilters;
    }
    if (options.city) {
      updates.selectedCity = decodeURIComponent(options.city);
    }

    // type 参数：bids/plan → 设置默认 bidType
    if (options.type) {
      const t = decodeURIComponent(options.type);
      const newFilters = { ...(updates.currentFilters || this.data.currentFilters) };
      if (t === 'bids') {
        newFilters.bidType = '招标公告';
        updates.pageTitle = '查招标';
      } else if (t === 'win') {
        newFilters.bidType = '中标公告';
        updates.pageTitle = '查中标';
      } else if (t === 'plan') {
        newFilters.bidType = '工程类';
        updates.pageTitle = '查拟建';
      }
      updates.currentFilters = newFilters;
    }

    if (Object.keys(updates).length > 0) {
      this.setData(updates);
    }

    // 始终自动加载（无地区时显示全国数据）
    this.loadResults();
  },

  onBack() {
    wx.navigateBack({ delta: 1 });
  },

  onInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  onSearch() {
    if (!this.data.keyword.trim()) {
      wx.showToast({ title: '请输入关键词', icon: 'none' });
      return;
    }
    this.loadResults();
  },

  async loadResults() {
    this.setData({ loading: true });
    try {
      // 注意: API 字段名是 snake_case (publish_date_start, created_at)
      const params = {
        page: 1,
        page_size: 20,
        sort_by: 'created_at',
        sort_order: 'desc'
      };

      // 关键词过滤
      if (this.data.keyword && this.data.keyword.trim()) {
        params.keyword = this.data.keyword.trim();
      }

      // 地区过滤：来自首页（selectedProvince/selectedCity） 或 筛选条（currentFilters.region）
      const province = this.data.selectedProvince || this.data.currentFilters.region;
      const city = this.data.selectedCity;
      if (province) params.province = province;
      if (city) params.city = city;

      // 类型过滤：使用 list_type / bid_phase / category 三个不同字段做映射
      // 避免使用不被后端接受的 bid_type 值（如"中标公告"、"工程类"）
      const bidType = this.data.currentFilters.bidType;
      if (bidType) {
        if (bidType === '招标公告') {
          // 用 list_type 简化：排除已中标
          params.list_type = 'bids';
        } else if (bidType === '中标公告') {
          // 用 list_type 简化：仅成交公示
          params.list_type = 'wins';
        } else if (bidType === '招标') {
          params.bid_phase = '招标';
        } else if (bidType === '中标') {
          params.bid_phase = '中标';
        } else if (['工程类', '服务类', '货物类', '其他'].indexOf(bidType) !== -1) {
          // category 是 4 个枚举值之一
          params.category = bidType;
        } else if (this.data.BID_TYPES && this.data.BID_TYPES.indexOf(bidType) !== -1) {
          // bid_type 是 12 个枚举值之一
          params.bid_type = bidType;
        }
      }

      // 时间过滤：API 字段是 publish_date_start (YYYY-MM-DD)
      if (this.data.currentFilters.time) {
        const days = { '今日': 1, '近3天': 3, '近7天': 7, '近30天': 30, '近90天': 90 }[this.data.currentFilters.time];
        if (days) {
          const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
          params.publish_date_start = startDate.toISOString().split('T')[0];
        }
      }

      console.log('[search] 请求参数:', params);

      const data = await api.getBidList(params);

      const items = (data.items || []).map(item => {
        return {
          id: item.id,
          title: api.cleanTitle(item.title),
          desc: item.biddingMethod || '采购结果公告',
          buyer: item.buyer || item.agent || '未提供',
          winner: item.winner || '',
          province: item.province || '',
          city: item.city || '',
          bidType: item.bidType || '其他',
          time: formatRelativeTime(item.publishDate)
        };
      });

      this.setData({
        resultList: items,
        loading: false,
        emptyText: items.length === 0 ? (params.keyword ? `未找到与"${params.keyword}"相关的结果` : '该地区暂无数据') : ''
      });
    } catch (e) {
      console.error('[search] 搜索失败:', e);
      const errMsg = (e && e.message) || (typeof e === 'string' ? e : '搜索出错，请重试');
      this.setData({
        loading: false,
        resultList: [],
        emptyText: '搜索错误: ' + errMsg + '，请重试'
      });
    }
  },

  // 筛选弹窗
  showFilter(e) {
    const type = e.currentTarget.dataset.type;
    let title = '';
    let options = [];
    let selected = '';

    if (type === 'bidType') {
      title = '全部类型';
      options = ['招标公告', '中标公告', '交易公告', '交易结果', '工程类'];
      selected = this.data.currentFilters.bidType;
    } else if (type === 'industry') {
      title = '行业分类';
      options = ['能源化工', '医疗卫生', '教育培训', '市政建设', '交通运输', '信息技术', '建筑工程', '机械设备'];
      selected = this.data.currentFilters.industry;
    } else if (type === 'region') {
      title = '所在地区';
      options = ['北京', '上海', '广东', '江苏', '浙江', '山东', '天津', '重庆', '四川', '湖北', '河南', '福建', '河北', '湖南', '安徽'];
      selected = this.data.currentFilters.region;
    } else if (type === 'time') {
      title = '发布时间';
      options = ['今日', '近3天', '近7天', '近30天', '近90天'];
      selected = this.data.currentFilters.time;
    }

    this.setData({
      filterPanel: {
        show: true,
        type,
        title,
        options,
        selected
      }
    });
  },

  hideFilter() {
    this.setData({ 'filterPanel.show': false });
  },

  selectFilterOption(e) {
    const value = e.currentTarget.dataset.value;
    const { type, selected } = this.data.filterPanel;

    // 切换选中
    this.setData({ 'filterPanel.selected': value });

    // 更新筛选条件
    const newFilters = { ...this.data.currentFilters };
    if (type === 'bidType') newFilters.bidType = value;
    else if (type === 'industry') newFilters.industry = value;
    else if (type === 'region') newFilters.region = value;
    else if (type === 'time') newFilters.time = value;

    this.setData({ currentFilters: newFilters });
    this.hideFilter();

    // 重新加载
    this.loadResults();
  },

  onItemTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  }
})
