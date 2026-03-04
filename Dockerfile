# ใช้ Node.js เวอร์ชัน 20 เป็นแกนหลัก
FROM node:20-bookworm-slim

# ติดตั้ง ffmpeg, python3 และ curl ให้ตัว OS
RUN apt-get update && apt-get install -y ffmpeg python3 curl

# โหลด yt-dlp แบบเจาะจง เพื่อแก้ปัญหาหา python ไม่เจอ
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
RUN chmod a+rx /usr/local/bin/yt-dlp

# ตั้งค่าพื้นที่ทำงาน
WORKDIR /app

# ก๊อปปี้ไฟล์ package.json มาติดตั้ง dependencies ก่อน
COPY package*.json ./
RUN npm install

# ก๊อปปี้โค้ดทั้งหมดในโปรเจกต์เข้ามา
COPY . .

# ⚠️ คำสั่งรันบอท (แก้ "index.js" ให้ตรงกับชื่อไฟล์ที่คุณใช้รันบอทจริงๆ นะครับ)
CMD ["node", "index.js"]