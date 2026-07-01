const api = require('../../utils/api.js');
const userApi = require('../../utils/user-api.js');

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

// 规范化日期时间显示：保证日期与时间之间有空格
//   "2025-01-01T10:00:00"        → "2025-01-01 10:00:00"
//   "2025-01-01 10:00:00"        → "2025-01-01 10:00:00"
//   "2025-01-0110:00:00"         → "2025-01-01 10:00:00"
//   "2025-01-01"                 → "2025-01-01"
function formatDateTime(dateStr) {
  if (!dateStr) return '';
  let s = String(dateStr).trim();
  // 1. ISO 8601 格式的 T 替换为空格
  s = s.replace(/T/g, ' ');
  // 2. 修复日期与时间无分隔符的情况: YYYY-MM-DDHH:mm[:ss]
  s = s.replace(/(\d{4}-\d{2}-\d{2})(\d{2}:\d{2}(?::\d{2})?)/, '$1 $2');
  return s;
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
 * 生成正文预览（用于未登录/积分不足时显示一段）
 * 策略：
 *   1. 优先用后端返回的纯文本字段
 *   2. 没有则从 HTML 提取（去标签 + 合并空白）
 *   3. 截取前 N 个字符
 *
 * 注意：返回的必须是纯文本（无 HTML 标签），用于 <text> 组件插值显示。
 */
function buildContentPreview(plainText, html, maxLen) {
  const limit = maxLen || 200;
  let text = '';
  if (plainText && typeof plainText === 'string') {
    // 如果 plainText 本身也含 HTML 标签（后端字段命名不规范），也走一次清洗
    if (/<[a-z][^>]*>/i.test(plainText)) {
      text = stripAllTags(plainText);
    } else {
      text = plainText;
    }
  } else if (html && typeof html === 'string') {
    text = stripAllTags(html);
  }
  // 合并空白
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length > limit) {
    return text.substring(0, limit) + '…';
  }
  return text;
}

/**
 * 彻底去除所有 HTML 标签 / 注释 / CDATA / style 脚本，并解码常见实体
 */
function stripAllTags(raw) {
  return raw
    // 1. 去掉 <script>...</script> 整块
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    // 2. 去掉 <style>...</style> 整块
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    // 3. 去掉 HTML 注释
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // 4. 去掉 CDATA 段
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, ' ')
    // 5. 去掉所有 HTML 标签（关键：处理 <div class="artcon">、<span style="...">、自闭合标签等）
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
    // 6. 去掉单独的 < 或 > 残留
    .replace(/[<>]/g, ' ')
    // 7. 解码常见 HTML 实体
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/**
 * HTML 清理与规范化 - 让 rich-text 组件能正确渲染
 * 支持：div/p/span/h1-h6/ul/ol/li/table/tr/td/th/img/a/br/strong/em 等
 */
