// ส่ง LINE push message ผ่าน LINE Messaging API (LINE OA)
const { LINE_CHANNEL_ACCESS_TOKEN, LINE_TO_USER_ID, DRY_RUN } = require("../config");

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

async function sendLineMessage(text) {
  if (DRY_RUN) {
    console.log("[lineNotify] DRY_RUN=true, would send:\n" + text);
    return true;
  }

  if (!LINE_CHANNEL_ACCESS_TOKEN || !LINE_TO_USER_ID) {
    console.log("[lineNotify] missing LINE credentials, skip send");
    return false;
  }

  try {
    const res = await fetch(LINE_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: LINE_TO_USER_ID,
        messages: [{ type: "text", text: text.slice(0, 5000) }], // LINE limit
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[lineNotify] LINE API error ${res.status}: ${errText}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[lineNotify] send error:", e.message);
    return false;
  }
}

module.exports = { sendLineMessage };
