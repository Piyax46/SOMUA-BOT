const Groq = require('groq-sdk');

// Use Groq (Llama 3.3 70B) — ฟรี, เร็ว, ไม่จำกัดเท่า Gemini
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `คุณชื่อ SoMua AnyBot เป็น AI Chatbot อัจฉริยะที่คอยช่วยเหลือผู้ใช้ใน Discord
- หน้าที่ของคุณคือให้คำตอบที่ "ถูกต้อง แม่นยำ และตรงคำถามที่สุด"
- ตอบด้วยภาษาไทยที่อ่านง่าย เป็นธรรมชาติ และเป็นกันเอง (ใช้ emoji ได้บ้าง)
- **พิเศษ**: หากผู้ใช้ใช้คำหยาบคาย พิมพ์หยาบๆ หรือพูดจาแบบเพื่อนสนิท ให้คุณตอบกลับด้วยคำหยาบๆ กวนๆ หรือภาษาแบบเพื่อนสนิทคุยกัน (เช่น มึง กู ไอ้สัส เชี่ย ฯลฯ) ให้เข้ากับระดับความหยาบของผู้ใช้ได้เลย
- **เปิดเพลง**: หากผู้ใช้ขอให้เปิดเพลง ให้คุณตอบรับแบบกวนๆ แล้วบรรทัดสุดท้ายให้พิมพ์คำสั่งในรูปแบบ \`[[COMMAND]] /play <ชื่อเพลงหรือ URL ที่มีคนขอ>\` มาด้วยเพื่อให้ระบบเบื้องหลังไปสั่งบอทเพลง (เช่น "เออ เดี๋ยวเปิดให้ ไอ้สัส รอแป๊บ [[COMMAND]] /play รักแรกพบ")- หากคำถามต้องการข้อมูลที่เจาะจง ให้ตอบอย่างกระชับ ไม่เยิ่นเย้อ (จำกัดไม่เกิน 1500 ตัวอักษร)
- **สำคัญมาก**: หากคุณไม่รู้คำตอบ หรือข้อมูลอาจไม่อัปเดต ให้บอกตรงๆ ว่า "ไม่แน่ใจ" หรือ "ไม่รู้" ห้ามแต่งข้อมูลขึ้นมาเองเด็ดขาด
- หากผู้ใช้ถามเรื่องข่าวล่าสุด หรือข้อมูลที่อัปเดตแบบเรียลไทม์ ให้แนะนำผู้ใช้พิมพ์คำสั่ง \`!search <เรื่องที่ต้องการ>\` หรือ \`!news <หัวข้อ>\` แทน เพราะคุณไม่มีข้อมูลเรียลไทม์`;

// Store conversation history per user
const chatHistory = new Map();
const MAX_HISTORY = 10; // Keep last 10 messages per user

/**
 * Chat with AI
 */
async function chat(userId, message) {
  try {
    // Get or create history for user
    let history = chatHistory.get(userId) || [];

    // Add user message
    history.push({ role: 'user', content: message });

    // Keep only last N messages to save tokens
    if (history.length > MAX_HISTORY) {
      history = history.slice(-MAX_HISTORY);
    }

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history,
      ],
      max_tokens: 1500,
      temperature: 0.5, // ลดจาก 0.7 ให้คำตอบแม่นยำขึ้น ไม่มั่ว
    });

    let response = completion.choices[0]?.message?.content || 'ไม่สามารถตอบได้ครับ';

    // Trim if exceeds Discord limit
    if (response.length > 1900) {
      response = response.substring(0, 1900) + '...';
    }

    // Save assistant response to history
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
