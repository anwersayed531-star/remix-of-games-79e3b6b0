import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QRCodeDisplayProps {
  value: string;
  label?: string;
  size?: number;
}

const QRCodeDisplay = ({ value, label, size = 200 }: QRCodeDisplayProps) => {
  const [copied, setCopied] = useState(false);
  const [showText, setShowText] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {label && (
        <p className="text-accent text-sm font-bold text-center">{label}</p>
      )}
      <div className="bg-white rounded-xl p-3 shadow-md">
        <QRCodeSVG
          value={value}
          size={size}
          level="M"
          bgColor="#ffffff"
          fgColor="#1a1a2e"
        />
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="border-accent text-accent hover:bg-accent/10 gap-1"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "تم النسخ!" : "نسخ الكود"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowText(!showText)}
          className="text-muted-foreground gap-1"
        >
          {showText ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {showText ? "إخفاء" : "عرض النص"}
        </Button>
      </div>
      {showText && (
        <div className="bg-background/80 rounded-lg p-2 w-full max-w-[250px]">
          <p className="text-foreground text-xs font-mono break-all text-center leading-relaxed" dir="ltr">
            {value}
          </p>
        </div>
      )}
    </div>
  );
};

export default QRCodeDisplay;
