import axios from "axios";
import * as fs from "fs";
import { Storage } from "@google-cloud/storage";
import AWS from "aws-sdk";
 
export const handler = async (event, context) => {
 
  console.log("Event received:", JSON.stringify(event, null, 2));
 
  if (event.Records) {
    event.Records.forEach(async(record) => {
      const snsMessage = JSON.parse(record.Sns.Message);
      console.log("SNS Message:", snsMessage);
 
      const url = snsMessage.submission_url;
      const email = snsMessage.email;
      console.log(`SNS Message ID: ${url}, Text: ${email}`);
    });
  }
  await bucketSave();

};

export const bucketSave = async()=>{

  console.log("bucket name " + process.env.bucketName);
  const timestampValueForFile = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "_")
    .split(".")[0];
  const filenameForSubmission = `assignment_${timestampValueForFile}`;

  const fileUploadInBucket = `${filenameForSubmission}.zip`;
  const fileToDownload = await axios.get("https://github.com/tparikh/myrepo/archive/refs/tags/v1.0.0.zip",
    {
      responseType: "arraybuffer",
    }
  );
 
  const accessKeyToDecode = JSON.parse(
    Buffer.from(process.env.gcpPrivateKey, "base64").toString()
  );
 
  console.log("credentials " + accessKeyToDecode);
  console.log("private key " + accessKeyToDecode.private_key);

  console.log("bucket name " + process.env.bucketName);
  const storage = new Storage({
    credentials: {
      project_id: process.env.gcpProjectId,
      client_email: process.env.gcpEmail,
      private_key: accessKeyToDecode.private_key,
    },
  });
  const bucketName = process.env.bucketName; 
  const bucketForAssignment = storage.bucket(bucketName);
  console.log("bucket name " + process.env.bucketName);

  try {
    const fileBuffer = Buffer.from(fileToDownload.data);
    await storage.bucket(bucketName).file(fileUploadInBucket).save(fileBuffer);
    await sendMail('barathis1998@gmail.com','submitted successfully')
    console.log("upload completed");
  } catch (err) {
    console.log("error " + err);
  }
  
}


AWS.config.update({ region: 'us-east-1' }); // Replace 'your-aws-region' with your AWS region

const ses = new AWS.SES();

export const sendMail = async (email, assignmentDetails) => {
  console.log("inside email");
  const params = {
    Destination: {
      ToAddresses: [email], 
    },
    Message: {
      Body: {
        Html: {
          Charset: 'UTF-8',
          Data: `<p>Dear student, your assignment has been submitted successfully. Here are the details:</p>
                 <p><strong>Assignment Details:</strong></p>
                 <p>${assignmentDetails}</p>
                 <p>Thank you for your submission.</p>`,
        },
        Text: {
          Charset: 'UTF-8',
          Data: `Dear student, your assignment has been submitted successfully. Here are the details:

Assignment Details:
${assignmentDetails}

Thank you for your submission.`,
        },
      },
      Subject: {
        Charset: 'UTF-8',
        Data: 'Assignment Submission Successful',
      },
    },
    Source: 'barathis1998+demo1@gmail.com', 
  };

  try {
    console.log(params);
    const data = await ses.sendEmail(params).promise();
    await trackSentEmail(email, new Date().toISOString(), 'Sent');
    console.log('Email sent:', data);
  } catch (error) {
    await trackSentEmail(email, new Date().toISOString(), 'Failed');
    console.error('Error sending email:', error);
  }
};
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const EMAIL_TABLE_NAME = "EmailTrackingTable";

const trackSentEmail = async (recipient, timestamp, status) => {
  console.log(process.env.dynamoTable);
  const params = {
    TableName: process.env.dynamoTable,
    Item: {
      EmailId: recipient + timestamp,
      Recipient: recipient,
      Timestamp: timestamp,
      Status: status,
    },
  };

  try {
    await dynamoDB.put(params).promise();
    console.log('Email tracked successfully:', params.Item);
  } catch (error) {
    console.error('Error tracking email:', error);
  }
};
 