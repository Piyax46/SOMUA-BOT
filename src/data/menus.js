/**
 * เมนูอาหาร แบ่งตามหมวดหมู่
 */
const menus = {
    thai: {
        category: '🇹🇭 อาหารไทย',
        items: [
            { name: 'ข้าวผัดกระเพราหมูสับ', emoji: '🌶️', note: 'ไข่ดาวด้วยเด็ดมาก!' },
            { name: 'ผัดไทยกุ้งสด', emoji: '🍤', note: 'เมนูระดับชาติ' },
            { name: 'ต้มยำกุ้ง', emoji: '🍲', note: 'ร้อนๆ เผ็ดๆ ซดน้ำซุป' },
            { name: 'ส้มตำไก่ย่าง', emoji: '🥗', note: 'แซ่บอีสาน' },
            { name: 'แกงเขียวหวานไก่', emoji: '🍛', note: 'หอมกะทิ' },
            { name: 'ข้าวมันไก่', emoji: '🍗', note: 'เมนูง่ายๆ อิ่มท้อง' },
            { name: 'กะเพราปลาหมึก', emoji: '🦑', note: 'กรอบนอกนุ่มใน' },
            { name: 'ข้าวซอย', emoji: '🍜', note: 'สไตล์เชียงใหม่' },
            { name: 'แกงส้มชะอมไข่', emoji: '🥘', note: 'เปรี้ยวๆ สดชื่น' },
            { name: 'หมูสะเต๊ะ', emoji: '🥩', note: 'จิ้มซอสถั่ว อร่อยมาก' },
            { name: 'ลาบหมู', emoji: '🥬', note: 'เมนูอีสานแท้ๆ' },
            { name: 'ยำวุ้นเส้น', emoji: '🥗', note: 'แซ่บ เปรี้ยว อร่อย' },
            { name: 'ผัดซีอิ๊ว', emoji: '🍝', note: 'หอมน้ำมันหอย' },
            { name: 'ข้าวคลุกกะปิ', emoji: '🍚', note: 'กินกับกุ้งแห้ง' },
            { name: 'แกงมัสมั่นไก่', emoji: '🍛', note: 'เข้มข้น หอมเครื่องแกง' },
        ],
    },
    japanese: {
        category: '🇯🇵 อาหารญี่ปุ่น',
        items: [
            { name: 'ราเมน', emoji: '🍜', note: 'น้ำซุปเข้มข้น เส้นเหนียวนุ่ม' },
            { name: 'ซูชิ', emoji: '🍣', note: 'สดใหม่จากทะเล' },
            { name: 'ข้าวหน้าแซลมอน (Salmon Don)', emoji: '🐟', note: 'ไขมันดี อร่อยด้วย' },
            { name: 'คัตสึดง (Katsudon)', emoji: '🍖', note: 'หมูทอดไข่ข้น' },
            { name: 'อุด้ง', emoji: '🍲', note: 'เส้นใหญ่เหนียวนุ่ม' },
            { name: 'กิวด้ง (Gyudon)', emoji: '🥩', note: 'ข้าวหน้าเนื้อ เมนูง่ายๆ' },
            { name: 'โอโคโนมิยากิ', emoji: '🥞', note: 'พิซซ่าญี่ปุ่น!' },
            { name: 'เทมปุระ', emoji: '🍤', note: 'ทอดกรอบ เบาๆ' },
        ],
    },
    streetfood: {
        category: '🛒 อาหารตามสั่ง/ริมทาง',
        items: [
            { name: 'ก๋วยเตี๋ยวเรือ', emoji: '🍜', note: 'น้ำซุปเข้มข้น' },
            { name: 'ข้าวขาหมู', emoji: '🍖', note: 'เปื่อยนุ่ม น้ำจิ้มแซ่บ' },
            { name: 'หมูปิ้ง + ข้าวเหนียว', emoji: '🥩', note: 'เมนู street food ระดับโลก' },
            { name: 'บะหมี่เกี๊ยว', emoji: '🍜', note: 'น้ำใส หรือแห้ง ก็อร่อย' },
            { name: 'ข้าวหมูแดง', emoji: '🍚', note: 'หมูแดงหอมๆ ราดน้ำแดง' },
            { name: 'โจ๊ก', emoji: '🥣', note: 'มื้อเช้าง่ายๆ อุ่นท้อง' },
            { name: 'ไข่เจียว + ข้าวสวย', emoji: '🍳', note: 'King of เมนูง่ายๆ' },
            { name: 'ราดหน้า', emoji: '🍝', note: 'หมี่กรอบ หรือเส้นใหญ่' },
            { name: 'ข้าวต้มปลา', emoji: '🐟', note: 'ร้อนๆ ซดน้ำซุป' },
            { name: 'ผัดมาม่า', emoji: '🍜', note: 'เมนูนักศึกษา ตำนานที่แท้จริง' },
        ],
    },
    dessert: {
        category: '🍰 ของหวาน',
        items: [
            { name: 'ข้าวเหนียวมะม่วง', emoji: '🥭', note: 'ของหวานไทยอันดับ 1' },
            { name: 'โรตีกล้วยไข่', emoji: '🥞', note: 'หวาน มัน กรอบ' },
            { name: 'ไอศกรีมกะทิ', emoji: '🍨', note: 'กับถั่ว ข้าวเหนียว' },
            { name: 'บัวลอย', emoji: '🍡', note: 'นุ่มๆ หวานน้อย' },
            { name: 'กล้วยบวชชี', emoji: '🍌', note: 'กะทิหอมๆ' },
            { name: 'ขนมครก', emoji: '🥥', note: 'หอมมะพร้าว กรอบนอกนุ่มใน' },
            { name: 'ทับทิมกรอบ', emoji: '❄️', note: 'เย็นชื่นใจ' },
            { name: 'สังขยาฟักทอง', emoji: '🎃', note: 'หวานมัน หอมไข่' },
        ],
    },
    drinks: {
        category: '🥤 เครื่องดื่ม',
        items: [
            { name: 'ชาไทยเย็น', emoji: '🧋', note: 'หวาน มัน ส้ม' },
            { name: 'กาแฟเย็น', emoji: '☕', note: 'เข้มข้น สดชื่น' },
            { name: 'น้ำมะนาวโซดา', emoji: '🍋', note: 'คลายร้อน' },
            { name: 'ชาเขียวมัทฉะ', emoji: '🍵', note: 'สายญี่ปุ่น' },
            { name: 'สมูทตี้ผลไม้รวม', emoji: '🥤', note: 'วิตามินเยอะ' },
            { name: 'โกโก้เย็น', emoji: '🍫', note: 'หวาน มัน ฟิน' },
            { name: 'น้ำอัญชัน', emoji: '💜', note: 'สีสวย สดชื่น' },
        ],
    },
};

/**
 * Get a random menu from all categories
 */
function getRandomMenu() {
    const categories = Object.keys(menus);
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    const categoryData = menus[randomCategory];
    const randomItem = categoryData.items[Math.floor(Math.random() * categoryData.items.length)];

    return {
        ...randomItem,
        category: categoryData.category,
    };
}

module.exports = { menus, getRandomMenu };
