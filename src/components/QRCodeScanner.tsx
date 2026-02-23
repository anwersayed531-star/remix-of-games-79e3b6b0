import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CameraOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QRCodeScannerProps {
  onScan: (data: string) => void;
  onError?: (error: string) => void;
  scanning?: boolean;
}

const QRCodeScanner = ({ onScan, onError, scanning = true }: QRCodeScannerProps) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<string>("qr-reader-" + Math.random().toString(36).slice(2));
  const scannedRef = useRef(false);

  const stopScanner = useCallback(async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }
    } catch {
      // ignore
    }
    scannerRef.current = null;
  }, []);

  const startScanner = useCallback(async () => {
    if (scannedRef.current) return;
    setIsStarting(true);
    setErrorMsg(null);

    try {
      // Request camera permission
      await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setHasPermission(true);

      const scanner = new Html5Qrcode(containerRef.current);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText) => {
          if (!scannedRef.current) {
            scannedRef.current = true;
            onScan(decodedText);
            stopScanner();
          }
        },
        () => {
          // QR code not found in frame - ignore
        }
      );
    } catch (err: any) {
      setHasPermission(false);
      const msg = err?.message || "فشل في الوصول للكاميرا";
      if (msg.includes("Permission") || msg.includes("NotAllowed")) {
        setErrorMsg("يرجى السماح بالوصول للكاميرا من إعدادات التطبيق");
      } else {
        setErrorMsg("فشل في تشغيل الكاميرا: " + msg);
      }
      onError?.(msg);
    } finally {
      setIsStarting(false);
    }
  }, [onScan, onError, stopScanner]);

  useEffect(() => {
    if (scanning) {
      scannedRef.current = false;
      startScanner();
    }
    return () => {
      stopScanner();
    };
  }, [scanning, startScanner, stopScanner]);

  if (!scanning) return null;

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {isStarting && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">جاري تشغيل الكاميرا...</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex flex-col items-center gap-2 py-4">
          <CameraOff className="w-8 h-8 text-destructive" />
          <p className="text-destructive text-sm text-center">{errorMsg}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              scannedRef.current = false;
              startScanner();
            }}
            className="border-accent text-accent hover:bg-accent/10"
          >
            <Camera className="w-4 h-4 ml-1" />
            حاول مرة أخرى
          </Button>
        </div>
      )}

      <div
        id={containerRef.current}
        className="w-full max-w-[300px] aspect-square rounded-xl overflow-hidden bg-black/20"
        style={{ minHeight: hasPermission === false ? 0 : 280 }}
      />

      {hasPermission && !errorMsg && (
        <p className="text-xs text-muted-foreground text-center">
          وجّه الكاميرا نحو رمز QR على شاشة المضيف
        </p>
      )}
    </div>
  );
};

export default QRCodeScanner;