function sanitizeHtml(rawHtml) {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  let html = String(rawHtml);

  // 0. 提取核心内容区（rich-text 不支持 <body>/<html> 包裹）
  //    用栈匹配找到对应结束标签，避免非贪婪匹配过早结束
  //    支持 class 和 id 两种属性
  const containerKeywords = [
    'detail_content', 'mycontent', 'mainContent', 'content-body', 'article-body',
    'detail-body', 'notice-content', 'main-content', 'content',
    'detail_content_box', 'mycontent', 'info_content', 'bid_content', 'contenido',
    'news-content', 'article-content', 'post-content', 'entry-content',
    'bid-detail', 'notice-detail', 'detailContent', 'mainContent', 'conTxt'
  ];
  const kwRe = '(?:' + containerKeywords.join('|') + ')';
  const contentClassRe = new RegExp('<(div|section|article|td)[^>]*class=["\'][^"\']*' + kwRe + '[^"\']*["\'][^>]*>', 'i');
  const contentIdRe = new RegExp('<(div|section|article|td)[^>]*id=["\'][^"\']*' + kwRe + '[^"\']*["\'][^>]*>', 'i');
  const openRe = /<(div|section|article|p|table|ul|ol|h[1-6])(\s[^>]*)?>|<\/(div|section|article|p|table|ul|ol|h[1-6])>/gi;

  const findContent = (openMatch) => {
    if (!openMatch) return null;
    const startIdx = openMatch.index + openMatch[0].length;
    const tagName = openMatch[1].toLowerCase();
    let depth = 1;
    openRe.lastIndex = startIdx;
    let m;
    while ((m = openRe.exec(html)) !== null) {
      const t = m[0].toLowerCase();
      // 块级标签需要栈匹配
      if (t.startsWith('</')) {
        const closeTag = t.replace(/[<\/]/g, '');
        if (closeTag === tagName) {
          depth--;
          if (depth === 0) return html.substring(startIdx, m.index);
        }
      } else {
        const newTag = t.replace(/[<>]/g, '').split(/\s/)[0];
        if (newTag === tagName) depth++;
      }
    }
    return null;
  };

  let coreContent = findContent(html.match(contentClassRe)) || findContent(html.match(contentIdRe));
  if (coreContent) {
    html = coreContent;
  }

  // 0.1 剥掉 <body>/<html>/<head> 等结构标签
  html = html.replace(/<\/?(html|head|body|meta|link|title|script|style|iframe|object|embed|frameset|frame)[\s\S]*?>/gi, '');

  // 0.2 移除百度/采集器的隐藏锚点（只匹配空锚点，不删带内容的 a）
  html = html.replace(/<span[^>]*id=["']_baidu_bookmark_(start|end)_\d+["'][\s\S]*?<\/span>/gi, '');
  html = html.replace(/<a[^>]*name=["'][^"']*["']>\s*<\/a>/gi, '');

  // 0.3 移除空白零宽字符
  html = html.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // 0.4 移除采购云采集器生成的无意义表单元素（只移除真正空表单）
  html = html.replace(/<form[^>]*>\s*<\/form>/gi, '');
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
    isLoggedIn: false,    // 是否已登录
    isFavorited: false,    // 是否已收藏
    favoriting: false      // 收藏请求中
  },

  onLoad(options) {
    // 获取状态栏高度
    const app = getApp();
    const statusBarHeight = (app && app.globalData && app.globalData.statusBarHeight) || 20;
    this.setData({ statusBarHeight });
    if (options.id) {
      this._bidId = options.id;
      this.loadDetail(options.id);
    }
  },

  onShow() {
    if (!this._bidId) return;
    const loggedIn = !!userApi.getToken();
    this.setData({ isLoggedIn: loggedIn });
    if (loggedIn) {
      // 已登录：如果详情还没加载（如从登录页返回），重新加载
      if (!this.data.detail && !this.data.loading) {
        this.loadDetail(this._bidId);
      } else if (this.data.detail) {
        // 详情已加载，刷新收藏状态
        this.checkFavorite();
      }
    }
  },

  checkFavorite() {
    userApi.checkFavorite(this._bidId).then((res) => {
      const fav = res === true || res === 'true' || (res && res.favorited) || false;
      this.setData({ isFavorited: fav });
    }).catch((err) => {
      console.log('[Detail] 查询收藏状态失败', err);
    });
  },

  async loadDetail(id) {
    this.setData({ loading: true });

    const isLoggedIn = !!userApi.getToken();
    this.setData({ isLoggedIn });

    // 1. 公开接口（X-Mini-Program 头）无需登录即可拉到详情数据
    try {
      const raw = await api.getBidDetail(id);
      const data = raw || {};

      // 清理 title 中的 Office/HTML 残留（MSO 样式、HTML 实体等）
      if (data.title) data.title = api.cleanTitle(data.title);
      if (data.parentBid && data.parentBid.title) data.parentBid.title = api.cleanTitle(data.parentBid.title);
      if (Array.isArray(data.childBids)) {
        data.childBids.forEach(cb => { if (cb.title) cb.title = api.cleanTitle(cb.title); });
      }

      // 调试：打印原始响应到控制台
      console.log('[Detail] 原始响应字段:', Object.keys(data));
      console.log('[Detail] 完整响应:', JSON.stringify(data).slice(0, 2000));

      // 规范化日期字段显示：保证日期与时间之间是空格（处理 "T" 或紧贴的情况）
      if (data.publishDate) data.publishDate = formatDateTime(data.publishDate);
      if (data.deadline) data.deadline = formatDateTime(data.deadline);
      if (data.openBidTime) data.openBidTime = formatDateTime(data.openBidTime);

      // 格式化日期字段（保留旧逻辑：供关联区块使用的 Fmt 字段）
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

      // 3) 附件列表 - 多种字段名, 转成 WXML 可直接遍历的数组
      const attachmentsArr = data.attachments
        || data.files
        || data.documents
        || data['附件']
        || [];
      console.log('[Detail] 原始 attachments:', JSON.stringify(attachmentsArr).slice(0, 1500));
      data.attachments = Array.isArray(attachmentsArr) ? attachmentsArr.map((att, idx) => {
        const fileName = att.fileName
          || att.file_name
          || att.name
          || att.filename
          || att.title
          || `附件${idx + 1}`;
        const fileSize = att.fileSize || att.file_size || att.size || 0;
        const fileType = att.fileType || att.file_type || att.type || '';
        const icon = getFileIcon(fileType);
        // 优先用后端返回的 url，其次拼接附件下载接口
        let url = att.downloadUrl
          || att.download_url
          || att.url
          || att.originalUrl
          || att.original_url
          || att.fileUrl
          || att.file_url
          || '';
        // 如果后端没返回 url，但有 id，尝试拼接下载接口
        if (!url && att.id) {
          url = `/api/v1/attachments/${att.id}/download`;
        }
        console.log('[Detail] 附件', idx, 'fileName:', fileName, 'id:', att.id, 'url:', url);
        return {
          id: att.id || idx,
          fileName,
          fileType,
          fileSize,
          fileSizeText: fileSize > 0 ? formatFileSize(fileSize) : '',
          downloadUrl: url,
          icon
        };
      }) : [];

      // 4) 组装正文 HTML (主正文 + sections + 关联交易结果)
      const transactionResult = data.transactionResult
        || data.transaction_result
        || data.winResult
        || data['交易结果']
        || '';
      const resultHtml = transactionResult
        ? `<view class="transaction-result"><view class="block-title">交易结果</view><view class="result-body">${sanitizeHtml(transactionResult)}</view></view>`
        : '';
      const contentHtml = (mainHtml || '') + sectionsHtml + resultHtml;

      data.contentHtml = contentHtml;
      data.hasContent = !!(mainHtml || sectionsHtml);

      // 提取正文纯文本（用于未登录/积分不足时显示的预览片段）
      const plainContent = data.content || data.body || data.description || data.text || data.plainContent || data.plain_content || '';
      data.contentPreview = buildContentPreview(plainContent, contentHtml);

      // 已登录用户：先扣积分/记录浏览历史，积分不足则不显示正文
      let insufficientPoints = false;
      if (isLoggedIn) {
        try {
          await userApi.addBrowseHistory(id);
          console.log('[Detail] 浏览历史记录成功（积分已扣减）');
        } catch (err) {
          console.warn('[Detail] 记录浏览历史失败:', err);
          if (err && err.httpStatus === 402) {
            insufficientPoints = true;
          }
        }
      }
      data.insufficientPoints = insufficientPoints;

      this.setData({
        detail: data,
        loading: false
      });

      // 积分不足：弹窗引导去签到/充值
      if (insufficientPoints) {
        wx.showModal({
          title: '积分不足',
          content: '查看标讯详情需要消耗积分，签到或充值可获得更多积分。',
          confirmText: '去签到或充值',
          cancelText: '返回',
          success: (res) => {
            if (res.confirm) {
              wx.navigateTo({ url: '/pages/points/points' });
            } else {
              wx.navigateBack({ delta: 1, fail: () => {
                wx.switchTab({ url: '/pages/index/index' });
              }});
            }
          }
        });
      } else if (isLoggedIn) {
        this.checkFavorite();
      }
    } catch (e) {
      console.error('[Detail] 加载失败', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  // 点击电话号码 - 拉起系统拨号
  onPhoneTap(e) {
    const phone = e.currentTarget.dataset.phone;
    if (!phone) return;
    // 从可能混合的字符串中提取纯电话号码（去除 "联系人：张三 13800000000" 里的姓名）
    // 兼容中英文括号、空格、短横线、转机分机号
    const matched = String(phone).match(/(\+?\d[\d\s\-()（）]{6,}\d)/);
    const purePhone = matched ? matched[1].trim() : String(phone).trim();
    if (!purePhone) {
      wx.showToast({ title: '电话号码格式异常', icon: 'none' });
      return;
    }
    wx.makePhoneCall({
      phoneNumber: purePhone,
      fail: (err) => {
        console.log('[detail] 拨号失败:', err);
        // 用户取消拨号不提示，其他错误才提示
        if (err.errMsg && err.errMsg.indexOf('cancel') < 0) {
          wx.showToast({ title: '拨号失败', icon: 'none' });
        }
      }
    });
  },

  // 点击附件 - 直接下载并打开
  onAttachmentTap(e) {
    const { url, name } = e.currentTarget.dataset || {};
    if (!url || url === '#') {
      wx.showToast({ title: '附件链接不可用', icon: 'none' });
      return;
    }
    // 如果是相对路径，补全为完整 URL
    const fullUrl = url.startsWith('http') ? url : ('https://www.sunbidinfo.com' + (url.startsWith('/') ? url : '/' + url));

    wx.showActionSheet({
      itemList: ['直接下载并打开', '复制下载链接'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 直接下载
          this.downloadAttachment(fullUrl, name);
        } else if (res.tapIndex === 1) {
          // 复制链接
          wx.setClipboardData({
            data: fullUrl,
            success: () => wx.showToast({ title: '已复制到剪贴板', icon: 'success' })
          });
        }
      }
    });
  },

  // 下载附件
  downloadAttachment(url, name) {
    const fileName = name || '附件';
    console.log('[Detail] 下载附件:', url, fileName);
    wx.showLoading({ title: '下载中...', mask: true });

    // 如果是相对路径，补全为完整 URL
    const baseUrl = url.startsWith('http') ? url : ('https://www.sunbidinfo.com' + (url.startsWith('/') ? url : '/' + url));

    // 鉴权改造后：通过 header 传 X-Mini-Program + 用户 token（不再用 api_key query 参数）
    // wx.downloadFile 支持 header 参数
    // 过渡期兼容：补 X-Web-Access 兜底，后端升级后可移除
    const token = userApi.getToken ? userApi.getToken() : '';
    const header = {
      'X-Mini-Program': '1',
      'X-Web-Access': 'bid_web_2026_public'
    };
    if (token) {
      header['Authorization'] = 'Bearer ' + token;
    }
    console.log('[Detail] 下载 URL:', baseUrl);

    wx.downloadFile({
      url: baseUrl,
      timeout: 30000,
      header: header,
      success: (res) => {
        wx.hideLoading();
        console.log('[Detail] 下载结果 statusCode:', res.statusCode, 'tempFilePath:', res.tempFilePath);
        if (res.statusCode === 200) {
          console.log('[Detail] 下载成功:', res.tempFilePath);
          // 根据文件名后缀选择打开方式
          const ext = (fileName.split('.').pop() || '').toLowerCase();
          const fileType = ext === 'pdf' ? 'pdf'
            : (ext === 'doc' || ext === 'docx') ? 'doc'
            : (ext === 'xls' || ext === 'xlsx') ? 'xls'
            : (ext === 'png' || ext === 'jpg' || ext === 'jpeg') ? 'image'
            : '';
          if (fileType) {
            wx.openDocument({
              filePath: res.tempFilePath,
              fileType: fileType,
              showMenu: true,
              success: () => {
                console.log('[Detail] 打开文档成功');
              },
              fail: (err) => {
                console.error('[Detail] 打开文档失败:', err);
                wx.showToast({ title: '已下载，可在文件管理器中查看', icon: 'none', duration: 2000 });
              }
            });
          } else {
            wx.showToast({ title: '已下载完成', icon: 'success' });
          }
        } else {
          console.error('[Detail] 下载失败 statusCode:', res.statusCode);
          wx.showToast({ title: '下载失败 (' + res.statusCode + ')', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('[Detail] 下载失败 errMsg:', err && err.errMsg, 'err:', JSON.stringify(err));
        wx.showToast({ title: '下载失败，请重试', icon: 'none' });
      }
    });
  },

  onCollect() {
    if (!userApi.getToken()) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => wx.navigateTo({ url: '/pages/login/login' }), 800);
      return;
    }
    if (!this._bidId || this.data.favoriting) return;
    const wasFav = this.data.isFavorited;
    this.setData({ favoriting: true });

    if (wasFav) {
      // 取消收藏
      userApi.removeFavorite(this._bidId).then(() => {
        // 验证后端是否真的取消了收藏
        return userApi.checkFavorite(this._bidId);
      }).then((res) => {
        const stillFav = res === true || res === 'true' || (res && res.favorited) || false;
        this.setData({ isFavorited: stillFav, favoriting: false });
        if (stillFav) {
          // 后端返回成功但实际未删除
          wx.showToast({ title: '取消收藏失败，请重试', icon: 'none' });
        } else {
          wx.showToast({ title: '已取消收藏', icon: 'success' });
        }
      }).catch((err) => {
        // 请求失败，恢复为已收藏状态
        this.setData({ isFavorited: true, favoriting: false });
        wx.showToast({ title: (err && err.message) || '取消收藏失败', icon: 'none' });
        console.error('[Detail] 取消收藏失败', err);
      });
    } else {
      // 添加收藏
      userApi.addFavorite(this._bidId).then(() => {
        this.setData({ isFavorited: true, favoriting: false });
        wx.showToast({ title: '已收藏', icon: 'success' });
      }).catch((err) => {
        this.setData({ isFavorited: false, favoriting: false });
        wx.showToast({ title: (err && err.message) || '收藏失败', icon: 'none' });
        console.error('[Detail] 收藏失败', err);
      });
    }
  },

  // 空状态按钮：去登录
  onGoLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  // 积分不足：跳转到积分签到页
  onGoPoints() {
    wx.navigateTo({ url: '/pages/points/points' });
  },

  // 空状态按钮：返回上一页
  onGoBack() {
    wx.navigateBack({ delta: 1, fail: () => {
      wx.switchTab({ url: '/pages/index/index' });
    }});
  },

  // 分享给微信好友（点击"分享"按钮 open-type="share" 触发）
  onShareAppMessage() {
    const detail = this.data.detail || {};
    const title = detail.title ? String(detail.title).slice(0, 60) : '阳光标讯 - 公告详情';
    return {
      title: title,
      path: '/pages/detail/detail?id=' + (this._bidId || ''),
      imageUrl: ''
    };
  },

  // 分享到朋友圈
  onShareTimeline() {
    const detail = this.data.detail || {};
    const title = detail.title ? String(detail.title).slice(0, 60) : '阳光标讯 - 公告详情';
    return {
      title: title,
      query: 'id=' + (this._bidId || '')
    };
  }
})
