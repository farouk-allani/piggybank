import { useState, useEffect } from "react";

interface CountdownTimerProps {
  targetTimestamp: number; // Unix timestamp in milliseconds
  onComplete?: () => void;
  className?: string;
  compact?: boolean; // New compact mode for inline display
}

export default function CountdownTimer({
  targetTimestamp,
  onComplete,
  className = "",
  compact = false,
}: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    total: number;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 });

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = Date.now();
      const difference = targetTimestamp - now;

      if (difference <= 0) {
        setTimeRemaining({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          total: 0,
        });
        if (onComplete) {
          onComplete();
        }
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeRemaining({ days, hours, minutes, seconds, total: difference });
    };

    // Calculate immediately
    calculateTimeRemaining();

    // Update every second
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [targetTimestamp, onComplete]);

  if (timeRemaining.total <= 0) {
    return (
      <div className={`text-center ${className}`}>
        <p className="text-sm font-bold text-lime-600">
          ⏰ Next deposit due now!
        </p>
      </div>
    );
  }

  // Compact inline mode
  if (compact) {
    const parts = [];
    if (timeRemaining.days > 0) {
      parts.push(`${timeRemaining.days}d`);
    }
    parts.push(`${String(timeRemaining.hours).padStart(2, "0")}h`);
    parts.push(`${String(timeRemaining.minutes).padStart(2, "0")}m`);
    parts.push(`${String(timeRemaining.seconds).padStart(2, "0")}s`);

    return (
      <div className={`inline-flex items-center gap-1 ${className}`}>
        <span className="font-mono text-lg font-bold text-purple-900">
          {parts.join(" ")}
        </span>
      </div>
    );
  }

  // Original large card mode
  return (
    <div className={`${className}`}>
      <div className="grid grid-cols-4 gap-2 text-center">
        {timeRemaining.days > 0 && (
          <div className="brut-card bg-blue-100 p-2">
            <div className="text-2xl font-black">{timeRemaining.days}</div>
            <div className="text-xs text-gray-600">
              Day{timeRemaining.days !== 1 ? "s" : ""}
            </div>
          </div>
        )}
        <div className="brut-card bg-blue-100 p-2">
          <div className="text-2xl font-black">
            {String(timeRemaining.hours).padStart(2, "0")}
          </div>
          <div className="text-xs text-gray-600">Hours</div>
        </div>
        <div className="brut-card bg-blue-100 p-2">
          <div className="text-2xl font-black">
            {String(timeRemaining.minutes).padStart(2, "0")}
          </div>
          <div className="text-xs text-gray-600">Mins</div>
        </div>
        <div className="brut-card bg-blue-100 p-2">
          <div className="text-2xl font-black">
            {String(timeRemaining.seconds).padStart(2, "0")}
          </div>
          <div className="text-xs text-gray-600">Secs</div>
        </div>
      </div>
    </div>
  );
}
