/**
 * 定位工具模块
 * 功能：调用 wx.getFuzzyLocation（模糊定位）获取经纬度，通过省份中心点最近邻匹配转为省份名
 * 使用模糊定位而非精确定位，审核更宽松，适合只需省份级别的场景
 */

// 全国 31 个省级行政区中心点经纬度（与 city-data.js 的 key 保持一致，不含"省/市"后缀）
const PROVINCE_CENTERS = [
  { name: '北京',   lng: 116.41, lat: 39.90 },
  { name: '天津',   lng: 117.20, lat: 39.13 },
  { name: '上海',   lng: 121.47, lat: 31.23 },
  { name: '重庆',   lng: 106.55, lat: 29.56 },
  { name: '河北',   lng: 114.50, lat: 38.05 },
  { name: '山西',   lng: 112.55, lat: 37.87 },
  { name: '辽宁',   lng: 123.43, lat: 41.80 },
  { name: '吉林',   lng: 125.32, lat: 43.90 },
  { name: '黑龙江', lng: 126.66, lat: 45.74 },
  { name: '江苏',   lng: 118.78, lat: 32.06 },
  { name: '浙江',   lng: 120.16, lat: 30.27 },
  { name: '安徽',   lng: 117.28, lat: 31.86 },
  { name: '福建',   lng: 119.30, lat: 26.08 },
  { name: '江西',   lng: 115.89, lat: 28.68 },
  { name: '山东',   lng: 117.00, lat: 36.67 },
  { name: '河南',   lng: 113.62, lat: 34.75 },
  { name: '湖北',   lng: 114.31, lat: 30.59 },
  { name: '湖南',   lng: 112.98, lat: 28.19 },
  { name: '广东',   lng: 113.27, lat: 23.13 },
  { name: '海南',   lng: 110.33, lat: 20.03 },
  { name: '四川',   lng: 104.07, lat: 30.67 },
  { name: '贵州',   lng: 106.71, lat: 26.60 },
  { name: '云南',   lng: 102.72, lat: 25.04 },
  { name: '陕西',   lng: 108.95, lat: 34.27 },
  { name: '甘肃',   lng: 103.82, lat: 36.06 },
  { name: '青海',   lng: 101.78, lat: 36.62 },
  { name: '内蒙古', lng: 111.75, lat: 40.84 },
  { name: '广西',   lng: 108.32, lat: 22.82 },
  { name: '西藏',   lng: 91.13,  lat: 29.65 },
  { name: '宁夏',   lng: 106.27, lat: 38.47 },
  { name: '新疆',   lng: 87.62,  lat: 43.79 }
];

// storage key
const LOCATION_PROVINCE_KEY = 'located_province';

/**
 * 计算两个经纬度点之间的距离（简化版，用平面距离近似）
 * 对于省份级别匹配足够精确
 */
function distance(lng1, lat1, lng2, lat2) {
  const dLng = lng1 - lng2;
  const dLat = lat1 - lat2;
  return dLng * dLng + dLat * dLat;
}

/**
 * 根据经纬度找到最近的省份名
 * @param {number} lng 经度
 * @param {number} lat 纬度
 * @returns {string} 省份名（如 "广东"），找不到返回 ''
 */
function lngLatToProvince(lng, lat) {
  if (!lng || !lat) return '';
  let minDist = Infinity;
  let nearest = '';
  for (const p of PROVINCE_CENTERS) {
    const d = distance(lng, lat, p.lng, p.lat);
    if (d < minDist) {
      minDist = d;
      nearest = p.name;
    }
  }
  return nearest;
}

/**
 * 获取定位并转为省份名
 * @returns {Promise<{province: string, lng: number, lat: number}>}
 */
function getLocatedProvince() {
  return new Promise((resolve, reject) => {
    // 触发系统隐私协议检查（基础库 2.32.3+ 生效）
    if (typeof wx.getPrivacySetting === 'function') {
      wx.getPrivacySetting({
        success: (res) => {
          if (res.needAuthorization) {
            // 用户还没同意隐私协议，引导到设置页
            console.log('[Location] 需要用户同意隐私协议');
            // 不阻断流程，尝试直接调用；如失败再降级
            doGetLocation(resolve, reject);
          } else {
            doGetLocation(resolve, reject);
          }
        },
        fail: () => doGetLocation(resolve, reject)
      });
    } else {
      // 旧版基础库没有隐私协议 API，直接调用
      doGetLocation(resolve, reject);
    }
  });
}

function doGetLocation(resolve, reject) {
  wx.getFuzzyLocation({
    type: 'wgs84',
    success(res) {
      const province = lngLatToProvince(res.longitude, res.latitude);
      console.log('[Location] 模糊定位成功:', res.longitude, res.latitude, '→', province);
      if (province) {
        // 缓存到 storage
        wx.setStorageSync(LOCATION_PROVINCE_KEY, province);
        resolve({ province, lng: res.longitude, lat: res.latitude });
      } else {
        reject({ message: '无法识别省份' });
      }
    },
    fail(err) {
      // 静默降级：用户拒绝授权或隐私协议未声明时，不影响业务
      console.log('[Location] 模糊定位失败（已降级，使用缓存或全国）:', err.errMsg || err);
      reject(err);
    }
  });
}

/**
 * 读取上次缓存的定位省份
 * @returns {string} 省份名或 ''
 */
function getCachedProvince() {
  try {
    return wx.getStorageSync(LOCATION_PROVINCE_KEY) || '';
  } catch (e) {
    return '';
  }
}

module.exports = {
  getLocatedProvince,
  getCachedProvince,
  lngLatToProvince,
  LOCATION_PROVINCE_KEY
};
