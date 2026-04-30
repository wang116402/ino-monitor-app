#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
JSY-31-SPP蓝牙测试工具
支持BLE模式连接和数据通信
"""

import sys
import time
import threading

try:
    from bleak import BleakClient, BleakScanner
    from bleak.backends.characteristic import BleakGATTCharacteristic
except ImportError:
    print("请先安装bleak库: pip install bleak")
    sys.exit(1)

# 全局变量
client = None
connected = False
service_uuid = "0000ffe0-0000-1000-8000-00805f9b34fb"
char_uuid = "0000ffe1-0000-1000-8000-00805f9b34fb"

def notification_handler(char: BleakGATTCharacteristic, data: bytearray):
    """接收数据回调函数"""
    print(f"\n[收到数据] {len(data)} bytes: {data.hex()}")
    
    # 尝试解析传感器数据
    if len(data) >= 11 and data[0] == 0xAA and data[-1] == 0x55:
        temp = (data[1] << 8 | data[2]) / 100
        humi = (data[3] << 8 | data[4]) / 100
        light = data[5] << 8 | data[6]
        speed = data[7] << 8 | data[8]
        water = (data[9] << 8 | data[10]) / 100
        print(f"  温度: {temp:.1f}°C  湿度: {humi:.1f}%  光照: {light} lux")
        print(f"  转速: {speed} rpm  水位: {water:.1f} cm")
    else:
        try:
            text = data.decode('utf-8').strip()
            print(f"  文本数据: {text}")
        except:
            pass

async def connect_device(device):
    """连接BLE设备"""
    global client, connected
    
    try:
        print(f"\n正在连接: {device.name} ({device.address})")
        client = BleakClient(device.address)
        await client.connect()
        connected = True
        print("✅ 连接成功!")
        
        # 查找服务和特征
        services = await client.get_services()
        for service in services:
            print(f"  服务: {service.uuid}")
            for char in service.characteristics:
                print(f"    特征: {char.uuid}  属性: {char.properties}")
                
                if 'notify' in char.properties:
                    await client.start_notify(char, notification_handler)
                    print(f"    ✓ 已开启通知")
                
                if 'write' in char.properties:
                    global char_uuid
                    char_uuid = char.uuid
                    print(f"    ✓ 找到可写特征")
        
        # 保持连接
        while connected:
            await asyncio.sleep(1)
            
    except Exception as e:
        print(f"❌ 连接失败: {e}")
        connected = False

async def send_command(command):
    """发送控制命令"""
    if not client or not connected:
        print("❌ 未连接设备")
        return
    
    try:
        data = bytes([0xBB, command, 0xCC])
        await client.write_gatt_char(char_uuid, data)
        print(f"✅ 发送命令: 0x{command:02X}")
    except Exception as e:
        print(f"❌ 发送失败: {e}")

async def scan_devices():
    """扫描BLE设备"""
    print("🔍 正在扫描BLE设备...")
    devices = await BleakScanner.discover(timeout=5)
    
    if len(devices) == 0:
        print("❌ 未找到BLE设备")
        return None
    
    print("\n发现设备列表:")
    for i, device in enumerate(devices):
        name = device.name if device.name else "未知设备"
        print(f"{i+1}. {name} ({device.address}) 信号强度: {device.rssi} dBm")
    
    while True:
        try:
            choice = int(input("\n请选择要连接的设备序号: ")) - 1
            if 0 <= choice < len(devices):
                return devices[choice]
            print("❌ 无效的选择")
        except ValueError:
            print("❌ 请输入数字")

def input_thread():
    """用户输入线程"""
    global connected
    
    while True:
        if connected:
            print("\n" + "="*50)
            print("命令菜单:")
            print("  0x00 - 闸门关闭    0x01 - 闸门开启")
            print("  0x02 - 灯管关闭    0x03 - 灯管开启")
            print("  0x04 - 门禁关闭    0x05 - 门禁开启")
            print("  0x06 - 风扇关闭    0x07 - 风扇开启")
            print("  q - 退出")
            
            cmd = input("\n请输入命令: ").strip()
            
            if cmd.lower() == 'q':
                print("📤 正在断开连接...")
                connected = False
                if client:
                    import asyncio
                    asyncio.run(client.disconnect())
                break
            
            try:
                if cmd.startswith('0x'):
                    command = int(cmd, 16)
                else:
                    command = int(cmd)
                
                if 0 <= command <= 7:
                    import asyncio
                    asyncio.run(send_command(command))
                else:
                    print("❌ 无效命令，范围0-7")
            except ValueError:
                print("❌ 请输入有效的命令")
        
        time.sleep(0.5)

async def main():
    """主函数"""
    print("="*60)
    print("    JSY-31-SPP BLE测试工具 v1.0")
    print("    支持STM32传感器数据监测和设备控制")
    print("="*60)
    
    # 扫描设备
    device = await scan_devices()
    if not device:
        return
    
    # 启动输入线程
    t = threading.Thread(target=input_thread, daemon=True)
    t.start()
    
    # 连接设备
    await connect_device(device)
    
    print("\n👋 再见!")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())