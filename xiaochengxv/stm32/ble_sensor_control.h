/**
  ******************************************************************************
  * @file    ble_sensor_control.h
  * @author  IoT Team
  * @brief   STM32蓝牙传感器控制头文件
  ******************************************************************************
  */

#ifndef BLE_SENSOR_CONTROL_H
#define BLE_SENSOR_CONTROL_H

#ifdef __cplusplus
extern "C" {
#endif

/* BLE相关函数声明 */
void BLE_Init(void);
uint8_t BLE_CheckReceivedData(void);
void BLE_GetReceivedData(uint8_t *buffer, uint8_t maxLen);
uint8_t BLE_GetReceivedLength(void);
void BLE_SendData(uint8_t *data, uint8_t len);
void BLE_SetDeviceName(uint8_t *name);
void BLE_EnableService(uint16_t uuid);
void BLE_EnableCharacteristic(uint16_t uuid, uint8_t properties);
void BLE_StartAdvertising(void);

/* 特征属性定义 */
#define CHAR_PROP_READ    0x02
#define CHAR_PROP_WRITE   0x08
#define CHAR_PROP_NOTIFY  0x10

/* GPIO定义 (根据实际硬件修改) */
#define GATE_GPIO_Port    GPIOB
#define GATE_Pin          GPIO_PIN_0

#define LIGHT_GPIO_Port   GPIOB
#define LIGHT_Pin         GPIO_PIN_1

#define ACCESS_GPIO_Port  GPIOB
#define ACCESS_Pin        GPIO_PIN_2

#define FAN_GPIO_Port     GPIOB
#define FAN_Pin           GPIO_PIN_3

/* 主循环函数 */
void IoT_MainLoop(void);

#ifdef __cplusplus
}
#endif

#endif /* BLE_SENSOR_CONTROL_H */