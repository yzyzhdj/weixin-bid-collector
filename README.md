# 阳光标讯 - 微信小程序

> 一款集成真实招标数据 API 的微信小程序，专注提供招标 / 中标 / 拟建信息的浏览、搜索、订阅与全文详情查看。

[![GitHub stars](https://img.shields.io/github/stars/yzyzhdj/weixin-bid-collector)](https://github.com/yzyzhdj/weixin-bid-collector)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## 项目简介

**阳光标讯** 是基于微信原生小程序开发的企业级招标信息查询应用，对接 `biaoxun.pandaorder.cn` 公开招标数据 API，提供：

- 📰 **海量招标信息流** - 覆盖全国 31 个省 / 直辖市
- 🔍 **多维度智能筛选** - 省/市二级联动 + 公告类型 + 行业 + 时间
- 📄 **完整公告详情** - 支持 HTML 正文、表格、标段信息
- 🔎 **全文关键词搜索** - 标题/采购单位/代理机构全文匹配
- 🔔 **订阅管理** - 关键词订阅 / 企业订阅 / 通知中心
- 👤 **个人中心** - VIP 会员、收藏、浏览历史

---

## 功能矩阵

| 模块 | 功能点 |
|------|--------|
| 🏠 **首页** | 三 Tab 信息流（最新招标 / 最新中标 / 拟建项目）+ 8 大功能宫格 + 省市二级联动筛选 |
| 🔍 **搜索** | 4 列吸顶筛选（类型/行业/地区/时间）+ 关键词搜索 + 结果分页 + 当前地区提示 |
| 📄 **详情** | HTML 公告正文（rich-text 渲染）+ 标段信息 + 关联公告 + **全屏查看弹层**（缩放 60%-200% + 双向滚动）|
| 🔔 **订阅** | 关键词/企业两种订阅类型 + 立即订阅 CTA + 浮动添加按钮 |
| ➕ **更多** | 标书模版 / 业务拓展 / 数据服务入口 |
| 👤 **我的** | 用户信息 + VIP 卡片 + 通知栏 + 快捷功能（订阅/收藏/定制）+ 设置 |

---

## 页面架构

```
阳光标讯 (weixin-bid-collector)
├── Tab 1: 首页         pages/index/
├── Tab 2: 订阅         pages/subscribe/
├── Tab 3: 更多         pages/list/
├── Tab 4: 我的         pages/profile/
├── 跳转: 搜索结果       pages/search/        (从首页「查招标/查中标/查拟建」入口)
├── 跳转: 详情          pages/detail/        (从搜索结果 / 首页列表入口)
├── 跳转: 高级会员       pages/more/          (从我的「VIP 卡片」入口)
└── 跳转: 综合搜索       pages/subscription/  (从 Tab 栏之外)
```

---

## 快速开始

### 环境要求

- **微信开发者工具** ≥ 1.06.0
- **基础库** ≥ 2.30.0

### 安装步骤

#### 1. 克隆仓库

```bash
git clone https://github.com/yzyzhdj/weixin-bid-collector.git
```

#### 2. 导入项目

打开微信开发者工具 → 「导入项目」→ 选择 `weixin-bid-collector` 目录 → AppID 选择「测试号」或自己的小程序 AppID。

#### 3. 配置 API Key

打开 [utils/config.js](utils/config.js)：

```javascript
module.exports = {
  API_BASE_URL: 'https://biaoxun.pandaorder.cn/api/v1',
  API_KEY: 'your_api_key_here'  // 替换为你的 API Key
};
```

> **申请 API Key**：访问 [biaoxun.pandaorder.cn](https://biaoxun.pandaorder.cn) 注册账号申请。

#### 4. 配置服务器域名

在 **微信公众平台** → 开发管理 → 服务器域名 中添加：

```
request 合法域名:  https://biaoxun.pandaorder.cn
```

> 开发阶段可在 `project.private.config.json` 中临时关闭域名校验（不推荐生产使用）。

#### 5. 编译运行

点击微信开发者工具的「编译」按钮即可预览。

---

## 项目结构

```
weixin-bid-collector/
├── app.js                  # 小程序入口（初始化全局系统信息）
├── app.json                # 全局配置（页面路由、TabBar）
├── app.wxss                # 全局样式
├── sitemap.json
│
├── pages/                  # 页面目录
│   ├── index/              # 首页 - 招标信息流 + 省市筛选
│   ├── search/             # 搜索结果页（独立路由）
│   ├── detail/             # 标讯详情（含全屏查看）
│   ├── subscribe/          # 订阅管理（Tab）
│   ├── subscription/       # 综合搜索（Tab 外）
│   ├── list/               # 更多功能（Tab）
│   ├── more/               # 高级会员（VIP 卡片入口）
│   └── profile/            # 我的中心（Tab）
│
├── utils/
│   ├── api.js              # API 请求封装（Promise 化）
│   ├── config.js           # 全局配置（API_KEY、API_BASE_URL）
│   └── city-data.js        # 31 省 + 城市级联数据
│
└── images/                 # 图标资源（80+ PNG / SVG）
    ├── tab-*.png           # TabBar 图标
    ├── icon-*.svg          # 功能图标（彩色）
    └── biz-icon*.png       # 业务图标
```

---

## 技术栈

| 类别 | 选型 |
|------|------|
| **框架** | 微信原生小程序 |
| **样式** | WXSS + rpx 自适应单位 |
| **状态管理** | Page data + globalData（轻量）|
| **网络** | `wx.request` + Promise 封装 |
| **渲染** | rich-text（HTML）+ 自定义 sanitize |
| **存储** | `wx.setStorage`（订阅、收藏）|
| **API 协议** | HTTPS + Bearer Token |

---

## 核心功能详解

### 1. 省市二级联动筛选

**实现位置**：[pages/index/index.js](pages/index/index.js) + [utils/city-data.js](utils/city-data.js)

```javascript
// 31 省级行政区数据，支持直辖市 + 自治区 + 特别行政区
const PROVINCES = ['北京', '天津', '上海', '重庆', ..., '新疆', '香港', '澳门'];

// 选择省/市 → 自动调用 API
const params = {
  page: 1,
  page_size: 20,
  province: '北京',       // 可选
  city: '海淀区',          // 可选
  sort_by: 'createdAt',
  sort_order: 'desc'
};
const data = await api.getBidList(params);
```

**交互细节**：
- 点击「全国」打开底部弹层
- 左侧省份列 + 右侧城市列二级联动
- 选中省份后自动展示该省所有城市
- 直辖市（北京/上海等）支持区级选择
- 「确认筛选」才应用选择，避免误操作

### 2. 富文本 + 表格全屏查看

**痛点**：标讯正文常含 `<table>`、`<div>` 等标签，小屏展示表格被截断。

**实现**：[pages/detail/detail.js](pages/detail/detail.js) + [pages/detail/detail.wxml](pages/detail/detail.wxml)

**关键技术**：

1. **HTML 清理**（防止 XSS）：
   ```javascript
   function sanitizeHtml(html) {
     // 1. 移除 <script> / <style> / <iframe>
     // 2. 移除 on* 事件属性
     // 3. 清理 javascript: 协议
     // 4. 规范化 img / table 内联样式
     return cleanHtml;
   }
   ```

2. **rich-text 渲染 + table 强制适配**：
   ```css
   .content-text table {
     width: 100% !important;
     table-layout: fixed !important;  /* 列宽自动均分 */
   }
   .content-text td {
     word-break: break-all !important; /* 长文本自动换行 */
   }
   ```

3. **全屏查看弹层**（解决极宽表格）：
   - 点击「全屏查看」按钮
   - 双向 scroll-view 自由滚动
   - A−/A+ 字号缩放 60%-200%
   - 遮罩点击关闭

### 3. 刘海屏/灵动岛适配

**适配策略**（[app.js](app.js) + 各 page）：

```javascript
// app.js 读取微信胶囊位置
const systemInfo = wx.getSystemInfoSync();
const menuButton = wx.getMenuButtonBoundingClientRect();
this.globalData = {
  statusBarHeight: systemInfo.statusBarHeight,
  menuButton: {
    top: menuButton.top,
    height: menuButton.height
  }
};
```

**各页面 header 结构**：

```xml
<view class="header" style="padding-top: env(safe-area-inset-top);">
  <view class="header-content" style="height: 60rpx;">
    <view class="back-btn">...</view>
    <view class="header-title-wrap">
      <text class="header-title">查招标</text>
    </view>
  </view>
</view>
```

**适配要点**：
- ✅ 状态栏用 `padding-top: env(...)` 占位
- ✅ 标题区独立 60rpx，与微信胶囊同高
- ✅ 设置按钮用 JS 动态定位避开胶囊
- ✅ 测试覆盖：iPhone X / 11 / 12 / 13 / 14 Pro（灵动岛）

### 4. 三个分类 Tab 智能映射

| Tab | 默认 bidType | 全国 | 北京 | 北京·海淀区 |
|-----|------------|------|------|------------|
| 最新招标 | `招标公告` | 1052 | 273 | 78 |
| 最新中标 | `中标公告` | 753 | 257 | 60 |
| 拟建项目 | `工程类` | 15 | 0 | 0 |

**智能逻辑**：当用户选择了具体省市时，**不传 bidType**（避免命中 0 结果）。

```javascript
const hasRegion = this.data.selectedProvince || this.data.selectedCity;
if (!hasRegion) {
  // 默认 Tab → 传 bidType
  params.bid_type = this.getBidTypeByTab(this.data.currentInfoTab);
}
```

---

## API 集成

### 接口列表

| 接口 | 用途 |
|------|------|
| `GET /bids` | 招标列表 + 多维筛选 + 分页 |
| `GET /bids/:id` | 招标详情 + HTML 正文 + 标段 + 关联公告 |
| `GET /bids/search` | 关键词全文搜索 |
| `GET /stats` | 数据统计（总数 / 今日新增）|
| `GET /filters` | 筛选选项（来源/类型/方式/省份）|

完整 API 文档：[API_DOC.md](API_DOC.md)

### 请求封装

[utils/api.js](utils/api.js)：

```javascript
function request(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: API_BASE_URL + options.url,
      header: {
        'Authorization': `Bearer ${API_KEY}`
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.code === 0) {
          resolve(res.data.data);
        } else {
          wx.showToast({ title: res.data.message });
          reject(res.data);
        }
      },
      fail: (err) => reject(err)
    });
  });
}
```

---

## 开发规范

### 命名约定

- 文件：`kebab-case`（如 `bid-detail.wxml`）
- 变量 / 函数：`camelCase`（如 `loadBidList`）
- 常量：`UPPER_SNAKE_CASE`（如 `API_KEY`）

### 尺寸单位

- 优先使用 `rpx`（750rpx = 屏幕宽度）
- 字体大小 `px` 配合 `rpx` 混用（rpx 可缩放）
- 状态栏高度用 `px`（系统绝对值）

### 样式组织

- 全局样式：[app.wxss](app.wxss)（reset + 通用类）
- 页面样式：每个 page 自带 `*.wxss`
- 公共类：`.flex`, `.text-ellipsis`, `.card`, `.btn-primary` 等

---

## 部署上线

### 1. 真机预览

微信开发者工具 → 预览 → 扫码 → 真机运行

### 2. 体验版 / 正式版

1. 微信开发者工具 → 上传 → 填写版本号
2. 微信公众平台 → 版本管理 → 提交审核
3. 审核通过 → 发布

### 3. 生产环境检查清单

- [ ] `utils/config.js` 中的 `API_KEY` 替换为生产 Key
- [ ] 微信公众平台添加 `biaoxun.pandaorder.cn` 为合法域名
- [ ] 关闭 `project.private.config.json` 中的 `urlCheck: false`
- [ ] 测试所有页面在不同机型的兼容性
- [ ] 验证支付 / 登录等敏感流程

---

## 浏览器 / 设备兼容

| 设备 | 支持 |
|------|------|
| iOS 微信 | ✅ 8.0+ |
| Android 微信 | ✅ 8.0+ |
| iPhone 灵动岛 | ✅ 完整适配 |
| iPhone 刘海屏 | ✅ 完整适配 |
| Android 全面屏 | ✅ 完整适配 |
| 旧版微信（< 7.0）| ⚠️ 部分功能受限 |

---

## 路线图

- [x] 基础信息流 + 省市筛选
- [x] 富文本详情 + 全屏查看
- [x] 订阅管理 UI
- [ ] 订阅功能接入真实 API
- [ ] 收藏功能接入真实 API
- [ ] 微信支付 / VIP 购买
- [ ] 企业认证 / 发布招标
- [ ] PWA / 多端支持

---

## 贡献

欢迎提交 Issue 和 Pull Request！

```bash
# Fork 项目
# 创建特性分支
git checkout -b feature/AmazingFeature

# 提交改动
git commit -m "feat: add AmazingFeature"

# 推送到分支
git push origin feature/AmazingFeature

# 创建 Pull Request
```

---

## 许可证

[MIT License](LICENSE)

---

## 联系方式

- **GitHub**: [yzyzhdj/weixin-bid-collector](https://github.com/yzyzhdj/weixin-bid-collector)
- **API 文档**: [biaoxun.pandaorder.cn](https://biaoxun.pandaorder.cn)

---

<p align="center">
  <sub>Built with ❤️ by WeChat Mini Program Developer</sub>
</p>
