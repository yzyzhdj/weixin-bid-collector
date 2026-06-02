const { API_BASE_URL, API_KEY } = require('./config.js');

function request(options) {
  return new Promise((resolve, reject) => {
    const task = wx.request({
      url: API_BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      timeout: options.timeout || 30000,
      header: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.code === 0) {
          resolve(res.data.data);
        } else {
          wx.showToast({
            title: res.data.message || '请求失败',
            icon: 'none'
          });
          reject(res.data);
        }
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.indexOf('timeout') !== -1) {
          wx.showToast({
            title: '请求超时，请重试',
            icon: 'none'
          });
        } else {
          wx.showToast({
            title: '网络错误',
            icon: 'none'
          });
        }
        reject(err);
      }
    });
  });
}

function getBidList(params = {}) {
  return request({
    url: '/bids',
    method: 'GET',
    data: params
  });
}

function getBidDetail(bidId) {
  return request({
    url: `/bids/${bidId}`,
    method: 'GET'
  });
}

function searchBids(params) {
  return request({
    url: '/bids/search',
    method: 'GET',
    data: params
  });
}

function getStats() {
  return request({
    url: '/stats',
    method: 'GET'
  });
}

function getFilters() {
  return request({
    url: '/filters',
    method: 'GET'
  });
}

module.exports = {
  getBidList,
  getBidDetail,
  searchBids,
  getStats,
  getFilters
};
