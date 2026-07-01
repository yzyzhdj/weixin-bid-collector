// pages/invite/invite.js
const userApi = require('../../utils/user-api.js');

// 文档中 status 仅返回 "completed"，这里保留兜底状态映射
const statusMap = {
  completed: { text: '已得积分', color: '#10b981' },
  registered: { text: '已注册', color: '#1e88ff' },
  pending: { text: '待注册', color: '#94a3b8' }
};

Page({
  data: {
    inviteCode: '',
    inviteUrl: '',
    inviteInfo: null,
    records: [],
    invitedCount: 0,
    totalReward: 0,
    loading: true,
    statusBarHeight: 20
  },

  onLoad() {
    const app = getApp();
    if (app && app.globalData) {
      this.setData({ statusBarHeight: app.globalData.statusBarHeight || 20 });
    }
    this.loadInfo();
    this.loadRecords();
  },

  onShareAppMessage() {
    return {
      title: '阳光标讯 - 邀请您一起加入',
      path: '/pages/index/index?inviteCode=' + (this.data.inviteCode || ''),
      imageUrl: ''
    };
  },

  onShareTimeline() {
    return {
      title: '阳光标讯 - 邀请您一起加入',
      query: 'inviteCode=' + (this.data.inviteCode || '')
    };
  },

  // 14.2 获取邀请信息 → { inviteCode, invitedCount, totalReward }
  async loadInfo() {
    try {
      const data = await userApi.getInviteInfo();
      console.log('[invite] info:', data);
      // 文档字段：inviteCode / invitedCount / totalReward
      const inviteCode = data.inviteCode || '';
      const inviteUrl = `https://www.sunbidinfo.com/register?code=${inviteCode}`;
      this.setData({
        inviteInfo: data,
        inviteCode,
        inviteUrl,
        invitedCount: data.invitedCount || 0,
        totalReward: data.totalReward || 0
      });
    } catch (e) {
      console.error('[invite] info 失败', e);
      // 兜底：邀请码 = 当前用户 userId（文档规则）
      const userInfo = userApi.getUserInfo ? userApi.getUserInfo() : null;
      const code = (userInfo && (userInfo.id || userInfo.userId)) || '';
      this.setData({
        inviteCode: String(code),
        inviteUrl: `https://www.sunbidinfo.com/register?code=${code}`,
        invitedCount: 0,
        totalReward: 0
      });
    }
  },

  // 14.3 获取邀请记录 → items: [{ inviteeUserId, inviteeNickname, inviteeAvatar, inviterReward, inviteeReward, status, createdAt }]
  async loadRecords() {
    this.setData({ loading: true });
    try {
      const data = await userApi.getInviteRecords({ page: 1, page_size: 50 });
      console.log('[invite] records:', data);
      const items = (data.items || []).map(item => {
        const st = item.status || 'completed';
        const statusInfo = statusMap[st] || statusMap.completed;
        // 邀请人视角展示 inviterReward
        return {
          id: item.inviteeUserId,
          nickname: item.inviteeNickname || '匿名用户',
          avatar: item.inviteeAvatar || '',
          createdAt: item.createdAt || '',
          status: st,
          statusText: statusInfo.text,
          statusColor: statusInfo.color,
          reward: item.inviterReward || 0
        };
      });
      this.setData({ records: items, loading: false });
    } catch (e) {
      console.error('[invite] records 失败', e);
      this.setData({ records: [], loading: false });
    }
  },

  onCopyCode() {
    wx.setClipboardData({
      data: this.data.inviteCode,
      success: () => {
        wx.showToast({ title: '邀请码已复制', icon: 'success' });
      }
    });
  },

  onCopyLink() {
    wx.setClipboardData({
      data: this.data.inviteUrl,
      success: () => {
        wx.showToast({ title: '链接已复制', icon: 'success' });
      }
    });
  },

  onShare() {
    wx.showActionSheet({
      itemList: ['分享给微信好友', '分享到朋友圈', '复制邀请链接'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.showToast({ title: '点击右上角分享', icon: 'none' });
        } else if (res.tapIndex === 1) {
          wx.showToast({ title: '点击右上角分享到朋友圈', icon: 'none' });
        } else {
          this.onCopyLink();
        }
      }
    });
  }
});
