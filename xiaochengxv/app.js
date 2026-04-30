App({
  globalData: {
    sensorData: {
      temperature: 25.0,
      humidity: 60,
      light: 500,
      speed: 1200,
      waterLevel: 45
    },
    deviceStatus: {
      gate: false,
      light: false,
      access: false,
      fan: false
    }
  },

  onLaunch: function () {
    console.log('物联网监控系统启动')
  },

  onShow: function () {
    console.log('小程序显示')
  },

  onHide: function () {
    console.log('小程序隐藏')
  },

  updateSensorData: function(data) {
    this.globalData.sensorData = { ...this.globalData.sensorData, ...data }
  },

  toggleDevice: function(deviceName) {
    if (this.globalData.deviceStatus[deviceName] !== undefined) {
      this.globalData.deviceStatus[deviceName] = !this.globalData.deviceStatus[deviceName]
      return this.globalData.deviceStatus[deviceName]
    }
    return false
  }
})