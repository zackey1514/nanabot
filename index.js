"use strict";

const request = require("request");
const crypto = require('crypto');
const aesCmac = require('node-aes-cmac').aesCmac;

const SWITCHBOT_TOKEN = process.env.SWITCHBOT_TOKEN;
const LINE_TOKEN = process.env.LINE_TOKEN;
const LINE_CHANNELSECRET = process.env.LINE_CHANNELSECRET;    // 秘密鍵
const SESAME_API_KEY = process.env.SESAME_API_KEY;    // 秘密鍵

const CONFIG = require("./config.json");

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
  const jsonbody = JSON.parse(event.body)
  const botid = jsonbody.destination;
  const reqtext = jsonbody.events[0].message.text;
  const reptoken = jsonbody.events[0].replyToken;
  const groupid = jsonbody.events[0].source.groupId;

  // 秘密鍵で復号したボディのダイジェスト値を取得する
  const signature = crypto
    .createHmac('SHA256', LINE_CHANNELSECRET)
    .update(String(event.body)).digest('base64');
  // リクエストヘッダーの大文字小文字は変更される可能性がある
  const signatureHeader = event.headers[Object.keys(event.headers).find(key => key.toLowerCase() ==="x-line-signature")];

  // ダイジェスト値と x-line-signature の署名と一致しなければ400を返す
  if (signature !== signatureHeader) {
    context.succeed(createResponse(400, 'There is no corresponding process ...'));
    console.log('Signatures do not match.');
    return;
  }

  let resStr = '';

  if (reptoken === '00000000000000000000000000000000') {
    context.succeed(createResponse(200, 'Completed successfully !!'));
    console.log("Success: Response completed successfully !!");
  } else {
    if (botid === CONFIG.line.botid && groupid === CONFIG.line.groupid) {
      if (reqtext === 'オートロック開けて') {
        await pushAutolock();
        resStr = '開けたよ～';
      } else  if (reqtext === '玄関の鍵は開いてる？'){
        let sesameRes = await getSesameStatus();
        let status = JSON.parse(sesameRes);
        if (status.CHSesame2Status === 'locked' ) {
          resStr = '閉まってるよ～';
        } else if (status.CHSesame2Status === 'unlocked' ) {
          resStr = '開いてるよ～';
        }
      } else  if (reqtext === '玄関閉めて'){
        let sesameRes = await changeSesameStatus('lock');
        resStr = '閉めたよ～'
      } else  if (reqtext === '玄関開けて'){
        let sesameRes = await changeSesameStatus('unlock');
        resStr = '開けたよ～'
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
          "text": resStr,
          "quickReply": {
            "items": [
              {
                "type": "action", // ③
                "action": {
                  "type": "message",
                  "label": "オートロック",
                  "text": "オートロック開けて"
                }
              },
              {
                "type": "action",
                "action": {
                  "type": "message",
                  "label": "玄関鍵の状態",
                  "text": "玄関の鍵は開いてる？"
                }
              }
            ]
          }
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

function getSesameStatus() {
  return new Promise((resolve, reject) => {
    const uuid = CONFIG.sesame.uuid
    const url = `https://app.candyhouse.co/api/sesame2/${uuid}`;

    let options = {
      uri: url,
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": `${SESAME_API_KEY}`,
      }
    };
    request.get(options, function (error, response, body) {
      if (!error) {

        console.log('Success: Communication successful completion!!: Sesame');
        console.log(body);
        resolve(body);
      } else {
        console.log(`Failed: ${error}`);
        resolve();
      }
    });
  });
}

function changeSesameStatus(status) {
  return new Promise((resolve, reject) => {
    const uuid = CONFIG.sesame.uuid
    const url = `https://app.candyhouse.co/api/sesame2/${uuid}/cmd`;
    const base64History = Buffer.from("test2").toString('base64');
    const SESAME_SECRET_KEY = 'AAAAAAAAAAAAyAwckieHRepOxgAEpA/wKHKHSLSkE9auRQyQ83GGikmRGBVCRpRbLB6MP5/H6ElYzo+R/VtSxdmBiSnomW4SwgOzjrt4R7GjAACFm4PfA/3w1OlPFPGdWvL0'
    const sign = generateRandomTag(SESAME_SECRET_KEY);

    let cmd = '';
    switch(status) {
      case 'lock':
        cmd = 82;
        break;
      case 'unlock':
        cmd = 83;
        break;
    }

    let options = {
      uri: url,
      headers: {
        "X-API-KEY": `${SESAME_API_KEY}`,
      },
      form: {
        "cmd": cmd,
        "history": base64History,
        "sign": sign,
      }
    };
    // TODO エラー処理書く
    request.post(options, function (error, response, body) {
      if (!error) {
        console.log('Success: Communication successful completion!!: Sesame');
        console.log(body);
        resolve();
      } else {
        console.log(`Failed: ${error}`);
        resolve();
      }
    });
  });
}

function generateRandomTag(secret) {
  // * key:key-secret_hex to data
  // let key = Buffer.from(secret, 'hex')
  let key = '0000000000000000c80c1c92278745ea'

  // message
  // 1. timestamp  (SECONDS SINCE JAN 01 1970. (UTC))  // 1621854456905
  // 2. timestamp to uint32  (little endian)   //f888ab60
  // 3. remove most-significant byte    //0x88ab60
  const date = Math.floor(Date.now() / 1000);
  const dateDate = Buffer.allocUnsafe(4);
  dateDate.writeUInt32LE(date);
  const message = Buffer.from(dateDate.slice(1, 4));

  return aesCmac(key, message);
}