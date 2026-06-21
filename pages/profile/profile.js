Page({
  data: {
    statusBarHeight: 20,
    settingsBtnTop: 0,
    isLoggedIn: false,  // 未登录状态
    debugExpanded: false,
    testing: false,
    debugInfo: {
      url: '',
      keyPreview: '',
      status: 'pending',
      statusLabel: '未测试',
      message: ''
    }
  },

  onLoad() {
    // 获取状态栏高度 + 微信胶囊位置（适配刘海屏）
    const app = getApp();
    if (app && app.globalData) {
      const statusBarHeight = app.globalData.statusBarHeight || 20;
      const menuButton = app.globalData.menuButton;

      // 设置按钮 top = 胶囊底部 + 间距（避免和微信胶囊按钮重合）
      let settingsBtnTop = statusBarHeight + 40;
      if (menuButton && menuButton.height) {
        settingsBtnTop = menuButton.top + menuButton.height + 8;
      }

      this.setData({
        statusBarHeight,
        settingsBtnTop
      });
    }
    // 加载 API 调试信息
    this.loadDebugInfo();
  },

  // 加载 API 配置信息
  loadDebugInfo() {
    try {
      const config = require('../../utils/config.js');
      const key = config.API_KEY || '';
      const keyPreview = key ? (key.slice(0, 12) + '...' + key.slice(-4)) : '(空)';
      // 检查本地是否有自定义 key 覆盖
      const overrideKey = wx.getStorageSync('API_KEY_OVERRIDE');
      const actualKey = overrideKey || key;
      const actualKeyPreview = actualKey ? (actualKey.slice(0, 12) + '...' + actualKey.slice(-4)) : '(空)';
      this.setData({
        'debugInfo.url': config.API_BASE_URL,
        'debugInfo.keyPreview': actualKeyPreview + (overrideKey ? ' (本地覆盖)' : ''),
        'debugInfo.statusLabel': '配置已加载，点击"测试"验证'
      });
    } catch (e) {
      this.setData({
        'debugInfo.statusLabel': '加载配置失败: ' + e.message
      });
    }
  },

  // 切换调试面板
  toggleDebug() {
    this.setData({ debugExpanded: !this.data.debugExpanded });
  },

  // 测试 API 连接
  async onTestApi() {
    if (this.data.testing) return;
    this.setData({ testing: true, 'debugInfo.statusLabel': '测试中...' });
    try {
      const api = require('../../utils/api.js');
      // 如果有本地覆盖的 key,临时使用
      const overrideKey = wx.getStorageSync('API_KEY_OVERRIDE');
      if (overrideKey) {
        const config = require('../../utils/config.js');
        const origKey = config.API_KEY;
        config.API_KEY = overrideKey;
        const result = await api.testConnection();
        config.API_KEY = origKey;  // 恢复
        this.setData({
          testing: false,
          'debugInfo.status': result.success ? 'success' : (result.status === 0 ? 'error' : 'failed'),
          'debugInfo.statusLabel': result.success ? '✓ 连接成功' : '✗ ' + result.message,
          'debugInfo.message': JSON.stringify(result.response, null, 2).slice(0, 500)
        });
        if (result.success) {
          wx.showToast({ title: '连接成功!', icon: 'success' });
        } else {
          wx.showToast({ title: result.message, icon: 'none', duration: 3000 });
        }
      } else {
        const result = await api.testConnection();
        this.setData({
          testing: false,
          'debugInfo.status': result.success ? 'success' : (result.status === 0 ? 'error' : 'failed'),
          'debugInfo.statusLabel': result.success ? '✓ 连接成功' : '✗ ' + result.message,
          'debugInfo.message': JSON.stringify(result.response, null, 2).slice(0, 500)
        });
        if (result.success) {
          wx.showToast({ title: '连接成功!', icon: 'success' });
        } else {
          wx.showToast({ title: result.message, icon: 'none', duration: 3000 });
        }
      }
    } catch (e) {
      this.setData({
        testing: false,
        'debugInfo.status': 'error',
        'debugInfo.statusLabel': '✗ 测试异常: ' + e.message
      });
    }
  },

  // 清空本地 Key 覆盖
  onClearKey() {
    wx.removeStorageSync('API_KEY_OVERRIDE');
    this.loadDebugInfo();
    wx.showToast({ title: '已恢复默认 Key', icon: 'success' });
  },

  // 修改 Key (弹出输入框)
  onChangeKey() {
    const currentKey = wx.getStorageSync('API_KEY_OVERRIDE') ||
      (require('../../utils/config.js').API_KEY || '');
    wx.showModal({
      title: '修改 API Key',
      editable: true,
      placeholderText: '输入新的 API Key (bid_xxx...)',
      content: currentKey,
      success: (res) => {
        if (res.confirm && res.content) {
          const newKey = res.content.trim();
          if (newKey) {
            wx.setStorageSync('API_KEY_OVERRIDE', newKey);
            this.loadDebugInfo();
            wx.showToast({ title: '已保存, 请测试连接', icon: 'success' });
          }
        }
      }
    });
  },

  // 点击登录
  onLoginTap() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  // 设置
  onSettingsTap() {
    wx.showToast({ title: '设置', icon: 'none' });
  },

  // 开通 VIP
  onOpenVip() {
    wx.navigateTo({ url: '/pages/more/more' });
  },

  // 快捷功能
  onActionTap(e) {
    const type = e.currentTarget.dataset.type;
    const map = {
      subscription: '我的订阅',
      favorite: '我的收藏',
      custom: '信息定制'
    };
    wx.showToast({ title: map[type] || '功能开发中', icon: 'none' });
  },

  // 菜单
  onMenuTap(e) {
    const type = e.currentTarget.dataset.type;
    if (type === 'buy') {
      wx.navigateTo({ url: '/pages/more/more' });
    } else if (type === 'service') {
      wx.makePhoneCall({ phoneNumber: '19156012821', fail: () => {
        wx.showToast({ title: '客服热线：19156012821', icon: 'none' });
      }});
    } else {
      const map = {
        orders: '购买记录',
        cooperation: '渠道合作',
        feedback: '意见反馈'
      };
      wx.showToast({ title: map[type] || '功能开发中', icon: 'none' });
    }
  }
})
