// ========== 运行环境切换 ==========
// 当前生效：公网生产环境
// 鉴权改造后，小程序统一使用 X-Mini-Program: 1 头标识渠道，不再需要 API Key
// （旧 API Key 已在后端被吊销，禁止再出现在小程序代码中）

const API_BASE_URL = 'https://www.sunbidinfo.com/api/v1';

module.exports = {
  API_BASE_URL
};
