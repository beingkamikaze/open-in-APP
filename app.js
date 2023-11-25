const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");
const cron = require("node-cron");
const gmail = google.gmail({ version: "v1" });

const SCOPES = ["https://www.googleapis.com/auth/gmail.modify"];
const TOKEN_PATH = "token.json";

const credentials = {
  web: {
    client_id:
      "519859382661-0najbsmq2ee0spc3jdom018aosc725md.apps.googleusercontent.com",
    project_id: "empirical-envoy-406210",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_secret: "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",
    redirect_uri: [
      "https://www.googleapis.com/auth/gmail.modify",
      //   "https://developers.google.com/oauthplayground",
      //   "https://www.googleapis.com/auth/gmail.modify",
    ],
  },
};
const redirect_uris = "https://www.googleapis.com/auth/gmail.modify";

// Load client secrets from a file, create a new token, and authorize the client with OAuth2
function authorize(credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris
  );

  // Check if we have previously stored a token
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });
  console.log("Authorize this app by visiting this url:", authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question("Enter the code from that page here: ", (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error("Error retrieving access token", err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log("Token stored to", TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

function listLabels(auth) {
  const gmail = google.gmail({ version: "v1", auth });
  gmail.users.labels.list(
    {
      userId: "me",
    },
    (err, res) => {
      if (err) return console.log("The API returned an error: " + err);
      const labels = res.data.labels;
      if (labels.length) {
        labels.forEach((label) => {
          console.log(label.name);
        });
      } else {
        console.log("No labels found.");
      }
    }
  );
}

function createLabel(auth) {
  const gmail = google.gmail({ version: "v1", auth });
  gmail.users.labels.create(
    {
      userId: "me",
      resource: {
        name: "MyLabel", // Replace with your desired label name
      },
    },
    (err, res) => {
      if (err) return console.log("The API returned an error: " + err);
      console.log("Label created:", res.data.name);
    }
  );
}

async function checkAndReply(auth) {
  // Implement logic to fetch and reply to emails
  // Make sure to check for prior replies and avoid double replies
  // Also, add a label to the email and move it to the label
  try {
    const messages = await listMessages(auth, "me", "is:unread"); // Fetch unread emails
    for (const message of messages) {
      const threadId = message.threadId;
      const hasPriorReplies = await hasReplies(auth, threadId);

      if (!hasPriorReplies) {
        // Reply to the email
        const replyText = "Thank you for your email!"; // Customize the reply text
        await sendReply(auth, message.id, replyText);

        // Add a label and move the email to the label
        const labelName = "MyLabel"; // Replace with your desired label name
        await addLabel(auth, "me", threadId, labelName);
      }
    }
  } catch (error) {
    console.error("Error in checkAndReply:", error);
  }
}
async function listMessages(auth, userId, query) {
  const response = await gmail.users.messages.list({
    auth,
    userId,
    q: query,
  });
  return response.data.messages || [];
}

async function hasReplies(auth, threadId) {
  const response = await gmail.users.threads.get({
    auth,
    userId: "me",
    id: threadId,
  });
  const thread = response.data;

  // Check if the thread has replies from the user
  return thread.messages.some((message) => message.fromMe);
}

async function sendReply(auth, messageId, replyText) {
  const response = await gmail.users.messages.send({
    auth,
    userId: "me",
    resource: {
      raw: await createReplyRaw(auth, messageId, replyText),
    },
  });
  console.log("Reply sent:", response.data);
}

async function createReplyRaw(auth, messageId, replyText) {
  const response = await gmail.users.messages.get({
    auth,
    userId: "me",
    id: messageId,
  });
  const message = response.data;

  // Create a MIME message for the reply
  const replyMessage = `From: ${message.from}\r\nTo: ${message.to}\r\nSubject: Re: ${message.subject}\r\n\r\n${replyText}`;
  return Buffer.from(replyMessage).toString("base64");
}

async function addLabel(auth, userId, threadId, labelName) {
  // Check if the label already exists
  const labelsResponse = await gmail.users.labels.list({
    auth,
    userId,
  });
  const labelExists = labelsResponse.data.labels.some(
    (label) => label.name === labelName
  );

  // Create the label if it doesn't exist
  if (!labelExists) {
    await gmail.users.labels.create({
      auth,
      userId,
      resource: {
        name: labelName,
      },
    });
  }

  // Add the label to the thread
  await gmail.users.threads.modify({
    auth,
    userId,
    id: threadId,
    resource: {
      addLabelIds: [labelName],
    },
  });
}

// Load client secrets from a file and run the authorization function
fs.readFile("credentials.json", (err, content) => {
  if (err) return console.log("Error loading client secret file:", err);
  authorize(JSON.parse(content), checkAndReply);
});

// Schedule the checkAndReply function to run at random intervals
cron.schedule("*/45 * * * *", () => {
  checkAndReply(); // Adjust the interval as needed
});
