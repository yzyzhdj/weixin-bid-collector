// 引入 API 工具
const { API_BASE_URL } = require('../../utils/config.js');

Page({
  data: {
    statusBarHeight: 20,
    headerContentHeight: 32,
    agreed: false,           // 协议是否勾选
    logging: false           // 登录中（防重复点击）
  },

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

  onBackTap() {
    wx.navigateBack({ delta: 1, fail: () => {
      wx.switchTab({ url: '/pages/profile/profile' });
    }});
  },

  onToggleAgreement() {
    this.setData({ agreed: !this.data.agreed });
  },

  onOpenAgreement(e) {
    const type = e.currentTarget.dataset.type;
    wx.navigateTo({ url: `/pages/agreement/agreement?type=${type}` });
  },

  // 点击手机号登录按钮（非 open-type 触发）
  onPhoneLoginTap() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先阅读并同意协议', icon: 'none' });
    }
    // 协议已勾选则由 open-type 接管，弹出 WeChat 原生授权窗
  },

  // 核心：接收 WeChat 手机号授权回调
  onGetPhoneNumber(e) {
    if (this.data.logging) return;
    if (!this.data.agreed) {
      wx.showToast({ title: '请先阅读并同意协议', icon: 'none' });
      return;
    }

    // 用户拒绝授权
    if (e.detail.errMsg && e.detail.errMsg.indexOf('fail') !== -1) {
      wx.showToast({ title: '已取消授权', icon: 'none' });
      return;
    }

    const { encryptedData, iv, cloudID } = e.detail;
    this.setData({ logging: true });
    wx.showLoading({ title: '登录中...', mask: true });

    // 第一步：wx.login 获取 code（用于换取 openid/session_key）
    wx.login({
      success: (loginRes) => {
        if (!loginRes.code) {
          this.setData({ logging: false });
          wx.hideLoading();
          wx.showToast({ title: '微信登录失败', icon: 'none' });
          return;
        }
        // 第二步：把 code + 加密手机号数据 发送到后端
        this.sendLoginRequest(loginRes.code, encryptedData, iv, cloudID);
      },
      fail: () => {
        this.setData({ logging: false });
        wx.hideLoading();
        wx.showToast({ title: '微信登录失败', icon: 'none' });
      }
    });
  },

  // 发送登录请求到后端
  sendLoginRequest(code, encryptedData, iv, cloudID) {
    wx.request({
      url: `${API_BASE_URL}/auth/phone-login`,
      method: 'POST',
      timeout: 15000,
      data: {
        code,
        encryptedData,
        iv,
        cloudID
      },
      header: { 'Content-Type': 'application/json' },
      success: (res) => {
        this.setData({ logging: false });
        wx.hideLoading();
        if (res.statusCode === 200 && res.data && res.data.code === 0) {
          // 登录成功，保存 token + 用户信息
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
        console.error('[登录] 请求失败:', err);
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

  // 验证码登录
  onCodeLogin() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先阅读并同意协议', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/login/code-login' });
  }
})
