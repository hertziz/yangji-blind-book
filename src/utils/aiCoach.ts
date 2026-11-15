const COACH_SYSTEM_INSTRUCTION = `초등 5학년 영어 문장 코치입니다.
[절대 규칙]
1. 정답 문장·구절 직접 제시 금지(스스로 고칠 단서만 제시).
2. '주어,동사,be동사,형용사,명사,관사,단수,복수,3인칭,시제,문법' 등 문법 용어 금지('짝꿍 말','단어 주머니' 등 사용).
3. 엄격 점검(하나라도 어색하면 절대 통과 금지!):
- Step 1~3에서 같은 인물인데 He와 She 혼용 여부
- 키에 tall/short 대신 long 사용 또는 tall/short/smart 앞에 a 사용 여부
- 옷차림('He/She is wearing ~')에서 is/wearing 누락 또는 오타 여부
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
 * API 일일 할당량(20회)을 아끼기 위해, 확실한 문법·철자 오류는 API를 쓰지 않고 즉시 잡아냅니다.
 */
function detectDefiniteErrorsInstantly(params: {
  step1Looks: string;
  step2Clothes: string;
  step3Traits: string;
}): string | null {
  const s1 = params.step1Looks.trim();
  const s2 = params.step2Clothes.trim();
  const s3 = params.step3Traits.trim();
  const combined = `${s1} ${s2}${s3}`.trim();

  const errors: string[] = [];

  if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(combined) || !/[a-zA-Z]/.test(combined)) {
    errors.push("위쪽 '단어 주머니'를 펼쳐 한글 대신 영어 단어로 문장을 써 볼까요?");
  } else {
    // 1. 동일 인물 He / She 혼용
    if (/\b(he|his|him)\b/i.test(combined) && /\b(she|her)\b/i.test(combined)) {
      errors.push("한 인물을 소개하는 글인데 'He(남자)'와 'She(여자)'가 섞여 있어요! 인물에 맞게 하나로 통일해 보세요.");
    }
    // 2. Step 1 시작 구조 점검 (He/She is 또는 He/She has로 시작하는지)
    if (s1 && !/^(he|she)\s+(is|has)\b/i.test(s1)) {
      errors.push("Step 1(생김새) 문장은 'He is ~', 'She is ~' 또는 'He has ~', 'She has ~'로 시작해 보세요.");
    }
    // 3. 키 묘사에 long 오용 또는 형용사 앞 불필요한 a/an
    if (/\b(is|am|are)\s+(a\s+)?long\b/i.test(combined)) {
      errors.push("사람의 키가 크다고 할 때는 'long' 대신 'tall'을 쓰고, 앞의 'a'도 빼야 해요.");
    } else if (/\b(is|am|are)\s+a(n)?\s+(tall|short|smart|brave|kind|funny|curious|cute|pretty|big|small)\b/i.test(combined)) {
      errors.push("키나 성격을 나타내는 말('tall', 'short' 등) 앞에는 'a'를 쓰지 않아요.");
    }
    // 4. Step 2 옷차림 필수 구조('He/She is wearing ~') 엄격 점검 (wrae, waer, ware, were 등 모든 오타 포착!)
    if (s2 && !/^(he|she)\s+is\s+wearing\b/i.test(s2)) {
      errors.push("Step 2(옷차림) 문장은 'He is wearing ~' 또는 'She is wearing ~'으로 정확히 시작해야 해요. 철자를 다시 확인해 볼까요?");
    }
    // 5. He/She is + 신체부위 오류 (has 대신 is를 쓴 경우)
    if (/\b(he|she)\s+is\s+(a\s+)?(big|small|long|short|curly|straight)?\s*(eyes|eye|nose|hair|ears)\b/i.test(combined)) {
      errors.push("눈, 코, 머리카락 같은 신체 모습을 가지고 있다고 할 때는 'is' 대신 'has'를 써 보세요.");
    }
    // 6. 같은 글자 3연속 오타 (예: dresss, talll)
    const triple = combined.match(/\b[a-zA-Z]*([a-zA-Z])\1\1[a-zA-Z]*\b/);
    if (triple) {
      errors.push(`'${triple[0]}' 단어에 같은 알파벳이 세 번 연속 들어갔어요. 철자를 다시 확인해 보세요.`); } // 7. 복수형 의류(-s/-es) 누락 (pant, shoe, glass, boot) if (/\b(pant\vert{}shoe\vert{}glass\vert{}boot)\b/i.test(combined)) { errors.push('바지(pants), 신발(shoes), 안경(glasses), 부츠(boots)처럼 두 짝인 물건은 단어 끝에 -s나 -es를 붙여요.'); } // 8. 단수 의류 앞 a 누락 if (/\bwearing\s+(?:blue\vert{}red\vert{}yellow\vert{}white\vert{}black\vert{}green\vert{}pink\vert{}brown\s+)?(dress\vert{}hat\vert{}cap\vert{}jacket\vert{}raincoat\vert{}coat\vert{}shirt\vert{}t-shirt\vert{}skirt)\b/i.test(combined)) { errors.push("드레스, 모자, 재킷처럼 하나인 옷 앞에는 'a'를 붙여 보세요."); } // 9. 첫 글자 대문자 및 마침표 점검 if ((s1 && !/^[A-Z]/.test(s1)) \vert{}\vert{} (s2 && !/^[A-Z]/.test(s2)) \vert{}\vert{} (s3 && !/^[A-Z]/.test(s3))) { errors.push('각 문장의 맨 첫 글자는 항상 큰 글자(대문자)로 시작해 주세요.'); } if ((s1 && !/[.!]$/.test(s1)) \vert{}\vert{} (s2 && !/[.!]$/.test(s2)) \vert{}\vert{} (s3 && !/[.!]$/.test(s3))) { errors.push('문장 끝에는 마침표(.)를 꼭 찍어 마무리해 주세요.'); } }  if (errors.length > 0) { const goodPoint = '인물의 생김새와 옷차림을 영어로 표현하려고 시도한 점이 멋져요!'; const fixPoint = errors.slice(0, 2).join(' '); const moreQuestion = s3 ? '오류를 고친 뒤 옷이나 머리 모양에 색깔 단어를 하나 더 넣어 볼까요?' : '위 힌트를 보고 문장을 고친 뒤, 옷의 색깔이나 Step 3(특징·취미)도 더해 볼까요?';  return [`🟢 ${goodPoint}`, `🟡 ${fixPoint}`, `🔍 ${moreQuestion}`].join('\n');
  }

  return null;
}

// 현재 API 키로 호출 가능한 모든 텍스트 모델 목록을 가져와 한도 초과(429) 시 다른 모델로 자동 우회합니다.
async function getAvailableModels(apiKey: string): Promise<string[]> {
  const defaults = [
    'gemini-3.8-flash-lite',
    'gemini-3.0-flash',
    'gemini-2.5-flash-lite',
    'gemini-3.8-pro',
    'gemini-3.8-flash',
  ];
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}` ); if (!res.ok) return defaults; const data = await res.json(); const fetched: string[] = (data.models \vert{}\vert{} []) .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent')) .map((m: any) => String(m.name).replace(/^models\//, '')) .filter((n: string) => n.includes('gemini') && !n.includes('tts') && !n.includes('image') && !n.includes('vision'));  // 한도가 꽉 찬 gemini-3.8-flash는 맨 뒤로 배치하고 다른 flash/lite 모델을 우선 배치 const others = fetched.filter((n) => n !== 'gemini-3.8-flash'); return [...others, 'gemini-3.8-flash']; } catch { return defaults; } }  async function callGeminiWithQuotaRotation(apiKey: string, userPrompt: string): Promise<string> { if (!apiKey) { throw new Error('API 키가 설정되지 않았습니다.'); }  const models = await getAvailableModels(apiKey); let lastError = '';  for (const modelName of models) { try { const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`; const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ systemInstruction: { parts: [{ text: COACH_SYSTEM_INSTRUCTION }], }, contents: [ { role: 'user', parts: [{ text: userPrompt }], }, ], generationConfig: { temperature: 0.1, maxOutputTokens: 170, }, }), });  const data = await res.json().catch(() => ({})); if (res.ok) { const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim(); if (text) return stripFeedbackLabels(text); } else { lastError = data?.error?.message \vert{}\vert{} `HTTP ${res.status}`;
        // 429(한도 초과), 404(지원 종료), 503(혼잡)이면 즉시 다음 모델로 우회!
        continue;
      }
    } catch (e: any) {
      lastError = e?.message || '오류';
    }
  }

  throw new Error(`일일 무료 AI 호출 한도를 모두 사용했어요. (${lastError})`); }  export async function requestCoachReview(params: { step1Looks: string; step2Clothes: string; step3Traits: string; }): Promise<string> { // 1단계: 필수 문장 구조(He/She is wearing 등) 및 오타는 API 횟수를 쓰지 않고 0.05초 만에 즉시 피드백! const instantErrorFeedback = detectDefiniteErrorsInstantly(params); if (instantErrorFeedback) { return instantErrorFeedback; }  // 2단계: 1단계를 통과한 문장은 사용 가능한 다른 Gemini 모델을 순회하며 정밀 점검 const apiKey = getGeminiApiKey(); const userPrompt = [ `Step 1(생김새): ${params.step1Looks.trim()}`,
    `Step 2(옷차림): ${params.step2Clothes.trim()}`, `Step 3(특징): ${params.step3Traits.trim() || '(없음)'}`,
  ].join('\n');

  return await callGeminiWithQuotaRotation(apiKey, userPrompt);
}

export async function requestCoachQuestion(params: {
  question: string;
  currentDraft: string;
}): Promise<string> {
  const apiKey = getGeminiApiKey();

  const userPrompt = [
    '초등 3~5학년 수준 영단어 1~2개와 힌트만 2문장 이내로 짧게 답하세요(문장 전체 대신 작성 금지, 💡 기호로 시작).',
    params.currentDraft ? `현재 글: ${params.currentDraft.trim()}` : '', `질문: ${params.question.trim()}`,
  ]
    .filter(Boolean)
    .join('\n');

  return await callGeminiWithQuotaRotation(apiKey, userPrompt);
}
