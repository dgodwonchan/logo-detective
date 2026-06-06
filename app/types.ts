// 분석 결과 타입 정의 (서버/클라이언트 공유)

export type RiskLevel = "safe" | "caution" | "danger";

export interface SimilarBrand {
  name: string;
  industry: string;
  country: string;
  foundedYear: string;
  similarityScore: number; // 0-100
  reasonForSimilarity: string;
  officialUrl: string;
}

export interface DesignElements {
  colors: string[]; // 한글 색상 설명 (예: "딥 인디고", "차콜 그레이")
  shape: string; // 형태/심볼 묘사
  typography: string; // 타이포 특성
}

export interface AnalysisResult {
  riskLevel: RiskLevel;
  riskReason: string;
  designElements: DesignElements;
  similarBrands: SimilarBrand[];
  educationalFeedback: string;
}

// 사용량 / 잠금 상태 (서버 → 클라이언트)
export interface LimitStatus {
  allowed: boolean;
  remaining: number; // -1 = 무제한 (unlocked)
  unlocked: boolean;
  unlockedUntil?: number;
  limit: number;
}
