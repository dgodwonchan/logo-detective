import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest } from "next/server";
import { consume, getClientIp, getStatus } from "@/app/lib/rateLimiter";

export const runtime = "nodejs";
// 분석은 시간이 걸릴 수 있으므로 Vercel 배포 시에도 60초까지 허용
export const maxDuration = 60;

const ANALYSIS_PROMPT = `당신은 글로벌 브랜드 아이덴티티와 로고 디자인의 세계적 권위자입니다. 디자이너가 만든 로고를 분석해 주세요.

다음을 수행하십시오:

1. **유사 브랜드 검색** (Top 5)
   - 이 로고와 시각적으로 유사하거나 컨셉이 겹치는 실제 존재하는 글로벌/한국 브랜드를 최대 5개 찾으세요.
   - 각 브랜드의 정확한 이름, 업종, 국가, 설립연도, 공식 웹사이트 URL을 제공하세요.
   - URL은 반드시 실제로 존재할 가능성이 매우 높은 공식 도메인으로 작성하세요 (예: https://www.apple.com).
   - 확신할 수 없는 브랜드는 절대 포함하지 마세요. 가짜 정보를 만드는 것보다 적게 반환하는 것이 낫습니다.
   - 각 브랜드별로 "왜 유사한지" (형태, 색상, 컨셉, 타이포 등) 1-2문장으로 설명하고 유사도 점수(0-100)를 매기세요.

2. **표절 위험 등급 판정**
   - "safe": 우연한 유사성, 차별화 충분
   - "caution": 일부 요소가 겹쳐 주의 필요
   - "danger": 명백히 기존 브랜드를 모방한 수준
   - 판정 근거를 한국어로 2-3문장으로 명확히 설명하세요.

3. **디자인 요소 분해**
   - colors: 사용된 주요 색상들의 한국어 설명 (예: "딥 네이비", "차콜 그레이")
   - shape: 형태/심볼의 특징을 한 문장으로
   - typography: 타이포그래피의 특성 (있는 경우, 없으면 "텍스트 없음")

4. **디자인 피드백**
   - 브랜딩 전문가가 디자이너에게 줄 법한 건설적 코멘트를 3-5문장으로 작성하세요.
   - 어떤 부분을 차별화해야 독창성이 살아날지, 어떤 디자인 결정이 좋았는지 균형 있게 평가하세요.
   - 한국어로 작성하세요.

응답은 반드시 지정된 JSON 스키마를 따라야 합니다. 모든 텍스트 필드는 한국어로 작성하세요.`;

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
    educationalFeedback: { type: Type.STRING },
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
        error: "오늘의 무료 분석 횟수(3회)를 모두 사용하셨어요. ☕ 커피 한 잔 후원해주시면 24시간 무제한으로 이용하실 수 있습니다.",
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

    const response = await ai.models.generateContent({
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
            { text: ANALYSIS_PROMPT },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.4,
      },
    });

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

    // 분석 성공 시 카운트 소비 + 응답에 잔여 횟수 포함
    const postStatus = consume(ip);
    return Response.json({ ...parsed, limitStatus: postStatus });
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
