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
  },
  globalData: {
    userInfo: null,
    statusBarHeight: 20,
    navBarHeight: 44,
    menuButton: null,
    safeAreaTop: 20,
    safeAreaBottom: 0
  }
})
