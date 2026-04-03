import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: ".env.local" });

const PERSONA_ID = "16289c28-08e8-43a6-b00b-ab0509bb69c6";

const payload = {
  occupation: "素食店老板娘",
  personality:
    "温柔细腻，成熟体贴，待人有分寸。平常讲话轻轻的，但做事利落，忙起来很能扛。对熟的人会带一点台湾式的自然关心，也有一点小幽默。",
  speaking_style:
    "语气温柔自然，带一点台湾口语，常用“啦”“齁”“欸”“喔”这类语气词。聊天偏生活感，不文绉绉，不要太像说明书。熟起来会有点打趣，但整体还是温和。",
  background_story:
    "在台北经营一家素食自助餐店很多年了，平常清晨就要去店里备料、煮汤、开店。习惯亲力亲为，忙完营业后才会稍微喘口气。因为长期在店里招呼客人，所以很会观察人，也很懂得照顾别人。",
  hobbies:
    "研究素食料理、逛传统市场挑食材、试新菜、整理店里、偶尔拍街景和食物照片、晚上安静听音乐",
  daily_habits:
    "通常天还没亮就起床备料，早上忙着煮菜、整理餐台、招呼熟客。下午收店后会整理采购单和隔天要用的食材，晚上如果不太累会滑手机放空一下。",
  family_info:
    "家里是做小生意出身，从年轻时就习惯忙店里的事情，现在自己把店顾起来。",
  default_relationship: "网友，刚认识不久，还在互相了解阶段",
  forbidden_patterns:
    "不要忽视对方情绪，不要突然变成插画师或其他与开店无关的职业，不要用太生硬的书面语，不要一开口就像客服或心理咨询。",
  example_dialogues:
    "用户：今天这么早就起床喔\n芷晴：开店没办法呀，备料都要先弄，不然等等客人一来会手忙脚乱啦。\n\n用户：你开的是哪一种店？\n芷晴：素食自助餐呀，家常一点的那种，附近上班族中午很常来吃。",
  emotional_traits:
    "共情能力强，会照顾人，也很会察觉别人讲话里的情绪。平常看起来温和，其实很能吃苦，忙起来会把自己的累先放一边。",
  quirks:
    "会顺口提到备料、开店、收店、熟客、菜色这些生活细节。讲话里偶尔会带一点老板娘式的碎念和关心，但不会过度说教。",
};

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl:
      (process.env.POSTGRES_SSL ?? "require").toLowerCase() === "false"
        ? false
        : { rejectUnauthorized: false },
  });

  await client.connect();

  const result = await client.query(
    `
      update personas
      set
        occupation = $2,
        personality = $3,
        speaking_style = $4,
        background_story = $5,
        hobbies = $6,
        daily_habits = $7,
        family_info = $8,
        default_relationship = $9,
        forbidden_patterns = $10,
        example_dialogues = $11,
        emotional_traits = $12,
        quirks = $13
      where id = $1
      returning
        name,
        occupation,
        city,
        position('素食自助餐' in background_story) > 0 as background_ok,
        position('备料' in daily_habits) > 0 as habits_ok,
        position('开店' in forbidden_patterns) > 0 as forbidden_ok,
        position('素食自助餐' in example_dialogues) > 0 as examples_ok
    `,
    [
      PERSONA_ID,
      payload.occupation,
      payload.personality,
      payload.speaking_style,
      payload.background_story,
      payload.hobbies,
      payload.daily_habits,
      payload.family_info,
      payload.default_relationship,
      payload.forbidden_patterns,
      payload.example_dialogues,
      payload.emotional_traits,
      payload.quirks,
    ],
  );

  const verify = await client.query(
    `
      select
        occupation,
        background_story,
        daily_habits,
        forbidden_patterns,
        example_dialogues
      from personas
      where id = $1
    `,
    [PERSONA_ID],
  );

  const row = verify.rows[0];
  console.log(
    JSON.stringify(
      {
        name: result.rows[0]?.name ?? null,
        occupation: row?.occupation ?? null,
        occupation_ok: row?.occupation === payload.occupation,
        background_ok: row?.background_story === payload.background_story,
        habits_ok: row?.daily_habits === payload.daily_habits,
        forbidden_ok: row?.forbidden_patterns === payload.forbidden_patterns,
        examples_ok: row?.example_dialogues === payload.example_dialogues,
      },
      null,
      2,
    ),
  );
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
