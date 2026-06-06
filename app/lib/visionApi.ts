/**
 * Google Cloud Vision API - Web Detection
 * 이미지를 구글 웹 인덱스에서 검색하여 출처, 유사 이미지, 관련 엔터티 반환
 */

export interface VisionWebEntity {
  entityId?: string;
  description?: string;
  score?: number;
}

export interface VisionMatchingPage {
  url?: string;
  pageTitle?: string;
  fullMatchingImages?: { url: string }[];
  partialMatchingImages?: { url: string }[];
}

export interface VisionWebDetection {
  webEntities?: VisionWebEntity[];
  pagesWithMatchingImages?: VisionMatchingPage[];
  fullMatchingImages?: { url: string }[];
  partialMatchingImages?: { url: string }[];
  visuallySimilarImages?: { url: string }[];
  bestGuessLabels?: { label: string }[];
}

export interface WebDetectionParsed {
  entities: { entityId?: string; description: string; score: number }[];
  matchingPages: { url: string; pageTitle: string; imageUrl?: string }[];
  similarImages: string[];
  bestGuessLabels: string[];
}

/**
 * Vision API Web Detection 호출
 * @param base64Data - base64 인코딩된 이미지 데이터
 * @returns 파싱된 Web Detection 결과 또는 null (실패 시)
 */
export async function detectWeb(base64Data: string): Promise<WebDetectionParsed | null> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[Vision API] API 키가 설정되지 않음. Web Detection 건너뜀.");
    return null;
  }

  const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

  const body = {
    requests: [
      {
        image: { content: base64Data },
        features: [
          { type: "WEB_DETECTION", maxResults: 30 },
        ],
      },
    ],
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[Vision API] HTTP error:", res.status, err);
      return null;
    }

    const data = await res.json();
    const webDetection: VisionWebDetection = data?.responses?.[0]?.webDetection;
    if (!webDetection) return null;

    // 파싱
    const entities = (webDetection.webEntities || [])
      .filter((e) => e.description && e.score)
      .map((e) => ({
        entityId: e.entityId,
        description: e.description!,
        score: Math.round((e.score || 0) * 100) / 100,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    const matchingPages = (webDetection.pagesWithMatchingImages || [])
      .filter((p) => p.url)
      .map((p) => ({
        url: p.url!,
        pageTitle: p.pageTitle || new URL(p.url!).hostname,
        imageUrl: p.fullMatchingImages?.[0]?.url || p.partialMatchingImages?.[0]?.url,
      }))
      .slice(0, 8);

    const similarImages = (webDetection.visuallySimilarImages || [])
      .map((i) => i.url)
      .filter(Boolean)
      .slice(0, 18);

    const bestGuessLabels = (webDetection.bestGuessLabels || [])
      .map((l) => l.label)
      .filter(Boolean);

    return { entities, matchingPages, similarImages, bestGuessLabels };
  } catch (err) {
    console.error("[Vision API] fetch error:", err);
    return null;
  }
}
