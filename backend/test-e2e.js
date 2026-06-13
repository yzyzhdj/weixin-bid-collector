// E2E API 测试脚本
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'test-output.log');
fs.writeFileSync(OUT, ''); // 清空
const log = (...args) => {
  const line = args.map(a => typeof a === 'string' ? a : JSON.stringify(a, null, 2)).join(' ');
  fs.appendFileSync(OUT, line + '\n');
  console.log(line);
};

const BASE = 'http://localhost:5000';

async function req(url, options = {}) {
  const res = await fetch(BASE + url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

(async () => {
  log('=== 1. 健康检查 ===');
  log(await req('/api/health'));

  const phone = '1880000' + String(Math.floor(Math.random() * 9000) + 1000);
  log('Generated phone:', phone, 'length:', phone.length);

  log('\n=== 2. 发送注册验证码 ===');
  const r1 = await req('/api/v1/auth/sms-code', {
    method: 'POST',
    body: { phone, purpose: 'register' }
  });
  log(r1);
  if (!r1.json.data?.code) return;

  log('\n=== 3. 注册 ===');
  const r2 = await req('/api/v1/auth/register', {
    method: 'POST',
    body: { phone, password: 'a123456', smsCode: r1.json.data.code, nickname: '测试用户' }
  });
  log(r2);
  if (!r2.json.data?.token) return;
  const token = r2.json.data.token;
  const auth = { Authorization: 'Bearer ' + token };

  log('\n=== 4. 获取个人资料 ===');
  log(await req('/api/v1/user/profile', { headers: auth }));

  log('\n=== 5. 获取用户设置 ===');
  log(await req('/api/v1/user/settings', { headers: auth }));

  log('\n=== 6. 创建订阅 ===');
  log(await req('/api/v1/subscriptions', {
    method: 'POST',
    headers: auth,
    body: { name: '北京基建', keywords: ['北京', '基建', '工程'] }
  }));

  log('\n=== 7. 订阅列表 ===');
  log(await req('/api/v1/subscriptions', { headers: auth }));

  log('\n=== 8. 收藏一条标讯 ===');
  log(await req('/api/v1/favorites', {
    method: 'POST',
    headers: auth,
    body: { bidId: 12345, remark: '重要项目' }
  }));

  log('\n=== 9. 收藏列表 ===');
  log(await req('/api/v1/favorites', { headers: auth }));

  log('\n=== 10. 检查收藏状态 ===');
  log(await req('/api/v1/favorites/check/12345', { headers: auth }));

  log('\n=== 11. 添加企业监控 ===');
  log(await req('/api/v1/company-monitors', {
    method: 'POST',
    headers: auth,
    body: { companyName: '中铁建工集团' }
  }));

  log('\n=== 12. 记录浏览历史 ===');
  log(await req('/api/v1/history', {
    method: 'POST',
    headers: auth,
    body: { bidId: 67890 }
  }));

  log('\n=== 13. 浏览历史列表 ===');
  log(await req('/api/v1/history', { headers: auth }));

  log('\n=== 14. 退出登录 ===');
  log(await req('/api/v1/auth/logout', { method: 'POST', headers: auth }));

  log('\n=== 15. 退出后 token 失效 ===');
  log(await req('/api/v1/user/profile', { headers: auth }));

  log('\n=== All tests done ===');
})().catch(e => log('FATAL:', e));
