const COACH_SYSTEM_INSTRUCTION = `당신은 대한민국 초등학교 5학년 영어 수업을 돕는 엄격하고 다정한 '영어 문장 코치'입니다.
학생이 쓴 등장인물 소개글(Step 1~3)을 아래 기준으로 철저히 점검하세요.

[절대 엄수 규칙]
1. 정답 직접 제시 금지: 고쳐진 정답 영어 문장이나 완성된 정답 구절을 직접 적어주지 마세요. 학생이 스스로 생각해서 고칠 수 있도록 '어느 단어/위치가 왜 어색한지' 단서(힌트)만 구체적으로 짚어주세요.
2. 상위 문법 용어 금지: '주어, 동사, be동사, 일반동사, 형용사, 명사, 관사, 단수, 복수, 3인칭, 수일치, 시제, 현재진행형, 과거형, 문법, 어순' 같은 문법 용어는 절대 쓰지 마세요. 대신 '짝꿍 말', '단어 주머니', '움직임을 나타내는 말', '셀 수 있는 물건 하나를 뜻하는 말(a/an)' 등 초등학생 눈높이 말로 풀어서 설명하세요.
3. 엄격한 오류 점검 체크리스트 (하나라도 틀리면 절대 통과시키지 마세요!):
   - Step 1(생김새)과 Step 2(옷차림)가 같은 인물인데 'He'와 'She'를 섞어 썼는가?
   - 사람의 키를 말할 때 'tall/short' 대신 'long' 같은 잘못된 단어를 썼는가? (예: "She is a long" -> 사람의 키에는 long을 쓰지 않고, 키를 나타내는 말 앞에는 a도 쓰지 않음을 지적)
   - 키나 성격을 나타내는 말(tall, short, smart 등) 앞에 불필요한 'a/an'을 붙였는가?
   - 옷을 입고 있다는 표현('He/She is wearing ~')에서 'is'나 'wearing'이 빠졌거나, 'were/ware/waer/wear' 같은 오타나 다른 단어를 썼는가? (예: "She were pants" -> 입고 있는 옷을 말할 때는 'were'가 아니라 짝꿍 말 'is wearing'을 써야 함을 지적)
   - 'He/She has ~'에서 'has' 대신 'have'를 썼거나 'He is big eyes'처럼 'has' 대신 'is'를 잘못 썼는가?
   - 모자(a hat), 드레스(a dress) 등 하나인 물건 앞에 'a/an'이 빠졌거나, 바지(pants)·신발(shoes)·안경(glasses)에 '-s/-es'가 빠졌는가?
   - 문장 첫 글자 대문자 및 문장 끝 마침표(.)가 정확한가?
4. 출력 형식 (항목 제목 글자는 절대 쓰지 말고, 반드시 아래 아이콘 3줄로만 각 1~2문장 존댓말로 답하세요):
🟢 (학생이 쓴 단어 중 의미가 통하거나 노력한 부분 1문장 칭찬)
🟡 (위 체크리스트에서 발견된 고쳐야 할 위치와 힌트 1~2문장. 단, 모든 문장에 오류가 단 하나도 없을 때만 "우리 학년 표현에 맞게 정확히 잘 썼어요! 바로 제출해도 좋아요."라고 출력)
🔍 (친구들이 인물을 더 생생히 상상하도록 색깔, 크기, 특징 등을 한 가지 더 떠올려 보게 하는 짧은 질문 1문장)`;

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGeminiStrict(apiKey: string, userPrompt: string): Promise<string> {
  if (!apiKey) {
    throw new Error('API 키가 설정되지 않았습니다. Netlify 환경변수를 확인해 주세요.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  let lastErrorMsg = '';

  // 구글 서버 일시 혼잡(503/429) 시 1.2초 간격으로 최대 3회 자동 재시도
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
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
            temperature: 0.2,
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return stripFeedbackLabels(text);
      } else {
        lastErrorMsg = data?.error?.message || `HTTP ${res.status}`;
        if (res.status === 503 || res.status === 429) {
          await sleep(1200 * (attempt + 1));
          continue;
        }
        break;
      }
    } catch (err: any) {
      lastErrorMsg = err?.message || '네트워크 연결 오류';
      await sleep(1000);
    }
  }

  throw new Error(
    `지금 AI 코치 서버에 접속자가 많아 응답이 지연되고 있어요. 2~3초 뒤에 [🔍 내 영어 문장 점검받기] 버튼을 한 번 더 눌러주세요! (${lastErrorMsg})`
  );
}

export async function requestCoachReview(params: {
  step1Looks: string;
  step2Clothes: string;
  step3Traits: string;
}): Promise<string> {
  const apiKey = getGeminiApiKey();

  const userPrompt = [
    '아래 초등학교 5학년 학생이 쓴 문장을 [절대 엄수 규칙]의 체크리스트에 따라 엄격하게 점검해 주세요. 틀린 표현이나 오타가 하나라도 있으면 절대 바로 제출하라고 하지 말고 🟡에 힌트를 주세요.',
    `Step 1(생김새 묘사 - 필수): ${params.step1Looks.trim()}`,
    `Step 2(옷차림 묘사 - 필수): ${params.step2Clothes.trim()}`,
    `Step 3(특징·취미·능력 - 선택): ${params.step3Traits.trim() || '(작성하지 않음)'}`,
  ].join('\n');

  return await callGeminiStrict(apiKey, userPrompt);
}

export async function requestCoachQuestion(params: {
  question: string;
  currentDraft: string;
}): Promise<string> {
  const apiKey = getGeminiApiKey();

  const userPrompt = [
    '초등 3~5학년 수준 영단어 1~2개와 활용 힌트만 2문장 이내로 짧게 답하세요(문장 전체 대신 작성 금지, 문법 용어 금지, 💡 기호로 시작).',
    params.currentDraft ? `현재 학생이 쓴 글: ${params.currentDraft.trim()}` : '',
    `학생 질문: ${params.question.trim()}`,
  ]
    .filter(Boolean)
    .join('\n');

  return await callGeminiStrict(apiKey, userPrompt);
}
