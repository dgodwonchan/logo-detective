import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest } from "next/server";
import { consume, getClientIp, getStatus } from "@/app/lib/rateLimiter";
import { detectWeb } from "@/app/lib/visionApi";

export const runtime = "nodejs";
// 분석은 시간이 걸릴 수 있으므로 Vercel 배포 시에도 60초까지 허용
export const maxDuration = 60;

const ANALYSIS_PROMPT = `당신은 글로벌 브랜드 아이덴티티와 상표법 분야의 세계적 권위자입니다.

[전제]
사용자(디자이너)가 자신이 새로 만들었다고 주장하는 로고를 업로드했습니다. 당신의 임무는 이 로고가 기존에 등록된 유명 브랜드와 얼마나 흡사한지 평가하는 것입니다. **이 로고는 절대로 "기존 유명 브랜드의 공식 로고"로 해석하면 안 됩니다.** 만약 이 이미지가 Apple/Amazon/Nike/Google/Samsung처럼 세계적으로 유명한 기존 브랜드 로고와 시각적으로 동일하거나 거의 동일하다면, 이는 사용자가 그 브랜드의 상표를 무단으로 사용하려는 시도이거나 그 브랜드의 로고를 자기 디자인이라고 잘못 제출한 것입니다. 두 경우 모두 **명백한 상표권 침해(danger)** 입니다.

다음을 수행하십시오:

1. **유사 브랜드 검색 (정확히 Top 5)**
   - 이 로고와 시각적으로 유사하거나 컨셉이 겹치는 실제 존재하는 브랜드를 **반드시 5개** 찾으세요.
   - 5개를 채우기 어려우면 시각적 닮음의 정도를 점진적으로 낮춰가며 채우되, 가장 비슷한 것을 1순위에 배치.
   - 각 브랜드의 정확한 이름, 업종, 국가, 설립연도, 공식 웹사이트 URL을 제공하세요.
   - URL은 반드시 실제 존재할 가능성이 높은 공식 도메인으로 작성 (예: https://www.apple.com).
   - 단순히 "산세리프 폰트를 쓴다"는 이유로 UNIQLO, H&M, Zara 같은 무관한 대형 브랜드를 끼워 넣지 마세요. 글자 모양·심볼 형태·컬러·전체 무드 같은 **시각적·구조적 요소**가 정말로 닮은 브랜드만.
   - 각 브랜드별로 "왜 유사한지" 1-2문장 + 유사도 점수(0-100).

2. **표절 위험 등급 판정 — 가장 중요한 규칙**

   **A. 자동 DANGER 판정 (반드시 지킬 것):**
   - 업로드된 이미지가 **세계적으로 유명한 기존 브랜드 로고와 시각적으로 동일하거나 거의 동일**(전체 일치도 90% 이상)하면 → 무조건 \`riskLevel: "danger"\`.
   - 이 경우 riskReason은 다음 형식: "이 이미지는 [브랜드명]의 등록된 공식 로고와 동일/거의 동일합니다. 이를 본인의 새 디자인이라고 사용할 경우 명백한 상표권 침해에 해당하며, 법적 분쟁 위험이 매우 높습니다. 완전히 다른 독창적 디자인을 만드세요."
   - similarBrands의 1순위는 그 유명 브랜드여야 하며 similarityScore는 95~100.

   **B. 일반 판정 기준:**
   - "safe": 기존 브랜드와 우연한 유사성만 있고 충분히 차별화됨
   - "caution": 특정 요소(폰트/심볼/컬러)가 일부 겹쳐 시장에서 혼동 가능성 있음
   - "danger": 기존 브랜드를 명백히 모방했거나, 위 A 규칙에 해당
   - 판정 근거를 한국어 2-3문장으로 명확히 설명.

3. **디자인 요소 분해**
   - colors: 사용된 주요 색상들의 한국어 설명 (예: "딥 네이비", "차콜 그레이")
   - shape: 형태/심볼의 특징을 한 문장으로
   - typography: 타이포그래피 특성 (없으면 "텍스트 없음")

4. **디자인 피드백 (4개 섹션 구조, 합계 약 1,000자)**
   - **overall** (~200자): 종합 첫인상과 핵심 평가. **A 규칙에 해당하면 "이는 [브랜드명] 공식 로고로 본인 디자인이 아닙니다"를 명확히 첫 문장에 명시.**
   - **pros** (~200자): 잘 된 디자인 결정과 강점. A 규칙 시 "원본 디자인 자체의 강점"을 객관적으로 분석 (단, 사용자 디자인으로 인정하지 말 것).
   - **cautions** (~250자): 표절·혼동 위험 요소. A 규칙 시 상표권 침해 위험을 명확히 경고.
   - **improvements** (~350자): 구체적·실행 가능한 개선 방향. A 규칙 시 "완전히 새로운 컨셉부터 다시 출발할 것"을 권유하며 차별화 방법 제안.
   - 모든 섹션 한국어. 디자이너에게 실질적 도움이 되는 전문가 톤.

응답은 반드시 지정된 JSON 스키마를 따라야 합니다.`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    riskLevel: {
      type: Type.STRING,
      enum: ["safe", "caution", "danger"],
    },
    riskReason: { type: Type.STRING },
    designElements: {
      type: Type.OBJECT,
      properties: {
        colors: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        shape: { type: Type.STRING },
        typography: { type: Type.STRING },
      },
      required: ["colors", "shape", "typography"],
      propertyOrdering: ["colors", "shape", "typography"],
    },
    similarBrands: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          industry: { type: Type.STRING },
          country: { type: Type.STRING },
          foundedYear: { type: Type.STRING },
          similarityScore: { type: Type.NUMBER },
          reasonForSimilarity: { type: Type.STRING },
          officialUrl: { type: Type.STRING },
        },
        required: [
          "name",
          "industry",
          "country",
          "foundedYear",
          "similarityScore",
          "reasonForSimilarity",
          "officialUrl",
        ],
        propertyOrdering: [
          "name",
          "industry",
          "country",
          "foundedYear",
          "similarityScore",
          "reasonForSimilarity",
          "officialUrl",
        ],
      },
    },
    educationalFeedback: {
      type: Type.OBJECT,
      properties: {
        overall: { type: Type.STRING },
        pros: { type: Type.STRING },
        cautions: { type: Type.STRING },
        improvements: { type: Type.STRING },
      },
      required: ["overall", "pros", "cautions", "improvements"],
      propertyOrdering: ["overall", "pros", "cautions", "improvements"],
    },
  },
  required: [
    "riskLevel",
    "riskReason",
    "designElements",
    "similarBrands",
    "educationalFeedback",
  ],
  propertyOrdering: [
    "riskLevel",
    "riskReason",
    "designElements",
    "similarBrands",
    "educationalFeedback",
  ],
};

