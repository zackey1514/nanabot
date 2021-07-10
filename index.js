"use strict";

const request = require("request");
const SWITCHBOT_TOKEN = process.env.SWITCHBOT_TOKEN;
const LINE_TOKEN = process.env.LINE_TOKEN;
// const LINE_CHANNELSECRET = process.env.LINE_CHANNELSECRET;


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

  let resStr = '';

  if (reptoken == '00000000000000000000000000000000') {
    context.succeed(createResponse(200, 'Completed successfully !!'));
    console.log("Success: Response completed successfully !!");
  } else {
    if (botid == 'U12858c8df21e071b62eb7ab44c489876') {
      if (reqtext == 'オートロック開けて') {
        resStr = '了解！オートロックを開けるから少し待ってね';
        return pushAutolock()
      } else {
        resStr = 'ばなないす♪';
      }
      return replyLine(reptoken, resStr).then(() => {
        context.succeed(createResponse(200, 'Completed successfully !!'));
      });
    } else {
      context.succeed(createResponse(500, 'There is no corresponding process ...'));
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
    const url = 'https://api.switch-bot.com/v1.0/devices/F319A316F2AE/commands';

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