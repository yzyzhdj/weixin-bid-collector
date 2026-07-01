// 用户中心 API
const userApi = require('../../utils/user-api.js');

// 流水类型映射
const TYPE_MAP = {
  sign: '每日签到',
  recharge: '充值获得',
  view_bid: '查看标讯',
  admin_adjust: '管理员调整',
  admin_deduct: '管理员扣除'
};

Page({
  data: {
    statusBarHeight: 20,
    points: 0,
    totalEarned: 0,
    totalSpent: 0,
    signedDays: 0,
    todaySigned: false,
    signInPoints: 3,
    viewBidCost: 1,
    yuanPerPoint: 1,
    newUserPoints: 200,
    pointEnabled: true,
    // 流水
    transactions: [],
    activeTab: 'all',   // all / sign / recharge / view_bid / admin
    page: 1,
    hasMore: true,
    loading: false,
    // 充值套餐弹窗
    rechargePopupShow: false,
    rechargePlans: [],         // 套餐列表（来自后端，或本地默认）
    rechargeLoading: false,    // 正在创建订单/拉起支付
    selectedPlanId: ''         // 当前选中的套餐 ID
  },

  onLoad() {
    const app = getApp();
    if (app && app.globalData) {
      this.setData({ statusBarHeight: app.globalData.statusBarHeight || 20 });
    }
    this.loadData();
    this.loadTransactions();
  },

  onShow() {
    this.loadData();
    this.setData({ page: 1, transactions: [], hasMore: true });
    this.loadTransactions();
  },

  onBackTap() {
    wx.navigateBack({ delta: 1, fail: () => {
      wx.switchTab({ url: '/pages/profile/profile' });
    }});
  },

  // 加载积分账户信息
  loadData() {
    if (!userApi.getToken()) return;
    userApi.getPoints().then((res) => {
      if (!res) return;
      this.setData({
        points: res.balance || 0,
        totalEarned: res.totalEarned || 0,
        totalSpent: res.totalSpent || 0,
        signedDays: res.continuousSignDays || 0,
        todaySigned: res.signedToday || false,
        signInPoints: res.signInPoints || 3,
        viewBidCost: res.viewBidCost || 1,
        yuanPerPoint: res.yuanPerPoint || 1,
        pointEnabled: res.pointEnabled !== false
      });
    }).catch(() => {});
  },

  // 加载积分流水
  loadTransactions() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });

    const type = this.data.activeTab === 'all' ? undefined : this.data.activeTab;
    userApi.getPointTransactions(this.data.page, 20, type).then((res) => {
      const items = (res && (res.items || res.list || res.records)) || [];
      const mapped = items.map(it => ({
        id: it.id,
        typeLabel: it.typeLabel || TYPE_MAP[it.type] || it.type || '其他',
        type: it.type,
        amount: it.amount,
        isIncome: it.amount > 0,
        description: it.description || '',
        time: formatTime(it.createdAt || it.created_at)
      }));

      this.setData({
        transactions: this.data.page === 1 ? mapped : this.data.transactions.concat(mapped),
        loading: false,
        hasMore: this.data.transactions.length + mapped.length < ((res && res.pagination && res.pagination.total) || 0)
      });
    }).catch((err) => {
      this.setData({ loading: false });
      console.error('[points] 加载流水失败:', err);
    });
  },

  // 切换 tab
  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.activeTab) return;
    this.setData({
      activeTab: tab,
      page: 1,
      transactions: [],
      hasMore: true
    });
    this.loadTransactions();
  },

  // 上拉加载
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadTransactions();
    }
  },

  // 签到
  onSignTap() {
    if (this.data.todaySigned) {
      wx.showToast({ title: '今日已签到', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '签到中...', mask: true });
    this._doSignIn(0);
  },

  _doSignIn(retryCount) {
    userApi.signIn().then((res) => {
      wx.hideLoading();
      // 签到成功后，从后端重新加载真实数据
      this.loadData();
      this.setData({ page: 1, transactions: [], hasMore: true });
      this.loadTransactions();
      const added = (res && res.signInPoints) || this.data.signInPoints;
      wx.showToast({ title: '签到成功 +' + added + ' 积分', icon: 'success' });
    }).catch((err) => {
      const errMsg = (err && err.message) || '';
      const httpStatus = err && err.httpStatus;
      console.warn('[points] 签到失败 httpStatus=' + httpStatus + ' code=' + (err && err.code) + ' msg=' + errMsg, err);

      if (err && (err.code === 400 || errMsg.indexOf('已签到') !== -1)) {
        wx.hideLoading();
        this.loadData();
        wx.showToast({ title: '今日已签到', icon: 'none' });
      } else if (httpStatus === 403 && retryCount < 2) {
        // 403 可能是 CSRF Token 缺失：先发一个 GET 请求获取 CSRF Token，再重试
        console.log('[points] 签到 403，尝试获取 CSRF Token 后重试 (retry=' + retryCount + ')');
        // 清除旧 token 强制重新获取
        try { wx.removeStorageSync('csrf_token'); } catch (e) { /* ignore */ }
        userApi.getPoints().then(() => {
          this._doSignIn(retryCount + 1);
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

  // ============ 积分充值（微信支付 JSAPI，对应 POINT_RECHARGE_API.md） ============

  // 默认套餐（后端 /api/v1/points/packages 不可用时使用）
  // 字段对齐后端：yuan / points / bonus / points_total / sort_order
  _defaultPlans(ypp) {
    return [
      { id: 1,  name: '1 元套餐',   yuan: 1,   points: 1   * ypp, bonus: 0,            points_total: 1   * ypp, sort_order: 1, remark: '基础体验' },
      { id: 2,  name: '6 元套餐',   yuan: 6,   points: 6   * ypp, bonus: 1   * ypp,    points_total: 7   * ypp, sort_order: 2, remark: '赠送' + (1*ypp) + '积分' },
      { id: 3,  name: '30 元套餐',  yuan: 30,  points: 30  * ypp, bonus: 8   * ypp,    points_total: 38  * ypp, sort_order: 3, remark: '推荐，赠送' + (8*ypp) + '积分' },
      { id: 4,  name: '68 元套餐',  yuan: 68,  points: 68  * ypp, bonus: 22  * ypp,    points_total: 90  * ypp, sort_order: 4, remark: '赠送' + (22*ypp) + '积分' },
      { id: 5,  name: '198 元套餐', yuan: 198, points: 198 * ypp, bonus: 80  * ypp,    points_total: 278 * ypp, sort_order: 5, remark: '赠送' + (80*ypp) + '积分' }
    ];
  },

  // 点击"积分充值"按钮 → 打开弹窗，加载套餐
  onRechargeTap() {
    // 未登录拦截
    if (!userApi.getToken()) {
      wx.showModal({
        title: '提示',
        content: '充值需要先登录，是否立即登录？',
        success: (r) => { if (r.confirm) wx.navigateTo({ url: '/pages/login/login' }); }
      });
      return;
    }
    this.setData({ rechargePopupShow: true, rechargePlans: [], selectedPlanId: '' });
    this._loadRechargePlans();
  },

  // 加载充值套餐（后端不可用时使用默认）
  _loadRechargePlans() {
    const ypp = this.data.yuanPerPoint || 1;
    userApi.getRechargePlans().then((res) => {
      // 后端返回数组（POINT_RECHARGE_API.md §4.1）
      const items = Array.isArray(res) ? res : (res && (res.items || res.list) || []);
      if (items.length > 0) {
        // 过滤 visible=true 并按 sort_order 升序
        const visible = items.filter(p => p.visible === undefined || p.visible === true)
                              .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        this.setData({ rechargePlans: visible.length > 0 ? visible : items });
      } else {
        this.setData({ rechargePlans: this._defaultPlans(ypp) });
      }
    }).catch(() => {
      // 后端未实现 → 使用默认套餐
      this.setData({ rechargePlans: this._defaultPlans(ypp) });
    });
  },

  // 选中某个套餐
  onSelectPlan(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ selectedPlanId: id });
  },

  // 关闭充值弹窗
  onCloseRecharge() {
    if (this.data.rechargeLoading) {
      wx.showToast({ title: '正在处理支付，请稍候', icon: 'none' });
      return;
    }
    this.setData({ rechargePopupShow: false });
  },

  // 确认充值：wx.login 拿 code → 调后端创建订单 → 拉起 wx.requestPayment → 轮询订单状态
  onConfirmRecharge() {
    const plan = (this.data.rechargePlans || []).find(p => p.id === this.data.selectedPlanId);
    if (!plan) {
      wx.showToast({ title: '请选择充值套餐', icon: 'none' });
      return;
    }
    if (this.data.rechargeLoading) return;

    // 校验金额
    if (!plan.yuan || plan.yuan < 1) {
      wx.showToast({ title: '支付金额需≥1元', icon: 'none' });
      return;
    }

    // 校验：基础库版本（wx.requestPayment 2.x+ 通用）
    if (!wx.requestPayment) {
      wx.showModal({
        title: '暂不支持',
        content: '当前微信版本过低，无法使用微信支付，请升级微信至最新版本。',
        showCancel: false
      });
      return;
    }

    this.setData({ rechargeLoading: true });
    wx.showLoading({ title: '创建订单...', mask: true });

    // Step 1: 调 wx.login 拿 code，作为 login_code 传给后端
    // 后端用 code 调 jscode2session 拿 session_key（生成 signature 必需）和 openid
    new Promise((resolve, reject) => {
      wx.login({
        success: (r) => {
          if (r.code) resolve(r.code);
          else reject({ message: '获取 login_code 失败' });
        },
        fail: (err) => reject({ message: 'wx.login 失败：' + (err.errMsg || ''), raw: err })
      });
    }).then((loginCode) => {
      // Step 2: 调后端创建订单，传 login_code
      console.log('[points] wx.login 成功，login_code 长度:', loginCode.length, '前8位:', loginCode.substring(0, 8) + '...');
      return userApi.createRechargeOrder({
        package_id: plan.id,
        trade_type: 'VIRTUAL',
        login_code: loginCode
      });
    }).then((order) => {
      wx.hideLoading();
      console.log('[points] 创建订单返回:', JSON.stringify(order).substring(0, 200));
      // 成功条件：后端返回 sign_data + pay_sig + signature（虚拟支付）
      //          或 jsapi_pay 对象（JSAPI 兜底）
      const hasVirtualSign = order && order.sign_data && order.pay_sig && order.signature;
      const hasJsapiPay = order && order.jsapi_pay && order.jsapi_pay.package;
      if (!hasVirtualSign && !hasJsapiPay) {
        this.setData({ rechargeLoading: false });
        const msg = (order && order.fail_reason) || '订单创建失败，请重试';
        wx.showToast({ title: msg, icon: 'none' });
        return;
      }
      // 拉起支付
      this._invokePay(order, plan);
    }).catch((err) => {
      wx.hideLoading();
      this.setData({ rechargeLoading: false });
      console.error('[points] 创建充值订单失败:', err);
      const msg = (err && err.message) || '订单创建失败';
      // 特殊提示：如果是 openid 错误，给用户更清晰的引导
      if (msg.indexOf('openid') !== -1) {
        wx.showModal({
          title: '需要重新登录',
          content: '为了使用微信支付，请退出后重新登录一次（用于获取支付所需的 openid）。',
          confirmText: '去登录',
          success: (r) => { if (r.confirm) wx.navigateTo({ url: '/pages/login/login' }); }
        });
      } else {
        wx.showToast({ title: msg, icon: 'none' });
      }
    });
  },

  // 调用支付（兼容虚拟支付 wx.requestVirtualPayment 和普通 JSAPI wx.requestPayment）
  _invokePay(order, plan) {
    // 虚拟支付：后端直接返回 sign_data + pay_sig + signature + mode
    if (order.sign_data && order.pay_sig && order.signature) {
      if (!wx.requestVirtualPayment) {
        wx.showModal({ title: '暂不支持', content: '当前微信版本不支持虚拟支付，请升级微信。', showCancel: false });
        this.setData({ rechargeLoading: false });
        return;
      }

      const mode = order.mode || 'short_series_goods';
      console.log('[points] 拉起虚拟支付:', {
        mode,
        signData: order.sign_data,
        paySig: '(有)',
        signature: '(有)'
      });

      wx.requestVirtualPayment({
        signData: order.sign_data,    // 后端返回的 JSON 字符串
        paySig: order.pay_sig,
        signature: order.signature,
        mode: mode,
        success: (res) => {
          console.log('[points] 虚拟支付成功（微信已扣款），等待后端确认到账:', res);
          // 虚拟支付是异步的：微信扣款成功后，会异步调后端"发货回调"接口
          // 后端在回调里给用户加积分 + 更新订单状态为 paid
          // 所以前端不能立即刷新积分，需要轮询订单状态
          wx.showLoading({ title: '确认到账中...', mask: true });
          this._pollOrderStatus(order.order_no, 0, plan);
        },
        fail: (err) => {
          this.setData({ rechargeLoading: false });
          console.error('[points] 虚拟支付失败:', err);
          const errMsg = (err && err.errMsg) || '';
          if (errMsg.indexOf('cancel') !== -1) {
            wx.showToast({ title: '已取消支付', icon: 'none' });
            userApi.closeOrder(order.order_no).catch(() => {});
          } else {
            wx.showToast({ title: '支付失败：' + errMsg, icon: 'none' });
          }
        }
      });
    } else if (order.jsapi_pay && order.jsapi_pay.package) {
      // 普通 JSAPI 支付：wx.requestPayment（兜底）
      console.log('[points] 拉起 JSAPI 支付:', order.jsapi_pay);
      const jsapiPay = order.jsapi_pay;
      wx.requestPayment({
        timeStamp: jsapiPay.timeStamp,
        nonceStr: jsapiPay.nonceStr,
        package: jsapiPay.package,
        signType: jsapiPay.signType,
        paySign: jsapiPay.paySign,
        success: (res) => {
          console.log('[points] JSAPI 支付成功:', res);
          wx.showLoading({ title: '确认到账中...', mask: true });
          this._pollOrderStatus(order.order_no, 0, plan);
        },
        fail: (err) => {
          this.setData({ rechargeLoading: false });
          const errMsg = (err && err.errMsg) || '';
          if (errMsg.indexOf('cancel') !== -1) {
            wx.showToast({ title: '已取消支付', icon: 'none' });
            userApi.closeOrder(order.order_no).catch(() => {});
          } else {
            wx.showToast({ title: '支付失败：' + errMsg, icon: 'none' });
          }
        }
      });
    } else {
      this.setData({ rechargeLoading: false });
      wx.showToast({ title: '订单数据异常，请重试', icon: 'none' });
    }
  },

  // 调用 wx.requestPayment（微信支付 JSAPI）— 保留供轮询回调使用
  _invokeJsapiPay(order, plan) {
    this._invokePay(order, plan);
  },

  // 轮询订单状态（最多 30 次 × 2 秒 = 60 秒）
  _pollOrderStatus(orderNo, attempts, plan) {
    if (attempts > 30) {
      wx.hideLoading();
      this.setData({ rechargeLoading: false });
      // 超时：可能是回调延迟，但通常支付已成功，提示用户稍后查看
      wx.showModal({
        title: '支付确认超时',
        content: '如果微信已扣款，积分将在几秒内到账，请稍后查看积分余额。',
        showCancel: false,
        success: () => {
          this.setData({ rechargePopupShow: false });
          this.loadData();
          this.setData({ page: 1, transactions: [], hasMore: true });
          this.loadTransactions();
        }
      });
      return;
    }
    userApi.getOrderStatus(orderNo).then((order) => {
      if (order && order.status === 'paid') {
        wx.hideLoading();
        this.setData({ rechargeLoading: false, rechargePopupShow: false });
        const pts = order.points_total || (plan.points_total || 0);
        wx.showToast({ title: '充值成功 +' + pts + ' 积分', icon: 'success' });
        // 刷新积分余额 + 流水
        this.loadData();
        this.setData({ page: 1, transactions: [], hasMore: true });
        this.loadTransactions();
      } else {
        // 继续轮询
        setTimeout(() => this._pollOrderStatus(orderNo, attempts + 1, plan), 2000);
      }
    }).catch(() => {
      // 网络错误也继续轮询
      setTimeout(() => this._pollOrderStatus(orderNo, attempts + 1, plan), 2000);
    });
  }
})

// 格式化时间
function formatTime(dateStr) {
  if (!dateStr) return '';
  const m = String(dateStr).match(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5];
  return String(dateStr).slice(0, 16);
}
