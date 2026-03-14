import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CameraOff, X, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QRCodeScannerProps {
  onScan: (value: string) => void;
  onClose: () => void;
  onManualInput?: () => void;
}

const QRCodeScanner = ({ onScan, onClose, onManualInput }: QRCodeScannerProps) => {
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scannedRef = useRef(false);

  const stopScanner = useCallback(async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }
      scannerRef.current?.clear();
    } catch {
      // ignore cleanup errors
    }
    scannerRef.current = null;
  }, []);

  useEffect(() => {
    const readerId = "qr-reader-" + Date.now();
    if (containerRef.current) {
      containerRef.current.id = readerId;
    }

    let mounted = true;
    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode(readerId);
        scannerRef.current = scanner;

        const containerWidth = containerRef.current?.clientWidth || 300;
        const scanSize = Math.floor(containerWidth * 0.85);

        await scanner.start(
          { facingMode: "environment" },
          { fps: 15, qrbox: { width: scanSize, height: scanSize } },
          (decodedText) => {
            if (!scannedRef.current && mounted) {
              scannedRef.current = true;
              stopScanner().then(() => onScan(decodedText));
            }
          },
          () => {} // ignore scan failures
        );

        if (mounted) setStarting(false);
      } catch (err: any) {
        if (mounted) {
          setStarting(false);
          if (err?.toString?.().includes("NotAllowedError")) {
            setError("تم رفض إذن الكاميرا. يرجى السماح بالوصول للكاميرا من إعدادات المتصفح.");
          } else if (err?.toString?.().includes("NotFoundError")) {
            setError("لم يتم العثور على كاميرا في هذا الجهاز.");
          } else {
            setError("تعذر تشغيل الكاميرا. تأكد من أن المتصفح يدعم الوصول للكاميرا.");
          }
        }
      }
    };

    startScanner();

    return () => {
      mounted = false;
      stopScanner();
    };
  }, [onScan, stopScanner]);

  return (
    <div className="fixed inset-0 z-50 bg-background/95 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="w-full max-w-sm flex items-center justify-between mb-4">
        <h3 className="text-accent text-lg font-bold flex items-center gap-2">
          <Camera className="w-5 h-5" />
          مسح QR Code
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => { stopScanner(); onClose(); }}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Scanner area */}
      <div className="w-full max-w-sm aspect-square rounded-xl overflow-hidden border-2 border-accent/30 bg-black relative">
        <div ref={containerRef} className="w-full h-full" />
        {starting && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center">
              <Camera className="w-10 h-10 text-accent animate-pulse mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">جاري تشغيل الكاميرا...</p>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="w-full max-w-sm mt-4 bg-destructive/20 border border-destructive/40 rounded-lg p-3 text-center">
          <CameraOff className="w-5 h-5 mx-auto mb-1 text-destructive" />
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      {/* Manual input fallback */}
      {onManualInput && (
        <Button
          variant="outline"
          onClick={() => { stopScanner(); onManualInput(); }}
          className="mt-4 border-accent text-accent hover:bg-accent/10 gap-2"
        >
          <Keyboard className="w-4 h-4" />
          أدخل الكود يدوياً
        </Button>
      )}

      <p className="text-muted-foreground text-xs mt-3 text-center max-w-xs">
        وجّه الكاميرا نحو الـ QR Code الظاهر على جهاز اللاعب الآخر
      </p>
    </div>
  );
};

export default QRCodeScanner;
