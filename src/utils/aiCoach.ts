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

const CANDIDATE_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.8-pro',
  'gemini-2.5-pro',
];

// 구글 서버가 일시 과부하(High demand)일 때 수업을 멈추지 않게 작동하는 내장 규칙 코치
function buildLocalSmartFeedback(params: {
  step1Looks: string;
  step2Clothes: string;
  step3Traits: string;
}): string {
  const s1 = params.step1Looks.trim();
  const s2 = params.step2Clothes.trim();
  const s3 = params.step3Traits.trim();
  const combined = `${s1} ${s2} ${s3}`.trim();

  const hints: string[] = [];

  // 1. 한글이나 자음/모음만 입력한 경우
  if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(combined) || !/[a-zA-Z]/.test(combined)) {
    hints.push("아직 한글이나 기호가 섞여 있어요. 위쪽 '단어 주머니'를 펼쳐 영어 단어로 문장을 만들어 볼까요?");
  } else {
    // 2. 첫 글자 대문자 및 마침표 점검
    if ((s1 && !/^[A-Z]/.test(s1)) || (s2 && !/^[A-Z]/.test(s2))) {
      hints.push('문장의 맨 첫 글자는 항상 큰 글자(대문자)로 시작해야 해요.');
    }
    // 3. Step 1: 'is a tall / is a short'처럼 키·성격 단어 앞에 불필요한 a를 쓴 경우
    if (/\b(is|am|are)\s+a\s+(tall|short|smart|brave|kind|funny|curious|cute|pretty)\b/i.test(combined)) {
      hints.push("키나 성격을 나타내는 말('tall', 'short' 등)은 셀 수 있는 물건이 아니라서 앞에 'a'를 쓰지 않아요.");
    }
    // 4. Step 1: He/She have 오류
    if (/\b(he|she)\s+have\b/i.test(combined)) {
      hints.push("한 명('He' 또는 'She')이 가진 모습을 말할 때는 'have' 대신 모양이 조금 다른 짝꿍 말('has')을 써 보세요.");
    }
    // 5. Step 2: wearing 또는 is 누락 (예: she wear pant / he wearing)
    if (s2 && /\b(he|she)\s+wear(s)?\b/i.test(s2)) {
      hints.push("입고 있는 옷차림을 소개할 때는 'wear' 대신 'is wearing' 형태로 짝꿍 말을 함께 써 보세요.");
    } else if (s2 && /\b(he|she)\s+wearing\b/i.test(s2)) {
      hints.push("옷차림 문장에서 'He/She'와 'wearing' 사이에 짝꿍 말('is')이 빠지지 않았는지 확인해 보세요.");
    }
    // 6. pant / shoe / glass 처럼 항상 둘이 짝인 옷 단어에 s 누락
    if (/\b(pant|shoe|glass|boot|short)\b/i.test(combined) && !/\bshort\s+hair\b/i.test(combined)) {
      hints.push('바지나 신발, 안경처럼 두 쪽이 한 짝인 물건은 단어 끝에 소리를 더해 주는 글자(-s/-es)가 붙는지 단어 주머니에서 확인해 보세요.');
    }
    // 7. 마침표 확인
    if ((s1 && !/[.!]$/.test(s1)) || (s2 && !/[.!]$/.test(s2))) {
      hints.push('문장이 끝날 때는 끝에 마침표(.)를 꼭 찍어 주세요.');
    }
  }

  const goodPoint =
    /[a-zA-Z]{2,}/.test(s1) && /[a-zA-Z]{2,}/.test(s2)
      ? '등장인물의 생김새(Step 1)와 옷차림(Step 2) 단서를 모두 영어로 열심히 작성해 주었네요!'
      : '인물의 특징을 떠올리며 영어 문장 쓰기에 도전한 점이 정말 멋져요!';

  const fixPoint =
    hints.length > 0
      ? hints.slice(0, 2).join(' 그리고 ')
      : '우리 학년 표현에 맞게 정확히 잘 썼어요! 바로 제출해도 좋아요.';

  const moreQuestion = s3
    ? 'Step 3까지 멋지게 채웠네요! 옷이나 머리 모양에 색깔(blue, red, yellow 등) 단어를 한 가지 더 넣어 보면 어떨까요?'
    : '친구들이 이 인물을 더 쉽게 상상할 수 있도록 옷의 색깔이나 Step 3(인물의 특징·취미)도 한 줄 더 적어 볼까요?';

  return [
    `🟢 잘한 점: ${goodPoint}`,
    `🟡 스스로 고쳐볼 점: ${fixPoint}`,
    `🔍 생각 더하기: ${moreQuestion}`,
  ].join('\n');
}

async function callGeminiWithFallback(apiKey: string, userPrompt: string): Promise<string> {
  for (const modelName of CANDIDATE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return text;
      }
    } catch {
      // 다음 모델 시도
    }
  }
  throw new Error('HIGH_DEMAND');
}

export async function requestCoachReview(params: {
  step1Looks: string;
  step2Clothes: string;
  step3Traits: string;
}): Promise<string> {
  const apiKey = getGeminiApiKey();

  if (apiKey) {
    try {
      const userPrompt = [
        `Step 1(생김새): ${params.step1Looks.trim()}`,
        `Step 2(옷차림): ${params.step2Clothes.trim()}`,
        `Step 3(특징): ${params.step3Traits.trim() || '(없음)'}`,
      ].join('\n');

      return await callGeminiWithFallback(apiKey, userPrompt);
    } catch {
      // 구글 Gemini 서버가 과부하(High Demand)일 때 에러 대신 즉시 내장 코치 피드백 반환
      return buildLocalSmartFeedback(params);
    }
  }

  return buildLocalSmartFeedback(params);
}

export async function requestCoachQuestion(params: {
  question: string;
  currentDraft: string;
}): Promise<string> {
  const apiKey = getGeminiApiKey();

  if (apiKey) {
    try {
      const userPrompt = [
        '초등 3~5학년 수준 영단어 1~2개와 힌트만 2문장 이내로 짧게 답하세요(문장 전체 대신 작성 금지, 💡 기호 사용).',
        params.currentDraft ? `현재 글: ${params.currentDraft.trim()}` : '',
        `질문: ${params.question.trim()}`,
      ]
        .filter(Boolean)
        .join('\n');

      return await callGeminiWithFallback(apiKey, userPrompt);
    } catch {
      return '💡 잠시 AI 질문 서버에 접속자가 많아요! 위쪽 [YBM(김) 3~5학년 교과서 단어 주머니]를 펼쳐서 필요한 단어를 먼저 찾아볼까요?';
    }
  }

  return '💡 위쪽 [YBM(김) 3~5학년 교과서 단어 주머니]를 펼쳐서 필요한 단어를 찾아보세요!';
}
