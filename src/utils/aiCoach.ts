const COACH_SYSTEM_INSTRUCTION = `대한민국 초등 5학년 영어 코치입니다.
규칙:
1. 정답 영어 문장·구절 직접 제시 절대 금지(힌트만 제공).
2. '주어,동사,be동사,형용사,명사,관사,단수,복수,3인칭,시제,문법' 등 문법 용어 절대 금지. 초등 눈높이 표현('짝꿍 말', '단어 주머니' 등)만 사용.
3. 반드시 아래 3줄 존댓말 형식으로만 짧게 답변:
🟢 잘한 점: (칭찬 1문장)
🟡 스스로 고쳐볼 점: (고칠 위치와 힌트 1~2문장. 완벽하면 "우리 학년 표현에 맞게 정확히 잘 썼어요! 바로 제출해도 좋아요.")
🔍 생각 더하기: (색깔·크기·특징을 더 떠올려 보게 하는 질문 1문장)`;

function getGeminiApiKey(): string {
  return (
    import.meta.env.VITE_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY ||
    ''
  ).trim();
}

const FAST_MODELS = ['gemini-3.8-flash-lite', 'gemini-3.8-flash'];

async function requestSingleModel(
  modelName: string,
  apiKey: string,
  userPrompt: string,
  timeoutMs = 5500
): Promise<string> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: COACH_SYSTEM_INSTRUCTION }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 220,
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // thinkingConfig 미지원 모델일 경우 thinkingConfig 없이 즉시 재호출
      if (res.status === 400) {
        const retryRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: COACH_SYSTEM_INSTRUCTION }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 220 },
          }),
        });
        const retryData = await retryRes.json().catch(() => ({}));
        const retryText = retryData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (retryRes.ok && retryText) return retryText;
      }
      throw new Error(data?.error?.message || `HTTP ${res.status}`);
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new Error('빈 응답');
    return text;
  } finally {
    window.clearTimeout(timer);
  }
}

async function callGeminiFast(apiKey: string, userPrompt: string): Promise<string> {
  if (!apiKey) {
    throw new Error('API 키가 비어 있습니다. Netlify 환경변수를 확인해 주세요.');
  }

  try {
    // 두 모델을 동시에 호출하여 0.1초라도 먼저 응답하는 결과를 즉시 사용합니다.
    return await Promise.any(
      FAST_MODELS.map((model) => requestSingleModel(model, apiKey, userPrompt))
    );
  } catch {
    // 동시 호출이 모두 일시 실패한 경우 기본 모델로 1회 최종 시도
    return await requestSingleModel('gemini-3.8-flash', apiKey, userPrompt, 8000);
  }
}

export async function requestCoachReview(params: {
  step1Looks: string;
  step2Clothes: string;
  step3Traits: string;
}): Promise<string> {
  const apiKey = getGeminiApiKey();

  const userPrompt = [
    `Step 1(생김새): ${params.step1Looks.trim()}`,
    `Step 2(옷차림): ${params.step2Clothes.trim()}`,
    `Step 3(특징): ${params.step3Traits.trim() || '(없음)'}`,
  ].join('\n');

  return await callGeminiFast(apiKey, userPrompt);
}

export async function requestCoachQuestion(params: {
  question: string;
  currentDraft: string;
}): Promise<string> {
  const apiKey = getGeminiApiKey();

  const userPrompt = [
    '초등 3~5학년 수준 영단어 1~2개와 힌트만 2문장 이내로 짧게 답하세요(문장 전체 대신 작성 금지, 💡 기호 사용).',
    params.currentDraft ? `현재 글: ${params.currentDraft.trim()}` : '',
    `질문: ${params.question.trim()}`,
  ]
    .filter(Boolean)
    .join('\n');

  return await callGeminiFast(apiKey, userPrompt);
}
