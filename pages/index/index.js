const api = require('../../utils/api.js');
const userApi = require('../../utils/user-api.js');
const cityData = require('../../utils/city-data.js');

// 构建 城市→省份 反查表（后端 province 为"全国"或空时，用 city 反查）
const cityToProvince = {};
for (const prov in cityData) {
  for (const city of cityData[prov]) {
    cityToProvince[city] = prov;
    // 也存带"市"后缀的版本
    cityToProvince[city + '市'] = prov;
  }
}

// 根据 item 的各字段推断真实省份
function inferProvince(item) {
  // 1. province 字段有效（非空、非"全国"）直接用
  if (item.province && item.province !== '全国') return item.province;
  // 2. 用 city 字段反查
  if (item.city) {
    const city = item.city.replace(/市$/, '');
    if (cityToProvince[city]) return cityToProvince[city];
    if (cityToProvince[item.city]) return cityToProvince[item.city];
    // 模糊匹配：城市名包含反查表中的 key
    for (const key in cityToProvince) {
      if (item.city.indexOf(key) >= 0 || key.indexOf(item.city) >= 0) return cityToProvince[key];
    }
  }
  // 3. 从 buyer/agent 字段提取省份名
  const buyerText = (item.buyer || '') + (item.agent || '');
  for (const prov in cityData) {
    if (buyerText.indexOf(prov) >= 0) return prov;
  }
  // 4. 从标题提取省份名
  const title = item.title || '';
  for (const prov in cityData) {
    if (title.indexOf(prov) >= 0) return prov;
  }
  // 5. 从 buyer/agent/title 提取城市名反查
  const fullText = buyerText + title;
  for (const key in cityToProvince) {
    if (fullText.indexOf(key) >= 0) return cityToProvince[key];
  }
  // 6. 兜底
  return '全国';
}

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
    functionList: [
      { name: '查招标', type: 'bids', color: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)', icon: '/images/icon-bid.svg' },
      { name: '查中标', type: 'win', color: 'linear-gradient(135deg, #a855f7 0%, #c084fc 100%)', icon: '/images/icon-win.svg' },
      { name: '查拟建', type: 'plan', color: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)', icon: '/images/icon-plan.svg' },
      { name: '查企业', type: 'company', color: 'linear-gradient(135deg, #14b8a6 0%, #2dd4bf 100%)', icon: '/images/icon-company.svg' }
    ],
    infoTabs: ['最新招标', '最新中标', '拟建项目'],
    currentInfoTab: 0,
    infoList: [],
    loading: true,
    loadingMore: false,
    hasMore: true,
    page: 1,
    pageSize: 20,
    totalCount: 0, // 当前筛选条件下的总条数（来自后端 pagination.total）
    regionPickerShow: false,
    provinces: Object.keys(cityData),
    cities: [],
    selectedProvince: '',
    selectedCity: '',
    tempProvince: '',
    tempCity: '',
    // Banner 轮播广告：默认使用 CSS 兜底，onLoad 时从 API 加载替换
    bannerList: [
      {
        id: 'ai-parse',
        theme: 'ai',
        title: 'AI智能解析，秒懂招标文件',
        subtitle1: '自动提取关键条款',
        subtitle2: '提升决策效率，解析更全面',
        tag: '限时免费',
        action: 'search'
      },
      {
        id: 'sign-in',
        theme: 'signin',
        title: '每日签到领积分',
        subtitle1: '每天 3 积分，1 分钟搞定',
        subtitle2: '连续签到 7 天额外奖励 50 积分',
        tag: '每日签到',
        action: 'points'
      }
    ],
    bannerFromApi: false,

    // 每日签到弹窗
    signinPopupShow: false,
    signinInfo: {
      signedToday: false,
      continuousDays: 0,
      todayPoints: 15
    },
    signinWeekList: [],

    // 顶部消息通知未读数
    unreadCount: 0
  },

  onLoad(options) {
    // 铃铛已改为 flex 布局：与"阳光标讯"标题一起在 header-center 中垂直居中
    // 不再需要依赖微信胶囊位置计算，兼容所有机型（iPhone X 全面屏 / 华为 / 小米 / OPPO 等）
    const app = getApp();

    // 检测是否通过邀请链接打开（好友点击分享卡片进入）
    if (options && options.inviteCode) {
      console.log('[首页] 检测到邀请码:', options.inviteCode);
      app.globalData.inviteCode = options.inviteCode;
      wx.setStorageSync('inviteCode', options.inviteCode);
    }

    // 初始默认显示"全国"，等待定位结果
    // 定位成功 → 自动切换到定位省份；定位失败 → 保持全国

    // 自动定位省份
    this._autoLocateProvince(app);

    // 初始加载全国列表（定位成功后会被刷新）
    this.loadBidList(true);

    // 从后端加载 Banner 图片
    this.loadBanners();

    // 检查今日签到状态（已登录用户才弹窗）
    this._initSigninCheck();

    // 加载未读消息数
    this._loadUnreadCount();
  },

  // 初始化签到检查：已登录 + 当日未签到 + 今日未弹出过 → 自动弹窗
  _initSigninCheck() {
    const userApi = require('../../utils/user-api.js');
    // 未登录：直接返回（弹窗会引导登录，但当前需求是已登录才签到）
    if (!userApi.getToken()) {
      console.log('[首页] 未登录，跳过签到检查');
      return;
    }
    // 今日已弹过：避免每次切回首页都弹
    const todayKey = 'signin_popup_shown_' + this._todayStr();
    const shown = wx.getStorageSync(todayKey);
    if (shown) {
      console.log('[首页] 今日已弹出过签到弹窗，跳过');
      return;
    }
    userApi.getPoints().then((res) => {
      if (!res) return;
      const signedToday = !!res.signedToday;
      const continuousDays = res.continuousSignDays || 0;
      const todayPoints = this._getDayPoints(continuousDays + (signedToday ? 0 : 1));
      this.setData({
        signinInfo: {
          signedToday,
          continuousDays,
          todayPoints
        },
        signinWeekList: this._buildSigninWeekList(continuousDays, signedToday)
      });
      if (!signedToday) {
        // 标记今日已弹（关闭后不再自动弹，需手动触发）
        wx.setStorageSync(todayKey, true);
        this.setData({ signinPopupShow: true });
      }
    }).catch((err) => {
      console.log('[首页] 签到状态检查失败（已忽略）:', err);
    });
  },

  // 计算连续签到 N 天应获得的积分（按需求：1=15, 2=20, 3=25, 4=30, 5=40, 6=50, 7=120）
  _getDayPoints(day) {
    const table = { 1: 15, 2: 20, 3: 25, 4: 30, 5: 40, 6: 50, 7: 120 };
    // 超过 7 天后回到第 1 天的奖励
    const d = ((day - 1) % 7) + 1;
    return table[d] || 15;
  },

  // 构建签到弹窗 7 天进度列表
  _buildSigninWeekList(continuousDays, signedToday) {
    // 当前是第几天（如果今日已签到，currentDay = continuousDays；未签到 = continuousDays + 1）
    const currentDay = signedToday ? continuousDays : continuousDays + 1;
    // 计算本周起点（第 1-7 天一组）
    const weekStart = Math.floor((currentDay - 1) / 7) * 7;
    const list = [];
    for (let i = 1; i <= 7; i++) {
      const day = weekStart + i;
      const points = this._getDayPoints(day);
      const isCurrent = day === currentDay;
      const isSigned = day < currentDay || (day === currentDay && signedToday);
      list.push({
        day,
        label: '第' + day + '天',
        points: points,
        signed: isSigned,
        isReward: day % 7 === 0,
        isCurrent
      });
    }
    return list;
  },

  _todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  },

  // 关闭签到弹窗
  onCloseSigninPopup() {
    this.setData({ signinPopupShow: false });
  },

  // 跳转到签到规则页
  onSigninRuleTap() {
    wx.navigateTo({ url: '/pages/signin-rule/signin-rule' });
  },

  // 点击签到按钮
  onSigninTap() {
    if (this.data.signinInfo.signedToday) {
      wx.showToast({ title: '今日已签到', icon: 'none' });
      return;
    }
    const userApi = require('../../utils/user-api.js');
    if (!userApi.getToken()) {
      // 未登录：先引导登录再签到
      wx.showModal({
        title: '提示',
        content: '签到需要先登录，是否立即登录？',
        success: (r) => {
          if (r.confirm) {
            wx.navigateTo({ url: '/pages/login/login' });
          }
        }
      });
      return;
    }
    wx.showLoading({ title: '签到中...', mask: true });
    this._doSignin(0);
  },

  _doSignin(retryCount) {
    const userApi = require('../../utils/user-api.js');
    userApi.signIn().then((res) => {
      wx.hideLoading();
      // 重新加载积分信息以获取最新的连续签到天数
      userApi.getPoints().then((pts) => {
        if (pts) {
          const continuousDays = pts.continuousSignDays || 0;
          this.setData({
            signinInfo: {
              signedToday: true,
              continuousDays,
              todayPoints: this._getDayPoints(continuousDays)
            },
            signinWeekList: this._buildSigninWeekList(continuousDays, true)
          });
        }
      });
      const added = (res && res.signInPoints) || (this.data.signinInfo && this.data.signinInfo.todayPoints) || 15;
      wx.showToast({ title: '签到成功 +' + added + ' 积分', icon: 'success' });
    }).catch((err) => {
      const errMsg = (err && err.message) || '';
      const httpStatus = err && err.httpStatus;
      console.warn('[首页] 签到失败 httpStatus=' + httpStatus + ' msg=' + errMsg, err);
      if (err && (err.code === 400 || errMsg.indexOf('已签到') !== -1)) {
        wx.hideLoading();
        // 已被后端识别为已签到，刷新数据并切换状态
        userApi.getPoints().then((pts) => {
          if (pts) {
            this.setData({
              signinInfo: {
                signedToday: true,
                continuousDays: pts.continuousSignDays || 0,
                todayPoints: this._getDayPoints(pts.continuousSignDays || 1)
              },
              signinWeekList: this._buildSigninWeekList(pts.continuousSignDays || 0, true)
            });
          }
        });
        wx.showToast({ title: '今日已签到', icon: 'none' });
      } else if (httpStatus === 403 && retryCount < 2) {
        try { wx.removeStorageSync('csrf_token'); } catch (e) { /* ignore */ }
        userApi.getPoints().then(() => {
          this._doSignin(retryCount + 1);
        }).catch(() => {
          wx.hideLoading();
          wx.showToast({ title: '签到失败，请稍后重试', icon: 'none' });
        });
      } else {
        wx.hideLoading();
        wx.showToast({ title: errMsg || '签到失败，请重试', icon: 'none' });
      }
    });
  },

  // 加载未读消息数（首页铃铛徽标）
  _loadUnreadCount() {
    const userApi = require('../../utils/user-api.js');
    if (!userApi.getToken()) {
      this.setData({ unreadCount: 0 });
      return;
    }
    userApi.getUnreadCount().then((res) => {
      // 后端 /unread-count 返回格式可能是：
      //   1) 数字本身：body.data = 2  → res = 2
      //   2) 对象：    body.data = {unreadCount: 2} 或 {count: 2}
      //   3) 兼容 snake_case：{unread_count: 2}
      let n = 0;
      if (typeof res === 'number') {
        n = res;
      } else if (res && typeof res === 'object') {
        n = res.unreadCount !== undefined ? res.unreadCount
          : (res.unread_count !== undefined ? res.unread_count
            : (res.count !== undefined ? res.count : 0));
      }
      console.log('[首页] 未读消息数:', n, '(原始返回:', JSON.stringify(res), ')');
      this.setData({ unreadCount: n });
    }).catch((err) => {
      // 静默失败，不影响首页浏览
      console.log('[首页] 加载未读消息数失败:', err);
    });
  },

  // 点击铃铛跳转到消息页
  onNoticeTap() {
    const userApi = require('../../utils/user-api.js');
    if (!userApi.getToken()) {
      wx.showModal({
        title: '提示',
        content: '查看消息需要先登录，是否立即登录？',
        success: (r) => {
          if (r.confirm) {
            wx.navigateTo({ url: '/pages/login/login' });
          }
        }
      });
      return;
    }
    // 仅跳转消息页，由消息页内的"全部已读"按钮控制已读状态
    // onShow 时会重新拉取未读数，自动同步最新状态
    wx.navigateTo({ url: '/pages/notifications/notifications' });
  },

  // 从 GET /api/v1/banners 加载 Banner，失败时保留 CSS 兜底
  loadBanners() {
    api.getBannerList().then((data) => {
      const list = Array.isArray(data) ? data : (data && data.items) || [];
      if (list.length === 0) {
        console.log('[首页] 后端无 Banner 数据，使用 CSS 兜底');
        return;
      }
      const bannerList = list.map(item => ({
        id: item.id,
        imageUrl: item.imageUrl || item.image_url || '',
        title: item.title || '',
        linkUrl: item.linkUrl || item.link_url || '',
        sortOrder: item.sortOrder || item.sort_order || 0
      })).filter(b => b.imageUrl); // 仅保留有图片的
      if (bannerList.length > 0) {
        console.log('[首页] Banner 从 API 加载:', bannerList.length, '张');
        this.setData({ bannerList, bannerFromApi: true });
      }
    }).catch((err) => {
      console.log('[首页] Banner API 加载失败，使用 CSS 兜底:', err);
    });
  },

  onShow() {
    const app = getApp();
    // 场景：热重载/从后台恢复时，app.js 重新 onLaunch 但页面 onLoad 未重新执行
    // 如果定位已完成且失败（locatedProvince 为空），但页面残留旧的省份选择，清除并重新加载全国
    if (app && app.globalData && app.globalData.locationDone && !app.globalData.locatedProvince && this.data.selectedProvince) {
      console.log('[首页] onShow: 定位失败但页面残留省份', this.data.selectedProvince, '→ 清除并加载全国数据');
      this.data.selectedProvince = '';
      this.data.selectedCity = '';
      this.data.region = '全国';
      this.data.city = '';
      this.setData({
        selectedProvince: '',
        selectedCity: '',
        region: '全国',
        city: '',
        cities: []
      });
      this.loadBidList(true);
      return;
    }

    // 每次 onShow 强制把列表项 region 同步为当前 selectedProvince
    // 解决"已筛选省份后列表项 region 没刷新"的 bug
    if (this.data.selectedProvince) {
      const list = (this.data.infoList || []).map(item => ({
        ...item,
        region: this.data.selectedProvince,
        region2: ''
      }));
      this.setData({ infoList: list });
    }
    // 仅在列表为空时加载，避免每次返回页面都重置
    if (this.data.infoList.length === 0) {
      this.loadBidList(true);
    }

    // 每次 onShow 刷新未读消息数（从消息页返回时同步最新状态）
    this._loadUnreadCount();
  },

  // 自动定位省份：启动时调用，定位成功后自动切换到用户所在省份
  _autoLocateProvince(app) {
    if (!app || !app.globalData) return;

    // 定位尚未完成：注册回调，等 app.js 定位完成后通知
    if (!app.globalData.locationDone) {
      app.onLocationReady = (province) => {
        app.onLocationReady = null; // 只执行一次
        this._applyLocatedProvince(province);
      };
    } else {
      // 定位已完成，直接取结果
      if (app.globalData.locatedProvince) {
        this._applyLocatedProvince(app.globalData.locatedProvince);
      }
    }
  },

  // 应用定位到的省份：自动切换左上角选择器 + 刷新列表
  _applyLocatedProvince(province) {
    if (!province) return;
    // 校验省份名是否在 city-data 中存在
    if (!cityData[province]) {
      console.warn('[首页] 定位省份不在列表中:', province);
      return;
    }
    // 如果当前已经是这个省份（缓存已恢复），不需要重复刷新
    if (this.data.selectedProvince === province) {
      console.log('[首页] 定位省份与当前一致，跳过:', province);
      return;
    }
    console.log('[首页] 自动切换到定位省份:', province);
    // setData 是异步的，先同步给 this.data 赋值再 loadBidList，
    // 否则 loadBidList 内读到的 selectedProvince 仍是旧值
    this.data.selectedProvince = province;
    this.data.selectedCity = '';
    this.data.cities = cityData[province] || [];
    this.data.region = province;
    this.data.city = '';
    this.data.hasMore = true;
    // 同步修正列表项的 region
    const syncedList = (this.data.infoList || []).map(it => ({
      ...it,
      region: province,
      region2: ''
    }));
    this.data.infoList = syncedList;
    this.setData({
      selectedProvince: province,
      selectedCity: '',
      cities: cityData[province] || [],
      region: province,
      city: '',
      hasMore: true,
      infoList: syncedList
    });
    // 刷新列表（带上定位省份）
    this.loadBidList(true);
  },

  onPullDownRefresh() {
    // 下拉刷新：重置到第一页
    this.loadBidList(true).then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    // 上拉触底：加载下一页，直到所有信息加载完
    if (this.data.loading || this.data.loadingMore || !this.data.hasMore) return;
    this.loadBidList(false);
  },

  async loadBidList(reset) {
    if (this.data.loadingMore) return;
    const page = reset ? 1 : this.data.page;
    this.setData({
      loading: reset,
      loadingMore: !reset
    });

    try {
      const params = {
        page,
        page_size: this.data.pageSize,
        sort_by: 'created_at',
        sort_order: 'desc'
      };

      // Tab 映射（使用 list_type 简化）
      // Tab 0: 最新招标 (list_type=bids 排除中标)
      // Tab 1: 最新中标 (list_type=wins 仅成交公示)
      // Tab 2: 拟建项目 (bid_type=招标预告 - 项目预告/预公示)
      const tab = this.data.currentInfoTab;
      if (tab === 0) {
        params.list_type = 'bids';
      } else if (tab === 1) {
        params.list_type = 'wins';
      } else if (tab === 2) {
        params.bid_type = '招标预告';
      }

      if (this.data.selectedProvince) params.province = this.data.selectedProvince;
      if (this.data.selectedCity) params.city = this.data.selectedCity;

      console.log('[loadBidList] 请求参数:', params);

      const data = await api.getBidList(params);

      // API 返回结构: { items, pagination: { total, page, pageSize, totalPages } }
      const pagination = data.pagination || {};
      const total = pagination.total || 0;
      console.log('[loadBidList] 返回 items:', (data.items || []).length, 'total:', total, 'pagination:', pagination);

      // api.js 已将 snake_case 转 camelCase（publishDate, bidType 等）
      // 地区标签：有筛选省份时强制用筛选的；无筛选时用 inferProvince 推断真实省份
      // （后端可能对部分标讯返回 province="全国"，需通过 city/buyer/title 反查）
      const curProvince = this.data.selectedProvince || '';
      const useCurProvince = !!curProvince;
      const items = (data.items || []).map(item => {
        const tag = getTypeTag(item.bidType);
        const inferredProvince = useCurProvince ? curProvince : inferProvince(item);
        return {
          id: item.id,
          title: api.cleanTitle(item.title),
          company: item.buyer || item.agent || '未提供',
          region: inferredProvince,
          region2: useCurProvince ? '' : (item.city || ''),
          tag: item.bidType || item.biddingMethod || '',
          tagBg: tag.bg,
          tagColor: tag.color,
          time: formatRelativeTime(item.publishDate),
          budget: item.budget || ''
        };
      });

      const list = reset ? items : this.data.infoList.concat(items);
      // 判断是否还有更多：
      // 1) 已加载数 < 总数 → 还有未加载的数据
      // 2) 本页返回满 pageSize → 后端可能还有下一页
      // 3) 兜底：如果 total 未知但本页满 pageSize，也允许继续加载
      let hasMore;
      if (total > 0) {
        hasMore = list.length < total;
      } else {
        // total 未知时，按本页是否满 pageSize 判断
        hasMore = items.length >= this.data.pageSize;
      }

      this.setData({
        infoList: list,
        page: page + 1,
        loading: false,
        loadingMore: false,
        hasMore,
        totalCount: total
      });
    } catch (e) {
      console.error('加载招标列表失败', e);
      this.setData({ loading: false, loadingMore: false, hasMore: false, totalCount: 0 });
      if (reset) this.setData({ infoList: [] });
    }
  },

  // 打开省市选择器
  showRegionPicker() {
    // 初始化临时选中状态为当前已选值
    this.data.tempProvince = this.data.selectedProvince;
    this.data.tempCity = this.data.selectedCity;
    this.setData({
      regionPickerShow: true,
      tempProvince: this.data.selectedProvince,
      tempCity: this.data.selectedCity,
      cities: this.data.selectedProvince ? (cityData[this.data.selectedProvince] || []) : []
    });
  },

  // 关闭省市选择器
  hideRegionPicker() {
    this.setData({ regionPickerShow: false });
  },

  // 选择省份（只更新临时选中状态，不立即刷新列表，等用户点确认）
  selectProvince(e) {
    const province = e.currentTarget.dataset.province;
    // 只更新弹窗内的临时选中状态和左上角显示
    // 注意：不修改 selectedProvince（真正生效的值），等 onConfirmRegion 才提交
    this.setData({
      tempProvince: province,
      tempCity: '',
      cities: province ? (cityData[province] || []) : [],
      region: province || '全国',
      city: ''
    });
  },

  // 选择城市（只更新临时选中状态，等用户点确认）
  selectCity(e) {
    const city = e.currentTarget.dataset.city;
    this.setData({
      tempCity: city,
      city: city
    });
  },

  // 确认筛选（关闭弹窗，把临时选中状态提交到 selectedProvince/City，并加载数据）
  onConfirmRegion() {
    this.hideRegionPicker();
    // 把临时选中状态提交为正式值，同步赋值 this.data 避免 setData 异步导致 loadBidList 读到旧值
    const province = this.data.tempProvince !== undefined ? this.data.tempProvince : this.data.selectedProvince;
    const city = this.data.tempCity !== undefined ? this.data.tempCity : this.data.selectedCity;
    this.data.selectedProvince = province;
    this.data.selectedCity = city;
    this.data.hasMore = true;
    this.setData({
      selectedProvince: province,
      selectedCity: city,
      hasMore: true
    });
    this.loadBidList(true);
  },

  // 重置筛选（在弹窗中，只重置临时状态）
  onResetFilter() {
    this.setData({
      tempProvince: '',
      tempCity: '',
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
      city: '',
      hasMore: true
    });
    this.loadBidList(true);
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

  // Banner 点击：根据 action 跳转不同目标
  onBannerTap(e) {
    const idx = e.currentTarget.dataset.idx;
    const banner = this.data.bannerList[idx];
    if (!banner) return;
    // API Banner：有 linkUrl 时跳转链接
    if (banner.linkUrl) {
      // 小程序内部路径
      if (banner.linkUrl.indexOf('/pages/') === 0) {
        wx.navigateTo({ url: banner.linkUrl });
      } else {
        // 外部链接：复制到剪贴板提示
        wx.setClipboardData({
          data: banner.linkUrl,
          success: () => wx.showToast({ title: '链接已复制', icon: 'success' })
        });
      }
      return;
    }
    // CSS 兜底 Banner：按 action 跳转
    const action = banner.action || e.currentTarget.dataset.action;
    if (!action) return;
    switch (action) {
      case 'search':
        wx.navigateTo({ url: '/pages/search/search' });
        break;
      case 'points':
        wx.navigateTo({ url: '/pages/points/points' });
        break;
      case 'profile':
        wx.switchTab({ url: '/pages/profile/profile' });
        break;
      default:
        break;
    }
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
      wx.navigateTo({ url: '/pages/companies/companies' });
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

  // 点击邀请好友 banner — 已改为 open-type="share" 按钮，无需手动跳转
  onInviteTap() {
    // 保留方法但不再使用（button open-type="share" 会自动调起分享）
  },

  // 分享给微信好友
  onShareAppMessage() {
    // 文档规则：邀请码 = 邀请人的 userId 字符串
    const userInfo = userApi.getUserInfo ? userApi.getUserInfo() : null;
    const inviteCode = (userInfo && (userInfo.id || userInfo.userId)) || '';
    return {
      title: '阳光标讯 - 海量招标信息，一键查询',
      path: '/pages/index/index?inviteCode=' + inviteCode,
      imageUrl: ''
    };
  },

  // 分享到朋友圈
  onShareTimeline() {
    const userInfo = userApi.getUserInfo ? userApi.getUserInfo() : null;
    const inviteCode = (userInfo && (userInfo.id || userInfo.userId)) || '';
    return {
      title: '阳光标讯 - 海量招标信息，一键查询',
      query: 'inviteCode=' + inviteCode
    };
  },

  switchInfoTab(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ currentInfoTab: index, hasMore: true });
    this.loadBidList(true);
  },

  onItemTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  }
})
