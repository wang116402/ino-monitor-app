const generateRandomValue = (base, variance) => {
  return base + (Math.random() - 0.5) * variance * 2
}

const sensorDataHistory = {
  temperature: [],
  humidity: [],
  light: [],
  speed: [],
  waterLevel: []
}

const generateHistoryData = () => {
  const now = Date.now()
  const data = {
    temperature: [],
    humidity: [],
    light: [],
    speed: [],
    waterLevel: []
  }
  
  for (let i = 29; i >= 0; i--) {
    const time = now - i * 60000
    data.temperature.push({
      time: formatTime(time),
      value: 25 + Math.sin(i * 0.2) * 3 + Math.random() * 2
    })
    data.humidity.push({
      time: formatTime(time),
      value: 60 + Math.sin(i * 0.15) * 5 + Math.random() * 3
    })
    data.light.push({
      time: formatTime(time),
      value: 500 + Math.sin(i * 0.1) * 100 + Math.random() * 50
    })
    data.speed.push({
      time: formatTime(time),
      value: 1200 + Math.sin(i * 0.25) * 200 + Math.random() * 100
    })
    data.waterLevel.push({
      time: formatTime(time),
      value: 45 + Math.sin(i * 0.12) * 5 + Math.random() * 2
    })
  }
  
  return data
}

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

const getSensorData = () => {
  const baseData = {
    temperature: generateRandomValue(25, 3),
    humidity: generateRandomValue(60, 5),
    light: generateRandomValue(500, 100),
    speed: generateRandomValue(1200, 200),
    waterLevel: generateRandomValue(45, 5)
  }
  
  Object.keys(sensorDataHistory).forEach(key => {
    sensorDataHistory[key].push(baseData[key])
    if (sensorDataHistory[key].length > 30) {
      sensorDataHistory[key].shift()
    }
  })
  
  return baseData
}

const getHistoryData = () => {
  const now = Date.now()
  const result = {}
  
  Object.keys(sensorDataHistory).forEach(key => {
    result[key] = sensorDataHistory[key].map((value, index) => {
      const time = now - (sensorDataHistory[key].length - 1 - index) * 2000
      return {
        time: formatTime(time),
        value: value
      }
    })
  })
  
  return result
}

module.exports = {
  getSensorData,
  getHistoryData,
  generateHistoryData
}