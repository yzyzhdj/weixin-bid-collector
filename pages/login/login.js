// 用户中心 API
const userApi = require('../../utils/user-api.js');

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

  onShow() {
    // 如果已经登录，直接返回
    if (userApi.getToken()) {
      this.navigateBack();
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
      return;
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
        // 第二步：调用 PC 端 /api/auth/login (loginType=wechat)
        // 注意：PC 端接口只需 wechatCode，encryptedData/iv 由后端用 session_key 解密
        userApi.login({
          loginType: 'wechat',
          wechatCode: loginRes.code,
          // 部分后端实现同时需要 encryptedData/iv
          encryptedData,
          iv,
          cloudID
        }).then(() => {
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
      fail: () => {
        this.setData({ logging: false });
        wx.hideLoading();
        wx.showToast({ title: '微信登录失败', icon: 'none' });
      }
    });
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
