import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COACH_SYSTEM_INSTRUCTION = `당신은 대한민국 초등학교 5학년 영어 수업을 돕는 다정한 '영어 문장 코치'입니다. 다음 5가지 규칙을 엄격히 지키세요.

1. [정답 직접 제시 절대 금지]:
   - 학생의 영어 문장에 철자나 표현 오류가 있어도 절대로 고쳐진 정답 문장이나 완성된 영어 구절을 직접 적어주지 마세요.
   - 학생이 스스로 어느 부분을 고쳐야 할지 생각할 수 있도록 단서(힌트)만 안내하세요.

2. [초간결 3줄 존댓말 피드백]:
   - 학생들은 긴 글을 읽기 싫어합니다. 반드시 친절한 존댓말을 사용하고, 각 항목을 1~2문장 이내로 짧게 작성하세요.
   - 출력 형식은 반드시 아래 3줄 구조만 사용하세요:
     🟢 잘한 점: (학생이 쓴 표현 중 자연스럽거나 조건에 잘 맞는 부분 1문장 칭찬)
     🟡 스스로 고쳐볼 점: (고쳐야 할 위치와 생각할 단서만 1~2문장으로 제시. 고칠 곳이 전혀 없으면 "우리 학년 표현에 맞게 정확히 잘 썼어요! 바로 제출해도 좋아요."라고 작성)
     🔍 생각 더하기: (친구들이 이 인물을 더 생생하게 상상할 수 있도록 색깔, 크기, 특징 등을 한 가지 더 떠올려 보게 하는 짧은 탐구 질문 1문장)

3. [선행학습금지법 및 2022 개정 교육과정(초 3~5학년 YBM 김) 수준 엄수]:
   - '주어, 동사, be동사, 일반동사, 형용사, 명사, 관사, 단수, 복수, 3인칭, 수일치, 시제, 현재진행형, 문법, 어순, 구문' 같은 상위 학교 문법 용어는 절대로 사용하지 마세요.
   - 대신 초등학생 눈높이 말로 설명하세요:
     * 예1 (is wearing에서 is 누락 시): "입고 있는 옷을 소개할 때는 'He/She'와 'wearing' 사이에 짝꿍 말('is')이 꼭 들어가야 해요."
     * 예2 (has 대신 have 사용 시): "한 명('He' 또는 'She')이 가진 것을 말할 때는 'have' 대신 모양이 조금 다른 짝꿍 말을 써요. 왼쪽 표현 주머니를 확인해 볼까요?"
     * 예3 (a/an 누락 시): "모자나 코트처럼 셀 수 있는 물건이 하나일 때는 단어 앞에 '하나'를 뜻하는 짧은 말('a' 또는 'an')을 붙여보세요."
     * 예4 (대문자/마침표 오류): "문장의 맨 첫 글자 크기와 문장 끝에 찍는 점을 다시 확인해 보세요."

4. [학생 질문('표현·단어 질문하기') 답변 규칙]:
   - 학생이 궁금한 표현을 물어보면 문장 전체를 대신 만들어 주지 말고, 3~5학년 수준에서 쓸 수 있는 핵심 영단어 1~2개와 활용 힌트만 2문장 이내로 짧게 알려주세요.

5. [이모티콘 절제]:
   - 항목 맨 앞의 구분 기호(🟢, 🟡, 🔍, 💡) 외에는 문장 중간에 불필요한 이모티콘을 남발하지 마세요.`;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '1mb' }));

  // 1. AI Sentence Self-Check Endpoint
  app.post('/api/coach/review', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: '선생님께 AI 연결 설정을 확인해 달라고 요청해 주세요.',
      });
      return;
    }

    const { step1Looks = '', step2Clothes = '', step3Traits = '' } = req.body ?? {};
    if (!String(step1Looks).trim() || !String(step2Clothes).trim()) {
      res.status(400).json({
        error: 'Step 1(생김새)과 Step 2(옷차림) 영어 문장을 먼저 작성해 주세요.',
      });
      return;
    }

    const userPrompt = [
      '다음은 초등학교 5학년 학생이 작성한 등장인물 영어 소개글입니다. 시스템 지침의 5가지 규칙(특히 정답 직접 제시 금지, 문법 용어 금지, 반드시 🟢/🟡/🔍 3줄 형식)을 엄격히 지켜 피드백해 주세요.',
      '',
      `[Step 1. 생김새 묘사(필수)]: ${String(step1Looks).trim()}`,
      `[Step 2. 옷차림 묘사(필수)]: ${String(step2Clothes).trim()}`,
      `[Step 3. 특징·취미·능력(심화 선택)]: ${String(step3Traits).trim() || '(작성하지 않음)'}`,
    ].join('\n');

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userPrompt,
        config: {
          systemInstruction: COACH_SYSTEM_INSTRUCTION,
        },
      });

      const feedback = (response.text ?? '').trim();
      if (!feedback) {
        res.status(502).json({ error: '잠시 인터넷 연결을 확인하고 다시 눌러주세요.' });
        return;
      }

      res.json({ feedback });
    } catch (err) {
      console.error('Gemini review error:', err);
      res.status(500).json({
        error: '잠시 인터넷 연결을 확인하고 다시 눌러주세요.',
      });
    }
  });

  // 2. AI Vocabulary / Expression Question Endpoint
  app.post('/api/coach/ask', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: '선생님께 AI 연결 설정을 확인해 달라고 요청해 주세요.',
      });
      return;
    }

    const { question = '', currentDraft = '' } = req.body ?? {};
    const cleanQuestion = String(question).trim();
    if (!cleanQuestion) {
      res.status(400).json({ error: '궁금한 표현이나 단어를 입력해 주세요.' });
      return;
    }

    const userPrompt = [
      '학생이 [표현·단어 질문하기]에 질문했습니다. 시스템 지침 4번(문장 전체를 대신 만들어 주지 말고, 초등 3~5학년 수준 핵심 영단어 1~2개와 활용 힌트만 2문장 이내로 짧게 안내, 문법 용어 금지, 💡 기호 활용 가능)을 꼭 지켜 답변해 주세요.',
      currentDraft ? `학생이 현재 쓰고 있는 글 참고: ${String(currentDraft).trim()}` : '',
      `학생 질문: ${cleanQuestion}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userPrompt,
        config: {
          systemInstruction: COACH_SYSTEM_INSTRUCTION,
        },
      });

      const answer = (response.text ?? '').trim();
      if (!answer) {
        res.status(502).json({ error: '잠시 인터넷 연결을 확인하고 다시 눌러주세요.' });
        return;
      }

      res.json({ answer });
    } catch (err) {
      console.error('Gemini ask error:', err);
      res.status(500).json({
        error: '잠시 인터넷 연결을 확인하고 다시 눌러주세요.',
      });
    }
  });

  // Vite dev middleware or static production build
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
