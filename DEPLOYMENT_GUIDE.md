# DMMS Local School Network Deployment Guide

This guide explains how to install, auto-start, and access the **Digital Marksheet Management System (DMMS)** on the school's local server computer and 4–5 client PCs without needing VS Code or manual terminal commands.

---

## 1. Prerequisites on the School Server PC

1. **Node.js (v18 or later)** installed.
2. **MongoDB Server** installed as a Windows Service (`MongoDB`, Startup Type: `Automatic`), listening only on `127.0.0.1:27017` (not exposed to the network).
3. **Static Local IP Address (Recommended)**:
   - Configure a static IPv4 address on the school server PC (e.g. `192.168.1.10` or reserve the server MAC address in the school router DHCP settings) so the browser bookmark never changes on the 4–5 client PCs.
   - Ensure the Windows network profile on the school LAN is set to **Private** (not Public).

---

## 2. One-Time Installation & Automatic Startup

1. Open the `dmms-app\scripts` folder in Windows File Explorer.
2. Right-click **`install-autostart.bat`** and select **"Run as administrator"** (recommended).
   - Running as Administrator:
     - Builds the production frontend (`frontend/dist`).
     - Registers the **`DMMS-AutoStart`** Windows Scheduled Task to start automatically at **Windows Startup** (even before login) and auto-recover on failure.
     - Configures a Windows Firewall inbound rule allowing **TCP Port `5173`** only on **Private / Domain** school networks (MongoDB `27017` and backend internal proxy stay protected).
     - Starts DMMS immediately in the background.
   - If run as a standard user (double-clicking `install-autostart.bat`), it configures an `AtLogOn` Scheduled Task plus a Windows Startup folder launcher (`DMMS-AutoStart.vbs`) and starts DMMS immediately.

---

## 3. Accessing DMMS from School Computers

- **On the Server Computer:**  
  Open Chrome or Edge and go to:  
  `http://localhost:5173`
- **On the 4–5 School Staff Computers (same Wi-Fi / LAN):**  
  Open Chrome or Edge and go to:  
  `http://<SERVER_LOCAL_IP>:5173` (for example, `http://192.168.1.10:5173`) or `http://<SERVER_HOSTNAME>:5173`.
  > Tip: Bookmark this URL on each staff computer. No VS Code, terminal, or `npm` commands are required.

---

## 4. Daily Management & Troubleshooting (No Terminal Needed)

- **Check Server Status:** Double-click `scripts\status-dmms.bat` to verify MongoDB, Backend (port `8000`), Frontend (port `5173`), and `/api/health`.
- **Start DMMS Manually (if ever stopped):** Double-click `scripts\start-dmms.bat`.
- **Stop DMMS Safely:** Double-click `scripts\stop-dmms.bat`.
- **Remove Auto-Startup:** Run `powershell -ExecutionPolicy Bypass -File scripts\uninstall-autostart.ps1`.
- **Logs:** Process and recovery logs are stored in `dmms-app\logs\` (`supervisor.log`, `backend.log`, `frontend.log`, `dmms-state.json`).

---

## 5. Built-in Recovery & Restart Features

- **Automatic Crash Recovery:** The DMMS Supervisor monitors both Backend and Frontend processes and automatically restarts either service within a few seconds if it crashes.
- **Refresh App (Staff / Client PCs):** Available on the Home page, School Registration, Login, Forgot Password, and `/refresh-app` even when the backend is temporarily offline. Clears only safe temporary UI state and reconnects without clearing login sessions or database data.
- **Restart Application (Authenticated Sidebar):** Available in the sidebar for Admin, Head Teacher, Teacher, and Office Staff. Prompts for confirmation, warns all connected users may briefly disconnect, logs the action in the Audit Log, and safely restarts both services via the server supervisor.
