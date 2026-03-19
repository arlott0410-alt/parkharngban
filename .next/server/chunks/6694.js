"use strict";exports.id=6694,exports.ids=[6694],exports.modules={56694:(a,b,c)=>{c.d(b,{Qz:()=>f,UN:()=>j,_X:()=>e,sendTelegramMessage:()=>g,wG:()=>h,xW:()=>i});var d=c(55511);function e(a){try{let b=process.env.TELEGRAM_BOT_TOKEN;if(!b)return{valid:!1,error:"TELEGRAM_BOT_TOKEN not configured"};let c=new URLSearchParams(a),e=c.get("hash");if(!e)return{valid:!1,error:"Missing hash"};c.delete("hash");let f=Array.from(c.entries()).sort(([a],[b])=>a.localeCompare(b)).map(([a,b])=>`${a}=${b}`).join("\n"),g=(0,d.createHmac)("sha256","WebAppData").update(b).digest();if((0,d.createHmac)("sha256",g).update(f).digest("hex")!==e)return{valid:!1,error:"Hash mismatch — possible tampering"};let h=parseInt(c.get("auth_date")??"0",10);if(Date.now()/1e3-h>86400)return{valid:!1,error:"initData expired (older than 24h)"};let i=c.get("user"),j=i?JSON.parse(decodeURIComponent(i)):void 0,k={query_id:c.get("query_id")??void 0,user:j,auth_date:h,hash:e,start_param:c.get("start_param")??void 0};return{valid:!0,data:k}}catch(a){return{valid:!1,error:a instanceof Error?a.message:"Validation error"}}}function f(a){let b=process.env.WEBHOOK_SECRET;return!b||a===b}async function g(a,b,c){let d=process.env.TELEGRAM_BOT_TOKEN;if(!d)throw Error("TELEGRAM_BOT_TOKEN not set");let e=`https://api.telegram.org/bot${d}/sendMessage`,f=await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:a,text:b,...c})});return(await f.json()).ok}function h(a,b,c,d){let e=new Intl.NumberFormat("lo-LA").format(b),f=d.income-d.expense,g=new Intl.NumberFormat("lo-LA").format(Math.abs(f));return`${"income"===a?"\uD83D\uDC9A":"\uD83D\uDD34"} ປ້າບັນທຶກໃຫ້ແລ້ວ!

📝 ${"income"===a?"ລາຍຮັບ":"ລາຍຈ່າຍ"}: ${e} ກີບ
💬 ${c}

📊 ຍອດລວມເດືອນນີ້:
💚 ຮັບ: ${new Intl.NumberFormat("lo-LA").format(d.income)} ກີບ
🔴 ຈ່າຍ: ${new Intl.NumberFormat("lo-LA").format(d.expense)} ກີບ
${f>=0?"✅":"⚠️"} ຄົງເຫຼືອ: ${f>=0?"+":"-"}${g} ກີບ`}function i(a){return({parse_failed:"\uD83E\uDD14 ປ້າບໍ່ເຂົ້າໃຈ...\n\nກະລຸນາສົ່ງຂໍ້ຄວາມໃໝ່ ເຊັ່ນ:\n• ຈ່າຍ 50,000 ຊື້ອາຫານ\n• ຮັບເງິນເດືອນ 1,500,000\n• ได้เงิน 200,000 จากงาน",expired:"⏰ ການສະມາຊິກໝົດອາຍຸແລ້ວ\n\nກະລຸນາຕໍ່ອາຍຸ 30,000 ກີບ/ເດືອນ\nກົດ /renew ເພື່ອຕໍ່ອາຍຸ \uD83D\uDE4F",not_registered:"\uD83D\uDC4B ສະບາຍດີ! ປ້າຊ່ວຍຈົດລາຍຮັບ-ລາຍຈ່າຍໃຫ້ທ່ານ\n\nກ່ອນໃຊ້ງານ ກະລຸນາເປີດ Mini App ກ່ອນ \uD83D\uDC47"})[a]}function j(a){return`🌺 ສະບາຍດີ ${a}!

ປ້າຂ້າງບ້ານຢູ່ນີ້ ✨
ຊ່ວຍຈົດລາຍຮັບ-ລາຍຈ່າຍດ້ວຍ AI ພາສາລາວ

💬 ສົ່ງຂໍ້ຄວາມໄດ້ເລີຍ ເຊັ່ນ:
• "ຈ່າຍ 50,000 ຊື້ອາຫານ"
• "ຮັບເງິນເດືອນ 1.5ລ້ານ"

💰 ຄ່າບໍລິການ: 30,000 ກີບ/ເດືອນ

ກົດ /subscribe ເພື່ອເລີ່ມໃຊ້ງານ 🙏`}}};