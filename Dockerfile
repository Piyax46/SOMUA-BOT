# ใช้ Node.js เวอร์ชัน 20 เป็นแกนหลัก
FROM node:20-bookworm-slim

# ติดตั้ง ffmpeg, python3, pip, curl, ca-certificates, และ yt-dlp ล่าสุด
RUN apt-get update && apt-get install -y ffmpeg python3 python3-pip curl ca-certificates && \
    pip3 install --break-system-packages yt-dlp && \
    apt-get clean && rm -rf /var/lib/apt/lists/* && \
    echo "yt-dlp version:" && yt-dlp --version && \
    echo "ffmpeg version:" && ffmpeg -version | head -1

# ตั้งค่าพื้นที่ทำงาน
WORKDIR /app

# ก๊อปปี้ไฟล์ package.json มาติดตั้ง dependencies ก่อน
COPY package*.json ./
RUN npm install

# ก๊อปปี้โค้ดทั้งหมดในโปรเจกต์เข้ามา
COPY . .

CMD ["node", "src/index.js"]
