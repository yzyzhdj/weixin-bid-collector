// 引入 API 工具
const { API_BASE_URL } = require('../../utils/config.js');

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
  },

  onUnload() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  },

  onBackTap() {
    wx.navigateBack({ delta: 1, fail: () => {
      wx.switchTab({ url: '/pages/profile/profile' });
    }});
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
    if (this.data.countdown > 0 || this.data.sending) return;

    const phone = this.data.phone;
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }

    this.setData({ sending: true });
    wx.showLoading({ title: '发送中...', mask: true });

    wx.request({
      url: `${API_BASE_URL}/auth/send-code`,
      method: 'POST',
      timeout: 15000,
      data: { phone },
      header: { 'Content-Type': 'application/json' },
      success: (res) => {
        this.setData({ sending: false });
        wx.hideLoading();
        if (res.statusCode === 200 && res.data && res.data.code === 0) {
          wx.showToast({ title: '验证码已发送', icon: 'success' });
          this.startCountdown(60);
        } else {
          wx.showToast({
            title: (res.data && res.data.message) || '发送失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        this.setData({ sending: false });
        wx.hideLoading();
        console.error('[发送验证码] 失败:', err);
        wx.showToast({ title: '网络错误，请重试', icon: 'none' });
      }
    });
  },

  // 倒计时
  startCountdown(seconds) {
    this.setData({ countdown: seconds });
    this.countdownTimer = setInterval(() => {
      const next = this.data.countdown - 1;
      if (next <= 0) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        this.setData({ countdown: 0 });
      } else {
        this.setData({ countdown: next });
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

    wx.request({
      url: `${API_BASE_URL}/auth/code-login`,
      method: 'POST',
      timeout: 15000,
      data: { phone, code },
      header: { 'Content-Type': 'application/json' },
      success: (res) => {
        this.setData({ logging: false });
        wx.hideLoading();
        if (res.statusCode === 200 && res.data && res.data.code === 0) {
          const userInfo = res.data.data;
          this.saveUserInfo(userInfo);
          wx.showToast({ title: '登录成功', icon: 'success' });
          setTimeout(() => {
            wx.navigateBack({ delta: 1, fail: () => {
              wx.switchTab({ url: '/pages/profile/profile' });
            }});
          }, 1000);
        } else {
          wx.showToast({
            title: (res.data && res.data.message) || '登录失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        this.setData({ logging: false });
        wx.hideLoading();
        console.error('[登录] 失败:', err);
        wx.showToast({ title: '网络错误，请重试', icon: 'none' });
      }
    });
  },

  // 保存登录态
  saveUserInfo(userInfo) {
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.userInfo = userInfo;
      app.globalData.token = userInfo.token || '';
      app.globalData.isLoggedIn = true;
    }
    wx.setStorageSync('userInfo', userInfo);
    wx.setStorageSync('token', userInfo.token || '');
  },

  // 切换到手机号快捷登录
  onQuickLogin() {
    wx.navigateBack({ delta: 1 });
  }
})
