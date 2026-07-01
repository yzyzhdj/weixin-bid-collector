// pages/feedback/feedback.js
const userApi = require('../../utils/user-api.js');

Page({
  data: {
    title: '',         // 反馈标题
    content: '',       // 问题描述
    submitting: false  // 防重复提交
  },

  // 标题输入
  onTitleChange(e) {
    const title = e.detail.value;
    const content = this.data.content;
    this.setData({
      title,
      canSubmit: !!title.trim() && !!content.trim()
    });
  },

  // 描述输入
  onContentChange(e) {
    const content = e.detail.value;
    const title = this.data.title;
    this.setData({
      content,
      canSubmit: !!title.trim() && !!content.trim()
    });
  },

  // 提交反馈
  onSubmitTap() {
    const title = (this.data.title || '').trim();
    const content = (this.data.content || '').trim();
    if (!title) {
      wx.showToast({ title: '请输入标题', icon: 'none' });
      return;
    }
    if (!content) {
      wx.showToast({ title: '请输入问题描述', icon: 'none' });
      return;
    }
    if (this.data.submitting) return;

    if (!userApi.getToken()) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => {
        wx.navigateTo({ url: '/pages/login/login' });
      }, 800);
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中...', mask: true });

    userApi.addFeedback({ title, content }).then(() => {
      wx.hideLoading();
      this.setData({ submitting: false });
      wx.showToast({ title: '提交成功，感谢您的反馈', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack({ delta: 1, fail: () => {
          wx.switchTab({ url: '/pages/profile/profile' });
        }});
      }, 1200);
    }).catch((err) => {
      wx.hideLoading();
      this.setData({ submitting: false });
      console.error('[feedback] 提交失败:', err);
      const msg = (err && err.message) || '提交失败，请稍后重试';
      wx.showToast({ title: msg, icon: 'none' });
    });
  }
})
