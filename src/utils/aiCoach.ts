const COACH_SYSTEM_INSTRUCTION = `대한민국 초등 5학년 영어 코치입니다.
규칙:
1. 정답 영어 문장·구절 직접 제시 절대 금지(힌트만 제공).
2. '주어,동사,be동사,형용사,명사,관사,단수,복수,3인칭,시제,문법' 등 문법 용어 절대 금지. 초등 눈높이 표현('짝꿍 말', '단어 주머니' 등)만 사용.
3. Step 1~3에서 같은 인물을 소개하는데 'He'와 'She'가 섞여 있으면 한 가지로 통일하도록 안내하세요.
4. 항목 이름('잘한 점:' 등)은 절대 쓰지 말고, 반드시 아래처럼 아이콘으로만 시작하는 초간결 3줄(각 1문장, 45자 이내) 존댓말로만 답하세요:
🟢 (칭찬 1문장)
🟡 (고칠 위치와 힌트 1~2가지. 완벽하면 "우리 학년 표현에 맞게 정확히 잘 썼어요! 바로 제출해도 좋아요.")
🔍 (색깔·크기·특징을 더 떠올려 보게 하는 짧은 질문 1문장)`;

function getGeminiApiKey(): string {
  return (
    import.meta.env.VITE_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY ||
    ''
  ).trim();
}

// 내장 스마트 규칙 코치 (0.1초 즉시 응답, 아이콘 단독 초간결 버전)
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

  if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(combined) || !/[a-zA-Z]/.test(combined)) {
    hints.push("한글이나 기호 대신 위쪽 '단어 주머니'를 펼쳐 영어 단어로 써 볼까요?");
  } else {
    // 1. 동일 인물 He / She 혼용 검사 (최우선 피드백)
    const hasHe = /\b(he|his|him)\b/i.test(combined);
    const hasShe = /\b(she|her)\b/i.test(combined);
    if (hasHe && hasShe) {
      hints.push("한 인물을 소개하는 글인데 'He(남자)'와 'She(여자)'가 섞여 있어요! 인물에 맞게 하나로 통일해 보세요.");
    }

    // 2. 첫 글자 대문자 점검
    if ((s1 && !/^[A-Z]/.test(s1)) || (s2 && !/^[A-Z]/.test(s2)) || (s3 && !/^[A-Z]/.test(s3))) {
      hints.push('각 문장의 맨 첫 글자는 큰 글자(대문자)로 시작해 보세요.');
    }

    // 3. 키·성격 형용사 앞 불필요한 a/an
    if (/\b(is|am|are)\s+a(n)?\s+(tall|short|smart|brave|kind|funny|curious|cute|pretty)\b/i.test(combined)) {
      hints.push("키나 성격을 나타내는 말('tall', 'short' 등) 앞에는 'a'를 붙이지 않아요.");
    }

    // 4. He/She have 오류
    if (/\b(he|she)\s+have\b/i.test(combined)) {
      hints.push("'He'나 'She' 뒤에는 'have' 대신 짝꿍 말 'has'를 써 보세요.");
    }

    // 5. 옷차림 wearing 및 오타(waer, ware) 점검
    if (/\b(waer|ware|wera)\b/i.test(combined)) {
      hints.push("옷을 입는다는 말은 'is wearing'이에요. 철자를 단어 주머니에서 확인해 보세요.");
    } else if (s2 && /\b(he|she)\s+wear(s)?\b/i.test(s2)) {
      hints.push("입고 있는 옷을 말할 때는 'wear' 대신 'is wearing'으로 써 보세요.");
    } else if (s2 && /\b(he|she)\s+wearing\b/i.test(s2)) {
      hints.push("'He/She'와 'wearing' 사이에 짝꿍 말 'is'를 넣어 보세요.");
    }

    // 6. 같은 알파벳 3연속 오타 (예: dresss, talll)
    const tripleMatch = combined.match(/\b[a-zA-Z]*([a-zA-Z])\1\1[a-zA-Z]*\b/);
    if (tripleMatch) {
      hints.push(`'${tripleMatch[0]}' 단어에 같은 글자가 세 번 연속 들어갔어요. 철자를 확인해 볼까요?`);
    }

    // 7. 단수 의류 앞 a 누락 (예: wearing dress, wearing red hat)
    if (/\bwearing\s+(?:blue|red|yellow|white|black|green|pink|brown|long|short\s+)?(dress|hat|cap|jacket|raincoat|coat|shirt|t-shirt|skirt)\b/i.test(combined)) {
      hints.push("모자나 드레스, 재킷처럼 하나인 옷 앞에는 'a'를 붙여 보세요.");
    }

    // 8. 복수형 의류(-s/-es) 누락
    if (/\b(pant|shoe|glass|boot|short)\b/i.test(combined) && !/\bshort\s+(hair|coat|skirt|dress)\b/i.test(combined)) {
      hints.push('바지(pants), 신발(shoes), 안경(glasses)처럼 짝을 이루는 물건은 끝에 -s나 -es를 붙여요.');
    }

    // 9. 문장 끝 마침표(.) 누락 또는 쉼표(,)로 끝난 경우
    if ((s1 && !/[.!]$/.test(s1)) || (s2 && !/[.!]$/.test(s2)) || (s3 && !/[.!]$/.test(s3))) {
      hints.push('문장 끝에는 쉼표(,) 대신 마침표(.)를 찍어 마무리해 주세요.');
    }
  }

  const goodPoint =
    /[a-zA-Z]{2,}/.test(s1) && /[a-zA-Z]{2,}/.test(s2)
      ? '생김새와 옷차림 단서를 모두 영어로 멋지게 채웠네요!'
      : '인물의 특징을 떠올리며 영어 문장 쓰기에 도전한 점이 멋져요!';

  const fixPoint =
    hints.length > 0
      ? hints.slice(0, 2).join(' ')
      : '우리 학년 표현에 맞게 정확히 잘 썼어요! 바로 제출해도 좋아요.';

  const moreQuestion = s3
    ? '옷이나 머리 모양에 색깔(blue, red 등) 단어를 하나 더 넣어 볼까요?'
    : '옷의 색깔을 더하거나 Step 3(특징·취미)도 한 줄 도전해 볼까요?';

  return [`🟢 ${goodPoint}`, `🟡 ${fixPoint}`, `🔍 ${moreQuestion}`].join('\n');
}

