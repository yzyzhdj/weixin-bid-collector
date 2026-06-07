# 招标信息数据服务 API 接口文档

> **版本**: v1  
> **基础地址**: `https://biaoxun.pandaorder.cn/api/v1`  
> **数据格式**: JSON  
> **字符编码**: UTF-8  
> **协议**: HTTPS

---

## 目录

1. [认证方式](#1-认证方式)
2. [频率限制](#2-频率限制)
3. [统一响应格式](#3-统一响应格式)
4. [错误码说明](#4-错误码说明)
5. [接口列表](#5-接口列表)
   - 5.1 [招标信息列表](#51-招标信息列表)
   - 5.2 [招标信息详情](#52-招标信息详情)
   - 5.3 [招标信息搜索](#53-招标信息搜索)
   - 5.4 [数据统计](#54-数据统计)
   - 5.5 [筛选选项](#55-筛选选项)
6. [数据字段说明](#6-数据字段说明)
7. [调用示例](#7-调用示例)
8. [常见问题](#8-常见问题)

---

## 1. 认证方式

所有接口均需要通过 API Key 进行身份认证，支持以下两种传递方式：

### 方式一：请求头传递（推荐）

```
Authorization: Bearer {your_api_key}
```

### 方式二：查询参数传递

```
?api_key={your_api_key}
```

> ⚠️ **安全提示**：推荐使用请求头方式传递 API Key，避免 Key 出现在 URL 中被日志记录泄露。

### 认证失败响应

```json
{
    "code": 401,
    "message": "缺少API Key，请通过 Authorization: Bearer <key> 或 ?api_key=<key> 传递"
}
```

```json
{
    "code": 401,
    "message": "无效的API Key"
}
```

```json
{
    "code": 401,
    "message": "API Key已过期"
}
```

---

## 2. 频率限制

每个 API Key 具有独立的请求频率限制（默认 1000 次/小时），超出限制后将返回：

```json
{
    "code": 429,
    "message": "请求频率超限，每小时最多1000次请求",
    "data": {
        "limit": 1000,
        "remaining": 0,
        "reset_at": 1716100000
    }
}
```

### 频率限制响应头

每个成功请求的响应头中包含以下字段，用于实时监控配额：

| 响应头 | 说明 |
|--------|------|
| `X-RateLimit-Limit` | 当前 Key 每小时允许的最大请求数 |
| `X-RateLimit-Remaining` | 当前时间窗口内剩余可用请求数 |

---

## 3. 统一响应格式

所有接口均返回 JSON 格式数据，遵循统一结构：

### 成功响应

```json
{
    "code": 0,
    "message": "success",
    "data": { ... }
}
```

### 错误响应

```json
{
    "code": 401,
    "message": "错误描述信息"
}
```

### 分页响应结构

```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [ ... ],
        "pagination": {
            "total": 335,
            "page": 1,
            "page_size": 20,
            "total_pages": 17
        }
    }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `total` | int | 符合条件的总记录数 |
| `page` | int | 当前页码 |
| `page_size` | int | 每页记录数 |
| `total_pages` | int | 总页数 |

---

## 4. 错误码说明

| 错误码 | HTTP 状态码 | 说明 |
|--------|-------------|------|
| 0 | 200 | 请求成功 |
| 400 | 400 | 请求参数错误 |
| 401 | 401 | 认证失败（缺少Key / Key无效 / Key过期） |
| 403 | 403 | 权限不足 |
| 404 | 404 | 资源不存在 |
| 429 | 429 | 请求频率超限 |
| 1 | 500 | 服务器内部错误 |

---

## 5. 接口列表

### 5.1 招标信息列表

获取招标信息列表，支持多条件筛选和分页。

**请求**

```
GET https://biaoxun.pandaorder.cn/api/v1/bids
```

**请求参数**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `page` | int | 否 | 1 | 页码，从1开始 |
| `page_size` | int | 否 | 20 | 每页条数，最大100 |
| `keyword` | string | 否 | - | 关键词，匹配标题、采购单位、代理机构 |
| `source` | string | 否 | - | 数据来源（可通过筛选选项接口获取可选值） |
| `bid_type` | string | 否 | - | 公告类型（交易公告、交易结果等） |
| `bidding_method` | string | 否 | - | 招标方式（公开招标、竞争性磋商等） |
| `province` | string | 否 | - | 省份 |
| `city` | string | 否 | - | 城市 |
| `buyer` | string | 否 | - | 采购单位（模糊匹配） |
| `publish_date_start` | string | 否 | - | 发布日期起始，格式 `YYYY-MM-DD` |
| `publish_date_end` | string | 否 | - | 发布日期截止，格式 `YYYY-MM-DD` |
| `industry` | string | 否 | - | 行业分类，多个用逗号分隔（如：`工程建筑,医疗卫生`），可选值见下方说明 |
| `bid_method` | string | 否 | - | 招采类型，多个用逗号分隔（如：`货物,工程`），可选值：`货物`、`工程`、`服务`、`其他` |
| `budget` | string | 否 | - | 预算金额范围，可选值：`0-50`（50万以内）、`50-100`（50-100万）、`100-`（100万以上）、`custom`（自定义，需配合budget_min/budget_max） |
| `budget_min` | double | 否 | - | 自定义预算最低金额（万元），budget=custom时生效 |
| `budget_max` | double | 否 | - | 自定义预算最高金额（万元），budget=custom时生效 |
| `buyer_type` | string | 否 | - | 招采单位类型，多个用逗号分隔，可选值：`党政机关`、`事业单位`、`医院`、`学校`、`国有企业`、`其他一般企业` |
| `agent` | string | 否 | - | 代理单位筛选，可选值：`有`、`无` |
| `winner` | string | 否 | - | 中标情况，可选值：`已中标`、`未中标`、`不确定` |
| `contact` | string | 否 | - | 联系方式筛选，可选值：`无联系方式`、`有联系方式`、`有招标单位联系方式`、`有中标单位联系方式`、`有代理单位联系方式` |
| `attachment` | string | 否 | - | 附件筛选，可选值：`有`、`无` |
| `doc_get_time` | string | 否 | - | 标书获取时间，可选值：`未截至`、`已截至`、`无时间` |
| `deadline` | string | 否 | - | 投标截止时间，可选值：`未截至`、`已截至`、`无时间` |
| `open_time` | string | 否 | - | 开标时间，可选值：`未开标`、`已开标`、`无时间` |
| `sort_by` | string | 否 | publish_date | 排序字段，可选：`publish_date`、`created_at`、`id` |
| `sort_order` | string | 否 | desc | 排序方向，可选：`asc`、`desc` |

**行业分类可选值**

`工程建筑`、`办公文教`、`医疗卫生`、`服务采购`、`机械设备`、`水利水电`、`能源化工`、`弱电安防`、`信息技术`、`交通运输`、`市政基建`、`农林牧渔`、`政府部门`、`日用百货`、`材料配件`、`通讯电子`、`仪器仪表`、`环保绿化`、`服装布料`、`制造生成`、`家居建材`、`食品饮品`、`债券发行`、`其他`

**多选参数说明**

`industry`、`bid_method`、`buyer_type` 支持多选，多个值用英文逗号分隔。例如：`industry=工程建筑,医疗卫生,服务采购`

**请求示例**

```
GET https://biaoxun.pandaorder.cn/api/v1/bids?page=1&page_size=10&bid_type=交易公告&province=山东
Authorization: Bearer {your_api_key}
```

**响应示例**

```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [
            {
                "id": 390,
                "source": "全国公共资源交易平台",
                "title": "河东区八湖镇污水处理厂及配套管网工程（一期）中标结果公示",
                "url": "https://www.ggzy.gov.cn/information/deal/html/...",
                "buyer": null,
                "buyer_contact": "0539-8083508",
                "agent": "金中证项目管理有限公司",
                "agent_contact": "张工 0539-7116936",
                "deadline": "2026年3月13日上午9:00",
                "budget": "15100万元",
                "publish_date": "2027-10-18T00:00:00",
                "bidding_method": "公开招标",
                "supervisor": "临沂市河东区城镇建设综合服务中心",
                "notice_nature": "已开标",
                "bid_type": "交易结果",
                "open_bid_time": "2026年4月8日上午09:00",
                "province": null,
                "city": null,
                "winner": null,
                "win_amount": null,
                "created_at": "2026-05-18T23:51:25",
                "updated_at": "2026-05-18T23:51:25"
            }
        ],
        "pagination": {
            "total": 335,
            "page": 1,
            "page_size": 20,
            "total_pages": 17
        }
    }
}
```

---

### 5.2 招标信息详情

获取单条招标信息的完整详情，包含标段、附件和关联公告。

**请求**

```
GET https://biaoxun.pandaorder.cn/api/v1/bids/{bid_id}
```

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `bid_id` | int | 是 | 招标信息ID |

**请求示例**

```
GET https://biaoxun.pandaorder.cn/api/v1/bids/390
Authorization: Bearer {your_api_key}
```

**响应示例**

```json
{
    "code": 0,
    "message": "success",
    "data": {
        "id": 390,
        "source": "全国公共资源交易平台",
        "title": "河东区八湖镇污水处理厂及配套管网工程（一期）中标结果公示",
        "url": "https://www.ggzy.gov.cn/information/deal/html/...",
        "buyer": null,
        "buyer_contact": "0539-8083508",
        "agent": "金中证项目管理有限公司",
        "agent_contact": "张工 0539-7116936",
        "deadline": "2026年3月13日上午9:00",
        "budget": "15100万元",
        "publish_date": "2027-10-18T00:00:00",
        "bidding_method": "公开招标",
        "supervisor": "临沂市河东区城镇建设综合服务中心",
        "notice_nature": "已开标",
        "bid_type": "交易结果",
        "open_bid_time": "2026年4月8日上午09:00",
        "province": null,
        "city": null,
        "content": "河东区八湖镇污水处理厂及配套管网工程（一期）\n中标结果公示...",
        "transaction_result": null,
        "correction_content": null,
        "open_bid_record": null,
        "parent_id": 389,
        "winner": null,
        "win_amount": null,
        "url_hash": "d14bbceac7492041ce0cacec63970d6d...",
        "created_at": "2026-05-18T23:51:25",
        "updated_at": "2026-05-18T23:51:25",
        "sections": [],
        "attachments": [],
        "parent_bid": {
            "id": 389,
            "title": "河东区八湖镇污水处理厂及配套管网工程（一期）招标公告",
            "bid_type": "交易公告",
            "publish_date": "2027-10-18T00:00:00"
        }
    }
}
```

**关联公告说明**

- 当该公告为中标/成交公告时，`parent_bid` 字段返回其关联的招标公告
- 当该公告为招标公告时，`child_bids` 字段返回其关联的中标/成交公告列表

```json
"child_bids": [
    {
        "id": 391,
        "title": "xxx项目中标结果公示",
        "bid_type": "交易结果",
        "winner": "某某建设有限公司",
        "win_amount": "1560万元",
        "publish_date": "2026-05-18T00:00:00"
    }
]
```

**标段信息**（`sections` 字段）

```json
"sections": [
    {
        "id": 1,
        "bid_id": 100,
        "section_name": "第一标段",
        "section_number": "E3701000001000929001",
        "package_number": "包1",
        "bid_document": "招标文件.pdf",
        "estimated_price": "500万元",
        "section_category": "工程施工",
        "bidding_category": "工程",
        "qualification": "投标人须具备建筑工程施工总承包壹级及以上资质...",
        "section_content": "本项目共划分为1个标段...",
        "created_at": "2026-05-18T10:00:00"
    }
]
```

**附件信息**（`attachments` 字段）

```json
"attachments": [
    {
        "id": 1,
        "file_name": "招标文件.pdf",
        "original_url": "https://www.ggzy.gov.cn/download/...",
        "file_size": 2048576,
        "file_type": ".pdf"
    }
]
```

**附件下载**

附件可通过以下地址下载：

```
GET https://biaoxun.pandaorder.cn/api/attachments/{attachment_id}/download
```

---

### 5.3 招标信息搜索

全文搜索招标信息，搜索范围涵盖标题、采购单位、代理机构、公告内容、省份、城市。

**请求**

```
GET https://biaoxun.pandaorder.cn/api/v1/bids/search
```

**请求参数**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `keyword` | string | **是** | - | 搜索关键词 |
| `page` | int | 否 | 1 | 页码 |
| `page_size` | int | 否 | 20 | 每页条数，最大100 |

**请求示例**

```
GET https://biaoxun.pandaorder.cn/api/v1/bids/search?keyword=医院&page=1&page_size=10
Authorization: Bearer {your_api_key}
```

**响应示例**

```json
{
    "code": 0,
    "message": "success",
    "data": {
        "keyword": "医院",
        "items": [
            {
                "id": 649,
                "source": "全国公共资源交易平台",
                "title": "九江市妇幼保健院母婴护理中心机动育婴服务外包采购项目公开招标公告",
                "url": "https://www.ggzy.gov.cn/information/deal/html/...",
                "buyer": "九江市妇幼保健院",
                "buyer_contact": "0792-8392842",
                "agent": "九江市海一咨询有限公司",
                "agent_contact": "张经理 0792-8888801",
                "deadline": "2026年06月10日 09点30",
                "budget": "3200000.00元",
                "publish_date": "2026-05-19T00:00:00",
                "bidding_method": "公开招标",
                "bid_type": "交易公告",
                "province": null,
                "city": null,
                "winner": null,
                "win_amount": null,
                "created_at": "2026-05-19T00:53:23"
            }
        ],
        "pagination": {
            "total": 21,
            "page": 1,
            "page_size": 20,
            "total_pages": 2
        }
    }
}
```

---

### 5.4 数据统计

获取招标信息的数据统计概览。

**请求**

```
GET https://biaoxun.pandaorder.cn/api/v1/stats
```

**请求参数**

无

**请求示例**

```
GET https://biaoxun.pandaorder.cn/api/v1/stats
Authorization: Bearer {your_api_key}
```

**响应示例**

```json
{
    "code": 0,
    "message": "success",
    "data": {
        "total": 335,
        "today": 145,
        "by_source": [
            { "source": "全国公共资源交易平台", "cnt": 335 }
        ],
        "by_type": [
            { "bid_type": "交易公告", "cnt": 294 },
            { "bid_type": "交易结果", "cnt": 41 }
        ],
        "by_province": []
    }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `total` | int | 招标信息总数 |
| `today` | int | 今日新增数量 |
| `by_source` | array | 按数据来源统计 |
| `by_type` | array | 按公告类型统计 |
| `by_province` | array | 按省份统计（前20） |

---

### 5.5 筛选选项

获取各筛选维度的可选值，用于构建前端筛选表单。

**请求**

```
GET https://biaoxun.pandaorder.cn/api/v1/filters
```

**请求参数**

无

**请求示例**

```
GET https://biaoxun.pandaorder.cn/api/v1/filters
Authorization: Bearer {your_api_key}
```

**响应示例**

```json
{
    "code": 0,
    "message": "success",
    "data": {
        "sources": ["全国公共资源交易平台"],
        "bid_types": ["交易公告", "交易结果"],
        "bidding_methods": ["公开招标", "竞争性磋商", "竞争性谈判", "询价"],
        "provinces": ["山东", "北京", "广东", "上海"]
    }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `sources` | string[] | 数据来源列表 |
| `bid_types` | string[] | 公告类型列表 |
| `bidding_methods` | string[] | 招标方式列表 |
| `provinces` | string[] | 省份列表 |

---

## 6. 数据字段说明

### 招标信息字段（bid_info）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | int | 唯一标识 |
| `source` | string | 数据来源平台 |
| `title` | string | 公告标题 |
| `url` | string | 原始链接 |
| `buyer` | string\|null | 采购单位 |
| `buyer_contact` | string\|null | 采购联系人/电话 |
| `agent` | string\|null | 招标代理机构 |
| `agent_contact` | string\|null | 代理联系人/电话 |
| `deadline` | string\|null | 投标截止时间 |
| `budget` | string\|null | 预算金额 |
| `publish_date` | string\|null | 发布时间（ISO 8601） |
| `bidding_method` | string\|null | 招标方式 |
| `supervisor` | string\|null | 监管部门 |
| `notice_nature` | string\|null | 公告性质 |
| `bid_type` | string\|null | 公告类型 |
| `open_bid_time` | string\|null | 开标时间 |
| `province` | string\|null | 省份 |
| `city` | string\|null | 城市 |
| `winner` | string\|null | 中标供应商 |
| `win_amount` | string\|null | 中标金额 |
| `industry` | string\|null | 行业分类 |
| `buyer_type` | string\|null | 招采单位类型 |
| `doc_get_time` | string\|null | 标书获取时间 |
| `content` | string\|null | 公告正文（仅详情接口返回） |
| `transaction_result` | string\|null | 成交公示（仅详情接口返回） |
| `correction_content` | string\|null | 更正事项内容（仅详情接口返回） |
| `open_bid_record` | string\|null | 开标记录（仅详情接口返回） |
| `parent_id` | int\|null | 关联招标公告ID |
| `created_at` | string | 采集时间（ISO 8601） |
| `updated_at` | string | 更新时间（ISO 8601） |

### 标段信息字段（bid_section）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | int | 唯一标识 |
| `bid_id` | int | 关联招标信息ID |
| `section_name` | string\|null | 标段名称 |
| `section_number` | string\|null | 标段编号 |
| `package_number` | string\|null | 包编号 |
| `bid_document` | string\|null | 招标文件 |
| `estimated_price` | string\|null | 标段合同估算价 |
| `section_category` | string\|null | 标段分类名称 |
| `bidding_category` | string\|null | 招标类别 |
| `qualification` | string\|null | 投标人资格条件 |
| `section_content` | string\|null | 标段内容 |

### 附件信息字段（bid_attachment）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | int | 唯一标识 |
| `file_name` | string | 文件名 |
| `original_url` | string\|null | 原始下载链接 |
| `file_size` | int\|null | 文件大小（字节） |
| `file_type` | string\|null | 文件扩展名 |

---

## 7. 调用示例

### cURL

```bash
# 招标列表
curl -X GET "https://biaoxun.pandaorder.cn/api/v1/bids?page=1&page_size=10" \
  -H "Authorization: Bearer {your_api_key}"

# 带筛选条件
curl -X GET "https://biaoxun.pandaorder.cn/api/v1/bids?bid_type=交易结果&province=山东&page_size=5" \
  -H "Authorization: Bearer {your_api_key}"

# 招标详情
curl -X GET "https://biaoxun.pandaorder.cn/api/v1/bids/390" \
  -H "Authorization: Bearer {your_api_key}"

# 关键词搜索
curl -X GET "https://biaoxun.pandaorder.cn/api/v1/bids/search?keyword=医院" \
  -H "Authorization: Bearer {your_api_key}"

# 数据统计
curl -X GET "https://biaoxun.pandaorder.cn/api/v1/stats" \
  -H "Authorization: Bearer {your_api_key}"

# 筛选选项
curl -X GET "https://biaoxun.pandaorder.cn/api/v1/filters" \
  -H "Authorization: Bearer {your_api_key}"
```

### Python

```python
import requests

API_BASE = "https://biaoxun.pandaorder.cn/api/v1"
API_KEY = "{your_api_key}"

headers = {"Authorization": f"Bearer {API_KEY}"}

# 招标列表
resp = requests.get(f"{API_BASE}/bids", headers=headers, params={
    "page": 1,
    "page_size": 10,
    "bid_type": "交易公告",
    "province": "山东",
})
data = resp.json()
for item in data["data"]["items"]:
    print(f"[{item['id']}] {item['title']}")

# 招标详情
resp = requests.get(f"{API_BASE}/bids/390", headers=headers)
detail = resp.json()
print(detail["data"]["title"])

# 关键词搜索
resp = requests.get(f"{API_BASE}/bids/search", headers=headers, params={
    "keyword": "医院",
})
results = resp.json()
print(f"搜索到 {results['data']['pagination']['total']} 条结果")

# 数据统计
resp = requests.get(f"{API_BASE}/stats", headers=headers)
stats = resp.json()
print(f"总数: {stats['data']['total']}, 今日: {stats['data']['today']}")
```

### JavaScript

```javascript
const API_BASE = "https://biaoxun.pandaorder.cn/api/v1";
const API_KEY = "{your_api_key}";

const headers = { "Authorization": `Bearer ${API_KEY}` };

// 招标列表
fetch(`${API_BASE}/bids?page=1&page_size=10&province=山东`, { headers })
    .then(res => res.json())
    .then(data => {
        console.log(`共 ${data.data.pagination.total} 条`);
        data.data.items.forEach(item => {
            console.log(`[${item.id}] ${item.title}`);
        });
    });

// 招标详情
fetch(`${API_BASE}/bids/390`, { headers })
    .then(res => res.json())
    .then(data => {
        console.log(data.data.title);
        console.log(`标段数: ${data.data.sections.length}`);
        console.log(`附件数: ${data.data.attachments.length}`);
    });

// 关键词搜索
fetch(`${API_BASE}/bids/search?keyword=医院`, { headers })
    .then(res => res.json())
    .then(data => {
        console.log(`搜索到 ${data.data.pagination.total} 条结果`);
    });
```

### Java

```java
import java.net.http.*;
import java.net.URI;

HttpClient client = HttpClient.newHttpClient();
String apiKey = "{your_api_key}";

HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://biaoxun.pandaorder.cn/api/v1/bids?page=1&page_size=10"))
    .header("Authorization", "Bearer " + apiKey)
    .GET()
    .build();

HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
System.out.println(response.body());
```

---

## 8. 常见问题

**Q: API Key 如何获取？**  
A: 请联系管理员开通账号，管理员将通过后台为您创建 API Key。

**Q: API Key 过期了怎么办？**  
A: 请联系管理员续期或重新签发新的 API Key。

**Q: 请求频率不够用怎么办？**  
A: 请联系管理员调整您的 API Key 速率限制配额。

**Q: 数据更新频率是怎样的？**  
A: 系统每4小时自动采集一次中国政府采购网、中国招标投标公共服务平台、全国公共资源交易平台等数据源的招标信息。

**Q: 时间字段的格式是什么？**  
A: 所有时间字段均采用 ISO 8601 格式，如 `2026-05-19T10:30:00`。

**Q: 如何获取招标公告的完整正文？**  
A: 列表接口不返回 `content` 字段，请通过详情接口 `GET /api/v1/bids/{id}` 获取完整公告正文、标段信息和附件列表。

**Q: 数据来源有哪些？**  
A: 目前支持以下三个国家级招标平台：
- 中国政府采购网（CCGP）
- 中国招标投标公共服务平台（CEB）
- 全国公共资源交易平台（GGZY）

**Q: 接口支持跨域请求吗？**  
A: 是的，所有 `/api/*` 接口已配置 CORS，支持跨域访问。

---

## 9. 用户中心接口

> **基础路径**: `/api/v1/user`  
> **认证方式**: 需要登录的接口通过 `Authorization: Bearer {user_token}` 传递用户Token  
> **无需登录的接口**: 注册、登录、发送验证码、重置密码

### 9.1 用户注册

**请求**

```
POST /api/v1/user/register
```

**请求体**

```json
{
    "phone": "13800138000",
    "password": "123456",
    "smsCode": "123456",
    "nickname": "张三"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `phone` | string | 是 | 手机号 |
| `password` | string | 是 | 密码（6-20位） |
| `smsCode` | string | 是 | 短信验证码 |
| `nickname` | string | 否 | 昵称 |

**响应示例**

```json
{
    "code": 0,
    "message": "success",
    "data": {
        "token": "a1b2c3d4e5f6...",
        "userId": 1,
        "nickname": "张三",
        "avatar": null,
        "phone": "138****8000"
    }
}
```

---

### 9.2 用户登录

支持三种登录方式：密码登录、短信验证码登录、微信扫码登录。

**请求**

```
POST /api/v1/user/login
```

**密码登录请求体**

```json
{
    "loginType": "password",
    "phone": "13800138000",
    "password": "123456"
}
```

**短信验证码登录请求体**

```json
{
    "loginType": "sms",
    "phone": "13800138000",
    "smsCode": "123456"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `loginType` | string | 是 | 登录方式：`password`/`sms`/`wechat` |
| `phone` | string | 条件必填 | 手机号（密码/短信登录必填） |
| `password` | string | 条件必填 | 密码（密码登录必填） |
| `smsCode` | string | 条件必填 | 短信验证码（短信登录必填） |
| `wechatCode` | string | 条件必填 | 微信授权码（微信登录必填） |

**响应示例**

```json
{
    "code": 0,
    "message": "success",
    "data": {
        "token": "a1b2c3d4e5f6...",
        "userId": 1,
        "nickname": "张三",
        "avatar": "https://example.com/avatar.jpg",
        "phone": "138****8000"
    }
}
```

---

### 9.3 微信扫码登录

**请求**

```
POST /api/v1/user/login/wechat
```

**请求体**

```json
{
    "code": "wechat_auth_code"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `code` | string | 是 | 微信OAuth2授权码 |

---

### 9.4 发送短信验证码

**请求**

```
POST /api/v1/user/sms-code
```

**请求体**

```json
{
    "phone": "13800138000",
    "purpose": "login"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `phone` | string | 是 | 手机号 |
| `purpose` | string | 是 | 用途：`login`/`register`/`reset_password` |

**响应示例**

```json
{
    "code": 0,
    "message": "success",
    "data": null
}
```

> 开发阶段验证码会输出到服务器日志中。

---

### 9.5 重置密码

**请求**

```
POST /api/v1/user/reset-password
```

**请求体**

```json
{
    "phone": "13800138000",
    "smsCode": "123456",
    "newPassword": "654321"
}
```

---

### 9.6 获取个人资料

**请求**

```
GET /api/v1/user/profile
Authorization: Bearer {user_token}
```

**响应示例**

```json
{
    "code": 0,
    "message": "success",
    "data": {
        "id": 1,
        "phone": "13800138000",
        "nickname": "张三",
        "avatar": "https://example.com/avatar.jpg",
        "gender": 1,
        "email": "zhangsan@example.com",
        "wechatNumber": "zhangsan_wx",
        "bio": "资深采购经理",
        "company": "XX科技有限公司",
        "position": "采购经理",
        "companyAddress": "北京市朝阳区XX路XX号",
        "companySize": "51-200",
        "realName": "张三",
        "isActive": true,
        "createdAt": "2026-06-01T10:00:00"
    }
}
```

---

### 9.7 更新个人资料

**请求**

```
PUT /api/v1/user/profile
Authorization: Bearer {user_token}
```

**请求体**

```json
{
    "nickname": "李四",
    "gender": 2,
    "email": "lisi@example.com",
    "wechatNumber": "lisi_wx",
    "bio": "供应商务实派",
    "company": "YY贸易有限公司",
    "position": "销售总监",
    "companyAddress": "上海市浦东新区XX路XX号",
    "companySize": "11-50",
    "realName": "李四"
}
```

---

### 9.8 修改密码

**请求**

```
PUT /api/v1/user/password
Authorization: Bearer {user_token}
```

**请求体**

```json
{
    "oldPassword": "123456",
    "newPassword": "654321"
}
```

---

### 9.9 浏览历史

**获取浏览历史**

```
GET /api/v1/user/browse-history?page=1&page_size=20
Authorization: Bearer {user_token}
```

**添加浏览历史**

```
POST /api/v1/user/browse-history?bid_id=100
Authorization: Bearer {user_token}
```

**删除单条浏览历史**

```
DELETE /api/v1/user/browse-history/{bid_id}
Authorization: Bearer {user_token}
```

**清空浏览历史**

```
DELETE /api/v1/user/browse-history
Authorization: Bearer {user_token}
```

**响应示例（列表）**

```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [
            {
                "id": 1,
                "userId": 1,
                "bidId": 100,
                "bidTitle": "XX项目招标公告",
                "browseAt": "2026-06-01T10:30:00"
            }
        ],
        "pagination": {
            "total": 50,
            "page": 1,
            "pageSize": 20,
            "totalPages": 3
        }
    }
}
```

---

### 9.10 收藏

**获取收藏列表**

```
GET /api/v1/user/favorites?page=1&page_size=20
Authorization: Bearer {user_token}
```

**添加收藏**

```
POST /api/v1/user/favorites?bid_id=100&remark=重点关注
Authorization: Bearer {user_token}
```

**取消收藏**

```
DELETE /api/v1/user/favorites/{bid_id}
Authorization: Bearer {user_token}
```

**检查是否已收藏**

```
GET /api/v1/user/favorites/check?bid_id=100
Authorization: Bearer {user_token}
```

**响应示例**

```json
{
    "code": 0,
    "message": "success",
    "data": true
}
```

---

### 9.11 我的发布

**获取我的发布列表**

```
GET /api/v1/user/publishments?type=bid&page=1&page_size=20
Authorization: Bearer {user_token}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | string | 否 | 类型筛选：`bid`-招标, `procurement`-采购, `supply`-供应 |
| `page` | int | 否 | 页码 |
| `page_size` | int | 否 | 每页条数 |

**创建发布**

```
POST /api/v1/user/publishments
Authorization: Bearer {user_token}
```

**请求体**

```json
{
    "type": "bid",
    "title": "XX项目招标公告",
    "content": "项目详情...",
    "category": "工程",
    "region": "北京",
    "budget": "500万元",
    "deadline": "2026-07-01",
    "contactName": "张经理",
    "contactPhone": "010-12345678",
    "contactEmail": "zhang@example.com"
}
```

**更新发布**

```
PUT /api/v1/user/publishments/{id}
Authorization: Bearer {user_token}
```

**删除发布**

```
DELETE /api/v1/user/publishments/{id}
Authorization: Bearer {user_token}
```

**响应示例（列表）**

```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [
            {
                "id": 1,
                "userId": 1,
                "type": "bid",
                "title": "XX项目招标公告",
                "content": "项目详情...",
                "category": "工程",
                "region": "北京",
                "budget": "500万元",
                "deadline": "2026-07-01T00:00:00",
                "contactName": "张经理",
                "contactPhone": "010-12345678",
                "contactEmail": "zhang@example.com",
                "status": "published",
                "viewCount": 128,
                "createdAt": "2026-06-01T10:00:00",
                "updatedAt": "2026-06-01T10:00:00"
            }
        ],
        "pagination": {
            "total": 5,
            "page": 1,
            "pageSize": 20,
            "totalPages": 1
        }
    }
}
```

---

### 9.12 我的下载

**请求**

```
GET /api/v1/user/downloads?page=1&page_size=20
Authorization: Bearer {user_token}
```

**响应示例**

```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [
            {
                "id": 1,
                "userId": 1,
                "bidId": 100,
                "bidTitle": "XX项目招标公告",
                "attachmentId": 5,
                "fileName": "招标文件.pdf",
                "fileSize": 2048576,
                "createdAt": "2026-06-01T11:00:00"
            }
        ],
        "pagination": {
            "total": 10,
            "page": 1,
            "pageSize": 20,
            "totalPages": 1
        }
    }
}
```

---

### 9.13 消息通知

**获取通知列表**

```
GET /api/v1/user/notifications?page=1&page_size=20
Authorization: Bearer {user_token}
```

**获取未读数**

```
GET /api/v1/user/notifications/unread-count
Authorization: Bearer {user_token}
```

**标记已读**

```
PUT /api/v1/user/notifications/{id}/read
Authorization: Bearer {user_token}
```

**全部标记已读**

```
PUT /api/v1/user/notifications/read-all
Authorization: Bearer {user_token}
```

**响应示例（列表）**

```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [
            {
                "id": 1,
                "userId": 1,
                "type": "system",
                "title": "欢迎注册",
                "content": "欢迎使用招标信息平台！",
                "link": null,
                "isRead": false,
                "readAt": null,
                "createdAt": "2026-06-01T10:00:00"
            }
        ],
        "pagination": {
            "total": 3,
            "page": 1,
            "pageSize": 20,
            "totalPages": 1
        },
        "unreadCount": 2
    }
}
```

**通知类型说明**

| 类型 | 说明 |
|------|------|
| `system` | 系统通知 |
| `bid` | 招标相关通知 |
| `review` | 审核结果通知 |
| `message` | 私信通知 |

---

### 9.14 用户设置

**获取设置**

```
GET /api/v1/user/settings
Authorization: Bearer {user_token}
```

**更新设置**

```
PUT /api/v1/user/settings
Authorization: Bearer {user_token}
```

**请求体**

```json
{
    "notifyBid": true,
    "notifySystem": true,
    "notifyMessage": true,
    "notifyEmail": false,
    "privacyPhone": "hidden",
    "privacyEmail": "hidden",
    "language": "zh_CN"
}
```

**隐私设置说明**

| 值 | 说明 |
|------|------|
| `hidden` | 隐藏 |
| `visible` | 公开 |
| `registered` | 注册用户可见 |

**公司规模选项**

| 值 | 说明 |
|------|------|
| `1-10` | 1-10人 |
| `11-50` | 11-50人 |
| `51-200` | 51-200人 |
| `201-500` | 201-500人 |
| `501-1000` | 501-1000人 |
| `1000+` | 1000人以上 |

---

### 9.15 帮助与反馈

**获取反馈列表**

```
GET /api/v1/user/feedbacks?page=1&page_size=20
Authorization: Bearer {user_token}
```

**创建反馈**

```
POST /api/v1/user/feedbacks
Authorization: Bearer {user_token}
```

**请求体**

```json
{
    "type": "feedback",
    "title": "功能建议",
    "content": "希望能增加数据导出功能",
    "contact": "13800138000",
    "images": "https://example.com/img1.jpg,https://example.com/img2.jpg"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | string | 是 | 类型：`feedback`/`bug`/`suggestion` |
| `title` | string | 是 | 标题 |
| `content` | string | 是 | 内容 |
| `contact` | string | 否 | 联系方式 |
| `images` | string | 否 | 图片URL，逗号分隔 |

**反馈状态说明**

| 状态 | 说明 |
|------|------|
| `pending` | 待处理 |
| `processing` | 处理中 |
| `resolved` | 已解决 |
| `closed` | 已关闭 |

---

### 用户中心错误码

| 错误码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 401 | 未登录或Token过期 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 409 | 资源冲突（如手机号已注册） |
| 429 | 请求频率超限（短信验证码） |
