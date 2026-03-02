import { QRCodeSVG } from "qrcode.react";

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  label?: string;
}

const QRCodeDisplay = ({ value, size = 260, label }: QRCodeDisplayProps) => {
  if (!value) return null;

  return (
    <div className="flex flex-col items-center gap-3">
      {label && (
        <p className="text-sm text-muted-foreground text-center">{label}</p>
      )}
      <div className="bg-white p-4 rounded-xl shadow-lg">
        <QRCodeSVG
          value={value}
          size={size}
          level="M"
          bgColor="#ffffff"
          fgColor="#1a0f0a"
        />
      </div>
      <p className="text-xs text-muted-foreground text-center max-w-[250px]">
        اطلب من اللاعب الآخر مسح هذا الرمز بالكاميرا
      </p>
    </div>
  );
};

export default QRCodeDisplay;