// Gemini가 혹시 '🟢 잘한 점:' 처럼 라벨을 붙여서 보내더라도 아이콘만 남기고 제거하는 후처리 함수
function stripFeedbackLabels(raw: string): string {
  return raw
    .replace(/🟢\s*(잘한\s*점\s*[:：\-]?\s*)?/g, '🟢 ')
    .replace(/🟡\s*(스스로\s*고쳐볼\s*점\s*[:：\-]?\s*)?/g, '🟡 ')
    .replace(/🔍\s*(생각\s*더하기\s*[:：\-]?\s*)?/g, '🔍 ')
    .trim();
}

async function callGeminiFastWithCutoff(
  apiKey: string,
  userPrompt: string,
  cutoffMs = 2500
): Promise<string> {
  const fetchPromise = (async () => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
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
          maxOutputTokens: 180,
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error('API_ERROR');
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new Error('EMPTY');
    return stripFeedbackLabels(text);
  })();

  const timeoutPromise = new Promise<string>((_, reject) => {
    window.setTimeout(() => reject(new Error('TIMEOUT')), cutoffMs);
  });

  return await Promise.race([fetchPromise, timeoutPromise]);
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

      return await callGeminiFastWithCutoff(apiKey, userPrompt, 2500);
    } catch {
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

      return await callGeminiFastWithCutoff(apiKey, userPrompt, 3500);
    } catch {
      return '💡 위쪽 [YBM(김) 3~5학년 교과서 단어 주머니]를 펼쳐서 필요한 단어를 먼저 찾아볼까요?';
    }
  }

  return '💡 위쪽 [YBM(김) 3~5학년 교과서 단어 주머니]를 펼쳐서 필요한 단어를 찾아보세요!';
}
