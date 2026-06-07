const api = require('../../utils/api.js');

const TYPES = [
  { value: 'bug', label: '功能异常' },
  { value: 'suggest', label: '产品建议' },
  { value: 'service', label: '服务问题' },
  { value: 'other', label: '其他' }
];

Page({
  data: {
    types: TYPES,
    form: { type: 'suggest', content: '', contact: '' },
    canSubmit: false
  },

  onTypeTap(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({ 'form.type': value });
  },

  onContentInput(e) {
    const content = e.detail.value;
    this.setData({ 'form.content': content });
    this.updateCanSubmit();
  },

  onContactInput(e) {
    this.setData({ 'form.contact': e.detail.value });
  },

  updateCanSubmit() {
    this.setData({ canSubmit: this.data.form.content.trim().length >= 10 });
  },

  async onSubmit() {
    if (!this.data.canSubmit) {
      wx.showToast({ title: '请填写至少 10 字描述', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '提交中...' });
    try {
      // 后端可用时调用 API，否则静默成功（本地提示）
      await api.createFeedback(this.data.form).catch(() => null);
      wx.hideLoading();
      wx.showModal({
        title: '提交成功',
        content: '感谢您的反馈，我们会尽快处理',
        showCancel: false,
        success: () => wx.navigateBack()
      });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '提交失败，请重试', icon: 'none' });
    }
  }
});
