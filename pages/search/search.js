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
    keywordList: [],            // 多关键词列表（来自订阅的关键词被分隔为多个）
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
    if (options.keyword) {
      const kw = decodeURIComponent(options.keyword);
      updates.keyword = kw;
      // 多关键词：检测是否含分隔符（空格/中文逗号/顿号/竖线）
      // 订阅关键词可能存为 "A,B,C" 或 "A B" 或 "A、B" 等
      const keywords = kw.split(/[\s,，、|]+/).filter(s => s && s.trim());
      updates.keywordList = keywords.length > 1 ? keywords : [kw];
    }
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
        newFilters.bidType = '招标预告';
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
      // 公共查询参数
      const baseParams = {
        page: 1,
        page_size: 20,
        sort_by: 'created_at',
        sort_order: 'desc'
      };

      // 地区过滤
      const province = this.data.selectedProvince || this.data.currentFilters.region;
      const city = this.data.selectedCity;
      if (province) baseParams.province = province;
      if (city) baseParams.city = city;

      // 类型过滤
      this._applyBidTypeFilter(baseParams);

      // 时间过滤
      this._applyTimeFilter(baseParams);

      console.log('[search] 请求基础参数:', baseParams);

      // 多关键词：每个关键词并发查一次，按 OR 合并去重
      const keywordList = this.data.keywordList && this.data.keywordList.length > 0
        ? this.data.keywordList
        : (this.data.keyword && this.data.keyword.trim() ? [this.data.keyword.trim()] : []);

      let items = [];
      if (keywordList.length === 0) {
        // 无关键词：单次查询
        const data = await api.getBidList(baseParams);
        items = data.items || [];
      } else if (keywordList.length === 1) {
        // 单关键词：单次查询
        const params = Object.assign({}, baseParams, { keyword: keywordList[0] });
        const data = await api.getBidList(params);
        items = data.items || [];
      } else {
        // 多关键词：并发查每个关键词，再合并去重
        const promises = keywordList.map(kw => {
          const params = Object.assign({}, baseParams, { keyword: kw });
          return api.getBidList(params).catch(err => {
            console.warn('[search] 关键词查询失败:', kw, err);
            return { items: [] };
          });
        });
        const results = await Promise.all(promises);
        // 按 id 去重（同一标讯可能被多个关键词匹配）
        const seen = new Set();
        items = [];
        results.forEach(r => {
          (r.items || []).forEach(it => {
            if (!seen.has(it.id)) {
              seen.add(it.id);
              items.push(it);
            }
          });
        });
        // 合并后按 created_at 倒序
        items.sort((a, b) => {
          const ta = new Date(a.createdAt || a.created_at || a.publishDate || a.publish_date || 0).getTime();
          const tb = new Date(b.createdAt || b.created_at || b.publishDate || b.publish_date || 0).getTime();
          return tb - ta;
        });
        // 只保留前 50 条（多关键词会成倍扩大结果）
        items = items.slice(0, 50);
      }

      const mapped = items.map(item => {
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

      // 空提示文案
      let emptyText = '';
      if (mapped.length === 0) {
        if (keywordList.length > 1) {
          emptyText = `未找到与"${keywordList.join('"或"')}"相关的结果`;
        } else if (keywordList.length === 1) {
          emptyText = `未找到与"${keywordList[0]}"相关的结果`;
        } else {
          emptyText = '该地区暂无数据';
        }
      }

      this.setData({
        resultList: mapped,
        loading: false,
        emptyText
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

  // 把 bidType 映射为后端字段
  _applyBidTypeFilter(params) {
    const bidType = this.data.currentFilters.bidType;
    if (!bidType) return;
    if (bidType === '招标公告') {
      params.list_type = 'bids';
    } else if (bidType === '中标公告') {
      params.list_type = 'wins';
    } else if (bidType === '招标') {
      params.bid_phase = '招标';
    } else if (bidType === '中标') {
      params.bid_phase = '中标';
    } else if (['工程类', '服务类', '货物类', '其他'].indexOf(bidType) !== -1) {
      params.category = bidType;
    } else {
      // bid_type 12 个标准值
      params.bid_type = bidType;
      if (['招标预告', '意见征集', '重新招标', '信息变更', '答疑公告'].indexOf(bidType) !== -1) {
        params.bid_phase = '招标';
      } else {
        params.bid_phase = '中标';
      }
    }
  },

  // 把 time 映射为 publish_date_start
  _applyTimeFilter(params) {
    if (!this.data.currentFilters.time) return;
    const days = { '今日': 1, '近3天': 3, '近7天': 7, '近30天': 30, '近90天': 90 }[this.data.currentFilters.time];
    if (!days) return;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    params.publish_date_start = startDate.toISOString().split('T')[0];
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
