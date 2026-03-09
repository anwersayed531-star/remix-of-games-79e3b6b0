package com.sayed.gamehub.plugins;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.wifi.p2p.*;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.*;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(
    name = "WifiDirect",
    permissions = {
        @Permission(alias = "location", strings = {
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        }),
        @Permission(alias = "nearby", strings = { "android.permission.NEARBY_WIFI_DEVICES" })
    }
)
public class WifiDirectPlugin extends Plugin {
    private static final String TAG = "WifiDirect";
    private static final int PORT = 8765;

    private WifiP2pManager manager;
    private WifiP2pManager.Channel channel;
    private BroadcastReceiver receiver;
    private IntentFilter intentFilter;

    private final List<WifiP2pDevice> discoveredPeers = new ArrayList<>();
    private final List<Socket> clientSockets = new ArrayList<>();
    private ServerSocket serverSocket;
    private Socket clientSocket;
    private boolean isHost = false;

    private PrintWriter writer;
    private final ExecutorService executor = Executors.newCachedThreadPool();

    // Pending call saved while waiting for permission result
    private PluginCall pendingCall;
    private String pendingAction; // "createGroup" or "discover"

    @Override
    public void load() {
        manager = (WifiP2pManager) getContext().getSystemService(Context.WIFI_P2P_SERVICE);
        channel = manager.initialize(getContext(), getContext().getMainLooper(), null);

        intentFilter = new IntentFilter();
        intentFilter.addAction(WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION);
        intentFilter.addAction(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION);
        intentFilter.addAction(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION);
        intentFilter.addAction(WifiP2pManager.WIFI_P2P_THIS_DEVICE_CHANGED_ACTION);

        receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getAction();
                if (WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION.equals(action)) {
                    manager.requestPeers(channel, peers -> {
                        discoveredPeers.clear();
                        discoveredPeers.addAll(peers.getDeviceList());
                        notifyPeersChanged();
                    });
                } else if (WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION.equals(action)) {
                    android.net.NetworkInfo networkInfo = intent.getParcelableExtra(WifiP2pManager.EXTRA_NETWORK_INFO);
                    if (networkInfo != null && networkInfo.isConnected()) {
                        manager.requestConnectionInfo(channel, info -> {
                            if (info.groupFormed) {
                                if (info.isGroupOwner) {
                                    startServer();
                                } else {
                                    connectToHost(info.groupOwnerAddress.getHostAddress());
                                }
                            }
                        });
                    }
                }
            }
        };

        getContext().registerReceiver(receiver, intentFilter);
    }

    // ─── Permission helpers ───────────────────────────────────────

    private boolean hasAllRequiredPermissions() {
        // Check location permission (required on all Android versions for WiFi Direct)
        if (getPermissionState("location") != PermissionState.GRANTED) {
            return false;
        }
        // Check nearby permission (required on Android 13+)
        if (Build.VERSION.SDK_INT >= 33) {
            if (getPermissionState("nearby") != PermissionState.GRANTED) {
                return false;
            }
        }
        return true;
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        super.checkPermissions(call);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        super.requestAllPermissions(call, "handlePermissionResult");
    }

    @PermissionCallback
    private void handlePermissionResult(PluginCall call) {
        if (call == null) return;

        // If this was a standalone requestPermissions() call, just return the state
        if (pendingAction == null) {
            super.checkPermissions(call);
            return;
        }

        // This was triggered from createGroup/discover — continue or reject
        if (!hasAllRequiredPermissions()) {
            call.reject("الأذونات المطلوبة غير ممنوحة. يرجى السماح بأذونات الموقع والأجهزة القريبة.");
            notifyStatus("failed");
            pendingAction = null;
            pendingCall = null;
            return;
        }

        String action = pendingAction;
        pendingAction = null;
        pendingCall = null;

        if ("createGroup".equals(action)) {
            doCreateGroup(call);
        } else if ("discover".equals(action)) {
            doDiscover(call);
        }
    }

    // ─── WiFi Direct operations ───────────────────────────────────

    @PluginMethod
    public void createGroup(PluginCall call) {
        if (!hasAllRequiredPermissions()) {
            pendingCall = call;
            pendingAction = "createGroup";
            requestAllPermissions(call, "handlePermissionResult");
            return;
        }
        doCreateGroup(call);
    }

    private void doCreateGroup(PluginCall call) {
        isHost = true;
        manager.createGroup(channel, new WifiP2pManager.ActionListener() {
            @Override
            public void onSuccess() {
                Log.d(TAG, "Group created");
                call.resolve(new JSObject().put("success", true));
                notifyStatus("waiting");
            }
            @Override
            public void onFailure(int reason) {
                Log.e(TAG, "Create group failed: " + reason);
                call.reject("Failed to create group: " + reason);
                notifyStatus("failed");
            }
        });
    }

    @PluginMethod
    public void discover(PluginCall call) {
        if (!hasRequiredPermissions()) {
            pendingCall = call;
            pendingAction = "discover";
            requestAllPermissions(call, "handlePermissionResult");
            return;
        }
        doDiscover(call);
    }

    private void doDiscover(PluginCall call) {
        isHost = false;
        manager.discoverPeers(channel, new WifiP2pManager.ActionListener() {
            @Override
            public void onSuccess() {
                Log.d(TAG, "Discovery started");
                call.resolve(new JSObject().put("success", true));
                notifyStatus("discovering");
            }
            @Override
            public void onFailure(int reason) {
                Log.e(TAG, "Discovery failed: " + reason);
                call.reject("Discovery failed: " + reason);
            }
        });
    }

    @PluginMethod
    public void connectToPeer(PluginCall call) {
        String address = call.getString("address");
        if (address == null) { call.reject("address required"); return; }

        WifiP2pConfig config = new WifiP2pConfig();
        config.deviceAddress = address;

        manager.connect(channel, config, new WifiP2pManager.ActionListener() {
            @Override
            public void onSuccess() {
                Log.d(TAG, "Connection initiated");
                call.resolve(new JSObject().put("success", true));
                notifyStatus("connecting");
            }
            @Override
            public void onFailure(int reason) {
                call.reject("Connect failed: " + reason);
                notifyStatus("failed");
            }
        });
    }

    @PluginMethod
    public void send(PluginCall call) {
        String data = call.getString("data");
        if (data == null) { call.reject("data required"); return; }

        executor.execute(() -> {
            try {
                if (isHost) {
                    synchronized (clientSockets) {
                        List<Socket> dead = new ArrayList<>();
                        for (Socket s : clientSockets) {
                            try {
                                PrintWriter pw = new PrintWriter(new OutputStreamWriter(s.getOutputStream(), "UTF-8"), true);
                                pw.println(data);
                            } catch (Exception e) {
                                dead.add(s);
                            }
                        }
                        clientSockets.removeAll(dead);
                    }
                } else if (writer != null) {
                    writer.println(data);
                }
                call.resolve(new JSObject().put("sent", true));
            } catch (Exception e) {
                call.reject("Send failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        cleanup();
        manager.removeGroup(channel, new WifiP2pManager.ActionListener() {
            @Override
            public void onSuccess() {
                call.resolve(new JSObject().put("success", true));
                notifyStatus("idle");
            }
            @Override
            public void onFailure(int reason) {
                call.resolve(new JSObject().put("success", true));
                notifyStatus("idle");
            }
        });
    }

    @PluginMethod
    public void getDeviceName(PluginCall call) {
        manager.requestDeviceInfo(channel, device -> {
            if (device != null) {
                call.resolve(new JSObject().put("name", device.deviceName));
            } else {
                call.resolve(new JSObject().put("name", "Player"));
            }
        });
    }

    // ─── Socket / networking ──────────────────────────────────────

    private void startServer() {
        executor.execute(() -> {
            try {
                if (serverSocket != null) serverSocket.close();
                serverSocket = new ServerSocket(PORT);
                Log.d(TAG, "Server listening on port " + PORT);
                notifyStatus("connected");

                while (!serverSocket.isClosed()) {
                    try {
                        Socket client = serverSocket.accept();
                        synchronized (clientSockets) {
                            clientSockets.add(client);
                        }
                        Log.d(TAG, "Client connected: " + client.getInetAddress());
                        notifyPeerConnected(client.getInetAddress().getHostAddress());
                        listenOnSocket(client);
                    } catch (Exception e) {
                        if (!serverSocket.isClosed()) Log.e(TAG, "Accept error", e);
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Server error", e);
                notifyStatus("failed");
            }
        });
    }

    private void connectToHost(String hostAddress) {
        executor.execute(() -> {
            int retries = 5;
            while (retries > 0) {
                try {
                    Thread.sleep(1000);
                    clientSocket = new Socket();
                    clientSocket.connect(new InetSocketAddress(hostAddress, PORT), 5000);
                    writer = new PrintWriter(new OutputStreamWriter(clientSocket.getOutputStream(), "UTF-8"), true);
                    Log.d(TAG, "Connected to host");
                    notifyStatus("connected");
                    listenOnSocket(clientSocket);
                    return;
                } catch (Exception e) {
                    retries--;
                    Log.w(TAG, "Connect retry, remaining: " + retries);
                }
            }
            notifyStatus("failed");
        });
    }

    private void listenOnSocket(Socket socket) {
        executor.execute(() -> {
            try {
                BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream(), "UTF-8"));
                String line;
                while ((line = reader.readLine()) != null) {
                    final String msg = line;
                    JSObject data = new JSObject();
                    data.put("message", msg);
                    data.put("from", socket.getInetAddress().getHostAddress());
                    notifyListeners("message", data);

                    if (isHost) {
                        synchronized (clientSockets) {
                            for (Socket s : clientSockets) {
                                if (s != socket && !s.isClosed()) {
                                    try {
                                        PrintWriter pw = new PrintWriter(new OutputStreamWriter(s.getOutputStream(), "UTF-8"), true);
                                        pw.println(msg);
                                    } catch (Exception ignored) {}
                                }
                            }
                        }
                    }
                }
            } catch (Exception e) {
                Log.d(TAG, "Socket closed: " + e.getMessage());
                notifyPeerDisconnected(socket.getInetAddress().getHostAddress());
            }
        });
    }

    // ─── Notification helpers ─────────────────────────────────────

    private void notifyStatus(String status) {
        JSObject data = new JSObject();
        data.put("status", status);
        notifyListeners("statusChange", data);
    }

    private void notifyPeersChanged() {
        try {
            JSObject data = new JSObject();
            JSONArray arr = new JSONArray();
            for (WifiP2pDevice d : discoveredPeers) {
                JSONObject dev = new JSONObject();
                dev.put("name", d.deviceName);
                dev.put("address", d.deviceAddress);
                dev.put("status", d.status);
                arr.put(dev);
            }
            data.put("peers", arr);
            notifyListeners("peersFound", data);
        } catch (Exception e) {
            Log.e(TAG, "notify peers error", e);
        }
    }

    private void notifyPeerConnected(String address) {
        JSObject data = new JSObject();
        data.put("address", address);
        notifyListeners("peerConnected", data);
    }

    private void notifyPeerDisconnected(String address) {
        JSObject data = new JSObject();
        data.put("address", address);
        notifyListeners("peerDisconnected", data);
    }

    private void cleanup() {
        try {
            if (serverSocket != null) { serverSocket.close(); serverSocket = null; }
            if (clientSocket != null) { clientSocket.close(); clientSocket = null; }
            synchronized (clientSockets) {
                for (Socket s : clientSockets) {
                    try { s.close(); } catch (Exception ignored) {}
                }
                clientSockets.clear();
            }
            writer = null;
        } catch (Exception e) {
            Log.e(TAG, "cleanup error", e);
        }
    }

    @Override
    protected void handleOnDestroy() {
        cleanup();
        try {
            getContext().unregisterReceiver(receiver);
        } catch (Exception ignored) {}
        manager.stopPeerDiscovery(channel, null);
    }
}
