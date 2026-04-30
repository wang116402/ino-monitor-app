#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
物联网监控控制软件
支持JSY-31-SPP蓝牙模块（BLE模式）
实时监测温度、湿度、光照度、转速、水位
远程控制闸门、灯管、门禁、风扇
"""

import sys
import asyncio
import threading
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QPushButton, QComboBox, QLineEdit, QTextEdit,
    QGroupBox, QGridLayout, QProgressBar, QFrame, QMessageBox
)
from PyQt5.QtGui import QFont, QColor, QPalette
from PyQt5.QtCore import Qt, pyqtSignal, pyqtSlot

try:
    from bleak import BleakClient, BleakScanner
    from bleak.backends.characteristic import BleakGATTCharacteristic
except ImportError:
    print("请先安装依赖: pip install bleak PyQt5")
    sys.exit(1)

class BleWorker(threading.Thread):
    """蓝牙工作线程"""
    data_received = pyqtSignal(bytes)
    connection_changed = pyqtSignal(bool, str)
    device_list_updated = pyqtSignal(list)
    
    def __init__(self):
        super().__init__(daemon=True)
        self.client = None
        self.connected = False
        self.running = True
        self.char_uuid = "0000ffe1-0000-1000-8000-00805f9b34fb"
        self.device_address = None
    
    def run(self):
        """线程主循环"""
        asyncio.run(self.main_loop())
    
    async def main_loop(self):
        """异步主循环"""
        while self.running:
            if not self.connected and self.device_address:
                await self.connect_device()
            await asyncio.sleep(0.5)
    
    async def scan_devices(self):
        """扫描BLE设备"""
        try:
            devices = await BleakScanner.discover(timeout=3)
            device_list = []
            for device in devices:
                name = device.name if device.name else "未知设备"
                device_list.append((name, device.address, device.rssi))
            self.device_list_updated.emit(device_list)
        except Exception as e:
            print(f"扫描失败: {e}")
    
    async def connect_device(self, address=None):
        """连接设备"""
        if address:
            self.device_address = address
        
        if not self.device_address:
            return
        
        try:
            self.client = BleakClient(self.device_address)
            await self.client.connect()
            self.connected = True
            self.connection_changed.emit(True, self.device_address)
            
            # 查找特征
            services = await self.client.get_services()
            for service in services:
                for char in service.characteristics:
                    if 'notify' in char.properties:
                        await self.client.start_notify(char, self.notification_handler)
                    if 'write' in char.properties:
                        self.char_uuid = char.uuid
            
        except Exception as e:
            self.connected = False
            self.connection_changed.emit(False, str(e))
    
    def notification_handler(self, char: BleakGATTCharacteristic, data: bytearray):
        """数据接收回调"""
        self.data_received.emit(bytes(data))
    
    async def send_command(self, command):
        """发送命令"""
        if not self.client or not self.connected:
            return False
        
        try:
            data = bytes([0xBB, command, 0xCC])
            await self.client.write_gatt_char(self.char_uuid, data)
            return True
        except Exception as e:
            print(f"发送失败: {e}")
            return False
    
    def disconnect(self):
        """断开连接"""
        if self.client:
            asyncio.run(self.client.disconnect())
        self.connected = False
        self.connection_changed.emit(False, "已断开")
    
    def stop(self):
        """停止线程"""
        self.running = False
        self.disconnect()

class MainWindow(QMainWindow):
    """主窗口"""
    
    def __init__(self):
        super().__init__()
        self.setWindowTitle("物联网监控系统")
        self.setGeometry(100, 100, 800, 600)
        
        # 初始化蓝牙工作线程
        self.ble_worker = BleWorker()
        self.ble_worker.data_received.connect(self.handle_data)
        self.ble_worker.connection_changed.connect(self.handle_connection)
        self.ble_worker.device_list_updated.connect(self.update_device_list)
        self.ble_worker.start()
        
        # 传感器数据
        self.sensor_data = {
            'temperature': 25.0,
            'humidity': 60.0,
            'light': 500,
            'speed': 1200,
            'waterLevel': 45.0
        }
        
        # 设备状态
        self.device_status = {
            'gate': False,
            'light': False,
            'access': False,
            'fan': False
        }
        
        self.init_ui()
    
    def init_ui(self):
        """初始化界面"""
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        layout = QVBoxLayout(central_widget)
        
        # 蓝牙连接区域
        conn_group = QGroupBox("蓝牙连接")
        conn_layout = QHBoxLayout(conn_group)
        
        self.device_combo = QComboBox()
        self.device_combo.setMinimumWidth(300)
        conn_layout.addWidget(self.device_combo)
        
        self.scan_btn = QPushButton("🔍 扫描设备")
        self.scan_btn.clicked.connect(self.scan_devices)
        conn_layout.addWidget(self.scan_btn)
        
        self.connect_btn = QPushButton("🔗 连接")
        self.connect_btn.clicked.connect(self.connect_device)
        conn_layout.addWidget(self.connect_btn)
        
        self.status_label = QLabel("状态: 未连接")
        self.status_label.setStyleSheet("color: red")
        conn_layout.addWidget(self.status_label)
        
        layout.addWidget(conn_group)
        
        # 传感器数据区域
        sensor_group = QGroupBox("实时数据监测")
        sensor_layout = QGridLayout(sensor_group)
        
        self.sensor_labels = {}
        sensors = [
            ("温度", "°C", "temperature", 0, 0),
            ("湿度", "%", "humidity", 0, 1),
            ("光照度", "lux", "light", 1, 0),
            ("转速", "rpm", "speed", 1, 1),
            ("水位", "cm", "waterLevel", 2, 0)
        ]
        
        for name, unit, key, row, col in sensors:
            frame = QFrame()
            frame.setFrameStyle(QFrame.StyledPanel)
            frame.setStyleSheet("background-color: #f8f9fa; border-radius: 8px;")
            flayout = QVBoxLayout(frame)
            
            value_label = QLabel("--")
            value_label.setFont(QFont("Arial", 24, QFont.Bold))
            value_label.setAlignment(Qt.AlignCenter)
            
            unit_label = QLabel(f"{name}: {unit}")
            unit_label.setFont(QFont("Arial", 12))
            unit_label.setAlignment(Qt.AlignCenter)
            
            flayout.addWidget(value_label)
            flayout.addWidget(unit_label)
            
            sensor_layout.addWidget(frame, row, col)
            self.sensor_labels[key] = value_label
        
        layout.addWidget(sensor_group)
        
        # 设备控制区域
        control_group = QGroupBox("设备控制")
        control_layout = QGridLayout(control_group)
        
        devices = [
            ("闸门", "gate", 0, 0),
            ("灯管", "light", 0, 1),
            ("门禁", "access", 1, 0),
            ("风扇", "fan", 1, 1)
        ]
        
        self.control_buttons = {}
        for name, key, row, col in devices:
            frame = QFrame()
            frame.setFrameStyle(QFrame.StyledPanel)
            frame.setStyleSheet("background-color: #f8f9fa; border-radius: 8px;")
            flayout = QVBoxLayout(frame)
            
            name_label = QLabel(name)
            name_label.setFont(QFont("Arial", 14, QFont.Bold))
            name_label.setAlignment(Qt.AlignCenter)
            
            status_label = QLabel("已关闭")
            status_label.setFont(QFont("Arial", 12))
            status_label.setAlignment(Qt.AlignCenter)
            status_label.setStyleSheet("color: #999")
            
            btn = QPushButton("开启")
            btn.setStyleSheet("background-color: #1a73e8; color: white; border-radius: 6px; padding: 8px 20px;")
            btn.clicked.connect(lambda checked, k=key: self.toggle_device(k))
            
            flayout.addWidget(name_label)
            flayout.addWidget(status_label)
            flayout.addWidget(btn)
            
            control_layout.addWidget(frame, row, col)
            self.control_buttons[key] = (btn, status_label)
        
        layout.addWidget(control_group)
        
        # 日志区域
        log_group = QGroupBox("系统日志")
        log_layout = QVBoxLayout(log_group)
        
        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        self.log_text.setFont(QFont("Consolas", 10))
        log_layout.addWidget(self.log_text)
        
        layout.addWidget(log_group)
        
        self.add_log("系统启动完成")
        self.add_log("请选择蓝牙设备并连接")
    
    def add_log(self, message):
        """添加日志"""
        timestamp = time.strftime("%H:%M:%S")
        self.log_text.append(f"[{timestamp}] {message}")
        self.log_text.verticalScrollBar().setValue(self.log_text.verticalScrollBar().maximum())
    
    def scan_devices(self):
        """扫描设备"""
        self.add_log("正在扫描BLE设备...")
        asyncio.run_coroutine_threadsafe(self.ble_worker.scan_devices(), asyncio.get_event_loop())
    
    def update_device_list(self, devices):
        """更新设备列表"""
        self.device_combo.clear()
        for name, address, rssi in devices:
            self.device_combo.addItem(f"{name} ({address}) [{rssi} dBm]", address)
        self.add_log(f"发现 {len(devices)} 个设备")
    
    def connect_device(self):
        """连接设备"""
        if self.ble_worker.connected:
            self.ble_worker.disconnect()
            self.connect_btn.setText("🔗 连接")
            return
        
        index = self.device_combo.currentIndex()
        if index < 0:
            QMessageBox.warning(self, "警告", "请先选择设备")
            return
        
        address = self.device_combo.itemData(index)
        self.add_log(f"正在连接: {address}")
        self.connect_btn.setText("🔴 断开")
        
        asyncio.run_coroutine_threadsafe(self.ble_worker.connect_device(address), asyncio.get_event_loop())
    
    def handle_connection(self, connected, message):
        """处理连接状态变化"""
        if connected:
            self.status_label.setText(f"状态: 已连接 - {message}")
            self.status_label.setStyleSheet("color: green")
            self.add_log(f"连接成功: {message}")
        else:
            self.status_label.setText(f"状态: 未连接 - {message}")
            self.status_label.setStyleSheet("color: red")
            self.connect_btn.setText("🔗 连接")
            self.add_log(f"连接断开: {message}")
    
    def handle_data(self, data):
        """处理接收到的数据"""
        self.add_log(f"收到数据: {data.hex()}")
        
        if len(data) >= 11 and data[0] == 0xAA and data[-1] == 0x55:
            temp = (data[1] << 8 | data[2]) / 100
            humi = (data[3] << 8 | data[4]) / 100
            light = data[5] << 8 | data[6]
            speed = data[7] << 8 | data[8]
            water = (data[9] << 8 | data[10]) / 100
            
            self.sensor_data['temperature'] = temp
            self.sensor_data['humidity'] = humi
            self.sensor_data['light'] = light
            self.sensor_data['speed'] = speed
            self.sensor_data['waterLevel'] = water
            
            self.update_sensor_display()
    
    def update_sensor_display(self):
        """更新传感器显示"""
        self.sensor_labels['temperature'].setText(f"{self.sensor_data['temperature']:.1f}")
        self.sensor_labels['humidity'].setText(f"{self.sensor_data['humidity']:.1f}")
        self.sensor_labels['light'].setText(f"{self.sensor_data['light']}")
        self.sensor_labels['speed'].setText(f"{self.sensor_data['speed']}")
        self.sensor_labels['waterLevel'].setText(f"{self.sensor_data['waterLevel']:.1f}")
    
    def toggle_device(self, key):
        """切换设备状态"""
        self.device_status[key] = not self.device_status[key]
        status = self.device_status[key]
        
        btn, status_label = self.control_buttons[key]
        
        if status:
            btn.setText("关闭")
            btn.setStyleSheet("background-color: #ea4335; color: white; border-radius: 6px; padding: 8px 20px;")
            status_label.setText("已开启")
            status_label.setStyleSheet("color: #34a853")
            command = [0, 2, 4, 6][['gate', 'light', 'access', 'fan'].index(key)] + 1
        else:
            btn.setText("开启")
            btn.setStyleSheet("background-color: #1a73e8; color: white; border-radius: 6px; padding: 8px 20px;")
            status_label.setText("已关闭")
            status_label.setStyleSheet("color: #999")
            command = [0, 2, 4, 6][['gate', 'light', 'access', 'fan'].index(key)]
        
        self.add_log(f"发送命令: {key} {'开启' if status else '关闭'} (0x{command:02X})")
        
        if self.ble_worker.connected:
            asyncio.run_coroutine_threadsafe(self.ble_worker.send_command(command), asyncio.get_event_loop())
        else:
            QMessageBox.warning(self, "警告", "请先连接设备")
    
    def closeEvent(self, event):
        """关闭窗口"""
        self.ble_worker.stop()
        event.accept()

if __name__ == "__main__":
    import time
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec_())