const location = require('./utils/location.js');

App({
  onLaunch() {
    // 获取系统信息（状态栏高度、安全区域等）
    const systemInfo = wx.getSystemInfoSync();
    const menuButton = wx.getMenuButtonBoundingClientRect();

    this.globalData = this.globalData || {};
    this.globalData.statusBarHeight = systemInfo.statusBarHeight || 20;
    this.globalData.screenWidth = systemInfo.screenWidth;
    this.globalData.screenHeight = systemInfo.screenHeight;
    this.globalData.windowWidth = systemInfo.windowWidth;

    // 微信胶囊菜单（顶部右侧）
    this.globalData.menuButton = menuButton;
    // 导航栏总高度 = 状态栏 + 胶囊高度 + (胶囊顶 - 状态栏) * 2
    this.globalData.navBarHeight = (menuButton.top - systemInfo.statusBarHeight) * 2 + menuButton.height;
    // 顶部安全距离 = 状态栏高度
    this.globalData.safeAreaTop = systemInfo.safeArea?.top || systemInfo.statusBarHeight;
    // 底部安全距离（iPhone X 等全面屏）
    this.globalData.safeAreaBottom = systemInfo.screenHeight - (systemInfo.safeArea?.bottom || systemInfo.screenHeight);

    console.log('小程序启动', { statusBarHeight: this.globalData.statusBarHeight, navBarHeight: this.globalData.navBarHeight });

    // 启动定位，自动识别用户所在省份
    this.globalData.locatedProvince = '';
    this.globalData.locationDone = false;
    location.getLocatedProvince().then((res) => {
      this.globalData.locatedProvince = res.province;
      this.globalData.locationDone = true;
      console.log('[App] 定位省份:', res.province);
      // 通知首页（如果首页已加载，通过回调通知）
      if (this.onLocationReady) this.onLocationReady(res.province);
    }).catch((err) => {
      this.globalData.locationDone = true;
      console.log('[App] 定位失败，显示全国', err);
      // 定位失败（隐私协议未声明 / 用户拒绝 / 网络错误等）：清空缓存，默认显示全国
      // 不调用 onLocationReady，首页保持初始的"全国"状态
      wx.removeStorageSync('located_province');
    });
  },
  globalData: {
    userInfo: null,
    statusBarHeight: 20,
    navBarHeight: 44,
    menuButton: null,
    safeAreaTop: 20,
    safeAreaBottom: 0,
    locatedProvince: '',
    locationDone: false
  }
})
