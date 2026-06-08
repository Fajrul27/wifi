import React, { useEffect, useState } from "react";

const formatDuration = (ms = 0) => {
  const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

const parseDuration = (value = "") => {
  if (!value || value === "-") return 0;
  const text = String(value);
  let total = 0;
  const days = text.match(/(\d+)\s*d/);
  const hours = text.match(/(\d+)\s*h/);
  const minutes = text.match(/(\d+)\s*m/);
  const seconds = text.match(/(\d+)\s*s/);
  if (days) total += Number(days[1]) * 86400;
  if (hours) total += Number(hours[1]) * 3600;
  if (minutes) total += Number(minutes[1]) * 60;
  if (seconds) total += Number(seconds[1]);
  return total * 1000;
};

const getLiveSessionDuration = (user, now) => {
  if (user?.isOnline) {
    const baseMs = parseDuration(user.uptime);
    const elapsedMs = user.realtimeUpdatedAt ? now - Number(user.realtimeUpdatedAt) : 0;
    return formatDuration(baseMs + elapsedMs);
  }

  const baseTime = user?.lastDisconnect || user?.lastSeen || user?.createdAt;
  const baseDate = baseTime ? new Date(baseTime) : null;
  if (baseDate && !isNaN(baseDate)) return formatDuration(now - baseDate.getTime());

  const downtimeMs = parseDuration(user?.downtime);
  const elapsedMs = user?.realtimeUpdatedAt ? now - Number(user.realtimeUpdatedAt) : 0;
  return formatDuration(downtimeMs + elapsedMs);
};

export default function LiveSessionDuration({ user }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return <>{getLiveSessionDuration(user, now)}</>;
}
