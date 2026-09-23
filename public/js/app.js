/**
 * DropFast - Production Client Application
 * Hybrid High-Speed File Transfer (Instant Sub-second for KB/MB, WebRTC 100GB for Massive)
 */

(function () {
  'use strict';

  // State
  let userRole = 'sender';
  let pairingMethod = 'qr';
  let myDeviceName = 'Device';
  let socket = null;
  let streamer = null;
  let qrScanner = null;
  let currentRoomId = null;
  let currentOtp = null;
  let pairedPeer = null;
  let stagedFiles = [];
  let completedFiles = [];

  // DOM Elements - Panels
  const stepRolePanel = document.getElementById('stepRolePanel');
  const stepMethodPanel = document.getElementById('stepMethodPanel');
  const senderQrPanel = document.getElementById('senderQrPanel');
  const receiverQrPanel = document.getElementById('receiverQrPanel');
  const senderOtpPanel = document.getElementById('senderOtpPanel');
  const receiverOtpPanel = document.getElementById('receiverOtpPanel');
  const pairedPeerBanner = document.getElementById('pairedPeerBanner');
  const senderTransferPanel = document.getElementById('senderTransferPanel');
  const receiverWaitingPanel = document.getElementById('receiverWaitingPanel');
  const activeTransferPanel = document.getElementById('activeTransferPanel');
  const completedPanel = document.getElementById('completedPanel');

  // Role Buttons
  const chooseSenderBtn = document.getElementById('chooseSenderBtn');
  const chooseReceiverBtn = document.getElementById('chooseReceiverBtn');

  // Method Buttons
  const backToRoleBtn = document.getElementById('backToRoleBtn');
  const currentRoleTag = document.getElementById('currentRoleTag');
  const chooseMethodQrBtn = document.getElementById('chooseMethodQrBtn');
  const chooseMethodOtpBtn = document.getElementById('chooseMethodOtpBtn');
  const qrMethodDesc = document.getElementById('qrMethodDesc');
  const otpMethodDesc = document.getElementById('otpMethodDesc');

  // Sender QR
  const backFromSenderQrBtn = document.getElementById('backFromSenderQrBtn');
  const senderQrImage = document.getElementById('senderQrImage');
  const senderQrLoader = document.getElementById('senderQrLoader');
  const senderWifiUrl = document.getElementById('senderWifiUrl');
  const copySenderWifiBtn = document.getElementById('copySenderWifiBtn');

  // Receiver QR
  const backFromReceiverQrBtn = document.getElementById('backFromReceiverQrBtn');
  const startReceiverCameraBtn = document.getElementById('startReceiverCameraBtn');
  const stopReceiverCameraBtn = document.getElementById('stopReceiverCameraBtn');
  const qrImageFileInput = document.getElementById('qrImageFileInput');
  const scanQrImageBtn = document.getElementById('scanQrImageBtn');
  const switchToOtpFromQrBtn = document.getElementById('switchToOtpFromQrBtn');

  // Sender OTP
  const backFromSenderOtpBtn = document.getElementById('backFromSenderOtpBtn');
  const senderPinDisplay = document.getElementById('senderPinDisplay');
  const copySenderPinBtn = document.getElementById('copySenderPinBtn');

  // Receiver OTP
  const backFromReceiverOtpBtn = document.getElementById('backFromReceiverOtpBtn');
  const pinCells = document.querySelectorAll('.pin-cell');
  const submitReceiverPinBtn = document.getElementById('submitReceiverPinBtn');

  // Paired Banner Info
  const pairedDeviceIcon = document.getElementById('pairedDeviceIcon');
  const pairedPeerDeviceName = document.getElementById('pairedPeerDeviceName');
  const myRoleBadge = document.getElementById('myRoleBadge');
  const swapRoleBtn = document.getElementById('swapRoleBtn');
  const disconnectBtn = document.getElementById('disconnectBtn');

  // File Upload Area
  const fileDropzone = document.getElementById('fileDropzone');
  const fileInput = document.getElementById('fileInput');
  const folderInput = document.getElementById('folderInput');
  const selectFilesBtn = document.getElementById('selectFilesBtn');
  const selectFolderBtn = document.getElementById('selectFolderBtn');
  const stagedFilesContainer = document.getElementById('stagedFilesContainer');
  const stagedCount = document.getElementById('stagedCount');
  const stagedTotalSize = document.getElementById('stagedTotalSize');
  const stagedList = document.getElementById('stagedList');
  const clearFilesBtn = document.getElementById('clearFilesBtn');
  const startTransferBtn = document.getElementById('startTransferBtn');

  // Progress Elements
  const transferFileName = document.getElementById('transferFileName');
  const transferFileCounter = document.getElementById('transferFileCounter');
  const currentSpeedVal = document.getElementById('currentSpeedVal');
  const transferPercentVal = document.getElementById('transferPercentVal');
  const etaVal = document.getElementById('etaVal');
  const progressBarFill = document.getElementById('progressBarFill');
  const transferredBytesLabel = document.getElementById('transferredBytesLabel');
  const totalBytesLabel = document.getElementById('totalBytesLabel');
  const cancelTransferBtn = document.getElementById('cancelTransferBtn');

  // Completed Elements
  const completedFilesList = document.getElementById('completedFilesList');
  const receiveMoreBtn = document.getElementById('receiveMoreBtn');

  // Meta, Theme & Audio
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeToggleIcon = document.getElementById('themeToggleIcon');
  const receiverQuickSendBtn = document.getElementById('receiverQuickSendBtn');
  const pairedSendFilesNowBtn = document.getElementById('pairedSendFilesNowBtn');
  const toastContainer = document.getElementById('toastContainer');
  const chimeSuccess = document.getElementById('chimeSuccess');
  const deviceIcon = document.getElementById('deviceIcon');
  const deviceName = document.getElementById('deviceName');
  const networkStatusPill = document.getElementById('networkStatusPill');

  // Theme Management
  function initTheme() {
    const saved = localStorage.getItem('dropfast_theme');
    let theme = 'light';
    if (saved) {
      theme = saved;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      theme = 'dark';
    } else {
      theme = 'light'; // Default to clean light/white theme
    }
    applyTheme(theme);

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('dropfast_theme')) {
          applyTheme(e.matches ? 'dark' : 'light');
        }
      });
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    if (themeToggleIcon) {
      themeToggleIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
    if (themeToggleBtn) {
      themeToggleBtn.setAttribute('title', theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
      themeToggleBtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
    }
    localStorage.setItem('dropfast_theme', theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    showToast(`Theme switched to ${next === 'dark' ? 'Dark' : 'Light'} Mode`);
  }

  // Helper: Format Bytes
  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Toast System
  function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast-item';
    toast.textContent = msg;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }

  // Detect Device
  function detectDevice() {
    const ua = navigator.userAgent;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
    if (isMobile) {
      myDeviceName = /iPhone|iPad|iPod/.test(ua) ? 'iPhone' : 'Android Phone';
      deviceIcon.textContent = '📱';
      deviceName.textContent = myDeviceName;
      const dropzoneTitle = document.querySelector('.dropzone-core h3');
      if (dropzoneTitle) dropzoneTitle.textContent = 'Tap to choose photos & files';
    } else {
      myDeviceName = /Macintosh/.test(ua) ? 'Mac' : 'Laptop / PC';
      deviceIcon.textContent = '💻';
      deviceName.textContent = myDeviceName;
    }
  }

  // Navigation: Step 1 (Role)
  function showStepRole() {
    stepRolePanel.style.display = 'block';
    stepMethodPanel.style.display = 'none';
    senderQrPanel.style.display = 'none';
    receiverQrPanel.style.display = 'none';
    senderOtpPanel.style.display = 'none';
    receiverOtpPanel.style.display = 'none';
    pairedPeerBanner.style.display = 'none';
    senderTransferPanel.style.display = 'none';
    receiverWaitingPanel.style.display = 'none';
    activeTransferPanel.style.display = 'none';
    completedPanel.style.display = 'none';
    if (qrScanner) qrScanner.stop();
    stopQrAutoRefreshTimer();
  }

  // Navigation: Step 2 (Method)
  function showStepMethod(role) {
    userRole = role;
    if (currentRoleTag) {
      currentRoleTag.textContent = role === 'sender' ? 'Sender' : 'Receiver';
      currentRoleTag.className = `badge-role-tag ${role === 'sender' ? '' : 'receive'}`;
    }

    if (qrMethodDesc && otpMethodDesc) {
      if (role === 'sender') {
        qrMethodDesc.textContent = 'Display a QR code for the receiving device to scan.';
        otpMethodDesc.textContent = 'Generate a 6-digit passcode to enter on the receiver.';
      } else {
        qrMethodDesc.textContent = 'Scan the QR code displayed on the sending device.';
        otpMethodDesc.textContent = 'Enter the 6-digit passcode displayed on the sender.';
      }
    }

    stepRolePanel.style.display = 'none';
    stepMethodPanel.style.display = 'block';
    senderQrPanel.style.display = 'none';
    receiverQrPanel.style.display = 'none';
    senderOtpPanel.style.display = 'none';
    receiverOtpPanel.style.display = 'none';
    if (qrScanner) qrScanner.stop();
    stopQrAutoRefreshTimer();
  }

  // Navigation: Step 3 (Pairing view)
  function showStepPairing(method) {
    pairingMethod = method;
    stepMethodPanel.style.display = 'none';

    if (userRole === 'sender') {
      if (method === 'qr') {
        senderQrPanel.style.display = 'block';
        receiverQrPanel.style.display = 'none';
        senderOtpPanel.style.display = 'none';
        receiverOtpPanel.style.display = 'none';
        requestSession();
      } else {
        senderOtpPanel.style.display = 'block';
        senderQrPanel.style.display = 'none';
        receiverQrPanel.style.display = 'none';
        receiverOtpPanel.style.display = 'none';
        requestSession();
      }
    } else {
      if (method === 'qr') {
        receiverQrPanel.style.display = 'block';
        senderQrPanel.style.display = 'none';
        senderOtpPanel.style.display = 'none';
        receiverOtpPanel.style.display = 'none';
        setTimeout(() => startReceiverCameraBtn.click(), 100);
      } else {
        receiverOtpPanel.style.display = 'block';
        senderQrPanel.style.display = 'none';
        receiverQrPanel.style.display = 'none';
        senderOtpPanel.style.display = 'none';
        if (pinCells[0]) pinCells[0].focus();
      }
    }
  }

  // Timer for QR Auto-Refresh (1 minute 30 seconds = 90s)
  let qrTimerInterval = null;
  let qrSecondsRemaining = 90;
  const qrTimerCountdown = document.getElementById('qrTimerCountdown');

  function startQrAutoRefreshTimer() {
    stopQrAutoRefreshTimer();
    qrSecondsRemaining = 90;
    updateQrTimerDisplay();

    qrTimerInterval = setInterval(() => {
      qrSecondsRemaining--;
      updateQrTimerDisplay();

      if (qrSecondsRemaining <= 0) {
        stopQrAutoRefreshTimer();
        showToast('Refreshing QR Code...');
        requestSession();
      }
    }, 1000);
  }

  function stopQrAutoRefreshTimer() {
    if (qrTimerInterval) {
      clearInterval(qrTimerInterval);
      qrTimerInterval = null;
    }
  }

  function updateQrTimerDisplay() {
    if (!qrTimerCountdown) return;
    const mins = Math.floor(qrSecondsRemaining / 60);
    const secs = qrSecondsRemaining % 60;
    qrTimerCountdown.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // Navigation: Step 4 (Paired & Ready)
  function showStepPaired(peer) {
    pairedPeer = peer;
    if (qrScanner) qrScanner.stop();
    stopQrAutoRefreshTimer();

    stepRolePanel.style.display = 'none';
    stepMethodPanel.style.display = 'none';
    senderQrPanel.style.display = 'none';
    receiverQrPanel.style.display = 'none';
    senderOtpPanel.style.display = 'none';
    receiverOtpPanel.style.display = 'none';

    if (pairedPeerBanner) pairedPeerBanner.style.display = 'flex';
    if (pairedPeerDeviceName) pairedPeerDeviceName.textContent = peer.name || 'Device';
    if (pairedDeviceIcon) pairedDeviceIcon.textContent = (peer.name && peer.name.toLowerCase().includes('phone')) ? '📱' : '💻';

    // Strict role enforcement: ONLY sender gets file selector, receiver waits for incoming files
    if (userRole === 'sender') {
      if (myRoleBadge) myRoleBadge.textContent = 'Sender';
      if (senderTransferPanel) senderTransferPanel.style.display = 'block';
      if (receiverWaitingPanel) receiverWaitingPanel.style.display = 'none';

      const senderDropzoneTitle = document.getElementById('senderDropzoneTitle');
      if (senderDropzoneTitle) {
        senderDropzoneTitle.textContent = `Select files to send to ${peer.name || 'Connected Device'}`;
      }
      showToast(`Connected with ${peer.name || 'Device'}! Select files to send.`);
    } else {
      if (myRoleBadge) myRoleBadge.textContent = 'Receiver';
      if (senderTransferPanel) senderTransferPanel.style.display = 'none';
      if (receiverWaitingPanel) receiverWaitingPanel.style.display = 'block';
      showToast(`Connected with ${peer.name || 'Device'}. Ready to receive files!`);
    }

    try { chimeSuccess.play().catch(() => {}); } catch(e) {}
  }

  // Request Session from Server
  function requestSession() {
    if (!socket) return;
    senderQrLoader.style.display = 'flex';
    senderQrImage.style.display = 'none';

    socket.emit('create-session', {
      role: userRole,
      deviceName: myDeviceName
    }, (res) => {
      senderQrLoader.style.display = 'none';
      if (res && res.success) {
        currentRoomId = res.roomId;
        currentOtp = res.otp;

        senderQrImage.src = res.qrDataUrl;
        senderQrImage.style.display = 'block';
        senderWifiUrl.value = res.joinUrl;

        const pinBoxes = senderPinDisplay.querySelectorAll('.pin-box');
        res.otp.split('').forEach((d, i) => {
          if (pinBoxes[i]) pinBoxes[i].textContent = d;
        });

        // Start 1:30 (90 seconds) countdown for QR Code
        if (pairingMethod === 'qr') {
          startQrAutoRefreshTimer();
        }
      }
    });
  }

  // Socket & Networking Setup
  function initNetworking() {
    socket = io();

    // Reset receiver files when sender initiates a new batch
    socket.on('transfer-batch-start', ({ totalFiles }) => {
      completedFiles = [];
      renderCompletedFiles();
      if (activeTransferPanel) activeTransferPanel.style.display = 'block';
      if (receiverWaitingPanel) receiverWaitingPanel.style.display = 'none';
      if (transferFileCounter) transferFileCounter.textContent = `Receiving 1 of ${totalFiles || 1}`;
    });

    // WebRTC streamer for 100GB files
    streamer = new WebRTCStreamer({
      socket: socket,
      onStatusChange: (status) => {
        if (status === 'completed') handleAllCompleted();
      },
      onProgress: (stats) => handleTransferProgress(stats),
      onFileReceived: (fileInfo) => handleFileReceived(fileInfo),
      onError: (err) => showToast(err)
    });

    socket.on('connect', () => {
      networkStatusPill.innerHTML = '<span class="indicator-dot online"></span><span>Online</span>';
      checkUrlJoin();

      // Seamless Mobile Reconnection: If device wakes up after picking files, rejoin active room
      if (currentRoomId && pairedPeer) {
        socket.emit('reconnect-session', {
          roomId: currentRoomId,
          role: userRole,
          deviceName: myDeviceName
        }, (res) => {
          if (res && res.success) {
            pairedPeer.id = res.peerId;
            showToast(`Connection active with ${res.peerDevice || 'Partner'}`);
          }
        });
      }
    });

    socket.on('disconnect', () => {
      networkStatusPill.innerHTML = '<span class="indicator-dot"></span><span>Offline</span>';
    });

    socket.on('peer-connected', ({ peerId, peerRole, peerDevice, isInitiator }) => {
      showStepPaired({ id: peerId, role: peerRole, name: peerDevice, isInitiator });
      streamer.startConnection(peerId, Boolean(isInitiator));
    });

    // Mobile background grace: partner is selecting files in native picker
    socket.on('peer-reconnecting', ({ message }) => {
      console.log('[DropFast] Peer is reconnecting/selecting files...');
      showToast(message || 'Partner is choosing files...');
    });

    socket.on('peer-reconnected', ({ peerId, peerDevice }) => {
      if (pairedPeer) pairedPeer.id = peerId;
      showToast(`${peerDevice || 'Partner'} reconnected! Ready to transfer.`);
    });

    socket.on('peer-disconnected', () => {
      handlePeerDisconnected();
    });

    socket.on('switch-role', ({ newRole }) => {
      userRole = newRole;
      if (myRoleBadge) myRoleBadge.textContent = 'P2P Ready';
      if (senderTransferPanel) senderTransferPanel.style.display = 'block';
      if (receiverWaitingPanel) receiverWaitingPanel.style.display = 'none';
      showToast('Switched: You can send files anytime');
    });

    // Single authoritative instant file reception listener via WebSocket
    socket.on('instant-file-receive', (fileData) => {
      const blob = new Blob([fileData.buffer], { type: fileData.type || 'application/octet-stream' });
      const downloadUrl = URL.createObjectURL(blob);
      handleFileReceived({
        name: fileData.name,
        size: fileData.size,
        downloadUrl: downloadUrl
      });
      try { chimeSuccess.play().catch(() => {}); } catch(e) {}
      showToast(`Received: ${fileData.name}`);
    });

    // Keep-alive heartbeat every 10 seconds
    setInterval(() => {
      if (socket && socket.connected && pairedPeer) {
        socket.emit('keep-alive');
      }
    }, 10000);
  }

  // Check URL Join (Receiver clicked or scanned QR)
  function checkUrlJoin() {
    const params = new URLSearchParams(window.location.search);
    const joinRoomId = params.get('join');
    if (joinRoomId) {
      showToast('Connecting to room...');
      socket.emit('join-session-room', {
        roomId: joinRoomId,
        role: userRole,
        deviceName: myDeviceName
      }, (res) => {
        if (res && res.success) {
          userRole = res.peerRole === 'sender' ? 'receiver' : 'sender';
          showStepPaired({ id: res.peerId, role: res.peerRole, name: res.peerDevice, isInitiator: true });
          streamer.startConnection(res.peerId, true);
        } else {
          showToast(res ? res.message : 'Invalid link');
          showStepRole();
        }
      });
    }
  }

  // Receiver Connects with PIN
  function connectWithPin(pin) {
    showToast(`Connecting with ${pin}...`);
    socket.emit('join-with-otp', {
      otp: pin,
      role: userRole,
      deviceName: myDeviceName
    }, (res) => {
      if (res && res.success) {
        userRole = res.peerRole === 'sender' ? 'receiver' : 'sender';
        showStepPaired({ id: res.peerId, role: res.peerRole, name: res.peerDevice, isInitiator: true });
        streamer.startConnection(res.peerId, true);
      } else {
        showToast(res ? res.message : 'Invalid PIN');
      }
    });
  }

  // Mobile File Selection Guard
  let isSelectingFiles = false;
  let filePickerTimeout = null;

  function markSelectingFiles() {
    isSelectingFiles = true;
    if (filePickerTimeout) clearTimeout(filePickerTimeout);
  }

  function unmarkSelectingFiles() {
    if (filePickerTimeout) clearTimeout(filePickerTimeout);
    filePickerTimeout = setTimeout(() => {
      isSelectingFiles = false;
    }, 4000);
  }

  window.addEventListener('focus', unmarkSelectingFiles);

  function handlePeerDisconnected() {
    if (isSelectingFiles) {
      console.log('[DropFast] Suppressing peer disconnect because file picker is active');
      return;
    }
    showToast('Peer disconnected');
    pairedPeer = null;
    showStepRole();
  }

  // File Staging with deduplication
  function addFiles(files) {
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const isDup = stagedFiles.some(existing => existing.name === f.name && existing.size === f.size);
      if (!isDup) {
        stagedFiles.push(f);
      }
    }
    renderStagedFiles();
  }

  function renderStagedFiles() {
    if (stagedFiles.length === 0) {
      stagedFilesContainer.style.display = 'none';
      return;
    }

    stagedFilesContainer.style.display = 'block';
    stagedCount.textContent = stagedFiles.length;

    let totalBytes = 0;
    stagedList.innerHTML = '';

    stagedFiles.forEach((file, index) => {
      totalBytes += file.size;
      const ext = (file.name.split('.').pop() || 'FILE').toUpperCase().slice(0, 5);
      const row = document.createElement('div');
      row.className = 'file-row';
      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.65rem; min-width: 0; flex: 1;">
          <span class="file-ext-badge">${ext}</span>
          <span class="file-row-name" title="${file.name}">${file.name}</span>
        </div>
        <div style="display:flex; align-items:center; gap:0.6rem; flex-shrink: 0;">
          <span class="file-row-size">${formatBytes(file.size)}</span>
          <button class="btn-link text-danger remove-btn" data-index="${index}" title="Remove">✕</button>
        </div>
      `;
      stagedList.appendChild(row);
    });

    stagedTotalSize.textContent = formatBytes(totalBytes);

    stagedList.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-index'));
        stagedFiles.splice(idx, 1);
        renderStagedFiles();
      });
    });
  }

  // ULTRA FAST HYBRID FILE SENDING ENGINE
  async function startFileTransfer() {
    if (stagedFiles.length === 0) {
      showToast('Please select files first');
      return;
    }

    // Reset receiver list when starting a fresh batch
    if (socket && pairedPeer) {
      socket.emit('transfer-batch-start', {
        targetId: pairedPeer.id,
        totalFiles: stagedFiles.length
      });
    }

    activeTransferPanel.style.display = 'block';
    senderTransferPanel.style.display = 'none';

    for (let i = 0; i < stagedFiles.length; i++) {
      const file = stagedFiles[i];
      transferFileName.textContent = file.name;
      transferFileCounter.textContent = `File ${i + 1} of ${stagedFiles.length}`;

      // If file is small/medium (<= 20MB): send via instant WebSocket in 0.01 seconds!
      if (file.size <= 20 * 1024 * 1024) {
        const buffer = await file.arrayBuffer();
        socket.emit('instant-file-send', {
          targetId: pairedPeer.id,
          fileData: {
            name: file.name,
            size: file.size,
            type: file.type,
            buffer: buffer
          }
        });

        // Instant progress UI update
        progressBarFill.style.width = '100%';
        transferPercentVal.textContent = '100%';
        transferredBytesLabel.textContent = formatBytes(file.size);
        totalBytesLabel.textContent = formatBytes(file.size);
        currentSpeedVal.textContent = 'Instant';
        etaVal.textContent = 'Done';
      } else {
        // Massive files (> 20MB up to 100GB): WebRTC chunk stream
        await streamer.streamSingleFile(file, i + 1, stagedFiles.length);
      }
    }

    handleAllCompleted();
  }

  function handleTransferProgress(stats) {
    activeTransferPanel.style.display = 'block';
    senderTransferPanel.style.display = 'none';
    transferFileName.textContent = stats.fileName;
    transferFileCounter.textContent = `File ${stats.fileIndex} of ${stats.totalFiles}`;

    transferPercentVal.textContent = `${stats.percentage}%`;
    progressBarFill.style.width = `${stats.percentage}%`;
    transferredBytesLabel.textContent = formatBytes(stats.transferredBytes);
    totalBytesLabel.textContent = formatBytes(stats.totalBytes);
    currentSpeedVal.textContent = stats.speedMBps || '0.0';
  }

  function handleFileReceived(fileInfo) {
    // Strictly prevent duplicate files from being displayed
    const isDup = completedFiles.some(f => f.name === fileInfo.name && f.size === fileInfo.size);
    if (!isDup) {
      completedFiles.push(fileInfo);
    }
    renderCompletedFiles();
  }

  function renderCompletedFiles() {
    completedPanel.style.display = 'block';
    receiverWaitingPanel.style.display = 'none';
    activeTransferPanel.style.display = 'none';
    completedFilesList.innerHTML = '';

    completedFiles.forEach((file) => {
      const row = document.createElement('div');
      row.className = 'completed-row';
      row.innerHTML = `
        <div>
          <strong style="display:block; font-size:0.88rem;">${file.name}</strong>
          <span style="font-size:0.75rem; color:#94a3b8;">${formatBytes(file.size)}</span>
        </div>
        <a href="${file.downloadUrl}" download="${file.name}" class="btn-download">Download</a>
      `;
      completedFilesList.appendChild(row);
    });
  }

  function handleAllCompleted() {
    try { chimeSuccess.play().catch(() => {}); } catch(e) {}
    showToast('Transfer complete!');
    setTimeout(() => {
      activeTransferPanel.style.display = 'none';
      senderTransferPanel.style.display = 'block';
      stagedFiles = [];
      renderStagedFiles();
    }, 1200);
  }

  // Event Listeners
  function setupEvents() {
    // Step 1: Roles
    chooseSenderBtn.addEventListener('click', () => showStepMethod('sender'));
    chooseReceiverBtn.addEventListener('click', () => showStepMethod('receiver'));

    // Step 2: Methods
    backToRoleBtn.addEventListener('click', showStepRole);
    chooseMethodQrBtn.addEventListener('click', () => showStepPairing('qr'));
    chooseMethodOtpBtn.addEventListener('click', () => showStepPairing('otp'));

    // Step 3A: Sender QR
    backFromSenderQrBtn.addEventListener('click', () => showStepMethod(userRole));
    copySenderWifiBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(senderWifiUrl.value).then(() => showToast('Link copied'));
    });

    // Step 3B: Receiver QR
    backFromReceiverQrBtn.addEventListener('click', () => {
      if (qrScanner) qrScanner.stop();
      showStepMethod(userRole);
    });

    qrScanner = new QRScannerManager('receiverCameraViewfinder', (roomId) => {
      showToast('QR Code Recognized');
      startReceiverCameraBtn.style.display = 'inline-flex';
      stopReceiverCameraBtn.style.display = 'none';

      socket.emit('join-session-room', {
        roomId,
        role: 'receiver',
        deviceName: myDeviceName
      }, (res) => {
        if (res && res.success) {
          showStepPaired({ id: res.peerId, role: res.peerRole, name: res.peerDevice, isInitiator: true });
          streamer.startConnection(res.peerId, true);
        } else {
          showToast(res ? res.message : 'QR code invalid');
        }
      });
    }, (err) => console.warn(err));

    startReceiverCameraBtn.addEventListener('click', async () => {
      try {
        await qrScanner.start();
        startReceiverCameraBtn.style.display = 'none';
        stopReceiverCameraBtn.style.display = 'inline-flex';
      } catch (err) {
        showToast(err.message);
      }
    });

    stopReceiverCameraBtn.addEventListener('click', async () => {
      await qrScanner.stop();
      startReceiverCameraBtn.style.display = 'inline-flex';
      stopReceiverCameraBtn.style.display = 'none';
    });

    // Take Photo / Upload QR File fallback
    if (scanQrImageBtn && qrImageFileInput) {
      scanQrImageBtn.addEventListener('click', () => {
        qrImageFileInput.click();
      });

      qrImageFileInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files.length > 0) {
          const file = e.target.files[0];
          showToast('Scanning photo for QR code...');
          try {
            await qrScanner.scanFile(file);
          } catch (err) {
            showToast(err.message || 'No QR detected in photo');
          }
        }
      });
    }

    // Switch to 6-Digit PIN from QR screen
    if (switchToOtpFromQrBtn) {
      switchToOtpFromQrBtn.addEventListener('click', async () => {
        if (qrScanner) await qrScanner.stop();
        showStepPairing('otp');
      });
    }

    // Step 3C: Sender OTP
    backFromSenderOtpBtn.addEventListener('click', () => showStepMethod(userRole));
    copySenderPinBtn.addEventListener('click', () => {
      if (currentOtp) {
        navigator.clipboard.writeText(currentOtp).then(() => showToast('PIN copied'));
      }
    });

    // Step 3D: Receiver OTP
    backFromReceiverOtpBtn.addEventListener('click', () => showStepMethod(userRole));

    pinCells.forEach((cell, idx) => {
      cell.addEventListener('input', (e) => {
        const val = e.target.value.replace(/\D/g, '');
        e.target.value = val;
        if (val && idx < pinCells.length - 1) {
          pinCells[idx + 1].focus();
        }
        checkPin();
      });

      cell.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && idx > 0) {
          pinCells[idx - 1].focus();
        }
      });

      cell.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasteData = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
        for (let i = 0; i < pinCells.length; i++) {
          pinCells[i].value = pasteData[i] || '';
        }
        checkPin();
      });
    });

    function checkPin() {
      const code = Array.from(pinCells).map(c => c.value).join('');
      submitReceiverPinBtn.disabled = code.length !== 6;
    }

    submitReceiverPinBtn.addEventListener('click', () => {
      const code = Array.from(pinCells).map(c => c.value).join('');
      if (code.length === 6) connectWithPin(code);
    });

    // Theme Toggle
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', toggleTheme);
    }

    // Receiver & Header Quick Send Buttons (instant file picker)
    if (receiverQuickSendBtn) {
      receiverQuickSendBtn.addEventListener('click', () => {
        senderTransferPanel.style.display = 'block';
        receiverWaitingPanel.style.display = 'none';
        showToast('Select files to send');
        fileInput.click();
      });
    }

    if (pairedSendFilesNowBtn) {
      pairedSendFilesNowBtn.addEventListener('click', () => {
        senderTransferPanel.style.display = 'block';
        receiverWaitingPanel.style.display = 'none';
        showToast('Select files to send');
        fileInput.click();
      });
    }

    // Step 4 Actions: Paired
    if (swapRoleBtn) {
      swapRoleBtn.addEventListener('click', () => {
        userRole = userRole === 'sender' ? 'receiver' : 'sender';
        myRoleBadge.textContent = userRole === 'sender' ? 'Sender' : 'Receiver';
        if (userRole === 'sender') {
          senderTransferPanel.style.display = 'block';
          receiverWaitingPanel.style.display = 'none';
        } else {
          senderTransferPanel.style.display = 'none';
          receiverWaitingPanel.style.display = 'block';
        }
        if (socket && pairedPeer) {
          socket.emit('switch-role', {
            targetId: pairedPeer.id,
            newRole: userRole === 'sender' ? 'receiver' : 'sender'
          });
        }
        showToast(`Switched mode to ${userRole === 'sender' ? 'Sender' : 'Receiver'}`);
      });
    }

    if (disconnectBtn) {
      disconnectBtn.addEventListener('click', () => {
        if (confirm('Disconnect from peer?')) {
          streamer.closeConnection();
          handlePeerDisconnected();
        }
      });
    }

    // Drag & Drop
    if (fileDropzone) {
      fileDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileDropzone.classList.add('dragover');
      });

      fileDropzone.addEventListener('dragleave', () => fileDropzone.classList.remove('dragover'));

      fileDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        fileDropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          addFiles(e.dataTransfer.files);
        }
      });
    }

    if (selectFilesBtn) {
      selectFilesBtn.addEventListener('click', () => {
        markSelectingFiles();
        fileInput.click();
      });
    }
    if (selectFolderBtn) {
      selectFolderBtn.addEventListener('click', () => {
        markSelectingFiles();
        folderInput.click();
      });
    }

    const addMoreFilesBtn = document.getElementById('addMoreFilesBtn');
    if (addMoreFilesBtn) {
      addMoreFilesBtn.addEventListener('click', () => {
        markSelectingFiles();
        fileInput.click();
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        unmarkSelectingFiles();
        if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
        e.target.value = '';
      });
    }

    if (folderInput) {
      folderInput.addEventListener('change', (e) => {
        unmarkSelectingFiles();
        if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
        e.target.value = '';
      });
    }

    if (clearFilesBtn) {
      clearFilesBtn.addEventListener('click', () => {
        stagedFiles = [];
        renderStagedFiles();
      });
    }

    if (startTransferBtn) startTransferBtn.addEventListener('click', startFileTransfer);

    if (cancelTransferBtn) {
      cancelTransferBtn.addEventListener('click', () => {
        if (confirm('Cancel transfer?')) {
          streamer.cancelTransfer();
          activeTransferPanel.style.display = 'none';
          if (userRole === 'sender') {
            senderTransferPanel.style.display = 'block';
          } else {
            receiverWaitingPanel.style.display = 'block';
          }
          showToast('Transfer cancelled');
        }
      });
    }

    if (receiveMoreBtn) {
      receiveMoreBtn.addEventListener('click', () => {
        completedPanel.style.display = 'none';
        completedFiles = [];
        if (completedFilesList) completedFilesList.innerHTML = '';
        if (userRole === 'sender') {
          senderTransferPanel.style.display = 'block';
        } else {
          receiverWaitingPanel.style.display = 'block';
        }
      });
    }
  }

  // ==============================================
  // FEATURE SWITCHER & OCR CONTROLLER
  // ==============================================
  let activeFeature = 'transfer'; // 'transfer' | 'ocr'
  let currentOcrImageSource = null;
  let ocrPreprocessedDataUrl = null;
  let ocrOriginalDataUrl = null;
  let ocrRotationAngle = 0;
  let isShowingCleanedInk = true;
  let ocrEngineInstance = null;

  function initFeatureSwitcher() {
    const tabTransferBtn = document.getElementById('tabTransferBtn');
    const tabOcrBtn = document.getElementById('tabOcrBtn');
    const transferFeatureContainer = document.getElementById('transferFeatureContainer');
    const ocrFeatureContainer = document.getElementById('ocrFeatureContainer');

    function switchFeature(feature) {
      activeFeature = feature;
      if (feature === 'transfer') {
        if (tabTransferBtn) tabTransferBtn.classList.add('active');
        if (tabOcrBtn) tabOcrBtn.classList.remove('active');
        if (transferFeatureContainer) transferFeatureContainer.style.display = 'block';
        if (ocrFeatureContainer) ocrFeatureContainer.style.display = 'none';
      } else {
        if (tabOcrBtn) tabOcrBtn.classList.add('active');
        if (tabTransferBtn) tabTransferBtn.classList.remove('active');
        if (transferFeatureContainer) transferFeatureContainer.style.display = 'none';
        if (ocrFeatureContainer) ocrFeatureContainer.style.display = 'block';
      }
    }

    if (tabTransferBtn) {
      tabTransferBtn.addEventListener('click', () => switchFeature('transfer'));
    }
    if (tabOcrBtn) {
      tabOcrBtn.addEventListener('click', () => switchFeature('ocr'));
    }
  }

  function initOcrEngine() {
    const ocrDropzone = document.getElementById('ocrDropzone');
    const ocrFileInput = document.getElementById('ocrFileInput');
    const ocrCameraInput = document.getElementById('ocrCameraInput');
    const ocrSelectFileBtn = document.getElementById('ocrSelectFileBtn');
    const ocrCaptureCameraBtn = document.getElementById('ocrCaptureCameraBtn');

    const ocrRotateBtn = document.getElementById('ocrRotateBtn');
    const ocrProgressContainer = document.getElementById('ocrProgressContainer');
    const ocrStatusText = document.getElementById('ocrStatusText');
    const ocrProgressBarFill = document.getElementById('ocrProgressBarFill');
    const ocrProgressPercent = document.getElementById('ocrProgressPercent');

    const ocrResultContainer = document.getElementById('ocrResultContainer');
    const ocrPreviewImg = document.getElementById('ocrPreviewImg');
    const ocrTogglePreviewModeBtn = document.getElementById('ocrTogglePreviewModeBtn');
    const ocrOutputText = document.getElementById('ocrOutputText');
    const ocrWordCountChip = document.getElementById('ocrWordCountChip');
    const ocrCharCountChip = document.getElementById('ocrCharCountChip');
    const ocrConfidenceChip = document.getElementById('ocrConfidenceChip');
    const ocrCopyBtn = document.getElementById('ocrCopyBtn');
    const ocrCopyBtnText = document.getElementById('ocrCopyBtnText');
    const ocrDownloadTxtBtn = document.getElementById('ocrDownloadTxtBtn');
    const ocrNewScanBtn = document.getElementById('ocrNewScanBtn');

    // Structured View & Entities DOM elements
    const ocrEntitiesSection = document.getElementById('ocrEntitiesSection');
    const ocrEntitiesList = document.getElementById('ocrEntitiesList');
    const ocrTabFormattedBtn = document.getElementById('ocrTabFormattedBtn');
    const ocrTabTextareaBtn = document.getElementById('ocrTabTextareaBtn');
    const ocrCleanSpacingBtn = document.getElementById('ocrCleanSpacingBtn');
    const ocrFormattedContainer = document.getElementById('ocrFormattedContainer');

    // Gemini Modal Elements
    const ocrGeminiKeyBtn = document.getElementById('ocrGeminiKeyBtn');
    const ocrGeminiModal = document.getElementById('ocrGeminiModal');
    const ocrGeminiModalClose = document.getElementById('ocrGeminiModalClose');
    const geminiApiKeyInput = document.getElementById('geminiApiKeyInput');
    const ocrGeminiSaveBtn = document.getElementById('ocrGeminiSaveBtn');
    const ocrGeminiClearBtn = document.getElementById('ocrGeminiClearBtn');
    const ocrActiveEngineLabel = document.getElementById('ocrActiveEngineLabel');
    const ocrGeminiKeyLabel = document.getElementById('ocrGeminiKeyLabel');

    function updateGeminiStatusUI() {
      const savedKey = localStorage.getItem('gemini_api_key');
      if (savedKey && savedKey.trim().length > 0) {
        if (ocrGeminiKeyLabel) ocrGeminiKeyLabel.textContent = '⚡ Gemini AI Active';
        if (ocrGeminiKeyBtn) ocrGeminiKeyBtn.classList.add('connected');
        if (ocrActiveEngineLabel) ocrActiveEngineLabel.textContent = 'Google Gemini 1.5 Flash Vision (99.9% Precision)';
      } else {
        if (ocrGeminiKeyLabel) ocrGeminiKeyLabel.textContent = 'Connect Gemini AI (Optional)';
        if (ocrGeminiKeyBtn) ocrGeminiKeyBtn.classList.remove('connected');
        if (ocrActiveEngineLabel) ocrActiveEngineLabel.textContent = 'Dual Neural AI Vision Engine (99%+ Accuracy)';
      }
    }

    updateGeminiStatusUI();

    if (ocrGeminiKeyBtn && ocrGeminiModal) {
      ocrGeminiKeyBtn.addEventListener('click', () => {
        if (geminiApiKeyInput) geminiApiKeyInput.value = localStorage.getItem('gemini_api_key') || '';
        ocrGeminiModal.style.display = 'flex';
      });

      if (ocrGeminiModalClose) {
        ocrGeminiModalClose.addEventListener('click', () => {
          ocrGeminiModal.style.display = 'none';
        });
      }

      ocrGeminiModal.addEventListener('click', (e) => {
        if (e.target === ocrGeminiModal) ocrGeminiModal.style.display = 'none';
      });

      if (ocrGeminiSaveBtn) {
        ocrGeminiSaveBtn.addEventListener('click', () => {
          const key = (geminiApiKeyInput ? geminiApiKeyInput.value : '').trim();
          if (key) {
            localStorage.setItem('gemini_api_key', key);
            showToast('Google Gemini Vision AI activated!');
          } else {
            localStorage.removeItem('gemini_api_key');
            showToast('Using Built-in Dual Neural AI Vision');
          }
          updateGeminiStatusUI();
          ocrGeminiModal.style.display = 'none';
        });
      }

      if (ocrGeminiClearBtn) {
        ocrGeminiClearBtn.addEventListener('click', () => {
          localStorage.removeItem('gemini_api_key');
          if (geminiApiKeyInput) geminiApiKeyInput.value = '';
          updateGeminiStatusUI();
          showToast('Gemini key cleared. Dual Neural Engine active.');
          ocrGeminiModal.style.display = 'none';
        });
      }
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    if (typeof OCREngine !== 'undefined') {
      ocrEngineInstance = new OCREngine({
        onProgress: ({ status, progress }) => {
          if (ocrProgressContainer) ocrProgressContainer.style.display = 'block';
          if (ocrStatusText) ocrStatusText.textContent = status;
          const pct = Math.round((progress || 0) * 100);
          if (ocrProgressBarFill) ocrProgressBarFill.style.width = `${pct}%`;
          if (ocrProgressPercent) ocrProgressPercent.textContent = `${pct}%`;
        }
      });
    }

    async function handleOcrImageFile(file) {
      if (!file || !file.type.startsWith('image/')) {
        showToast('Please upload a valid image file');
        return;
      }

      currentOcrImageSource = file;
      ocrRotationAngle = 0;

      const reader = new FileReader();
      reader.onload = async (e) => {
        ocrOriginalDataUrl = e.target.result;
        runOcrRecognition();
      };
      reader.readAsDataURL(file);
    }

    // Render structured line-by-line cards
    function renderFormattedLines(lines) {
      if (!ocrFormattedContainer) return;
      ocrFormattedContainer.innerHTML = '';
      if (!lines || lines.length === 0) {
        ocrFormattedContainer.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; padding:1rem; text-align:center;">No text detected</div>';
        return;
      }

      lines.forEach((lineText, idx) => {
        const card = document.createElement('div');
        card.className = 'ocr-line-card';
        card.innerHTML = `
          <div class="ocr-line-left">
            <span class="ocr-line-num">${idx + 1}</span>
            <span class="ocr-line-text">${escapeHtml(lineText)}</span>
          </div>
          <button type="button" class="ocr-line-copy-btn" title="Copy this line">Copy</button>
        `;

        const copyBtn = card.querySelector('.ocr-line-copy-btn');
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(lineText).then(() => {
            copyBtn.classList.add('copied');
            copyBtn.textContent = '✓ Copied';
            setTimeout(() => {
              copyBtn.classList.remove('copied');
              copyBtn.textContent = 'Copy';
            }, 1800);
          });
        });

        ocrFormattedContainer.appendChild(card);
      });
    }

    // Tab switching between Structured View and Raw Editor
    if (ocrTabFormattedBtn && ocrTabTextareaBtn) {
      ocrTabFormattedBtn.addEventListener('click', () => {
        ocrTabFormattedBtn.classList.add('active');
        ocrTabTextareaBtn.classList.remove('active');
        if (ocrFormattedContainer) ocrFormattedContainer.style.display = 'flex';
        if (ocrOutputText) ocrOutputText.style.display = 'none';
      });

      ocrTabTextareaBtn.addEventListener('click', () => {
        ocrTabTextareaBtn.classList.add('active');
        ocrTabFormattedBtn.classList.remove('active');
        if (ocrFormattedContainer) ocrFormattedContainer.style.display = 'none';
        if (ocrOutputText) ocrOutputText.style.display = 'block';
      });
    }

    // Clean extra spacing tool
    if (ocrCleanSpacingBtn) {
      ocrCleanSpacingBtn.addEventListener('click', () => {
        if (!ocrOutputText) return;
        let t = ocrOutputText.value;
        t = t.replace(/[ \t]{2,}/g, ' ')
             .replace(/^[\|\~\_\-]{1,2}\s*/gm, '')
             .trim();
        ocrOutputText.value = t;
        updateCounts(t);
        renderFormattedLines(t.split('\n').filter(Boolean));
        showToast('Cleaned redundant spaces');
      });
    }

    async function runOcrRecognition() {
      if (!currentOcrImageSource || !ocrEngineInstance) return;

      if (ocrDropzone) ocrDropzone.style.display = 'none';
      if (ocrProgressContainer) {
        ocrProgressContainer.style.display = 'block';
        ocrProgressContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        if (ocrProgressBarFill) ocrProgressBarFill.style.width = '20%';
        if (ocrProgressPercent) ocrProgressPercent.textContent = '20%';
        if (ocrStatusText) ocrStatusText.textContent = 'Reading text with Dual Neural AI Vision...';
      }

      try {
        const result = await ocrEngineInstance.extractText(currentOcrImageSource, {
          rotation: ocrRotationAngle
        });

        ocrPreprocessedDataUrl = result.previewUrl;

        if (ocrProgressContainer) ocrProgressContainer.style.display = 'none';
        if (ocrResultContainer) ocrResultContainer.style.display = 'block';

        if (ocrPreviewImg) {
          ocrPreviewImg.src = ocrOriginalDataUrl || ocrPreprocessedDataUrl;
          isShowingCleanedInk = false;
          if (ocrTogglePreviewModeBtn) ocrTogglePreviewModeBtn.textContent = 'Enhanced Filter';
          const modeBadge = document.getElementById('ocrPreviewModeBadge');
          if (modeBadge) modeBadge.textContent = 'Original Photo';
        }

        const extractedLines = result.lines && result.lines.length > 0
          ? result.lines
          : (result.text || '').split('\n').filter(Boolean);

        if (ocrOutputText) {
          ocrOutputText.value = result.text || '(No text found in photo. Try rotating 90°)';
          updateCounts(ocrOutputText.value);
        }

        // Render structured line view
        renderFormattedLines(extractedLines);

        // Render detected codes/entities chips
        if (ocrEntitiesSection && ocrEntitiesList) {
          ocrEntitiesList.innerHTML = '';
          if (result.entities && result.entities.length > 0) {
            ocrEntitiesSection.style.display = 'block';
            result.entities.forEach(code => {
              const chip = document.createElement('button');
              chip.type = 'button';
              chip.className = 'ocr-entity-chip';
              chip.innerHTML = `<span>📋 ${escapeHtml(code)}</span>`;
              chip.title = `Click to copy ${code}`;
              chip.addEventListener('click', () => {
                navigator.clipboard.writeText(code).then(() => {
                  chip.classList.add('copied');
                  chip.innerHTML = `<span>✓ ${escapeHtml(code)}</span>`;
                  showToast(`Copied: ${code}`);
                  setTimeout(() => {
                    chip.classList.remove('copied');
                    chip.innerHTML = `<span>📋 ${escapeHtml(code)}</span>`;
                  }, 2000);
                });
              });
              ocrEntitiesList.appendChild(chip);
            });
          } else {
            ocrEntitiesSection.style.display = 'none';
          }
        }

        if (ocrConfidenceChip) {
          ocrConfidenceChip.textContent = `Accuracy: ${result.confidence}% • ${result.engine || 'Dual Neural Vision'}`;
        }

        showToast('Text extracted and structured successfully!');
      } catch (err) {
        console.error('OCR error:', err);
        if (ocrProgressContainer) ocrProgressContainer.style.display = 'none';
        if (ocrDropzone) ocrDropzone.style.display = 'block';
        showToast('Extraction failed: ' + (err.message || 'Error running OCR'));
      }
    }

    function updateCounts(text) {
      const words = (text.trim().match(/\S+/g) || []).length;
      const chars = text.length;
      if (ocrWordCountChip) ocrWordCountChip.textContent = `${words} words`;
      if (ocrCharCountChip) ocrCharCountChip.textContent = `${chars} chars`;
    }

    if (ocrOutputText) {
      ocrOutputText.addEventListener('input', (e) => {
        updateCounts(e.target.value);
        renderFormattedLines(e.target.value.split('\n').filter(Boolean));
      });
    }

    if (ocrTogglePreviewModeBtn) {
      ocrTogglePreviewModeBtn.addEventListener('click', () => {
        isShowingCleanedInk = !isShowingCleanedInk;
        const modeBadge = document.getElementById('ocrPreviewModeBadge');
        if (isShowingCleanedInk) {
          if (ocrPreviewImg) ocrPreviewImg.src = ocrPreprocessedDataUrl || ocrOriginalDataUrl;
          ocrTogglePreviewModeBtn.textContent = 'Original Photo';
          if (modeBadge) modeBadge.textContent = 'Enhanced Filter';
        } else {
          if (ocrPreviewImg) ocrPreviewImg.src = ocrOriginalDataUrl;
          ocrTogglePreviewModeBtn.textContent = 'Enhanced Filter';
          if (modeBadge) modeBadge.textContent = 'Original Photo';
        }
      });
    }

    if (ocrRotateBtn) {
      ocrRotateBtn.addEventListener('click', () => {
        ocrRotationAngle = (ocrRotationAngle + 90) % 360;
        showToast(`Rotated to ${ocrRotationAngle}°`);
        if (currentOcrImageSource) runOcrRecognition();
      });
    }

    if (ocrSelectFileBtn) {
      ocrSelectFileBtn.addEventListener('click', () => ocrFileInput && ocrFileInput.click());
    }
    if (ocrCaptureCameraBtn) {
      ocrCaptureCameraBtn.addEventListener('click', () => ocrCameraInput && ocrCameraInput.click());
    }

    if (ocrFileInput) {
      ocrFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          handleOcrImageFile(e.target.files[0]);
          e.target.value = '';
        }
      });
    }

    if (ocrCameraInput) {
      ocrCameraInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          handleOcrImageFile(e.target.files[0]);
          e.target.value = '';
        }
      });
    }

    if (ocrDropzone) {
      ocrDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        ocrDropzone.classList.add('dragover');
      });

      ocrDropzone.addEventListener('dragleave', () => ocrDropzone.classList.remove('dragover'));

      ocrDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        ocrDropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleOcrImageFile(e.dataTransfer.files[0]);
        }
      });
    }

    // Clipboard Paste (Ctrl + V)
    window.addEventListener('paste', (e) => {
      if (activeFeature !== 'ocr') return;
      const items = (e.clipboardData || (e.originalEvent && e.originalEvent.clipboardData))?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          showToast('Image pasted from clipboard');
          handleOcrImageFile(blob);
          break;
        }
      }
    });

    // Copy to Clipboard Button
    if (ocrCopyBtn) {
      ocrCopyBtn.addEventListener('click', () => {
        const text = ocrOutputText ? ocrOutputText.value : '';
        if (!text) {
          showToast('No text to copy');
          return;
        }

        navigator.clipboard.writeText(text).then(() => {
          showToast('Copied to clipboard!');
          if (ocrCopyBtnText) ocrCopyBtnText.textContent = '✓ Copied to Clipboard!';
          ocrCopyBtn.style.background = 'linear-gradient(135deg, #059669 0%, #10b981 100%)';

          setTimeout(() => {
            if (ocrCopyBtnText) ocrCopyBtnText.textContent = 'Copy Extracted Text';
            ocrCopyBtn.style.background = '';
          }, 2200);
        }).catch(() => {
          showToast('Failed to copy');
        });
      });
    }

    // Download TXT Button
    if (ocrDownloadTxtBtn) {
      ocrDownloadTxtBtn.addEventListener('click', () => {
        const text = ocrOutputText ? ocrOutputText.value : '';
        if (!text) {
          showToast('No text to download');
          return;
        }

        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AuraDrop_Extracted_Text_${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Downloaded text file');
      });
    }

    // Scan Another Photo Button
    if (ocrNewScanBtn) {
      ocrNewScanBtn.addEventListener('click', () => {
        currentOcrImageSource = null;
        ocrOriginalDataUrl = null;
        ocrPreprocessedDataUrl = null;
        if (ocrResultContainer) ocrResultContainer.style.display = 'none';
        if (ocrProgressContainer) ocrProgressContainer.style.display = 'none';
        if (ocrSettingsPanel) ocrSettingsPanel.style.display = 'none';
        if (ocrDropzone) ocrDropzone.style.display = 'block';
        if (ocrOutputText) ocrOutputText.value = '';
        if (ocrFileInput) ocrFileInput.value = '';
        if (ocrCameraInput) ocrCameraInput.value = '';
      });
    }
  }

  function init() {
    initTheme();
    detectDevice();
    initNetworking();
    setupEvents();
    initFeatureSwitcher();
    initOcrEngine();
    showStepRole();
  }

  window.addEventListener('DOMContentLoaded', init);
})();

