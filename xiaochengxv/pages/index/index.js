const app = getApp()
const { getSensorData } = require('../../utils/mockData.js')

Page({
  data: {
    isConnected: false,
    bluetoothDeviceId: '',
    serviceId: '',
    writeCharacteristicId: '',
    notifyCharacteristicId: '',
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
    },
    updateTimer: null,
    bleConnected: false,
    searching: false,
    showDeviceList: false,
    deviceList: [],
    connectedDeviceName: ''
  },

  onLoad: function () {
    this.startDataUpdate()
    this.initBluetooth()
  },

  onShow: function () {
    if (!this.data.updateTimer) {
      this.startDataUpdate()
    }
  },

  onHide: function () {
    this.stopDataUpdate()
  },

  onUnload: function () {
    this.stopDataUpdate()
    this.disconnectBluetooth()
  },

  initBluetooth: function () {
    wx.openBluetoothAdapter({
      success: (res) => {
        console.log('蓝牙适配器初始化成功')
        wx.onBluetoothAdapterStateChange((res) => {
          console.log('蓝牙状态变化:', res)
          if (!res.available) {
            wx.showToast({
              title: '蓝牙已关闭',
              icon: 'none'
            })
          }
        })
      },
      fail: (err) => {
        console.error('蓝牙适配器初始化失败:', err)
        wx.showModal({
          title: '提示',
          content: '请先开启蓝牙',
          showCancel: false
        })
      }
    })
  },

  startSearch: function () {
    if (this.data.bleConnected) {
      this.disconnectBluetooth()
      return
    }

    if (this.data.searching) return
    
    this.setData({ 
      searching: true,
      showDeviceList: true,
      deviceList: []
    })
    
    wx.startBluetoothDevicesDiscovery({
      allowDuplicatesKey: false,
      success: (res) => {
        console.log('开始搜索蓝牙设备')
        this.searchTimer = setTimeout(() => {
          this.getBluetoothDevices()
        }, 4000)
      },
      fail: (err) => {
        console.error('搜索失败:', err)
        this.setData({ searching: false })
        wx.showToast({
          title: '搜索失败: ' + err.errMsg,
          icon: 'none'
        })
      }
    })
  },

  getBluetoothDevices: function () {
    wx.getBluetoothDevices({
      success: (res) => {
        let devices = res.devices
        console.log('发现设备:', devices)
        
        const filteredDevices = devices.filter(device => {
          const name = device.name || ''
          return name.includes('JDY') || 
                 name.includes('JSY') || 
                 name.includes('SPP') || 
                 name.includes('BLE') || 
                 name.includes('STM32') ||
                 name.includes('IoT') ||
                 name.includes('HC-') ||
                 name === ''
        })
        
        this.setData({
          deviceList: filteredDevices,
          searching: false
        })
        
        if (filteredDevices.length === 0) {
          this.setData({ deviceList: devices })
          wx.showToast({
            title: '未找到BLE设备',
            icon: 'none'
          })
        }
      },
      fail: (err) => {
        console.error('获取设备列表失败:', err)
        this.setData({ searching: false })
      }
    })
  },

  closeDeviceList: function () {
    this.setData({ showDeviceList: false })
    if (this.searchTimer) {
      clearTimeout(this.searchTimer)
    }
    wx.stopBluetoothDevicesDiscovery()
  },

  selectDevice: function (e) {
    const device = e.currentTarget.dataset.device
    console.log('选择设备:', device)
    
    this.closeDeviceList()
    
    wx.showLoading({
      title: '连接中...'
    })
    
    wx.createBLEConnection({
      deviceId: device.deviceId,
      success: (res) => {
        console.log('连接成功:', device.deviceId)
        wx.hideLoading()
        
        this.setData({ 
          bluetoothDeviceId: device.deviceId,
          bleConnected: true,
          isConnected: true,
          connectedDeviceName: device.name || '未知设备'
        })
        
        wx.stopBluetoothDevicesDiscovery()
        
        wx.showToast({
          title: '连接成功: ' + (device.name || '未知设备'),
          icon: 'success',
          duration: 2000
        })
        
        this.getBLEServices(device.deviceId)
      },
      fail: (err) => {
        console.error('连接失败:', err)
        wx.hideLoading()
        
        if (err.errCode === 10009) {
          wx.showModal({
            title: '连接失败',
            content: '该设备可能是经典蓝牙(SPP)设备，不支持BLE连接。请将JSY-31-SPP切换到BLE模式。',
            showCancel: false
          })
        } else {
          wx.showToast({
            title: '连接失败: ' + err.errMsg,
            icon: 'none'
          })
        }
      }
    })
  },

  getBLEServices: function (deviceId) {
    wx.getBLEDeviceServices({
      deviceId: deviceId,
      success: (res) => {
        console.log('服务列表:', res.services)
        
        let foundService = null
        for (let i = 0; i < res.services.length; i++) {
          const service = res.services[i]
          const uuid = service.uuid.toLowerCase()
          console.log('服务UUID:', uuid)
          
          if (uuid === 'ffe0' || uuid.includes('ffe0')) {
            foundService = service
            break
          }
        }
        
        if (foundService) {
          this.setData({ serviceId: foundService.uuid })
          this.getBLECharacteristics(deviceId, foundService.uuid)
        } else if (res.services.length > 0) {
          this.setData({ serviceId: res.services[0].uuid })
          this.getBLECharacteristics(deviceId, res.services[0].uuid)
        }
      },
      fail: (err) => {
        console.error('获取服务失败:', err)
      }
    })
  },

  getBLECharacteristics: function (deviceId, serviceId) {
    wx.getBLEDeviceCharacteristics({
      deviceId: deviceId,
      serviceId: serviceId,
      success: (res) => {
        console.log('特征列表:', res.characteristics)
        
        let foundWrite = false
        let foundNotify = false
        
        res.characteristics.forEach(char => {
          const uuid = char.uuid.toLowerCase()
          console.log('特征UUID:', uuid, '属性:', char.properties)
          
          if (!foundWrite && (char.properties.write || char.properties.writeWithoutResponse)) {
            this.setData({ writeCharacteristicId: char.uuid })
            foundWrite = true
            console.log('找到可写特征:', char.uuid)
          }
          if (!foundNotify && (char.properties.notify || char.properties.indicate)) {
            this.setData({ notifyCharacteristicId: char.uuid })
            foundNotify = true
            this.startNotify(deviceId, serviceId, char.uuid)
          }
        })
        
        if (!foundWrite && res.characteristics.length > 0) {
          this.setData({ writeCharacteristicId: res.characteristics[0].uuid })
          console.log('使用第一个特征作为写入特征')
        }
      },
      fail: (err) => {
        console.error('获取特征失败:', err)
      }
    })
  },

  startNotify: function (deviceId, serviceId, characteristicId) {
    wx.notifyBLECharacteristicValueChange({
      deviceId: deviceId,
      serviceId: serviceId,
      characteristicId: characteristicId,
      state: true,
      success: (res) => {
        console.log('开启通知成功')
        
        wx.onBLECharacteristicValueChange((res) => {
          this.parseSensorData(res.value)
        })
      },
      fail: (err) => {
        console.error('开启通知失败:', err)
      }
    })
  },

  parseSensorData: function (buffer) {
    const data = new Uint8Array(buffer)
    console.log('接收到数据长度:', data.length, '数据:', Array.from(data))
    
    if (data.length >= 11) {
      if (data[0] === 0xAA && data[data.length - 1] === 0x55) {
        const temperature = (data[1] << 8 | data[2]) / 100
        const humidity = (data[3] << 8 | data[4]) / 100
        const light = data[5] << 8 | data[6]
        const speed = data[7] << 8 | data[8]
        const waterLevel = ((data.length > 9 ? data[9] : 0) << 8 | (data.length > 10 ? data[10] : 0)) / 100

        this.setData({
          sensorData: {
            temperature: temperature,
            humidity: humidity,
            light: light,
            speed: speed,
            waterLevel: waterLevel
          },
          isConnected: true
        })
        
        app.updateSensorData(this.data.sensorData)
        return
      }
    }
    
    if (data.length > 0) {
      try {
        const text = String.fromCharCode.apply(null, data)
        console.log('接收到文本数据:', text)
        
        const jsonData = JSON.parse(text)
        if (jsonData.temperature !== undefined) {
          this.setData({
            sensorData: jsonData,
            isConnected: true
          })
          app.updateSensorData(jsonData)
        }
      } catch (e) {
        console.log('非JSON数据')
      }
    }
  },

  sendControlCommand: function (deviceName, status) {
    if (!this.data.bleConnected) {
      wx.showToast({
        title: '未连接蓝牙',
        icon: 'none'
      })
      return
    }

    let command = 0x00
    switch (deviceName) {
      case 'gate': command = status ? 0x01 : 0x00; break
      case 'light': command = status ? 0x03 : 0x02; break
      case 'access': command = status ? 0x05 : 0x04; break
      case 'fan': command = status ? 0x07 : 0x06; break
    }

    const buffer = new ArrayBuffer(3)
    const dataView = new DataView(buffer)
    dataView.setUint8(0, 0xBB)
    dataView.setUint8(1, command)
    dataView.setUint8(2, 0xCC)

    if (this.data.serviceId && this.data.writeCharacteristicId) {
      wx.writeBLECharacteristicValue({
        deviceId: this.data.bluetoothDeviceId,
        serviceId: this.data.serviceId,
        characteristicId: this.data.writeCharacteristicId,
        value: buffer,
        success: (res) => {
          console.log('发送指令成功:', command)
        },
        fail: (err) => {
          console.error('发送指令失败:', err)
          wx.showToast({
            title: '发送失败',
            icon: 'none'
          })
        }
      })
    } else {
      console.log('未找到可写特征')
      wx.showToast({
        title: '设备不支持写入',
        icon: 'none'
      })
    }
  },

  disconnectBluetooth: function () {
    if (this.data.bluetoothDeviceId) {
      wx.closeBLEConnection({
        deviceId: this.data.bluetoothDeviceId,
        success: () => {
          console.log('断开连接')
          this.setData({ 
            bleConnected: false,
            isConnected: false,
            bluetoothDeviceId: '',
            serviceId: '',
            writeCharacteristicId: '',
            notifyCharacteristicId: '',
            connectedDeviceName: ''
          })
          wx.showToast({
            title: '已断开连接',
            icon: 'none'
          })
        },
        fail: (err) => {
          console.error('断开失败:', err)
        }
      })
    }
  },

  startDataUpdate: function () {
    if (this.data.bleConnected) return
    
    this.updateSensorData()
    this.data.updateTimer = setInterval(() => {
      if (!this.data.bleConnected) {
        this.updateSensorData()
      }
    }, 2000)
  },

  stopDataUpdate: function () {
    if (this.data.updateTimer) {
      clearInterval(this.data.updateTimer)
      this.data.updateTimer = null
    }
  },

  updateSensorData: function () {
    const newData = getSensorData()
    this.setData({
      sensorData: newData
    })
    app.updateSensorData(newData)
  },

  toggleGate: function (e) {
    const status = e.detail.value
    this.setData({
      'deviceStatus.gate': status
    })
    app.globalData.deviceStatus.gate = status
    this.sendControlCommand('gate', status)
    this.showToast(status ? '闸门已开启' : '闸门已关闭')
  },

  toggleLight: function (e) {
    const status = e.detail.value
    this.setData({
      'deviceStatus.light': status
    })
    app.globalData.deviceStatus.light = status
    this.sendControlCommand('light', status)
    this.showToast(status ? '灯管已开启' : '灯管已关闭')
  },

  toggleAccess: function (e) {
    const status = e.detail.value
    this.setData({
      'deviceStatus.access': status
    })
    app.globalData.deviceStatus.access = status
    this.sendControlCommand('access', status)
    this.showToast(status ? '门禁已开启' : '门禁已关闭')
  },

  toggleFan: function (e) {
    const status = e.detail.value
    this.setData({
      'deviceStatus.fan': status
    })
    app.globalData.deviceStatus.fan = status
    this.sendControlCommand('fan', status)
    this.showToast(status ? '风扇已开启' : '风扇已关闭')
  },

  showToast: function (message) {
    wx.showToast({
      title: message,
      icon: 'none',
      duration: 1500
    })
  },

  preventDefault: function () {
    
  },

  goToChart: function () {
    wx.navigateTo({
      url: '/pages/chart/chart'
    })
  }
})