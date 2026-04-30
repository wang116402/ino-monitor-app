/**
  ******************************************************************************
  * @file    ble_sensor_control.c
  * @author  IoT Team
  * @brief   STM32蓝牙传感器控制示例代码
  *          用于与微信小程序进行BLE通信
  ******************************************************************************
  */

#include "stm32f1xx_hal.h"
#include "ble_sensor_control.h"

/* 传感器数据结构体 */
typedef struct {
    float temperature;  // 温度 (°C)
    float humidity;     // 湿度 (%)
    uint16_t light;     // 光照度 (lux)
    uint16_t speed;     // 转速 (rpm)
    float waterLevel;   // 水位 (cm)
} SensorData;

/* 设备控制状态 */
typedef struct {
    uint8_t gate : 1;   // 闸门
    uint8_t light : 1;  // 灯管
    uint8_t access : 1; // 门禁
    uint8_t fan : 1;    // 风扇
} DeviceStatus;

/* 全局变量 */
SensorData sensorData = {25.0f, 60.0f, 500, 1200, 45.0f};
DeviceStatus deviceStatus = {0, 0, 0, 0};

/* BLE发送缓冲区 */
uint8_t bleTxBuffer[20];
uint8_t bleRxBuffer[20];

/* 函数声明 */
void Sensor_ReadAll(SensorData *data);
void Device_Control(uint8_t command);
void BLE_SendSensorData(void);
void BLE_ProcessCommand(uint8_t *data, uint8_t len);

/**
  * @brief  主循环处理函数
  */
void IoT_MainLoop(void) {
    /* 读取传感器数据 */
    Sensor_ReadAll(&sensorData);
    
    /* 发送传感器数据到小程序 */
    BLE_SendSensorData();
    
    /* 处理接收到的命令 */
    if (BLE_CheckReceivedData()) {
        BLE_GetReceivedData(bleRxBuffer, sizeof(bleRxBuffer));
        BLE_ProcessCommand(bleRxBuffer, BLE_GetReceivedLength());
    }
    
    HAL_Delay(2000); // 2秒更新一次
}

/**
  * @brief  读取所有传感器数据
  */
void Sensor_ReadAll(SensorData *data) {
    /* 模拟传感器读取 */
    /* 实际项目中需要根据硬件连接读取ADC或传感器数据 */
    
    /* 温度传感器 (DS18B20或类似) */
    // data->temperature = DS18B20_ReadTemperature();
    data->temperature = 25.0f + (float)(rand() % 100 - 50) / 10.0f;
    
    /* 湿度传感器 (DHT11/DHT22) */
    // data->humidity = DHT22_ReadHumidity();
    data->humidity = 60.0f + (float)(rand() % 60 - 30) / 10.0f;
    
    /* 光照传感器 (BH1750) */
    // data->light = BH1750_ReadLight();
    data->light = 500 + rand() % 200;
    
    /* 转速传感器 (霍尔传感器) */
    // data->speed = HallSensor_ReadSpeed();
    data->speed = 1200 + rand() % 400 - 200;
    
    /* 水位传感器 */
    // data->waterLevel = WaterLevel_Read();
    data->waterLevel = 45.0f + (float)(rand() % 20 - 10) / 2.0f;
}

/**
  * @brief  设备控制
  * @param  command: 控制命令
  */
