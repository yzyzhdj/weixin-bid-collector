// ========== 运行环境切换 ==========
// 当前生效：本地开发环境（http://127.0.0.1:5000）
// 如需切换到公网，把下面 2 行注释，再取消最下面 2 行的注释即可

const API_BASE_URL = 'http://127.0.0.1:5000/api/v1';
const API_KEY = 'bid_e2291528c3c02c47223e9d26a2337276a2ce4d365a3ccf94';

// const API_BASE_URL = 'https://biaoxun.pandaorder.cn/api/v1';
// const API_KEY = 'bid_50e4cb3e6c53400aa0b65136ccb2ce38fe4b40a91ea909ea';

module.exports = {
  API_BASE_URL,
  API_KEY
};
