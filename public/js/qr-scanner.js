/**
 * DropFast QR Code Scanner Manager
 * Handles camera initialization, QR recognition, and session extraction
 */

class QRScannerManager {
  constructor(elementId, onScanSuccess, onScanError) {
    this.elementId = elementId;
    this.onScanSuccess = onScanSuccess;
    this.onScanError = onScanError;
    this.html5QrCode = null;
    this.isScanning = false;
  }

  async start() {
    if (this.isScanning) return;

    if (typeof Html5Qrcode === 'undefined') {
      throw new Error('QR Scanner library not loaded. Please use OTP code instead.');
    }

    try {
      this.html5QrCode = new Html5Qrcode(this.elementId);
      const config = {
        fps: 15,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      await this.html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          this.handleDecodedText(decodedText);
        },
        (errorMessage) => {
          // Ignore frequent frame decode misses
        }
      );

      this.isScanning = true;
    } catch (err) {
      console.error('Camera QR start error:', err);
      let msg = 'Could not access camera.';
      if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        msg += ' Browser requires HTTPS or Localhost for camera access. Please use the 6-Digit OTP code instead!';
      }
      throw new Error(msg);
    }
  }

  async scanFile(imageFile) {
    if (!imageFile) return;
    try {
      if (!this.html5QrCode) {
        this.html5QrCode = new Html5Qrcode(this.elementId);
      }
      const decodedText = await this.html5QrCode.scanFile(imageFile, true);
      this.handleDecodedText(decodedText);
    } catch (err) {
      console.error('File QR decode error:', err);
      throw new Error('No QR code detected in the photo. Please try a clearer photo or enter 6-Digit PIN.');
    }
  }

  handleDecodedText(decodedText) {
    try {
      let roomId = null;
      if (decodedText.includes('join=')) {
        const url = new URL(decodedText);
        roomId = url.searchParams.get('join');
      } else if (decodedText.startsWith('room_')) {
        roomId = decodedText;
      }

      if (roomId) {
        this.stop();
        if (this.onScanSuccess) {
          this.onScanSuccess(roomId);
        }
      }
    } catch (e) {
      console.warn('Scanned QR text is not a valid room link:', decodedText);
    }
  }

  async stop() {
    if (!this.isScanning || !this.html5QrCode) return;
    try {
      await this.html5QrCode.stop();
      await this.html5QrCode.clear();
    } catch (e) {
      console.warn('Error stopping scanner:', e);
    } finally {
      this.isScanning = false;
    }
  }
}

window.QRScannerManager = QRScannerManager;
