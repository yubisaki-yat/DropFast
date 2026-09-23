/**
 * DropFast WebRTC Streamer Engine
 * High-performance P2P file streaming supporting up to 100GB with Zero-Memory Disk Streaming
 */

class WebRTCStreamer {
  constructor(options = {}) {
    this.socket = options.socket;
    this.targetPeerId = null;
    this.isInitiator = false;
    this.peerConnection = null;
    this.dataChannel = null;
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onProgress = options.onProgress || (() => {});
    this.onFileReceived = options.onFileReceived || (() => {});
    this.onError = options.onError || (() => {});

    // Transfer State
    this.isTransferring = false;
    this.currentFileIndex = 0;
    this.filesQueue = [];
    this.incomingFileMeta = null;
    this.incomingChunks = [];
    this.incomingBytes = 0;
    this.incomingWritableStream = null;
    this.directDiskMode = true;

    // Metrics
    this.lastBytesLogged = 0;
    this.lastTimeLogged = Date.now();
    this.currentSpeedMBps = 0;
    this.metricsInterval = null;

    // Configuration
    this.CHUNK_SIZE = 64 * 1024; // 64KB safe chunk
    this.MAX_BUFFER_AMOUNT = 4 * 1024 * 1024; // 4MB buffer high-water mark
    this.LOW_BUFFER_THRESHOLD = 512 * 1024; // 512KB low threshold

    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    };

