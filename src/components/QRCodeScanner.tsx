import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CameraOff, X, Keyboard, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ensureCameraPermission } from "@/lib/nativePermissions";

interface QRCodeScannerProps {
  onScan: (value: string) => void;
  onClose: () => void;
  onManualInput?: () => void;
}

const QRCodeScanner = ({ onScan, onClose, onManualInput }: QRCodeScannerProps) => {
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scannedRef = useRef(false);

  const stopScanner = useCallback(async () => {
    try {
      if (scannerRef.current?.isScanning) await scannerRef.current.stop();
      scannerRef.current?.clear();
    } catch {
      // ignore cleanup errors
    }
    scannerRef.current = null;
  }, []);

  useEffect(() => {
    const readerId = "qr-reader-" + Date.now();
    if (containerRef.current) containerRef.current.id = readerId;

    let mounted = true;

    const startScanner = async () => {
      setStarting(true);
      setError(null);
      try {
        const allowed = await ensureCameraPermission();
        if (!mounted) return;
        if (!allowed) {
          setStarting(false);
          setError("لم يتم السماح باستخدام الكاميرا. افتح إعدادات الهاتف ← التطبيقات ← Game Hub ← الأذونات ← الكاميرا، وفعّلها.");
          return;
        }

        const scanner = new Html5Qrcode(readerId, { verbose: false });
        scannerRef.current = scanner;

        // Bigger scan box + higher resolution → reads dense codes from farther away
        const width = containerRef.current?.clientWidth || 320;
        const box = Math.floor(width * 0.92);

        await scanner.start(
          { facingMode: { ideal: "environment" } },
          {
            fps: 20,
            qrbox: { width: box, height: box },
            aspectRatio: 1,
            videoConstraints: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 1280 },
            } as MediaTrackConstraints,
          },
          (decodedText) => {
            if (!scannedRef.current && mounted) {
              scannedRef.current = true;
              stopScanner().then(() => onScan(decodedText.trim()));
            }
          },
          () => {} // ignore per-frame decode misses
        );

        if (mounted) setStarting(false);
      } catch (err: unknown) {
        if (!mounted) return;
        setStarting(false);
        const msg = String(err);
        if (msg.includes("NotAllowedError") || msg.includes("Permission")) {
          setError("تم رفض إذن الكاميرا. فعّل إذن الكاميرا للتطبيق من إعدادات الهاتف ثم أعد المحاولة.");
        } else if (msg.includes("NotFoundError") || msg.includes("no camera")) {
          setError("لم يتم العثور على كاميرا في هذا الجهاز.");
        } else if (msg.includes("NotReadableError")) {
          setError("الكاميرا مستخدمة من تطبيق آخر. أغلق التطبيقات الأخرى وحاول مجدداً.");
        } else {
          setError("تعذر تشغيل الكاميرا. جرّب إعادة المحاولة أو أدخل الكود يدوياً.");
        }
      }
    };

    startScanner();

    return () => {
      mounted = false;
      stopScanner();
    };
  }, [onScan, stopScanner, attempt]);

  return (
    <div className="fixed inset-0 z-50 bg-background/95 flex flex-col items-center justify-center p-3">
      <div className="w-full max-w-md flex items-center justify-between mb-3">
        <h3 className="text-accent text-lg font-bold flex items-center gap-2">
          <Camera className="w-5 h-5" />
          مسح QR Code
        </h3>
        <Button variant="ghost" size="icon" onClick={() => { stopScanner(); onClose(); }}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="w-full max-w-md aspect-square rounded-xl overflow-hidden border-2 border-accent/30 bg-black relative">
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

      {error && (
        <div className="w-full max-w-md mt-3 bg-destructive/20 border border-destructive/40 rounded-lg p-3 text-center">
          <CameraOff className="w-5 h-5 mx-auto mb-1 text-destructive" />
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <Button
          variant="outline"
          onClick={() => { scannedRef.current = false; stopScanner().then(() => setAttempt((a) => a + 1)); }}
          className="border-accent text-accent hover:bg-accent/10 gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          إعادة المحاولة
        </Button>
        {onManualInput && (
          <Button variant="outline" onClick={() => { stopScanner(); onManualInput(); }} className="gap-2">
            <Keyboard className="w-4 h-4" />
            إدخال يدوي
          </Button>
        )}
      </div>

      <p className="text-muted-foreground text-xs mt-3 text-center max-w-xs">
        قرّب الكاميرا من الكود حتى يملأ المربع — الإضاءة الجيدة تسرّع القراءة
      </p>
    </div>
  );
};

export default QRCodeScanner;
