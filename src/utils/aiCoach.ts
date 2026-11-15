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
    if (
