const COACH_SYSTEM_INSTRUCTION = `초등 5학년 영어 문장 코치입니다.
[절대 규칙]
1. 정답 문장·구절 직접 제시 금지(스스로 고칠 단서만 제시).
2. '주어,동사,be동사,형용사,명사,관사,단수,복수,3인칭,시제,문법' 등 문법 용어 금지('짝꿍 말','단어 주머니' 등 사용).
3. 엄격 점검(하나라도 어색하면 절대 통과 금지!):
- Step 1~3에서 같은 인물인데 He와 She 혼용 여부
- 키에 tall/short 대신 long 사용 또는 tall/short/smart 앞에 a 사용 여부
- 옷차림('He/She is wearing ~')에서 is/wearing 누락, wear/were/ware/waer 오타 여부
- 'He/She has ~'에서 have나 is 오용 여부
- 단수 옷(hat,dress,jacket,cap,coat,shirt,skirt) 앞 a 누락, 복수 옷(pants,shoes,glasses,boots,shorts) -s 누락 여부
- 첫 글자 대문자 및 끝 마침표(.) 여부
4. 항목 제목 없이 아래 아이콘 3줄(각 1문장, 존댓말)로만 출력:
🟢 (잘 쓴 단어·노력 칭찬 1문장)
🟡 (고칠 위치와 힌트 1~2가지. 오류가 전혀 없을 때만 "우리 학년 표현에 맞게 정확히 잘 썼어요! 바로 제출해도 좋아요.")
🔍 (색깔·크기·특징을 더 떠올려 보게 하는 짧은 질문 1문장)`;

function getGeminiApiKey(): string {
  return (
    import.meta.env.VITE_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY ||
    ''
  ).trim();
}

function stripFeedbackLabels(raw: string): string {
  return raw
    .replace(/🟢\s*(잘한\s*점\s*[:：\-]?\s*)?/g, '🟢 ')
    .replace(/🟡\s*(스스로\s*고쳐볼\s*점\s*[:：\-]?\s*)?/g, '🟡 ')
    .replace(/🔍\s*(생각\s*더하기\s*[:：\-]?\s*)?/g, '🔍 ')
    .trim();
}

/**
 * [1단계: 0.05초 초고속 엄격 오류 감지]
 * 명백한 오류만 0.05초 만에 즉시 잡아냅니다.
 * 주의: 여기서 오류가 안 발견되었다고 통과시키지 않고(null 반환), 반드시 Gemini AI 정밀 검사로 넘깁니다!
 */
function detectDefiniteErrorsInstantly(params: {
  step1Looks: string;
  step2Clothes: string;
  step3Traits: string;
}): string | null {
  const s1 = params.step1Looks.trim();
  const s2 = params.step2Clothes.trim();
  const s3 = params.step3Traits.trim();
  const combined = `${s1} ${s2} ${s3}`.trim();

  const errors: string[] = [];

  if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(combined) || !/[a-zA-Z]/.test(combined)) {
    errors.push("위쪽 '단어 주머니'를 펼쳐 한글 대신 영어 단어로 문장을 써 볼까요?");
  } else {
    // 1. 동일 인물 He / She 혼용
    if (/\b(he|his|him)\b/i.test(combined) && /\b(she|her)\b/i.test(combined)) {
      errors.push("한 인물을 소개하는 글인데 'He(남자)'와 'She(여자)'가 섞여 있어요! 인물에 맞게 하나로 통일해 보세요.");
    }
    // 2. 키 묘사에 long 오용 (예: she is a long / he is long)
    if (/\b(is|am|are)\s+(a\s+)?long\b/i.test(combined)) {
      errors.push("사람의 키가 크다고 할 때는 'long' 대신 'tall'을 쓰고, 앞의 'a'도 빼야 해요.");
    }
    // 3. 형용사 앞 불필요한 a/an (예: is a tall, is a short, is a smart)
    if (/\b(is|am|are)\s+a(n)?\s+(tall|short|smart|brave|kind|funny|curious|cute|pretty|big|small)\b/i.test(combined)) {
      errors.push("키나 성격을 나타내는 말('tall', 'short' 등) 앞에는 'a'를 쓰지 않아요.");
    }
    // 4. 옷차림 동사 오타 및 누락 (waer, ware, were, wear)
    if (/\b(waer|ware|wera)\b/i.test(combined)) {
      errors.push("옷을 입는다는 말은 'is wearing'이에요. 철자('w-e-a-r-i-n-g')를 단어 주머니에서 확인해 보세요.");
    } else if (s2 && /\b(he|she)\s+were\b/i.test(s2)) {
      errors.push("입고 있는 옷을 소개할 때는 'were'가 아니라 짝꿍 말 'is wearing'을 써야 해요.");
    } else if (s2 && /\b(he|she)\s+wear(s)?\b/i.test(s2)) {
      errors.push("입고 있는 옷차림을 말할 때는 'wear' 대신 'is wearing' 형태로 써 보세요.");
    } else if (s2 && /\b(he|she)\s+wearing\b/i.test(s2)) {
      errors.push("옷차림 문장에서 'He/She'와 'wearing' 사이에 짝꿍 말 'is'를 꼭 넣어 주세요.");
    }
    // 5. He/She have 오류 또는 He/She is big eyes 오류
    if (/\b(he|she)\s+have\b/i.test(combined)) {
      errors.push("'He'나 'She' 뒤에는 'have' 대신 짝꿍 말 'has'를 써 보세요.");
    }
    if (/\b(he|she)\s+is\s+(a\s+)?(big|small|long|short|curly|straight)\s+(eyes|eye|nose|hair|ears)\b/i.test(combined)) {
      errors.push("눈, 코, 머리카락 같은 신체 모습을 가지고 있다고 할 때는 'is' 대신 'has'를 써 보세요.");
    }
    // 6. 같은 글자 3연속 오타 (예: dresss, talll)
    const triple = combined.match(/\b[a-zA-Z]*([a-zA-Z])\1\1[a-zA-Z]*\b/);
    if (triple) {
      errors.push(`'${triple[0]}' 단어에 같은 알파벳이 세 번 연속 들어갔어요. 철자를 다시 확인해 보세요.`);
    }
    // 7. 복수형 의류(-s/-es) 누락 (pant, shoe, glass, boot)
    if (/\b(pant|shoe|glass|boot)\b/i.test(combined)) {
      errors.push('바지(pants), 신발(shoes), 안경(glasses), 부츠(boots)처럼 두 짝인 물건은 단어 끝에 -s나 -es를 붙여요.');
    }
    // 8. 단수 의류 앞 a 누락
    if (/\bwearing\s+(?:blue|red|yellow|white|black|green|pink|brown\s+)?(dress|hat|cap|jacket|raincoat|coat|shirt|t-shirt|skirt)\b/i.test(combined)) {
      errors.push("드레스, 모자, 재킷처럼 하나인 옷 앞에는 'a'를 붙여 보세요.");
    }
    // 9. 첫 글자 대문자 및 마침표 점검
    if ((s1 && !/^[A-Z]/.test(s1)) || (s2 && !/^[A-Z]/.test(s2)) || (s3 && !/^[A-Z]/.test(s3))) {
      errors.push('각 문장의 맨 첫 글자는 항상 큰 글자(대문자)로 시작해 주세요.');
    }
    if ((s1 && !/[.!]$/.test(s1)) || (s2 && !/[.!]$/.test(s2)) || (s3 && !/[.!]$/.test(s3))) {
      errors.push('문장 끝에는 마침표(.)를 꼭 찍어 마무리해 주세요.');
    }
  }

  // 명백한 오류가 1개 이상 발견된 경우에만 0.05초 만에 즉시 피드백 반환!
  if (errors.length > 0) {
    const goodPoint = '인물의 생김새와 옷차림을 영어로 표현하려고 시도한 점이 멋져요!';
    const fixPoint = errors.slice(0, 2).join(' ');
    const moreQuestion = s3
      ? '오류를 고친 뒤 옷이나 머리 모양에 색깔 단어를 하나 더 넣어 볼까요?'
      : '위 힌트를 보고 문장을 고친 뒤, 옷의 색깔이나 Step 3(특징·취미)도 더해 볼까요?';

    return [`🟢 ${goodPoint}`, `🟡 ${fixPoint}`, `🔍 ${moreQuestion}`].join('\n');
  }

  // 명백한 정규식 오류가 없으면 절대 혼자 통과시키지 않고 null을 반환하여 Gemini AI가 정밀 심사하게 함!
  return null;
}

