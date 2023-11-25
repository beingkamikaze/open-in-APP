const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");
const cron = require("node-cron");

const SCOPES = ["https://www.googleapis.com/auth/gmail.modify"];
const TOKEN_PATH = "token.json";

// Load client secrets from a file, create a new token, and authorize the client with OAuth2
function authorize(credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
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

function checkAndReply(auth) {
  // Implement logic to fetch and reply to emails
  // Make sure to check for prior replies and avoid double replies
  // Also, add a label to the email and move it to the label
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
