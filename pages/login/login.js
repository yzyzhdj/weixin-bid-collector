// 用户中心 API（PC 端 /api/auth）
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
    console.log('[登录] navigateBack 开始');
    wx.navigateBack({
      delta: 1,
      success: () => {
        console.log('[登录] navigateBack 成功');
      },
      fail: (err) => {
        console.log('[登录] navigateBack 失败，改用 switchTab:', err);
        wx.switchTab({
          url: '/pages/profile/profile',
          success: () => console.log('[登录] switchTab 成功'),
          fail: (e) => console.error('[登录] switchTab 失败:', e)
        });
      }
    });
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
        // 第二步：调用 PC 端标准接口（loginType=wechat，需要 encryptedData + iv）
        // 后端需要：jscode2session 拿 session_key -> 解密 encryptedData 拿手机号
        this.tryPcLogin(loginRes.code, encryptedData, iv, cloudID);
      },
      fail: () => {
        this.setData({ logging: false });
        wx.hideLoading();
        wx.showToast({ title: '微信登录失败', icon: 'none' });
      }
    });
  },

  // 调用 PC 端 /api/auth/login (loginType=wechat)
  // 后端流程：jscode2session 拿 session_key -> AES 解密 encryptedData 拿手机号 -> 查/建用户
  tryPcLogin(code, encryptedData, iv, cloudID) {
    const loginPayload = {
      loginType: 'wechat',
      wechatCode: code,
      code: code,
      encryptedData,
      iv,
      cloudID
    };
    console.log('[登录] 发送 PC 端登录请求, payload:', {
      loginType: loginPayload.loginType,
      wechatCode: loginPayload.wechatCode ? loginPayload.wechatCode.substring(0, 10) + '...' : '(空)',
      code: loginPayload.code ? loginPayload.code.substring(0, 10) + '...' : '(空)',
      encryptedData: loginPayload.encryptedData ? loginPayload.encryptedData.substring(0, 20) + '...' : '(空)',
      iv: loginPayload.iv || '(空)',
      cloudID: loginPayload.cloudID || '(空)'
    });

    userApi.login(loginPayload).then((data) => {
      console.log('[登录] PC 端登录成功:', data);
      this.onLoginSuccess(data);
    }).catch((pcErr) => {
      const errCode = pcErr && pcErr.code;
      const msg = (pcErr && pcErr.message) || '';
      const raw = pcErr && pcErr.raw;
      console.warn('[登录] PC 端失败:', errCode, msg, '原始响应:', raw);
      this.setData({ logging: false });
      wx.hideLoading();
      wx.showToast({ title: msg || '登录失败，请重试', icon: 'none' });
    });
  },

  // 登录成功处理：保存 token + userInfo
  onLoginSuccess(data) {
    console.log('[登录] onLoginSuccess 收到数据:', JSON.stringify(data));
    this.setData({ logging: false });
    wx.hideLoading();

    // PC 端接口直接返回 { token, userInfo, expiresIn }
    // 本地接口可能返回扁平结构，自己组装
    let token = data && data.token;
    let userInfo = data && data.userInfo;

    // 兼容更多后端返回格式
    if (!userInfo && data) {
      if (data.user) userInfo = data.user;
      else if (data.user_info) userInfo = data.user_info;
      else if (data.userId || data.user_id) {
        userInfo = {
          id: data.userId || data.user_id,
          phone: data.phone,
          nickname: data.nickname || data.nick_name
        };
      }
    }

    console.log('[登录] 解析出 token:', token ? '有' : '无', 'userInfo:', userInfo ? JSON.stringify(userInfo) : '无');

    if (!token || !userInfo) {
      console.error('[登录] 数据格式错误，token 或 userInfo 为空');
      this.onLoginFail('登录返回数据格式错误');
      return;
    }

    userApi.setToken(token);
    userApi.setUserInfo(userInfo);
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.token = token;
      app.globalData.userInfo = userInfo;
      app.globalData.isLoggedIn = true;
    }

    // 登录成功后，检查是否有邀请码（通过好友分享链接进入）
    const inviteCode = (app && app.globalData.inviteCode) || wx.getStorageSync('inviteCode');
    if (inviteCode) {
      console.log('[登录] 检测到邀请码，上报后端:', inviteCode);
      userApi.reportInvite(inviteCode).then((res) => {
        console.log('[登录] 邀请码上报成功:', res);
        // 上报成功后清除邀请码
        wx.removeStorageSync('inviteCode');
        if (app && app.globalData) app.globalData.inviteCode = null;
      }).catch((err) => {
        console.warn('[登录] 邀请码上报失败:', err);
      });
    }

    wx.showToast({ title: '登录成功', icon: 'success' });
    console.log('[登录] 800ms 后跳转...');
    setTimeout(() => {
      console.log('[登录] 执行跳转');
      this.navigateBack();
    }, 800);
  },

  onLoginFail(errMsg) {
    this.setData({ logging: false });
    wx.hideLoading();
    wx.showToast({ title: errMsg, icon: 'none' });
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