export async function POST(request: NextRequest) {
  // 1) Rate limit 사전 체크 (분석 시작 전)
  const ip = getClientIp(request.headers);
  const preStatus = getStatus(ip);
  if (!preStatus.allowed) {
    return Response.json(
      {
        error: "오늘의 무료 분석 횟수(5회)를 모두 사용하셨어요. ☕ 커피 한 잔 후원해주시면 24시간 무제한으로 이용하실 수 있습니다.",
        rateLimited: true,
        limitStatus: preStatus,
      },
      { status: 429 }
    );
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "your-api-key-here") {
      return Response.json(
        {
          error:
            "GEMINI_API_KEY가 설정되지 않았습니다. .env.local 파일을 확인해 주세요.",
        },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("image");

    if (!(file instanceof File)) {
      return Response.json(
        { error: "이미지 파일이 첨부되지 않았습니다." },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return Response.json(
        { error: "이미지 형식의 파일만 업로드할 수 있습니다." },
        { status: 400 }
      );
    }

    // 10MB 제한
    if (file.size > 10 * 1024 * 1024) {
      return Response.json(
        { error: "이미지 크기는 10MB 이하여야 합니다." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");

    const ai = new GoogleGenAI({ apiKey });

    // 속도 최적화: Vision API와 Gemini를 진짜 병렬 호출
    // Gemini는 Vision 데이터 없이도 자체적으로 분석 가능 (프롬프트에 자동 DANGER 규칙 내장)
    // Vision 결과는 사후 처리로 보정 (유명 브랜드 매칭 시 강제 DANGER 적용)
    const visionPromise = detectWeb(base64Data);

    const enhancedPrompt = ANALYSIS_PROMPT + `\n\n---\n[참고] similarBrands는 정확히 5개를 채우되, 단순히 같은 폰트 종류(산세리프 등)를 쓴다는 이유로 무관한 대형 브랜드(UNIQLO, H&M 등)를 끼워 넣지 마세요. 글자 모양·심볼 형태·컬러·전체 무드가 정말 닮은 브랜드만 골라 1순위부터 5순위까지 닮은 정도 순으로 배치하세요.`;

    const geminiPromise = ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: file.type,
                data: base64Data,
              },
            },
            { text: enhancedPrompt },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.4,
      },
    });

    // 둘 다 동시에 기다리기
    const [webResult, response] = await Promise.all([visionPromise, geminiPromise]);

    const text = response.text;
    if (!text) {
      return Response.json(
        { error: "AI가 응답을 반환하지 않았습니다. 다시 시도해 주세요." },
        { status: 502 }
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return Response.json(
        { error: "AI 응답을 해석할 수 없습니다. 다시 시도해 주세요." },
        { status: 502 }
      );
    }

    // 유사도 점수 정렬 (높은 순)
    if (Array.isArray(parsed.similarBrands)) {
      parsed.similarBrands.sort(
        (a: { similarityScore: number }, b: { similarityScore: number }) =>
          b.similarityScore - a.similarityScore
      );
    }

    // ===== Vision API 사후 처리: 유명 브랜드 매칭 시 강제 DANGER =====
    // 유명 브랜드 공식 도메인 매칭 시 = 사용자가 그 로고를 자기 디자인이라고 올린 것 = 표절
    if (webResult && webResult.matchingPages.length > 0) {
      const FAMOUS_DOMAINS: { domain: string; brand: string; url: string; industry: string; country: string; founded: string }[] = [
        { domain: "apple.com", brand: "Apple Inc.", url: "https://www.apple.com", industry: "기술/전자제품", country: "미국", founded: "1976" },
        { domain: "amazon.com", brand: "Amazon", url: "https://www.amazon.com", industry: "전자상거래/클라우드", country: "미국", founded: "1994" },
        { domain: "nike.com", brand: "Nike", url: "https://www.nike.com", industry: "스포츠웨어", country: "미국", founded: "1964" },
        { domain: "google.com", brand: "Google", url: "https://www.google.com", industry: "기술/검색", country: "미국", founded: "1998" },
        { domain: "samsung.com", brand: "Samsung", url: "https://www.samsung.com", industry: "전자제품", country: "한국", founded: "1938" },
        { domain: "microsoft.com", brand: "Microsoft", url: "https://www.microsoft.com", industry: "소프트웨어", country: "미국", founded: "1975" },
        { domain: "meta.com", brand: "Meta", url: "https://www.meta.com", industry: "소셜미디어", country: "미국", founded: "2004" },
        { domain: "facebook.com", brand: "Facebook", url: "https://www.facebook.com", industry: "소셜미디어", country: "미국", founded: "2004" },
        { domain: "instagram.com", brand: "Instagram", url: "https://www.instagram.com", industry: "소셜미디어", country: "미국", founded: "2010" },
        { domain: "twitter.com", brand: "X (Twitter)", url: "https://x.com", industry: "소셜미디어", country: "미국", founded: "2006" },
        { domain: "x.com", brand: "X (Twitter)", url: "https://x.com", industry: "소셜미디어", country: "미국", founded: "2006" },
        { domain: "starbucks.com", brand: "Starbucks", url: "https://www.starbucks.com", industry: "F&B", country: "미국", founded: "1971" },
        { domain: "mcdonalds.com", brand: "McDonald's", url: "https://www.mcdonalds.com", industry: "F&B", country: "미국", founded: "1940" },
        { domain: "coca-cola.com", brand: "Coca-Cola", url: "https://www.coca-cola.com", industry: "음료", country: "미국", founded: "1892" },
        { domain: "adidas.com", brand: "Adidas", url: "https://www.adidas.com", industry: "스포츠웨어", country: "독일", founded: "1949" },
        { domain: "tesla.com", brand: "Tesla", url: "https://www.tesla.com", industry: "전기차", country: "미국", founded: "2003" },
        { domain: "netflix.com", brand: "Netflix", url: "https://www.netflix.com", industry: "스트리밍", country: "미국", founded: "1997" },
        { domain: "spotify.com", brand: "Spotify", url: "https://www.spotify.com", industry: "음악 스트리밍", country: "스웨덴", founded: "2006" },
      ];

      let famousMatch: typeof FAMOUS_DOMAINS[number] | null = null;
      for (const page of webResult.matchingPages) {
        try {
          const host = new URL(page.url).hostname.replace(/^www\./, "");
          const found = FAMOUS_DOMAINS.find((d) => host === d.domain || host.endsWith("." + d.domain));
          if (found) {
            famousMatch = found;
            break;
          }
        } catch {
          /* 잘못된 URL은 무시 */
        }
      }

      if (famousMatch) {
        // 강제 DANGER 판정
        parsed.riskLevel = "danger";
        parsed.riskReason = `이 이미지는 ${famousMatch.brand}의 등록된 공식 로고와 동일/거의 동일합니다. 이를 본인의 새 디자인이라고 사용할 경우 명백한 상표권 침해에 해당하며, 법적 분쟁 위험이 매우 높습니다. 완전히 다른 독창적 디자인을 만드세요.`;

        // similarBrands 1순위에 해당 브랜드 강제 삽입 (이미 있으면 점수만 보정, 없으면 추가)
        const existingIdx = (parsed.similarBrands || []).findIndex(
          (b: { name: string }) => b.name?.toLowerCase().includes(famousMatch!.brand.toLowerCase().split(" ")[0])
        );
        const famousBrandEntry = {
          name: famousMatch.brand,
          industry: famousMatch.industry,
          country: famousMatch.country,
          foundedYear: famousMatch.founded,
          similarityScore: 100,
          reasonForSimilarity: `Google Vision AI가 이 이미지를 ${famousMatch.brand} 공식 로고로 식별했습니다. 시각적으로 동일한 수준입니다.`,
          officialUrl: famousMatch.url,
        };
        if (!Array.isArray(parsed.similarBrands)) parsed.similarBrands = [];
        if (existingIdx >= 0) {
          parsed.similarBrands.splice(existingIdx, 1);
        }
        parsed.similarBrands.unshift(famousBrandEntry);
      }
    }

    // 분석 성공 시 카운트 소비 + 응답에 잔여 횟수 포함
    const postStatus = consume(ip);

    // Vision API Web Detection 결과 포함
    const webDetection = webResult
      ? {
          entities: webResult.entities,
          matchingPages: webResult.matchingPages,
          similarImages: webResult.similarImages,
        }
      : undefined;

    return Response.json({ ...parsed, webDetection, limitStatus: postStatus });
  } catch (error) {
    console.error("[/api/analyze] error:", error);
    const raw = error instanceof Error ? error.message : String(error);

    // 사용자 친화적 메시지로 변환
    let friendly = "분석 중 오류가 발생했습니다. 다시 시도해 주세요.";
    let status = 500;
    const lower = raw.toLowerCase();

    if (lower.includes("429") || lower.includes("quota") || lower.includes("resource_exhausted")) {
      friendly = "현재 무료 한도에 도달했습니다. 잠시 후 다시 시도해 주세요. (Gemini 무료 티어는 1분에 약 10건, 하루에 약 250~1500건까지 가능합니다)";
      status = 429;
    } else if (lower.includes("503") || lower.includes("unavailable") || lower.includes("overloaded")) {
      friendly = "AI 서버가 일시적으로 혼잡합니다. 30초 후 다시 시도해 주세요.";
      status = 503;
    } else if (lower.includes("401") || lower.includes("403") || lower.includes("api key") || lower.includes("permission_denied") || lower.includes("unauthenticated")) {
      friendly = "API 키 인증에 실패했습니다. .env.local 파일의 GEMINI_API_KEY를 확인해 주세요.";
      status = 401;
    } else if (lower.includes("safety") || lower.includes("blocked")) {
      friendly = "이미지가 안전 정책에 의해 차단되었습니다. 다른 이미지로 시도해 주세요.";
      status = 400;
    } else if (lower.includes("not found") || lower.includes("404")) {
      friendly = "AI 모델을 찾을 수 없습니다. 모델 이름이 변경되었을 수 있어요. (route.ts의 model 값을 확인해 주세요)";
      status = 404;
    }

    return Response.json({ error: friendly }, { status });
  }
}
