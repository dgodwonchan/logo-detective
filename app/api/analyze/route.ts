import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest } from "next/server";
import { getClientIp, consume, getStatus, getUnlockFromHeaders } from "@/app/lib/rateLimiter";
import { detectWeb } from "@/app/lib/visionApi";

export const runtime = "nodejs";
// 분석은 시간이 걸릴 수 있으므로 Vercel 배포 시에도 60초까지 허용
export const maxDuration = 60;

async function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** Gemini API 재시도: 503/overloaded 시 최대 3회, 지수 백오프(2s, 4s, 8s). 429/quota는 즉시 실패 */
async function geminiWithRetry(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI["models"]["generateContent"]>[0],
  maxRetries = 3,
  baseDelay = 2000
) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await ai.models.generateContent(params);
      if (res && (res as any).text != null) return res;
      lastError = new Error("Empty response");
    } catch (err) {
      lastError = err;
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
      // quota 초과는 재시도 의미 없음
      if (msg.includes("429") || msg.includes("quota") || msg.includes("resource_exhausted")) throw err;
    }
    if (attempt < maxRetries) await sleep(baseDelay * attempt);
  }
  throw lastError;
}

const ANALYSIS_PROMPT = `당신은 글로벌 브랜드 아이덴티티와 상표법 분야의 세계적 권위자이며, 동시에 신진 디자이너를 공정하게 평가하고 키우는 멘토입니다.

[전제]
사용자(주로 디자인을 배우는 학생·신진 디자이너)가 자신이 새로 만들었다고 주장하는 로고를 업로드했습니다. 당신의 임무는 이 로고가 표절인지 아닌지를 **공정하고 정밀하게** 평가하는 것입니다. 절대 과도하게 엄격하게 판단하지 마세요.

**핵심 원칙 — 닮음(similarity) ≠ 표절(infringement):**
거의 모든 창작물은 기존 브랜드와 부분적으로 닮을 수 있습니다. 하지만 그것만으로는 표절이 아닙니다. 상표권 침해·표절은 **"기존 특정 브랜드의 '식별력 있는 고유 요소들의 조합'을 실질적으로 베꼈을 때"만** 성립합니다. 한두 가지 흔한 요소가 겹치는 것은 정상이며 표절이 아닙니다.

[표절이 아닌 것 — 절대 위험 등급을 올리는 근거로 삼지 말 것]
아래는 누구나 자유롭게 쓰는 '공유 자산(common elements)'입니다. 이것들이 겹친다는 이유만으로는 절대 caution/danger를 주지 마세요:
- **동일한 알파벳/글자 그 자체** (예: 'O', 'A', 'M' 한 글자가 닮음). 같은 글자를 쓰는 모든 로고가 표절일 수는 없습니다.
- 기본 기하 도형 (원, 정사각형, 삼각형, 육각형, 직선, 점, 호)
- 산세리프/세리프 등 보편적 폰트 카테고리, 굵기, 자간
- 흔한 단색 (검정, 흰색, 파랑, 빨강, 회색 등)
- 미니멀리즘·기하추상·그라데이션·플랫 같은 보편적 디자인 트렌드/스타일
- 업종 관용 모티프 (의료=십자, 배송=화살표, 친환경=잎사귀 등)

[유사 브랜드 오류 금지 — 반드시 지킬 것]
- similarBrands는 업로드한 로고와 **직접 시각적으로 비교했을 때 닮아있는** 브랜드만 나열하세요.
- 함정 주의: "특정 스타일(스트리트웨어, 스포츠 등)에 속한다"거나 "같은 업종이다"는 이유만으로는 유사한 것이 아닙니다.
- 구별되는 요소(배경 패턴, 캔버스 그림, 오동작 그래픽, 아이콘 전체 등)가 완전히 다른 브랜드를 포함하지 마세요.
- 색 조합과 시각적 특징이 실제로 많이 일치하는 브랜드만 포함하세요.
- 만약 업로드된 로고가 스트리트웨어 스타일이라고 해서 무조건 Supreme, Stussy, Obey, Off-White 등을 나열하지 마세요. 똑같은 스타일 카테고리에 있다는 이유만으로는 유사하지 않습니다.
- 벡터▫일러스트와 같은 오동작 그래픽이 있는지 주의하세요. 유사 브랜드 검색 결과에서 이런 그래픽을 오인하지 마세요.

[표절·침해로 의심할 수 있는 것 — 아래 요소가 '동시에 여러 개' 겹칠 때만]
- 특정 유명 브랜드의 '고유 심볼/엠블럼'을 거의 그대로 차용 (예: 애플의 베어 먹은 사과, 나이키 스우시, 스타벅스 세이렌)
- 식별력 있는 요소들의 '조합'이 특정 한 브랜드와 일치 (글자형태 + 전용 컬러 + 심볼 + 배치가 동시에)
- 전체적 인상(게슈탈트)이 특정 한 브랜드와 혼동될 정도로 동일

다음을 수행하십시오:

1. **유사 브랜드 검색**
   - 이 로고와 시각적으로 유사하거나 컨셉이 겹치는 실제 존재하는 브랜드를 찾으되, 무관한 브랜드는 절대 포함하지 마세요.
   - 각 브랜드의 정확한 이름, 업종, 국가, 설립연도, 공식 웹사이트 URL을 제공하세요.
   - URL은 반드시 실제 존재할 가능성이 높은 공식 도메인으로 작성 (예: https://www.apple.com).
   - 단순히 "산세리프 폰트를 쓴다"는 이유로 UNIQLO, H&M, Zara 같은 무관한 대형 브랜드를 끼워 넣지 마세요. 글자 모양·심볼 형태·컬러·전체 무드 같은 **시각적·구조적 요소**가 정말로 닮은 브랜드만.
   - 각 브랜드별로 "왜 유사한지" 1-2문장 + 유사도 점수(0-100).

2. **표절 위험 등급 판정 — 정밀 루브릭 (가장 중요)**

   판정 전 반드시 스스로 이 질문에 답하세요:
   "이 로고가 닮은 이유가 위 [표절이 아닌 것] 목록의 '공유 자산' 때문인가, 아니면 특정 한 브랜드의 '고유한 요소 조합'을 베꼈기 때문인가?"
   - 공유 자산 때문이면 → **safe** (절대 등급을 올리지 말 것)
   - 고유 조합이 부분적으로 겹치면 → caution
   - 고유 심볼/조합을 명백히 베꼈으면 → danger

   **A. 자동 DANGER (명백한 복제에만 적용):**
   - 업로드 이미지가 **세계적으로 유명한 기존 브랜드 로고와 전체 일치도 90% 이상으로 동일/거의 동일**할 때만 -> riskLevel: "danger".
   - 해당 브랜드의 고유 심볼/엠블럼을 거의 그대로 베낀 경우. **글자 하나·도형 하나·색 하나가 닮은 정도에는 절대 적용 금지.**
   - similarBrands 1순위는 그 브랜드, similarityScore 95~100.

   **B. 등급 정의 (정밀):**
   - **"safe"** (학생 창작물의 대다수가 여기 해당): 기존 브랜드와의 닮음이 공유 자산(글자·기본도형·폰트·흔한 색) 수준이거나 우연한 유사성이며, 전체 인상이 독창적이고 충분히 구별됨. → **단 한 가지 요소(예: 같은 알파벳 O, 같은 원형)만 겹친다면 무조건 safe.**
   - **"caution"**: 특정 '한' 브랜드와 식별력 있는 요소가 **2가지 이상**(예: 심볼 형태 + 전용 컬러 조합, 또는 글자 변형 방식 + 배치) 겹쳐 일부 소비자가 혼동할 여지가 있음. 법적 표절은 아니지만 차별화를 권장하는 수준.
   - **"danger"**: 특정 브랜드의 고유 심볼/엠블럼을 거의 그대로 차용했거나, 식별 요소 조합이 전반적으로 일치해 혼동 가능성이 큼. 또는 위 A 규칙 해당.

   **C. riskReason 작성 규칙 (반드시 지킬 것):**
   - 어떤 요소가 닮았는지 구체적으로 적고, 그것이 '공유 자산'인지 '고유 조합'인지 명시.
   - **글자 하나·도형 하나만 닮은 경우, riskReason에 "이는 누구나 쓰는 공통 요소이므로 표절이 아닙니다"라고 분명히 적고 safe로 판정.**
   - 학생의 독창적 노력이 보이면 격려하는 문장 포함. 짧게 2-4문장.

3. **디자인 요소 분해**
   - colors: 사용된 주요 색상들 설명
   - shape: 형태/심볼의 특징을 한 문장으로
   - typography: 타이포그래피 특성 (없으면 "텍스트 없음")

4. **디자인 피드백 (4개 섹션 구조, 합계 약 1,000자)**
   - **overall** (~200자): 종합 첫인상과 핵심 평가. 자동 DANGER(A 규칙)에 해당하면 "이는 [브랜드명] 공식 로고로 본인 디자인이 아닙니다"를 첫 문장에 명시. 그 외에는 학생 창작물의 독창성을 공정하게 평가.
   - **pros** (~200자): 잘 된 디자인 결정과 강점. 격려 톤으로 구체적으로.
   - **cautions** (~250자): 표절·혼동 위험 요소. 단, 공유 자산(글자·도형·폰트) 수준의 닮음을 표절처럼 과장하지 말 것. 실제 혼동 가능성이 있을 때만 경고하고, 없으면 "표절 우려는 낮습니다"라고 안심시킬 것.
   - **improvements** (~350자): 구체적·실행 가능한 개선 방향. 차별화를 더 강화할 방법을 제안.

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
  const cookieUnlock = getUnlockFromHeaders(request.headers);
  const preStatus = getStatus(ip, cookieUnlock);
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
    const locale = (formData.get("locale") as string) || "ko";

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

    // 언어별 프롬프트 추가
    const langInstruction =
      locale === "en"
        ? "Respond ENTIRELY in English. Do NOT use any Korean or Chinese characters. Use natural, professional English suitable for designers."
        : locale === "zh"
        ? "用中文回答。不要出现任何韩文或英文字符。使用专业、自然的中文，适合设计师阅读。"
        : "한국어로 답변하세요. 영어나 중국어 문자를 절대 사용하지 마세요. 디자이너에게 적합한 전문적이고 자연스러운 한국어를 사용하세요.";

    // Vision API를 먼저 실행해 식별 신호를 Gemini에 참고로 전달 (정확도 우선)
    const webResult = await detectWeb(base64Data);

    // Vision 신호 구성 — 단, "검색 키워드/출처일 뿐 = 그 브랜드 로고"가 아님을 반드시 명시
    let visionHint = "";
    if (webResult) {
      const ents = (webResult.entities || []).slice(0, 8).filter(Boolean);
      const pageTitles = (webResult.matchingPages || [])
        .map((p) => p.pageTitle)
        .filter(Boolean)
        .slice(0, 5);
      if (ents.length > 0 || pageTitles.length > 0) {
        visionHint =
          `\n\n---\n[Google Vision 참고 신호 — 해석 주의]\n` +
          `아래는 Google Vision이 이 이미지와 시각적으로 연관지어 찾은 "검색 키워드"와 "이미지가 등장한 웹페이지 제목"입니다. ` +
          `이것은 단순 검색/출처 정보이며, **절대 "이 로고가 곧 그 브랜드의 공식 로고"라는 뜻이 아닙니다.** ` +
          `특히 어떤 이미지가 Google Play, Instagram, Facebook, Pinterest, Amazon 등에 게시되어 있다고 해서 그 이미지가 구글/인스타/페이스북 로고인 것은 절대 아닙니다. ` +
          `이 신호는 오직 "업로드된 로고가 실제로 어떤 브랜드/업종의 것인지" 정체를 파악하는 보조 단서로만 쓰고, 표절 여부는 반드시 이미지 자체의 시각적 비교로만 판단하세요.\n` +
          (ents.length > 0 ? `- 연관 키워드: ${ents.join(", ")}\n` : "") +
          (pageTitles.length > 0 ? `- 등장 웹페이지 제목: ${pageTitles.join(" | ")}\n` : "");
      }
    }

    const enhancedPrompt = ANALYSIS_PROMPT + `\n\n---\n[언어 설정] ${langInstruction}\n\n[참고] similarBrands는 시각적 유사도가 높은 것을 최대 5개까지만 나열하되, 정말 유사하지 않다면 3개 이하도 괜찮습니다. 무관한 대형 브랜드를 채우기 위해 억지로 넣지 마세요. 글자 모양·심볼 형태·컬러·전체 무드가 정말 닮은 브랜드만 골라 1순위부터 닮은 정도 순으로 배치하세요.\n[브랜드명 표기] 국제적인 고유명사(예: Nike, Starbucks, Instagram 등)는 원래 언어 형태 그대로 표기하고, 그 뒤에 괄호 안에 현지어 번역을 덧붙일 수 있습니다. 일반명사는 언어 설정에 맞게 번역합니다.` + visionHint;

    const response = await geminiWithRetry(ai, {
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
        temperature: 0.2,
        maxOutputTokens: 2048,
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    }, 3, 2000);

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
    const postStatus = consume(ip, cookieUnlock);

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
