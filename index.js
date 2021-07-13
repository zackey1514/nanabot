"use strict";

const request = require("request");
const crypto = require('crypto');

const SWITCHBOT_TOKEN = process.env.SWITCHBOT_TOKEN;
const LINE_TOKEN = process.env.LINE_TOKEN;
const LINE_CHANNELSECRET = process.env.LINE_CHANNELSECRET;    // 秘密鍵

const CONFIG = require("./config.json");

// Compare x-line-signature request header and the signature

// 成功時のレスポンス
const createResponse = (statusCode, body) => {
  return {
    statusCode: statusCode,
    headers: {
        "Access-Control-Allow-Origin": "*" // Required for CORS support to work
    },
    body: JSON.stringify(body)
  }
};

// メイン処理
exports.handler = async (event, context) => {

  console.log(event.body);

  const jsonbody = JSON.parse(event.body)
  const botid = jsonbody.destination;
  const reqtext = jsonbody.events[0].message.text;
  const reptoken = jsonbody.events[0].replyToken;
  const groupid = jsonbody.events[0].source.groupId;

  // リクエストヘッダーの x-line-signature にある署名と秘密鍵で復号したボディのダイジェスト値を比較する
  const signature = crypto
    .createHmac('SHA256', LINE_CHANNELSECRET)
    .update(String(jsonbody)).digest('base64');
  const signatureHeader = event.headers["X-Line-Signature"];
  console.log(signature)
  console.log(signatureHeader)

  // 署名が一致しなければ400を返す
  if (signature === signatureHeader) {
    context.succeed(createResponse(400, 'There is no corresponding process ...'));
    return;
  }

  let resStr = '';

  if (reptoken === '00000000000000000000000000000000') {
    context.succeed(createResponse(200, 'Completed successfully !!'));
    console.log("Success: Response completed successfully !!");
  } else {
    if (botid === CONFIG.line.botid && groupid === CONFIG.line.groupid) {
      if (reqtext == 'オートロック開けて') {
        await pushAutolock();
        resStr = '開けたよ～';
      } else {
        resStr = 'ばなないす♪';
      }
      return replyLine(reptoken, resStr).then(() => {
        context.succeed(createResponse(200, 'Completed successfully !!'));
      });
    } else {
      resStr = 'Unauthorized access.'
      return replyLine(reptoken, resStr).then(() => {
        context.succeed(createResponse(500, 'There is no corresponding process ...'));
      });
    }
  }
}

// LINEへのReply
function replyLine(reptoken, resStr) {
  return new Promise((resolve, reject) => {
    const url = 'https://api.line.me/v2/bot/message/reply';

    let options = {
      uri: url,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LINE_TOKEN}`,
      },
      json: {
        "replyToken": reptoken,
        "messages": [{
          "type": "text",
          "text": resStr
        }]
      }
    };
    request.post(options, function (error, response, body) {
      if (!error) {
        console.log('Success: Communication successful completion!!: LINE');
        console.log(body);
        resolve();
      } else {
        console.log(`Failed: ${error}`);
        resolve();
      }
    });
  });
}

function pushAutolock() {
  return new Promise((resolve, reject) => {
    const autolockId = CONFIG.switchbot.autolock
    const url = `https://api.switch-bot.com/v1.0/devices/${autolockId}/commands`;

    let options = {
      uri: url,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `${SWITCHBOT_TOKEN}`,
      },
      json: {
        "command": "press",
      }
    };
    request.post(options, function (error, response, body) {
      if (!error) {

        console.log('Success: Communication successful completion!!: SwitchBot');
        console.log(body);
        resolve();
      } else {
        console.log(`Failed: ${error}`);
        resolve();
      }
    });
  });
}