async function fetchGeminiOnce(apiKey: string, userPrompt: string, useMinimalThinking: boolean): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

  const generationConfig: Record<string, any> = {
    temperature: 0.1,
    maxOutputTokens: 170,
  };
  if (useMinimalThinking) {
    generationConfig.thinkingConfig = { thinkingLevel: 'MINIMAL' };
  }

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
      generationConfig,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `HTTP ${res.status}`);
  }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error('빈 응답');
  return stripFeedbackLabels(text);
}

async function callGeminiFastAndStrict(apiKey: string, userPrompt: string): Promise<string> {
  if (!apiKey) {
    throw new Error('API 키가 설정되지 않았습니다.');
  }

  try {
    // 최소 추론(초고속) 호출과 일반 호출을 동시에 경쟁시켜 먼저 오는 응답을 즉시 채택
    return await Promise.any([
      fetchGeminiOnce(apiKey, userPrompt, true),
      fetchGeminiOnce(apiKey, userPrompt, false),
    ]);
  } catch {
    // 일시 과부하 시 1초 후 1회 최종 재시도
    await new Promise((r) => setTimeout(r, 1000));
    return await fetchGeminiOnce(apiKey, userPrompt, false);
  }
}

export async function requestCoachReview(params: {
  step1Looks: string;
  step2Clothes: string;
  step3Traits: string;
}): Promise<string> {
  // 1단계: 명백한 오류(He/She 혼용, a long, waer, pant, 대문자/마침표 누락 등)는 0.05초 만에 즉시 엄격 피드백!
  const instantErrorFeedback = detectDefiniteErrorsInstantly(params);
  if (instantErrorFeedback) {
    return instantErrorFeedback;
  }

  // 2단계: 1단계를 통과한 문장은 Gemini AI가 문맥과 세부 어법을 정밀 점검 (거짓 통과 원천 차단)
  const apiKey = getGeminiApiKey();
  const userPrompt = [
    `Step 1(생김새): ${params.step1Looks.trim()}`,
    `Step 2(옷차림): ${params.step2Clothes.trim()}`,
    `Step 3(특징): ${params.step3Traits.trim() || '(없음)'}`,
  ].join('\n');

  return await callGeminiFastAndStrict(apiKey, userPrompt);
}

export async function requestCoachQuestion(params: {
  question: string;
  currentDraft: string;
}): Promise<string> {
  const apiKey = getGeminiApiKey();

  const userPrompt = [
    '초등 3~5학년 수준 영단어 1~2개와 힌트만 2문장 이내로 짧게 답하세요(문장 전체 대신 작성 금지, 💡 기호로 시작).',
    params.currentDraft ? `현재 글: ${params.currentDraft.trim()}` : '',
    `질문: ${params.question.trim()}`,
  ]
    .filter(Boolean)
    .join('\n');

  return await callGeminiFastAndStrict(apiKey, userPrompt);
}
