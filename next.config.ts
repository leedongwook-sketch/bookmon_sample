import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 개발 중 휴대기기(LAN) 접속 허용 — Next 16이 기본 차단하는 dev 리소스(HMR 등) 교차출처 허용.
  allowedDevOrigins: ["192.168.45.125"],
};

export default nextConfig;