void Device_Control(uint8_t command) {
    switch(command) {
        case 0x00: // 闸门关闭
            deviceStatus.gate = 0;
            HAL_GPIO_WritePin(GATE_GPIO_Port, GATE_Pin, GPIO_PIN_RESET);
            break;
        case 0x01: // 闸门开启
            deviceStatus.gate = 1;
            HAL_GPIO_WritePin(GATE_GPIO_Port, GATE_Pin, GPIO_PIN_SET);
            break;
        case 0x02: // 灯管关闭
            deviceStatus.light = 0;
            HAL_GPIO_WritePin(LIGHT_GPIO_Port, LIGHT_Pin, GPIO_PIN_RESET);
            break;
        case 0x03: // 灯管开启
            deviceStatus.light = 1;
            HAL_GPIO_WritePin(LIGHT_GPIO_Port, LIGHT_Pin, GPIO_PIN_SET);
            break;
        case 0x04: // 门禁关闭
            deviceStatus.access = 0;
            HAL_GPIO_WritePin(ACCESS_GPIO_Port, ACCESS_Pin, GPIO_PIN_RESET);
            break;
        case 0x05: // 门禁开启
            deviceStatus.access = 1;
            HAL_GPIO_WritePin(ACCESS_GPIO_Port, ACCESS_Pin, GPIO_PIN_SET);
            break;
        case 0x06: // 风扇关闭
            deviceStatus.fan = 0;
            HAL_GPIO_WritePin(FAN_GPIO_Port, FAN_Pin, GPIO_PIN_RESET);
            break;
        case 0x07: // 风扇开启
            deviceStatus.fan = 1;
            HAL_GPIO_WritePin(FAN_GPIO_Port, FAN_Pin, GPIO_PIN_SET);
            break;
        default:
            break;
    }
}

/**
  * @brief  发送传感器数据到BLE
  *         数据格式: [0xAA][温度高8位][温度低8位][湿度高8位][湿度低8位]
  *                   [光照高8位][光照低8位][转速高8位][转速低8位]
  *                   [水位高8位][水位低8位][0x55]
  */
void BLE_SendSensorData(void) {
    uint16_t temp_u16, hum_u16, water_u16;
    
    /* 转换为16位整数 */
    temp_u16 = (uint16_t)(sensorData.temperature * 100);
    hum_u16 = (uint16_t)(sensorData.humidity * 100);
    water_u16 = (uint16_t)(sensorData.waterLevel * 100);
    
    /* 组装数据帧 */
    bleTxBuffer[0] = 0xAA;                              // 帧头
    bleTxBuffer[1] = (uint8_t)(temp_u16 >> 8);         // 温度高8位
    bleTxBuffer[2] = (uint8_t)(temp_u16 & 0xFF);       // 温度低8位
    bleTxBuffer[3] = (uint8_t)(hum_u16 >> 8);          // 湿度高8位
    bleTxBuffer[4] = (uint8_t)(hum_u16 & 0xFF);        // 湿度低8位
    bleTxBuffer[5] = (uint8_t)(sensorData.light >> 8); // 光照高8位
    bleTxBuffer[6] = (uint8_t)(sensorData.light & 0xFF); // 光照低8位
    bleTxBuffer[7] = (uint8_t)(sensorData.speed >> 8);  // 转速高8位
    bleTxBuffer[8] = (uint8_t)(sensorData.speed & 0xFF); // 转速低8位
    bleTxBuffer[9] = (uint8_t)(water_u16 >> 8);         // 水位高8位
    bleTxBuffer[10] = (uint8_t)(water_u16 & 0xFF);      // 水位低8位
    bleTxBuffer[11] = 0x55;                             // 帧尾
    
    /* 发送数据 */
    BLE_SendData(bleTxBuffer, 12);
}

/**
  * @brief  处理BLE接收到的命令
  *         命令格式: [0xBB][命令码][0xCC]
  */
void BLE_ProcessCommand(uint8_t *data, uint8_t len) {
    if (len >= 3 && data[0] == 0xBB && data[2] == 0xCC) {
        Device_Control(data[1]);
    }
}

/**
  * @brief  BLE初始化
  */
void BLE_Init(void) {
    /* 初始化BLE模块 */
    /* 设置设备名称为 "STM32_IoT" */
    BLE_SetDeviceName((uint8_t *)"STM32_IoT");
    
    /* 启用服务和特征 */
    /* UUID: FFE0 (服务), FFE1 (读写特征) */
    BLE_EnableService(0xFFE0);
    BLE_EnableCharacteristic(0xFFE1, CHAR_PROP_READ | CHAR_PROP_WRITE | CHAR_PROP_NOTIFY);
    
    /* 启动BLE广播 */
    BLE_StartAdvertising();
}