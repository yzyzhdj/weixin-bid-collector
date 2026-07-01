// 用户中心 API
const userApi = require('../../utils/user-api.js');
// 标讯 API 配置（用于本地回退发送验证码接口）
const { API_BASE_URL } = require('../../utils/config.js');

const COOLDOWN_SECONDS = 120;       // 2分钟防刷限制
const COOLDOWN_STORAGE_KEY = 'sms_cooldown_end';  // 倒计时结束时间戳

Page({
  data: {
    statusBarHeight: 20,
    headerContentHeight: 32,
    phone: '',              // 手机号
    code: '',               // 验证码
    agreed: false,          // 协议是否勾选
    sending: false,         // 正在发送验证码
    countdown: 0,           // 倒计时秒数
    logging: false          // 登录中
  },

  // 倒计时定时器
  countdownTimer: null,

  onLoad() {
    // 获取状态栏高度 + 微信胶囊位置
    const app = getApp();
    if (app && app.globalData) {
      const statusBarHeight = app.globalData.statusBarHeight || 20;
      const menuButton = app.globalData.menuButton;
      const headerContentHeight = menuButton ? menuButton.height : 32;
      this.setData({ statusBarHeight, headerContentHeight });
    }
    // 进入页面时恢复倒计时（防止用户离开页面再回来重新发送）
    this.restoreCountdown();
  },

  onShow() {
    // 如果已经登录，直接返回
    if (userApi.getToken()) {
      this.navigateBack();
      return;
    }
    // 每次显示时刷新倒计时（避免后台期间未更新）
    this.restoreCountdown();
  },

  onUnload() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  },

  // 从 storage 恢复倒计时
  restoreCountdown() {
    let endTime = 0;
    try { endTime = wx.getStorageSync(COOLDOWN_STORAGE_KEY) || 0; } catch (e) { /* ignore */ }
    if (!endTime) return;
    const remain = Math.ceil((endTime - Date.now()) / 1000);
    if (remain > 0) {
      this.startCountdown(remain, endTime);
    } else {
      this.clearCooldown();
    }
  },

  // 清除冷却记录
  clearCooldown() {
    try { wx.removeStorageSync(COOLDOWN_STORAGE_KEY); } catch (e) { /* ignore */ }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.setData({ countdown: 0 });
  },

  navigateBack() {
    wx.navigateBack({ delta: 1, fail: () => {
      wx.switchTab({ url: '/pages/profile/profile' });
    }});
  },

  onBackTap() {
    this.navigateBack();
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  onCodeInput(e) {
    this.setData({ code: e.detail.value });
  },

  onToggleAgreement() {
    this.setData({ agreed: !this.data.agreed });
  },

  onOpenAgreement(e) {
    const type = e.currentTarget.dataset.type;
    wx.navigateTo({ url: `/pages/agreement/agreement?type=${type}` });
  },

  // 发送验证码
  onSendCode() {
    if (this.data.countdown > 0 || this.data.sending) {
      if (this.data.countdown > 0) {
        wx.showToast({ title: '请等待 ' + this.data.countdown + ' 秒后再发送', icon: 'none' });
      }
      return;
    }

    const phone = this.data.phone;
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }

    if (!this.data.agreed) {
      wx.showToast({ title: '请先阅读并同意协议', icon: 'none' });
      return;
    }

    this.setData({ sending: true });
    wx.showLoading({ title: '发送中...', mask: true });

    // 优先 PC 端 /api/auth/sms-code，失败时回退到本地 /api/v1/auth/send-code
    userApi.sendSmsCode(phone, 'login').then(() => {
      this.setData({ sending: false });
      wx.hideLoading();
      wx.showToast({ title: '验证码已发送', icon: 'success' });
      this.startCountdown(COOLDOWN_SECONDS);
    }).catch((err) => {
      // 后端返回"频率过快"等错误时仍启动倒计时，防止恶意重试
      const msg = (err && err.message) || '';
      this.setData({ sending: false });
      wx.hideLoading();
      // 无论成功失败都启动 2 分钟冷却（防止恶意重试）
      this.startCountdown(COOLDOWN_SECONDS);
      if (/频繁|频率|too\s*many|429/i.test(msg)) {
        wx.showToast({ title: '请求过于频繁，请稍后再试', icon: 'none' });
      } else {
        // 失败时回退到本地接口
        this.sendCodeLocal(phone);
      }
    });
  },

  // 本地回退：调用 /api/v1/auth/send-code
  sendCodeLocal(phone) {
    wx.request({
      url: `${API_BASE_URL}/auth/send-code`,
      method: 'POST',
      timeout: 15000,
      data: { phone },
      header: {
        'Content-Type': 'application/json',
        'X-Mini-Program': '1',
        'X-Web-Access': 'bid_web_2026_public'
      },
      success: (res) => {
        this.setData({ sending: false });
        wx.hideLoading();
        if (res.statusCode === 200 && res.data && res.data.code === 0) {
          wx.showToast({ title: '验证码已发送', icon: 'success' });
          this.startCountdown(COOLDOWN_SECONDS);
        } else {
          // 启动倒计时，防止恶意重试
          this.startCountdown(COOLDOWN_SECONDS);
          wx.showToast({
            title: (res.data && res.data.message) || '发送失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        this.setData({ sending: false });
        wx.hideLoading();
        console.error('[发送验证码] 本地接口失败:', err);
        // 启动倒计时，防止恶意重试
        this.startCountdown(COOLDOWN_SECONDS);
        wx.showToast({ title: '网络错误，请重试', icon: 'none' });
      }
    });
  },

  // 倒计时（持久化到 storage，离开页面回来依然生效）
  startCountdown(seconds) {
    // 结束时间戳（绝对时间），用于跨页面恢复
    const endTime = Date.now() + seconds * 1000;
    try { wx.setStorageSync(COOLDOWN_STORAGE_KEY, endTime); } catch (e) { /* ignore */ }

    this.setData({ countdown: seconds });
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.countdownTimer = setInterval(() => {
      const remain = Math.ceil((endTime - Date.now()) / 1000);
      if (remain <= 0) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        this.clearCooldown();
      } else {
        this.setData({ countdown: remain });
      }
    }, 1000);
  },

  // 立即登录
  onLoginTap() {
    if (this.data.logging) return;
    if (!this.data.agreed) {
      wx.showToast({ title: '请先阅读并同意协议', icon: 'none' });
      return;
    }
    const phone = this.data.phone;
    const code = this.data.code;
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }
    if (!/^\d{4,6}$/.test(code)) {
      wx.showToast({ title: '请输入正确的验证码', icon: 'none' });
      return;
    }

    this.setData({ logging: true });
    wx.showLoading({ title: '登录中...', mask: true });

    // 短信验证码登录：loginType=sms
    userApi.login({
      loginType: 'sms',
      phone,
      smsCode: code
    }).then((data) => {
      this.setData({ logging: false });
      wx.hideLoading();
      wx.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => this.navigateBack(), 800);
    }).catch((err) => {
      this.setData({ logging: false });
      wx.hideLoading();
      console.error('[登录] 失败:', err);
      const msg = (err && err.message) || '登录失败，请重试';
      wx.showToast({ title: msg, icon: 'none' });
    });
  },

  // 切换到手机号快捷登录
  onQuickLogin() {
    wx.navigateBack({ delta: 1 });
  }
})
