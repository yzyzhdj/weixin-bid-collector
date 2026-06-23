// 用户中心 API
const userApi = require('../../utils/user-api.js');

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

  onShow() {
    // 如果已经登录，直接返回
    if (userApi.getToken()) {
      this.navigateBack();
    }
  },

  onUnload() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
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
    if (this.data.countdown > 0 || this.data.sending) return;

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

    userApi.sendSmsCode(phone, 'login').then(() => {
      this.setData({ sending: false });
      wx.hideLoading();
      wx.showToast({ title: '验证码已发送', icon: 'success' });
      this.startCountdown(60);
    }).catch((err) => {
      this.setData({ sending: false });
      wx.hideLoading();
      console.error('[发送验证码] 失败:', err);
      // 错误已由 userApi 弹窗提示
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
    });
  },

  // 切换到手机号快捷登录
  onQuickLogin() {
    wx.navigateBack({ delta: 1 });
  }
})