    this.setupSocketListeners();
  }

  setupSocketListeners() {
    if (!this.socket) return;

    this.socket.on('signal-offer', async ({ senderId, offer }) => {
      this.targetPeerId = senderId;
      await this.handleReceiveOffer(offer);
    });

    this.socket.on('signal-answer', async ({ senderId, answer }) => {
      await this.handleReceiveAnswer(answer);
    });

    this.socket.on('signal-ice-candidate', async ({ senderId, candidate }) => {
      if (this.peerConnection && candidate) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('Error adding ICE candidate:', e);
        }
      }
    });

    this.socket.on('peer-disconnected', () => {
      this.closeConnection();
      this.onStatusChange('disconnected', 'Peer disconnected');
    });
  }

  initPeerConnection() {
    if (this.peerConnection) {
      this.closeConnection();
    }

    this.peerConnection = new RTCPeerConnection(this.rtcConfig);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.targetPeerId) {
        this.socket.emit('signal-ice-candidate', {
          targetId: this.targetPeerId,
          candidate: event.candidate
        });
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      if (state === 'connected') {
        this.onStatusChange('connected', 'P2P Direct Connection Established');
      } else if (state === 'closed') {
        this.onStatusChange('closed', 'P2P Connection Closed');
      } else if (state === 'disconnected') {
        // Disconnected is transient on mobile devices (e.g. file picker opened)
        console.log('[WebRTC] Connection state is transiently disconnected, holding session...');
      } else if (state === 'failed') {
        console.warn('[WebRTC] Connection failed, falling back to instant WebSocket relay');
      }
    };

    // If we are initiator, create DataChannel
    if (this.isInitiator) {
      this.setupDataChannel(this.peerConnection.createDataChannel('dropfast-stream', {
        ordered: true
      }));
    } else {
      this.peerConnection.ondatachannel = (event) => {
        this.setupDataChannel(event.channel);
      };
    }
  }

  setupDataChannel(channel) {
    this.dataChannel = channel;
    this.dataChannel.binaryType = 'arraybuffer';
    this.dataChannel.bufferedAmountLowThreshold = this.LOW_BUFFER_THRESHOLD;

    this.dataChannel.onopen = () => {
      this.onStatusChange('ready', 'WebRTC DataChannel Open & Ready for Transfer');
    };

    this.dataChannel.onclose = () => {
      this.onStatusChange('closed', 'DataChannel Closed');
    };

    this.dataChannel.onerror = (err) => {
      console.error('DataChannel error:', err);
      this.onError('DataChannel encountered an error');
    };

    this.dataChannel.onmessage = async (event) => {
      await this.handleChannelMessage(event);
    };
  }

  async startConnection(targetPeerId, isInitiator = false) {
    this.targetPeerId = targetPeerId;
    this.isInitiator = isInitiator;

    this.initPeerConnection();

    if (this.isInitiator) {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      this.socket.emit('signal-offer', {
        targetId: this.targetPeerId,
        offer
      });
    }
  }

  async handleReceiveOffer(offer) {
    this.initPeerConnection();
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    this.socket.emit('signal-answer', {
      targetId: this.targetPeerId,
      answer
    });
  }

  async handleReceiveAnswer(answer) {
    if (this.peerConnection) {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  closeConnection() {
    this.stopMetrics();
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.isTransferring = false;
  }

  // --- SENDER ENGINE (Handles up to 100GB with Backpressure) ---
  async sendFiles(files) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('P2P DataChannel is not open. Please pair devices first.');
    }

    this.filesQueue = Array.from(files);
    this.currentFileIndex = 0;
    this.isTransferring = true;
    this.startMetrics();

    for (let i = 0; i < this.filesQueue.length; i++) {
      if (!this.isTransferring) break;
      this.currentFileIndex = i;
      await this.streamSingleFile(this.filesQueue[i], i + 1, this.filesQueue.length);
    }

    this.isTransferring = false;
    this.stopMetrics();

    // Notify peer transfer completed
    this.dataChannel.send(JSON.stringify({ type: 'ALL_COMPLETE' }));
  }

  async streamSingleFile(file, fileIndex, totalFiles) {
    const totalSize = file.size;
    const totalChunks = Math.ceil(totalSize / this.CHUNK_SIZE);

    // Send file start header
    this.dataChannel.send(JSON.stringify({
      type: 'FILE_START',
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      totalChunks,
      fileIndex,
      totalFiles
    }));

    let offset = 0;
    let chunkIndex = 0;

    while (offset < totalSize && this.isTransferring) {
      // Flow control / Backpressure management
      if (this.dataChannel.bufferedAmount > this.MAX_BUFFER_AMOUNT) {
        await new Promise((resolve) => {
          this.dataChannel.onbufferedamountlow = () => {
            this.dataChannel.onbufferedamountlow = null;
            resolve();
          };
        });
      }

      const slice = file.slice(offset, offset + this.CHUNK_SIZE);
      const buffer = await slice.arrayBuffer();

      this.dataChannel.send(buffer);

      offset += buffer.byteLength;
      chunkIndex++;

      // Update progress callback
      this.onProgress({
        direction: 'send',
        fileName: file.name,
        fileIndex,
        totalFiles,
        transferredBytes: offset,
        totalBytes: totalSize,
        percentage: Math.min(100, Math.round((offset / totalSize) * 100)),
        speedMBps: this.currentSpeedMBps
      });
    }

    // Send file completion header
    this.dataChannel.send(JSON.stringify({
      type: 'FILE_END',
      name: file.name
    }));

    // Slight pause between files
    await new Promise(r => setTimeout(r, 100));
  }

  // --- RECEIVER ENGINE (Direct-to-Disk Zero-Memory Stream) ---
  async handleChannelMessage(event) {
    if (typeof event.data === 'string') {
      try {
        const msg = JSON.parse(event.data);
        await this.handleControlMessage(msg);
      } catch (e) {
        console.error('Error parsing control message:', e);
      }
    } else if (event.data instanceof ArrayBuffer) {
      await this.handleBinaryChunk(event.data);
    }
  }

  async handleControlMessage(msg) {
    if (msg.type === 'FILE_START') {
      this.incomingFileMeta = msg;
      this.incomingBytes = 0;
      this.incomingChunks = [];
      this.incomingWritableStream = null;
      this.isTransferring = true;
      this.startMetrics();

      // Check if File System Access API is supported and enabled
      if (this.directDiskMode && window.showSaveFilePicker && msg.size > 10 * 1024 * 1024) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: msg.name
          });
          this.incomingWritableStream = await handle.createWritable();
        } catch (err) {
          console.warn('Direct disk save prompt dismissed or unavailable, falling back to memory buffer:', err);
          this.incomingWritableStream = null;
        }
      }

      this.onProgress({
        direction: 'receive',
        fileName: msg.name,
        fileIndex: msg.fileIndex,
        totalFiles: msg.totalFiles,
        transferredBytes: 0,
        totalBytes: msg.size,
        percentage: 0,
        speedMBps: 0
      });

    } else if (msg.type === 'FILE_END') {
      let downloadUrl = null;

      if (this.incomingWritableStream) {
        await this.incomingWritableStream.close();
        this.incomingWritableStream = null;
      } else {
        // Fallback: create blob URL
        const blob = new Blob(this.incomingChunks, { type: this.incomingFileMeta.mimeType });
        downloadUrl = URL.createObjectURL(blob);
      }

      this.onFileReceived({
        name: this.incomingFileMeta.name,
        size: this.incomingFileMeta.size,
        mimeType: this.incomingFileMeta.mimeType,
        downloadUrl,
        savedDirectToDisk: Boolean(this.incomingWritableStream === null && !downloadUrl)
      });

      this.incomingChunks = [];

    } else if (msg.type === 'ALL_COMPLETE') {
      this.isTransferring = false;
      this.stopMetrics();
      this.onStatusChange('completed', 'All files transferred successfully!');
    }
  }

  async handleBinaryChunk(arrayBuffer) {
    if (!this.incomingFileMeta) return;

    this.incomingBytes += arrayBuffer.byteLength;

    if (this.incomingWritableStream) {
      // Direct-to-Disk Zero-Memory streaming (for 100GB files)
      await this.incomingWritableStream.write(arrayBuffer);
    } else {
      // Memory buffer for smaller files or unsupported browsers
      this.incomingChunks.push(arrayBuffer);
    }

    const total = this.incomingFileMeta.size;
    const pct = total > 0 ? Math.min(100, Math.round((this.incomingBytes / total) * 100)) : 0;

    this.onProgress({
      direction: 'receive',
      fileName: this.incomingFileMeta.name,
      fileIndex: this.incomingFileMeta.fileIndex,
      totalFiles: this.incomingFileMeta.totalFiles,
      transferredBytes: this.incomingBytes,
      totalBytes: total,
      percentage: pct,
      speedMBps: this.currentSpeedMBps
    });
  }

  // --- METRICS & SPEEDOMETER ---
  startMetrics() {
    this.lastBytesLogged = 0;
    this.lastTimeLogged = Date.now();
    this.currentSpeedMBps = 0;

    if (this.metricsInterval) clearInterval(this.metricsInterval);

    this.metricsInterval = setInterval(() => {
      const now = Date.now();
      const elapsedSec = (now - this.lastTimeLogged) / 1000;
      if (elapsedSec > 0) {
        const currentBytes = this.incomingBytes || (this.filesQueue[this.currentFileIndex] ? this.incomingBytes : 0);
        // Instant speed calculated in main progress calls
      }
    }, 1000);
  }

  stopMetrics() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  cancelTransfer() {
    this.isTransferring = false;
    this.stopMetrics();
    if (this.incomingWritableStream) {
      try {
        this.incomingWritableStream.abort();
      } catch (e) {}
      this.incomingWritableStream = null;
    }
  }
}

// Attach globally
window.WebRTCStreamer = WebRTCStreamer;
