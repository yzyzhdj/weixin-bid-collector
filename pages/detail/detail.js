const api = require('../../utils/api.js');

// 格式化 ISO 日期为 YYYY-MM-DD
function formatDate(dateStr) {
  if (!dateStr) return '';
  // 处理 ISO 8601 格式: 2027-10-17T16:00:00
  const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * HTML 清理与规范化 - 让 rich-text 组件能正确渲染
 * 支持：div/p/span/h1-h6/ul/ol/li/table/tr/td/th/img/a/br/strong/em 等
 */
function sanitizeHtml(rawHtml) {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  let html = String(rawHtml);

  // 1. 移除危险标签（script/style/iframe/object/embed）
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<style[\s\S]*?<\/style>/gi, '');
  html = html.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
  html = html.replace(/<object[\s\S]*?<\/object>/gi, '');
  html = html.replace(/<embed[\s\S]*?<\/embed>/gi, '');

  // 2. 移除危险属性 (on* 事件)
  html = html.replace(/\s*on\w+\s*=\s*(['"])[^'"]*\1/gi, '');

  // 3. javascript: 协议清理
  html = html.replace(/javascript\s*:/gi, '');

  // 4. 规范化图片：添加 max-width 样式（避免大图超出屏幕）
  html = html.replace(/<img([^>]*)>/gi, (match, attrs) => {
    // 提取 style 属性
    const styleMatch = attrs.match(/style\s*=\s*(['"])(.*?)\1/i);
    let style = styleMatch ? styleMatch[2] : '';
    if (!/max-width/i.test(style)) {
      style = 'max-width:100%;height:auto;display:block;margin:8rpx 0;' + style;
    }
    // 移除旧的 style，重新附加
    let newAttrs = attrs.replace(/style\s*=\s*(['"])(.*?)\1/i, '');
    newAttrs += ` style="${style}"`;
    return `<img${newAttrs}>`;
  });

  // 5. 规范化表格：rich-text 不支持 colspan/rowspan 的复杂表格，但基础表格可以
  //    给 table 加 border-collapse，给 td 加 padding 和 border
  html = html.replace(/<table([^>]*)>/gi, (match, attrs) => {
    if (!/style/i.test(attrs)) {
      return `<table${attrs} style="width:100%;border-collapse:collapse;margin:16rpx 0;">`;
    }
    return match;
  });

  html = html.replace(/<td([^>]*)>/gi, (match, attrs) => {
    if (!/style/i.test(attrs)) {
      return `<td${attrs} style="padding:12rpx 16rpx;border:1rpx solid #e2e8f0;vertical-align:top;">`;
    }
    return match;
  });

  html = html.replace(/<th([^>]*)>/gi, (match, attrs) => {
    if (!/style/i.test(attrs)) {
      return `<th${attrs} style="padding:12rpx 16rpx;border:1rpx solid #e2e8f0;background:#f1f5f9;font-weight:600;text-align:left;vertical-align:top;">`;
    }
    return match;
  });

  // 6. 链接：让 a 标签新窗口打开（如果支持），至少加 target
  html = html.replace(/<a\s+([^>]*?)>/gi, (match, attrs) => {
    if (!/target/i.test(attrs)) {
      return `<a ${attrs} target="_blank" rel="noopener noreferrer">`;
    }
    return match;
  });

  // 7. 段落化：把连续的换行/空格规范化（避免 <p><br></p> 嵌套混乱）
  html = html.replace(/\r?\n/g, '');

  // 8. 移除空段落
  html = html.replace(/<p[^>]*>\s*<\/p>/gi, '');

  return html;
}

Page({
  data: {
    detail: null,
    loading: true,
    showFullscreen: false,
    fontScale: 1.0
  },

  onLoad(options) {
    // 获取状态栏高度（用于全屏弹层）
    const app = getApp();
    const statusBarHeight = (app && app.globalData && app.globalData.statusBarHeight) || 20;
    this.setData({ statusBarHeight });
    if (options.id) {
      this.loadDetail(options.id);
    }
  },

  async loadDetail(id) {
    this.setData({ loading: true });
    try {
      const data = await api.getBidDetail(id);
      // 格式化日期字段
      if (data.publishDate) data.publishDateFmt = formatDate(data.publishDate);
      if (data.parentBid && data.parentBid.publishDate) {
        data.parentBid.publishDateFmt = formatDate(data.parentBid.publishDate);
      }
      // 清理 HTML，让 rich-text 可以正确渲染 div/table/p 等标签
      if (data.content) {
        data.contentHtml = sanitizeHtml(data.content);
      }
      this.setData({
        detail: data,
        loading: false
      });
    } catch (e) {
      console.error('加载详情失败', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  onCollect() {
    wx.showToast({ title: '收藏功能开发中', icon: 'none' });
  },

  onShare() {
    wx.showToast({ title: '点击右上角分享', icon: 'none' });
  },

  onSubscribe() {
    wx.showToast({ title: '订阅成功', icon: 'success' });
  },

  /**
   * 打开全屏查看
   * - 显示与详情相同的内容
   * - 在全屏模式下表格不强制压缩，可以横向滚动查看完整内容
   * - 支持缩放（A+ / A-）
   */
  openFullscreen() {
    this.setData({ showFullscreen: true, fontScale: 1.0, fontScaleText: '100%' });
  },

  closeFullscreen() {
    this.setData({ showFullscreen: false });
  },

  onOverlayTap() {
    // 点击遮罩关闭弹层
    this.setData({ showFullscreen: false });
  },

  zoomIn() {
    const next = Math.min(2.0, this.data.fontScale + 0.2);
    const rounded = Math.round(next * 10) / 10;
    this.setData({ fontScale: rounded, fontScaleText: Math.round(rounded * 100) + '%' });
  },

  zoomOut() {
    const next = Math.max(0.6, this.data.fontScale - 0.2);
    const rounded = Math.round(next * 10) / 10;
    this.setData({ fontScale: rounded, fontScaleText: Math.round(rounded * 100) + '%' });
  }
})
