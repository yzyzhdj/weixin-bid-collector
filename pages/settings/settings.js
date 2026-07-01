// 用户中心 API
const userApi = require('../../utils/user-api.js');
// 标讯数据 API（用于获取平台统计）
const api = require('../../utils/api.js');

Page({
  data: {
    statusBarHeight: 20
  },

  onLoad() {
    const app = getApp();
    if (app && app.globalData) {
      this.setData({ statusBarHeight: app.globalData.statusBarHeight || 20 });
    }
  },

  onBackTap() {
    wx.navigateBack({ delta: 1, fail: () => {
      wx.switchTab({ url: '/pages/profile/profile' });
    }});
  },

  // 关于我们：调用后端统计接口获取平台数据
  onAboutTap() {
    wx.showLoading({ title: '加载中...', mask: true });
    api.getStats({ silent: true }).then((stats) => {
      wx.hideLoading();
      this.showAboutModal(stats);
    }).catch(() => {
      wx.hideLoading();
      // 接口失败时用本地兜底数据
      this.showAboutModal(null);
    });
  },

  showAboutModal(stats) {
    const lines = [];
    lines.push('产品名称：阳光标讯');
    lines.push('当前版本：1.0.0');
    lines.push('官方网站：www.sunbidinfo.com');

    // 平台统计数据（来自后端 /api/v1/stats）
    if (stats) {
      lines.push('');
      lines.push('—— 平台数据 ——');
      const total = stats.total || 0;
      const today = stats.today || 0;
      lines.push('累计标讯：' + total + ' 条');
      lines.push('今日更新：' + today + ' 条');
      const sources = stats.bySource || stats.by_source || [];
      if (sources.length > 0) {
        lines.push('数据来源：' + sources.length + ' 个渠道');
      }
      const provinces = stats.byProvince || stats.by_province || [];
      if (provinces.length > 0) {
        lines.push('覆盖地区：' + provinces.length + ' 个省市');
      }
    }

    lines.push('');
    lines.push('阳光标讯是专业的招投标信息聚合平台，');
    lines.push('提供实时、准确、完整的招标采购信息，');
    lines.push('助力企业高效获取商机。');

    wx.showModal({
      title: '关于我们',
      content: lines.join('\n'),
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  // 注销账号
  onDeleteAccountTap() {
    if (!userApi.getToken()) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '注销账号',
      content: '注销后账号将无法恢复，所有数据将被清除且不可恢复。\n\n确定要注销账号吗？',
      confirmText: '确认注销',
      confirmColor: '#ef4444',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.doDeleteAccount();
        }
      }
    });
  },

  doDeleteAccount() {
    if (!userApi.deleteAccount) {
      wx.showToast({ title: '功能开发中', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '注销中...', mask: true });
    userApi.deleteAccount().then(() => {
      wx.hideLoading();
      userApi.clearAuth();
      wx.showToast({ title: '账号已注销', icon: 'success' });
      setTimeout(() => {
        wx.reLaunch({ url: '/pages/index/index' });
      }, 800);
    }).catch((err) => {
      wx.hideLoading();
      const msg = (err && err.message) || '注销失败，请重试';
      wx.showToast({ title: msg, icon: 'none' });
    });
  },

  // 退出登录
  onLogoutTap() {
    if (!userApi.getToken()) {
      wx.showToast({ title: '您还未登录', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      confirmText: '退出',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          this.doLogout();
        }
      }
    });
  },

  doLogout() {
    userApi.logout().then(() => {
      userApi.clearAuth();
      wx.showToast({ title: '已退出登录', icon: 'success' });
      setTimeout(() => {
        wx.reLaunch({ url: '/pages/index/index' });
      }, 800);
    }).catch(() => {
      // 即使后端失败也清本地
      userApi.clearAuth();
      wx.showToast({ title: '已退出登录', icon: 'success' });
      setTimeout(() => {
        wx.reLaunch({ url: '/pages/index/index' });
      }, 800);
    });
  }
})
