const { google } = require("googleapis");
const gmail = google.gmail({ version: "v1" });

async function checkAndReply(auth) {
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

// The rest of the code remains unchanged...
