const Groq = require('groq-sdk');

// Use Groq (Llama 3.3 70B) — ฟรี, เร็ว (lazy init to avoid crash on import)
let groq = null;
function getGroq() {
    if (!groq) {
        groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }
    return groq;
}

const SYSTEM_PROMPT = `คุณชื่อ SoMua Bot เป็น AI Chatbot อัจฉริยะที่คอยช่วยเหลือผู้ใช้ใน Discord
- หน้าที่ของคุณคือให้คำตอบที่ "ถูกต้อง แม่นยำ และตรงคำถามที่สุด"
- ตอบด้วยภาษาไทยที่อ่านง่าย เป็นธรรมชาติ และเป็นกันเอง (ใช้ emoji ได้บ้าง)
- **พิเศษ**: หากผู้ใช้ใช้คำหยาบคาย พิมพ์หยาบๆ หรือพูดจาแบบเพื่อนสนิท ให้คุณตอบกลับด้วยคำหยาบๆ กวนๆ หรือภาษาแบบเพื่อนสนิทคุยกัน (เช่น มึง กู ไอ้สัส เชี่ย ฯลฯ) ให้เข้ากับระดับความหยาบของผู้ใช้ได้เลย

## คำสั่งพิเศษที่คุณสามารถสั่งระบบเบื้องหลังได้:

### 🎵 เปิดเพลง
หากผู้ใช้ขอให้เปิดเพลง (เช่น "เปิดเพลงรักแรกพบ", "อยากฟังเพลง XXX", "เล่นเพลง YYY ให้หน่อย") ให้คุณ:
1. ตอบรับแบบเป็นกันเอง
2. บรรทัดสุดท้ายพิมพ์: \`[[PLAY]] ชื่อเพลงหรือ URL\`
ตัวอย่าง: "เออ เดี๋ยวเปิดให้ รอแป๊บ 🎵 [[PLAY]] รักแรกพบ"
ตัวอย่าง: "ได้เลยๆ 🎶 [[PLAY]] ลุงพล ป้าแต๋น"

### 🔍 ค้นหา
หากผู้ใช้ขอให้ค้นหาข้อมูล (เช่น "ช่วยหาวิธีทำข้าวผัดให้หน่อย", "search xxx") ให้คุณ:
1. ตอบรับสั้นๆ
2. บรรทัดสุดท้ายพิมพ์: \`[[SEARCH]] คำค้นหา\`
ตัวอย่าง: "เดี๋ยวหาให้ 🔍 [[SEARCH]] วิธีทำข้าวผัด"

### 📰 ข่าว
หากผู้ใช้ถามเรื่องข่าว (เช่น "มีข่าวอะไรเกี่ยวกับเศรษฐกิจไทย", "ข่าวล่าสุดเรื่อง xxx") ให้คุณ:
1. ตอบรับสั้นๆ
2. บรรทัดสุดท้ายพิมพ์: \`[[NEWS]] หัวข้อข่าว\`
ตัวอย่าง: "เดี๋ยวเช็คข่าวให้ 📰 [[NEWS]] เศรษฐกิจไทย"

## กฎสำคัญ:
- จำกัดคำตอบไม่เกิน 1500 ตัวอักษร
- หากไม่รู้คำตอบ ให้บอกตรงๆ ว่า "ไม่แน่ใจ" ห้ามแต่งข้อมูลขึ้นมาเอง
- ใช้ [[PLAY]], [[SEARCH]], [[NEWS]] ได้ครั้งละ 1 คำสั่งเท่านั้น
- **สำคัญ**: Tag คำสั่ง [[PLAY]]/[[SEARCH]]/[[NEWS]] ต้องอยู่บรรทัดสุดท้ายเสมอ`;

// Store conversation history per user
const chatHistory = new Map();
const MAX_HISTORY = 10;

/**
 * Chat with AI
 */
async function chat(userId, message) {
  try {
    let history = chatHistory.get(userId) || [];
    history.push({ role: 'user', content: message });

    if (history.length > MAX_HISTORY) {
      history = history.slice(-MAX_HISTORY);
    }

    const completion = await getGroq().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history,
      ],
      max_tokens: 1500,
      temperature: 0.5,
    });

    let response = completion.choices[0]?.message?.content || 'ไม่สามารถตอบได้ครับ';

    if (response.length > 1900) {
      response = response.substring(0, 1900) + '...';
    }

    history.push({ role: 'assistant', content: response });
    chatHistory.set(userId, history);

    return response;
  } catch (error) {
    console.error('AI Error:', error.message);

    if (error.status === 429) {
      return '⏳ ขอโทษครับ ตอนนี้มีคนใช้เยอะ รอสักครู่แล้วลองใหม่นะครับ';
    }

    return '❌ เกิดข้อผิดพลาดในการตอบกลับ ลองใหม่อีกทีนะครับ';
  }
}

// Clear old sessions periodically (every 30 minutes)
setInterval(() => {
  chatHistory.clear();
  console.log('🧹 Cleared all chat history');
}, 30 * 60 * 1000);

module.exports = { chat };
