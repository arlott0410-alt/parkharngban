"use strict";exports.id=3370,exports.ids=[3370],exports.modules={53370:(a,b,c)=>{c.d(b,{A:()=>h,DEFAULT_SYSTEM_PROMPT:()=>f,M:()=>g});var d=c(94364);let e=null,f=`ທ່ານເປັນ AI ຊ່ວຍຈັດການລາຍຮັບ-ລາຍຈ່າຍ ສຳລັບຄົນລາວ.
ໜ້າທີ່ຂອງທ່ານຄື: ອ່ານຂໍ້ຄວາມທີ່ຜູ້ໃຊ້ສົ່ງ ແລ້ວດຶງຂໍ້ມູນທຸລະກຳອອກມາ.

ຮູບແບບ output (JSON only, ບໍ່ຕ້ອງມີ markdown code blocks):
{
  "type": "income" หรือ "expense",
  "amount": ตัวเลข (ในหน่วย LAK),
  "description": "คำอธิบายสั้นๆ ภาษาลาว",
  "category_hint": "ชื่อหมวดหมู่ที่เหมาะสม",
  "confidence": ตัวเลข 0-1
}

กฎการแปล:
- "ได้เงิน", "รับเงิน", "เงินเดือน", "ຮັບ", "ໄດ້ຮັບ" = income
- "จ่าย", "ซื้อ", "ใช้เงิน", "ຈ່າຍ", "ຊື້", "ໃຊ້ເງິນ" = expense
- สกุลเงิน: "กีบ", "ກີບ", "LAK", "K" หลังตัวเลข = LAK, "บาท", "฿" = คูณด้วย 40, "ดอลลาร์", "$", "USD" = คูณด้วย 22000
- ตัวเลขที่มี "ล้าน", "ລ້ານ" = คูณด้วย 1,000,000
- ตัวเลขที่มี "พัน", "ພັນ" = คูณด้วย 1,000

ตัวอย่าง:
- "ได้เงินเดือน 1,500,000" → income, 1500000, "เงินเดือน", "Salary"
- "จ่าย 50,000 ซื้อของกิน" → expense, 50000, "ซื้ออาหาร", "Food"
- "ຈ່າຍຄ່ານ້ຳ 30ກີບ" → expense, 30000, "ຄ່ານ້ຳ", "Utilities"  
- "ຮັບເງິນຈາກລູກຄ້າ 500ພັນ" → income, 500000, "ຮັບເງິນຈາກລູກຄ້າ", "Business"
- "ซื้อข้าว 15000" → expense, 15000, "ซื้ออาหาร", "Food"

หาก input ไม่ใช่ข้อมูลทางการเงิน ให้ตอบว่า:
{"type": null, "amount": 0, "description": "ไม่พบข้อมูลทางการเงิน", "category_hint": null, "confidence": 0}`;async function g(a,b){try{let c=(function(){if(!e){let a=process.env.GEMINI_API_KEY;if(!a)throw Error("GEMINI_API_KEY is not set");e=new d.ij(a)}return e})().getGenerativeModel({model:"gemini-1.5-flash",safetySettings:[{category:d.DE.HARM_CATEGORY_HARASSMENT,threshold:d.vk.BLOCK_NONE},{category:d.DE.HARM_CATEGORY_HATE_SPEECH,threshold:d.vk.BLOCK_NONE}]}),g=`${b||f}

Input: "${a}"

Output (JSON only):`,h=(await c.generateContent(g)).response.text().trim(),i=h.replace(/```json\n?/g,"").replace(/```\n?/g,"").trim(),j=JSON.parse(i);if(!j.type||j.amount<=0||j.confidence<.3)return{success:!1,error:"ບໍ່ສາມາດດຶງຂໍ້ມູນທຸລະກຳໄດ້ — ກະລຸນາສົ່ງຂໍ້ຄວາມໃໝ່ \uD83D\uDE4F",raw_response:h};let k={type:j.type,amount:Math.round(j.amount),description:j.description,category_hint:j.category_hint??void 0,confidence:j.confidence,raw_input:a};return{success:!0,transaction:k,raw_response:h}}catch(a){return console.error("Gemini parse error:",a),{success:!1,error:a instanceof Error?a.message:"AI error",raw_response:void 0}}}function h(a,b){if(!a)return null;let c=a.toLowerCase(),d=b.find(a=>a.name.toLowerCase()===c||a.name_lao&&a.name_lao.toLowerCase()===c);if(d)return d.id;for(let[d,e]of Object.entries({Food:["food","อาหาร","ອາຫານ","ข้าว","กิน","ຂ້າວ","ກິນ"],Salary:["salary","เงินเดือน","ເງິນເດືອນ"],Transport:["transport","การเดินทาง","ການເດີນທາງ","รถ","ລົດ"],Shopping:["shopping","ซื้อของ","ຊື້ເຄື່ອງ"],Health:["health","สุขภาพ","ສຸຂະພາບ","ยา","ຢາ","หมอ","ໝໍ"],Education:["education","การศึกษา","ການສຶກສາ"],Entertainment:["entertainment","บันเทิง","ຄວາມບັນເທີງ"],Utilities:["utilities","ค่าน้ำ","ຄ່ານ້ຳ","ไฟ","ໄຟ"],Business:["business","ธุรกิจ","ທຸລະກິດ","ลูกค้า","ລູກຄ້າ"],Investment:["investment","ลงทุน","ລົງທຶນ"]}))if(e.some(b=>c.includes(b)||a.includes(b))){let a=b.find(a=>a.name===d);if(a)return a.id}let e=b.find(a=>a.name.toLowerCase().includes(c)||c.includes(a.name.toLowerCase()));return e?.id??null}}};