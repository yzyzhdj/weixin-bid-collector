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

// HTML 转义
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (!bytes || bytes < 0) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

// 文件类型图标
function getFileIcon(type) {
  const t = String(type || '').toLowerCase();
  if (t.indexOf('pdf') !== -1) return '📄';
  if (t.indexOf('word') !== -1 || t.indexOf('doc') !== -1) return '📝';
  if (t.indexOf('excel') !== -1 || t.indexOf('xls') !== -1 || t.indexOf('sheet') !== -1) return '📊';
  if (t.indexOf('image') !== -1 || t.indexOf('png') !== -1 || t.indexOf('jpg') !== -1) return '🖼️';
  if (t.indexOf('zip') !== -1 || t.indexOf('rar') !== -1 || t.indexOf('7z') !== -1) return '🗜️';
  return '📎';
}

/**
 * HTML 清理与规范化 - 让 rich-text 组件能正确渲染
 * 支持：div/p/span/h1-h6/ul/ol/li/table/tr/td/th/img/a/br/strong/em 等
 */
function sanitizeHtml(rawHtml) {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  let html = String(rawHtml);

  // 0. 提取核心内容区（rich-text 不支持 <body>/<html> 包裹）
  //    优先取 detail_content / mycontent / mainContent
  const contentMatch = html.match(/<div[^>]*class=["'][^"']*(detail_content|mycontent|mainContent|content-body|article-body)[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/(div|body|html)>/i);
  if (contentMatch) {
    html = contentMatch[2];
  }

  // 0.1 剥掉 <body>/<html>/<head> 等结构标签
  html = html.replace(/<\/?(html|head|body|meta|link|title|script|style|iframe|object|embed|frameset|frame)[\s\S]*?>/gi, '');

  // 0.2 移除百度/采集器的隐藏锚点
  html = html.replace(/<span[^>]*id=["']_baidu_bookmark_(start|end)_\d+["'][\s\S]*?<\/span>/gi, '');
  html = html.replace(/<a[^>]*name=["'][^"']*["'][\s\S]*?<\/a>/gi, '');

  // 0.3 移除空白零宽字符
  html = html.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // 0.4 移除采购云采集器生成的无意义表单元素
  html = html.replace(/<(form|input|button|select|textarea)[\s\S]*?<\/\1>/gi, '');
  html = html.replace(/<input[^>]*\/?>/gi, '');

  // 1. 移除危险标签
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<style[\s\S]*?<\/style>/gi, '');
  html = html.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
  html = html.replace(/<object[\s\S]*?<\/object>/gi, '');
  html = html.replace(/<embed[\s\S]*?<\/embed>/gi, '');

  // 2. 移除危险属性 (on* 事件)
  html = html.replace(/\s*on\w+\s*=\s*(['"])[^'"]*\1/gi, '');

  // 3. javascript: 协议清理
  html = html.replace(/javascript\s*:/gi, '');

  // 4. 规范化图片：添加 max-width 样式
  html = html.replace(/<img([^>]*)>/gi, (match, attrs) => {
    const styleMatch = attrs.match(/style\s*=\s*(['"])(.*?)\1/i);
    let style = styleMatch ? styleMatch[2] : '';
    if (!/max-width/i.test(style)) {
      style = 'max-width:100%;height:auto;display:block;margin:8rpx 0;' + style;
    }
    let newAttrs = attrs.replace(/style\s*=\s*(['"])(.*?)\1/i, '');
    newAttrs += ` style="${style}"`;
    return `<img${newAttrs}>`;
  });

  // 5. 规范化表格
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

  // 6. 链接加 target
  html = html.replace(/<a\s+([^>]*?)>/gi, (match, attrs) => {
    if (!/target/i.test(attrs)) {
      return `<a ${attrs} target="_blank" rel="noopener noreferrer">`;
    }
    return match;
  });

  // 7. 段落化：规范化换行
  html = html.replace(/\r?\n/g, '');

  // 8. 移除空段落
  html = html.replace(/<p[^>]*>\s*<\/p>/gi, '');
  html = html.replace(/<div[^>]*>\s*<\/div>/gi, '');

  // 9. 清理多余空白
  html = html.replace(/[ \t]+/g, ' ');
  html = html.replace(/>\s+</g, '><');

  return html.trim();
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
      const raw = await api.getBidDetail(id);
      const data = raw || {};

      // 调试：打印原始响应到控制台
      console.log('[Detail] 原始响应字段:', Object.keys(data));
      console.log('[Detail] 完整响应:', JSON.stringify(data).slice(0, 2000));

      // 格式化日期字段
      if (data.publishDate) data.publishDateFmt = formatDate(data.publishDate);
      if (data.publishDateFmt === undefined && data.publish_date) {
        data.publishDateFmt = formatDate(data.publish_date);
      }
      if (data.parentBid && data.parentBid.publishDate) {
        data.parentBid.publishDateFmt = formatDate(data.parentBid.publishDate);
      }

      // 智能字段提取（兼容多种字段命名）
      // 1) 主正文 - 尝试多种字段名
      const mainContent = data.content
        || data.body
        || data.description
        || data.contentHtml
        || data.content_html
        || data.html
        || data.article
        || data.text
        || '';
      let mainHtml = '';
      if (typeof mainContent === 'string' && mainContent.trim()) {
        mainHtml = sanitizeHtml(mainContent);
      }

      // 2) 结构化 sections - 尝试多种字段名
      const sectionsArr = data.sections
        || data.blocks
        || data.items
        || data.parts
        || [];
      let sectionsHtml = '';
      if (Array.isArray(sectionsArr) && sectionsArr.length > 0) {
        const sortedSections = sectionsArr.slice().sort((a, b) => {
          return (a.orderNum || a.order_num || a.order || a.sort || 0)
               - (b.orderNum || b.order_num || b.order || b.sort || 0);
        });
        sectionsHtml = sortedSections
          .map((sec, idx) => {
            const title = sec.title || sec.name || sec.heading || sec.sectionName || sec.section_name || '';
            const body = sec.content
              || sec.body
              || sec.description
              || sec.html
              || sec.text
              || '';
            const titleHtml = title
              ? `<view class="section-title">${escapeHtml(title)}</view>`
              : '';
            const bodyHtml = body ? sanitizeHtml(body) : '';
            return `<view class="section" data-idx="${idx}">${titleHtml}<view class="section-body">${bodyHtml}</view></view>`;
          })
          .join('');
      }

      // 3) 附件列表 - 尝试多种字段名
      const attachmentsArr = data.attachments
        || data.files
        || data.documents
        || data.附件
        || [];
      let attachmentsHtml = '';
      if (Array.isArray(attachmentsArr) && attachmentsArr.length > 0) {
        const items = attachmentsArr
          .map((att, idx) => {
            const fileName = att.fileName
              || att.file_name
              || att.name
              || att.filename
              || att.title
              || `附件${idx + 1}`;
            const fileSize = att.fileSize || att.file_size || att.size || 0;
            const sizeStr = fileSize > 0 ? formatFileSize(fileSize) : '';
            const icon = getFileIcon(att.fileType || att.file_type || att.type || '');
            const url = att.downloadUrl
              || att.download_url
              || att.url
              || att.originalUrl
              || att.original_url
              || '#';
            return `<view class="attachment-item" data-url="${escapeHtml(url)}" bindtap="onAttachmentTap">
              <view class="att-icon">${icon}</view>
              <view class="att-info">
                <view class="att-name">${escapeHtml(fileName)}</view>
                <view class="att-meta">${sizeStr}${sizeStr ? ' · ' : ''}点击复制链接</view>
              </view>
            </view>`;
          })
          .join('');
        attachmentsHtml = `<view class="attachments-block">
          <view class="block-title">📎 附件 (${attachmentsArr.length})</view>
          ${items}
        </view>`;
      }

      // 4) 中标结果 - 多种字段名
      const result = data.transactionResult
        || data.transaction_result
        || data.winningResult
        || data.bidResult
        || '';
      let resultHtml = '';
      if (typeof result === 'string' && result.trim()) {
        resultHtml = `<view class="transaction-result">
          <view class="block-title">🏆 中标结果</view>
          <view class="result-body">${sanitizeHtml(result)}</view>
        </view>`;
      }

      // 合并所有内容
      const fullHtml = (mainHtml || '') + sectionsHtml + resultHtml + attachmentsHtml;
      data.contentHtml = fullHtml;
      data.hasContent = !!(mainHtml || sectionsHtml || resultHtml);

      console.log('[Detail] 加载完成:', {
        id: data.id,
        title: (data.title || '').slice(0, 50),
        hasContent: data.hasContent,
        mainContentLength: (mainContent || '').length,
        sectionsCount: sectionsArr.length,
        attachmentsCount: attachmentsArr.length,
        availableFields: Object.keys(data).filter(k => /content|body|html|section|attach/i.test(k))
      });

      this.setData({
        detail: data,
        loading: false
      });
    } catch (e) {
      console.error('[Detail] 加载失败', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  // 点击附件
  onAttachmentTap(e) {
    const url = e.currentTarget.dataset.url;
    if (!url || url === '#') {
      wx.showToast({ title: '附件链接不可用', icon: 'none' });
      return;
    }
    // 复制链接到剪贴板
    wx.setClipboardData({
      data: url,
      success: () => {
        wx.showModal({
          title: '附件链接已复制',
          content: '链接已复制到剪贴板，请在浏览器中打开下载。\n\n' + url,
          confirmText: '知道了',
          showCancel: false
        });
      }
    });
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
