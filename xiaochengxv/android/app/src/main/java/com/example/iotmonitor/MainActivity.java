package com.example.iotmonitor;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Message;
import android.util.Log;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.ToggleButton;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Set;
import java.util.UUID;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "IoTMonitor";
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private BluetoothAdapter bluetoothAdapter;
    private BluetoothSocket bluetoothSocket;
    private ConnectedThread connectedThread;

    private Spinner spinnerDevices;
    private Button btnScan, btnConnect;
    private TextView tvStatus, tvTemp, tvHumidity, tvLight, tvSpeed, tvWater;
    private TextView tvLog;
    private ToggleButton tbGate, tbLight, tbAccess, tbFan;
    private TextView tvGateStatus, tvLightStatus, tvAccessStatus, tvFanStatus;

    private ArrayList<BluetoothDevice> deviceList;
    private ArrayAdapter<String> deviceAdapter;

    private boolean isConnected = false;

    private final Handler handler = new Handler(new Handler.Callback() {
        @Override
        public boolean handleMessage(Message msg) {
            switch (msg.what) {
                case 1:
                    String data = (String) msg.obj;
                    parseSensorData(data);
                    break;
                case 2:
                    updateStatus((String) msg.obj, false);
                    break;
                case 3:
                    updateStatus((String) msg.obj, true);
                    break;
            }
            return true;
        }
    });

    private final BroadcastReceiver bluetoothReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            if (BluetoothDevice.ACTION_FOUND.equals(action)) {
                BluetoothDevice device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                if (device != null && !deviceList.contains(device)) {
                    deviceList.add(device);
                    String name = device.getName();
                    if (name == null || name.isEmpty()) {
                        name = "未知设备";
                    }
                    deviceAdapter.add(name + " (" + device.getAddress() + ")");
                    deviceAdapter.notifyDataSetChanged();
                }
            } else if (BluetoothAdapter.ACTION_DISCOVERY_FINISHED.equals(action)) {
                log("扫描完成，发现 " + deviceList.size() + " 个设备");
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        initViews();
        initBluetooth();
        loadPairedDevices();

        btnScan.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                scanDevices();
            }
        });

        btnConnect.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (isConnected) {
                    disconnect();
                } else {
                    connect();
                }
            }
        });

        tbGate.setOnCheckedChangeListener((buttonView, isChecked) -> {
            sendCommand("gate", isChecked);
            tvGateStatus.setText(isChecked ? "已开启" : "已关闭");
        });

        tbLight.setOnCheckedChangeListener((buttonView, isChecked) -> {
            sendCommand("light", isChecked);
            tvLightStatus.setText(isChecked ? "已开启" : "已关闭");
        });

        tbAccess.setOnCheckedChangeListener((buttonView, isChecked) -> {
            sendCommand("access", isChecked);
            tvAccessStatus.setText(isChecked ? "已开启" : "已关闭");
        });

        tbFan.setOnCheckedChangeListener((buttonView, isChecked) -> {
            sendCommand("fan", isChecked);
            tvFanStatus.setText(isChecked ? "已开启" : "已关闭");
        });
    }

    private void initViews() {
        spinnerDevices = findViewById(R.id.spinner_devices);
        btnScan = findViewById(R.id.btn_scan);
        btnConnect = findViewById(R.id.btn_connect);
        tvStatus = findViewById(R.id.tv_status);
        tvTemp = findViewById(R.id.tv_temp);
        tvHumidity = findViewById(R.id.tv_humidity);
        tvLight = findViewById(R.id.tv_light);
        tvSpeed = findViewById(R.id.tv_speed);
        tvWater = findViewById(R.id.tv_water);
        tvLog = findViewById(R.id.tv_log);

        tbGate = findViewById(R.id.tb_gate);
        tbLight = findViewById(R.id.tb_light);
        tbAccess = findViewById(R.id.tb_access);
        tbFan = findViewById(R.id.tb_fan);

        tvGateStatus = findViewById(R.id.tv_gate_status);
        tvLightStatus = findViewById(R.id.tv_light_status);
        tvAccessStatus = findViewById(R.id.tv_access_status);
        tvFanStatus = findViewById(R.id.tv_fan_status);

        deviceList = new ArrayList<>();
        deviceAdapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item);
        deviceAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spinnerDevices.setAdapter(deviceAdapter);
    }

    private void initBluetooth() {
        bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
        if (bluetoothAdapter == null) {
            Toast.makeText(this, "设备不支持蓝牙", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        if (!bluetoothAdapter.isEnabled()) {
            Intent enableBtIntent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN}, 1);
                return;
            }
            startActivityForResult(enableBtIntent, 1);
        }

        IntentFilter filter = new IntentFilter();
        filter.addAction(BluetoothDevice.ACTION_FOUND);
        filter.addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED);
        registerReceiver(bluetoothReceiver, filter);
    }

    private void loadPairedDevices() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.BLUETOOTH_CONNECT}, 1);
            return;
        }

        Set<BluetoothDevice> pairedDevices = bluetoothAdapter.getBondedDevices();
        if (pairedDevices.size() > 0) {
            for (BluetoothDevice device : pairedDevices) {
                deviceList.add(device);
                String name = device.getName();
                if (name == null || name.isEmpty()) {
                    name = "未知设备";
                }
                deviceAdapter.add(name + " (" + device.getAddress() + ")");
            }
        }
    }

    private void scanDevices() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.ACCESS_FINE_LOCATION}, 1);
            return;
        }

        if (bluetoothAdapter.isDiscovering()) {
            bluetoothAdapter.cancelDiscovery();
        }

        deviceList.clear();
        deviceAdapter.clear();
        loadPairedDevices();

        log("正在扫描蓝牙设备...");
        bluetoothAdapter.startDiscovery();
    }

    private void connect() {
        int position = spinnerDevices.getSelectedItemPosition();
        if (position < 0 || position >= deviceList.size()) {
            Toast.makeText(this, "请选择设备", Toast.LENGTH_SHORT).show();
            return;
        }

        BluetoothDevice device = deviceList.get(position);

        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.BLUETOOTH_CONNECT}, 1);
            return;
        }

        log("正在连接: " + device.getName());

        try {
            bluetoothSocket = device.createRfcommSocketToServiceRecord(SPP_UUID);
            bluetoothAdapter.cancelDiscovery();

            bluetoothSocket.connect();
            isConnected = true;
            updateStatus("已连接: " + device.getName(), true);
            btnConnect.setText("断开");

            connectedThread = new ConnectedThread(bluetoothSocket);
            connectedThread.start();

            log("连接成功");

        } catch (IOException e) {
            log("连接失败: " + e.getMessage());
            updateStatus("连接失败", false);
            try {
                bluetoothSocket.close();
            } catch (IOException ex) {
                ex.printStackTrace();
            }
        }
    }

    private void disconnect() {
        if (connectedThread != null) {
            connectedThread.cancel();
            connectedThread = null;
        }

        if (bluetoothSocket != null) {
            try {
                bluetoothSocket.close();
            } catch (IOException e) {
                e.printStackTrace();
            }
            bluetoothSocket = null;
        }

        isConnected = false;
        updateStatus("已断开连接", false);
        btnConnect.setText("连接");
        log("已断开连接");
    }

    private void sendCommand(String device, boolean status) {
        if (!isConnected) {
            Toast.makeText(this, "请先连接设备", Toast.LENGTH_SHORT).show();
            return;
        }

        int command = 0;
        switch (device) {
            case "gate":
                command = status ? 0x01 : 0x00;
                break;
            case "light":
                command = status ? 0x03 : 0x02;
                break;
            case "access":
                command = status ? 0x05 : 0x04;
                break;
            case "fan":
                command = status ? 0x07 : 0x06;
                break;
        }

        byte[] data = new byte[]{(byte) 0xBB, (byte) command, (byte) 0xCC};
        if (connectedThread != null) {
            connectedThread.write(data);
            log("发送命令: " + device + " " + (status ? "开启" : "关闭") + " (0x" + Integer.toHexString(command) + ")");
        }
    }

    private void parseSensorData(String data) {
        try {
            byte[] bytes = hexStringToByteArray(data);
            if (bytes.length >= 11 && bytes[0] == (byte) 0xAA && bytes[bytes.length - 1] == (byte) 0x55) {
                float temp = ((bytes[1] & 0xFF) << 8 | (bytes[2] & 0xFF)) / 100.0f;
                float humidity = ((bytes[3] & 0xFF) << 8 | (bytes[4] & 0xFF)) / 100.0f;
                int light = (bytes[5] & 0xFF) << 8 | (bytes[6] & 0xFF);
                int speed = (bytes[7] & 0xFF) << 8 | (bytes[8] & 0xFF);
                float water = ((bytes[9] & 0xFF) << 8 | (bytes[10] & 0xFF)) / 100.0f;

                tvTemp.setText(String.format("%.1f°C", temp));
                tvHumidity.setText(String.format("%.1f%%", humidity));
                tvLight.setText(String.format("%dlux", light));
                tvSpeed.setText(String.format("%drpm", speed));
                tvWater.setText(String.format("%.1fcm", water));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private byte[] hexStringToByteArray(String s) {
        int len = s.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(s.charAt(i), 16) << 4)
                    + Character.digit(s.charAt(i + 1), 16));
        }
        return data;
    }

    private void updateStatus(String status, boolean connected) {
        tvStatus.setText(status);
        tvStatus.setTextColor(connected ? getResources().getColor(R.color.green) : getResources().getColor(R.color.red));
    }

    private void log(String message) {
        tvLog.append("\n[" + java.text.DateFormat.getDateTimeInstance().format(new java.util.Date()) + "] " + message);
        tvLog.scrollTo(0, tvLog.getBottom());
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        unregisterReceiver(bluetoothReceiver);
        disconnect();
    }

    private class ConnectedThread extends Thread {
        private final BluetoothSocket mmSocket;
        private final InputStream mmInStream;
        private final OutputStream mmOutStream;
        private byte[] mmBuffer;

        public ConnectedThread(BluetoothSocket socket) {
            mmSocket = socket;
            InputStream tmpIn = null;
            OutputStream tmpOut = null;

            try {
                tmpIn = socket.getInputStream();
                tmpOut = socket.getOutputStream();
            } catch (IOException e) {
                e.printStackTrace();
            }

            mmInStream = tmpIn;
            mmOutStream = tmpOut;
        }

        public void run() {
            mmBuffer = new byte[1024];
            int numBytes;

            while (true) {
                try {
                    numBytes = mmInStream.read(mmBuffer);
                    if (numBytes > 0) {
                        byte[] data = new byte[numBytes];
                        System.arraycopy(mmBuffer, 0, data, 0, numBytes);

                        StringBuilder sb = new StringBuilder();
                        for (byte b : data) {
                            sb.append(String.format("%02X", b));
                        }

                        Message msg = handler.obtainMessage(1, sb.toString());
                        msg.sendToTarget();
                    }
                } catch (IOException e) {
                    handler.obtainMessage(2, "连接已断开").sendToTarget();
                    break;
                }
            }
        }

        public void write(byte[] bytes) {
            try {
                mmOutStream.write(bytes);
            } catch (IOException e) {
                e.printStackTrace();
            }
        }

        public void cancel() {
            try {
                mmSocket.close();
            } catch (IOException e) {
                e.printStackTrace();
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 1) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                initBluetooth();
                loadPairedDevices();
            } else {
                Toast.makeText(this, "需要蓝牙权限", Toast.LENGTH_SHORT).show();
            }
        }
    }
}
