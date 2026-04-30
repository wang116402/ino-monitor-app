const app = getApp()
const { getSensorData, getHistoryData } = require('../../utils/mockData.js')

Page({
  data: {
    currentTab: 'temperature',
    currentValue: '--',
    maxValue: '--',
    minValue: '--',
    avgValue: '--',
    sensorData: {
      temperature: 25.0,
      humidity: 60,
      light: 500,
      speed: 1200,
      waterLevel: 45
    },
    historyData: {},
    touchIndex: -1,
    updateTimer: null
  },

  tabConfig: {
    temperature: { name: '温度', unit: '°C', color: '#ff6b6b' },
    humidity: { name: '湿度', unit: '%', color: '#4ecdc4' },
    light: { name: '光照', unit: 'lux', color: '#ffe66d' },
    speed: { name: '转速', unit: 'rpm', color: '#95e1d3' },
    waterLevel: { name: '水位', unit: 'cm', color: '#667eea' }
  },

  onLoad: function () {
    this.loadHistoryData()
    this.startDataUpdate()
  },

  onShow: function () {
    if (!this.data.updateTimer) {
      this.startDataUpdate()
    }
    this.drawChart()
  },

  onHide: function () {
    this.stopDataUpdate()
  },

  onUnload: function () {
    this.stopDataUpdate()
  },

  startDataUpdate: function () {
    this.updateSensorData()
    this.data.updateTimer = setInterval(() => {
      this.updateSensorData()
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
    this.loadHistoryData()
    this.drawChart()
  },

  loadHistoryData: function () {
    const historyData = getHistoryData()
    this.setData({
      historyData: historyData
    })
    this.updateStatistics()
  },

  switchTab: function (e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({
      currentTab: tab,
      touchIndex: -1
    })
    this.updateStatistics()
    this.drawChart()
  },

  updateStatistics: function () {
    const data = this.data.historyData[this.data.currentTab] || []
    if (data.length === 0) {
      this.setData({
        currentValue: '--',
        maxValue: '--',
        minValue: '--',
        avgValue: '--'
      })
      return
    }

    const values = data.map(item => item.value)
    const currentValue = values[values.length - 1]
    const maxValue = Math.max(...values)
    const minValue = Math.min(...values)
    const avgValue = values.reduce((sum, val) => sum + val, 0) / values.length

    const config = this.tabConfig[this.data.currentTab]
    
    this.setData({
      currentValue: `${currentValue.toFixed(1)}${config.unit}`,
      maxValue: `${maxValue.toFixed(1)}${config.unit}`,
      minValue: `${minValue.toFixed(1)}${config.unit}`,
      avgValue: `${avgValue.toFixed(1)}${config.unit}`
    })
  },

  drawChart: function () {
    const ctx = wx.createCanvasContext('lineChart')
    const data = this.data.historyData[this.data.currentTab] || []
    const config = this.tabConfig[this.data.currentTab]

    const width = 650
    const height = 350
    const padding = { top: 30, right: 20, bottom: 40, left: 50 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    ctx.setFillStyle('#ffffff')
    ctx.fillRect(0, 0, width, height)

    ctx.setStrokeStyle('#e8eaed')
    ctx.setLineWidth(1)
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight / 4) * i
      ctx.beginPath()
      ctx.moveTo(padding.left, y)
      ctx.lineTo(width - padding.right, y)
      ctx.stroke()
    }

    const values = data.map(item => item.value)
    if (values.length === 0) return

    const maxVal = Math.max(...values) * 1.1
    const minVal = Math.min(...values) * 0.9
    const range = maxVal - minVal || 1

    ctx.setFillStyle('#999999')
    ctx.setFontSize(10)
    for (let i = 0; i <= 4; i++) {
      const val = maxVal - (range / 4) * i
      const y = padding.top + (chartHeight / 4) * i
      ctx.fillText(val.toFixed(0), 10, y + 4)
    }

    const stepX = chartWidth / Math.max(data.length - 1, 1)
    ctx.setFillStyle('#999999')
    ctx.setFontSize(9)
    for (let i = 0; i < data.length; i += Math.ceil(data.length / 6)) {
      const x = padding.left + stepX * i
      ctx.fillText(data[i].time, x - 15, height - 10)
    }

    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom)
    gradient.addColorStop(0, config.color + '40')
    gradient.addColorStop(1, config.color + '05')

    if (data.length > 1) {
      ctx.beginPath()
      ctx.moveTo(padding.left, height - padding.bottom)
      
      data.forEach((item, index) => {
        const x = padding.left + stepX * index
        const y = padding.top + chartHeight - ((item.value - minVal) / range) * chartHeight
        if (index === 0) {
          ctx.lineTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      
      ctx.lineTo(padding.left + stepX * (data.length - 1), height - padding.bottom)
      ctx.closePath()
      ctx.setFillStyle(gradient)
      ctx.fill()
    }

    ctx.setStrokeStyle(config.color)
    ctx.setLineWidth(2)
    ctx.beginPath()
    
    data.forEach((item, index) => {
      const x = padding.left + stepX * index
      const y = padding.top + chartHeight - ((item.value - minVal) / range) * chartHeight
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.stroke()

    if (this.data.touchIndex >= 0 && this.data.touchIndex < data.length) {
      const index = this.data.touchIndex
      const x = padding.left + stepX * index
      const y = padding.top + chartHeight - ((data[index].value - minVal) / range) * chartHeight

      ctx.setStrokeStyle('#cccccc')
      ctx.setLineWidth(1)
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(x, padding.top)
      ctx.lineTo(x, height - padding.bottom)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.setFillStyle(config.color)
      ctx.beginPath()
      ctx.arc(x, y, 6, 0, Math.PI * 2)
      ctx.fill()

      ctx.setFillStyle('#ffffff')
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fill()

      ctx.setFillStyle('#ffffff')
      ctx.setStrokeStyle(config.color)
      ctx.setLineWidth(1)
      ctx.beginPath()
      ctx.roundRect(x - 40, y - 35, 80, 25, 6)
      ctx.fill()
      ctx.stroke()

      ctx.setFillStyle(config.color)
      ctx.setFontSize(10)
      ctx.fillText(`${data[index].value.toFixed(1)}${config.unit}`, x - 35, y - 18)
    }

    ctx.draw()
  },

  onTouchStart: function (e) {
    this.handleTouch(e)
  },

  onTouchMove: function (e) {
    this.handleTouch(e)
  },

  onTouchEnd: function (e) {
    setTimeout(() => {
      this.setData({ touchIndex: -1 })
      this.drawChart()
    }, 1000)
  },

  handleTouch: function (e) {
    const touch = e.touches[0]
    const data = this.data.historyData[this.data.currentTab] || []
    if (data.length === 0) return

    const width = 650
    const padding = { left: 50, right: 20 }
    const chartWidth = width - padding.left - padding.right
    const stepX = chartWidth / Math.max(data.length - 1, 1)
    
    const x = touch.x * (width / 375)
    const relativeX = x - padding.left
    
    let index = Math.round(relativeX / stepX)
    index = Math.max(0, Math.min(index, data.length - 1))
    
    this.setData({ touchIndex: index })
    this.drawChart()
  }
})