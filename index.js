import axios from "axios";
import * as fs from "fs";
import { Storage } from "@google-cloud/storage";
import AWS from "aws-sdk";
 
export const handler = async (event, context) => {
 
  console.log("Event received:", JSON.stringify(event, null, 2));
  let url, email,assignmentId;

 
  if (event.Records) {
    event.Records.forEach(async(record) => {
      const snsMessage = JSON.parse(record.Sns.Message);
      console.log("SNS Message:", snsMessage);
 
      url = snsMessage.submissionUrl;
      email = snsMessage.email;
      assignmentId = snsMessage.assignmentId
      console.log(`SNS Message ID: ${url}, Text: ${email}`);
    });
  }
  await bucketSave(url,email,assignmentId);

};

export const bucketSave = async(url,email,assignment_id)=>{
  let fileToDownload

  console.log("bucket name " + process.env.bucketName);
  const timestampValueForFile = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "_")
    .split(".")[0];
  const filenameForSubmission = `assignment_${email}_${timestampValueForFile}`;

  const fileUploadInBucket = `${assignment_id}/${email}/${filenameForSubmission}.zip`;
  console.log("download from :"+ url);

  try{
  fileToDownload = await axios.get(url,
    {
      responseType: "arraybuffer",
    }
  );
}
catch(error){
  await sendFailureMail(email,'Submission Failed')

}
 
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
  let path = `${bucketName}/${fileUploadInBucket}`
  try {
    const fileBuffer = Buffer.from(fileToDownload.data);
    await storage.bucket(bucketName).file(fileUploadInBucket).save(fileBuffer);
    
    await sendMail(email,'Submitted successfully',path)
    console.log("upload completed");
  } catch (err) {
    console.log("error " + err);
    sendFailureMail(email,'Submission Failed',path);
  }
  
}


AWS.config.update({ region: 'us-east-1' }); 

const ses = new AWS.SES();

export const sendMail = async (email, assignmentDetails,path) => {
  const params = {
    Destination: {
      ToAddresses: [email], 
    },
    Message: {
      Body: {
        Html: {
          Charset: 'UTF-8',
          Data: `<p>Dear student,</p>
          <p> Your assignment has been submitted successfully. Here are the details:</p>
                 <p><strong>Assignment Details:</strong></p>
                 <p>${assignmentDetails}</p>
                 <p><strong>Saved Path:</strong> ${path}</p>
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
    Source: 'Pulse@demo.barathisridhar.me', 
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

export const sendFailureMail = async (email, assignmentDetails) => {
  const params = {
    Destination: {
      ToAddresses: [email], 
    },
    Message: {
      Body: {
        Html: {
          Charset: 'UTF-8',
          Data: `<p>Dear student, there was an issue with your assignment submission</p>

                 <p>Please contact support for assistance.</p>`,
        },
        Text: {
          Charset: 'UTF-8',
          Data: `Dear student, there was an issue with your assignment submission
  
  
  Please contact support for assistance.`,
        },
      },
      Subject: {
        Charset: 'UTF-8',
        Data: 'Assignment Submission Failed',
      },
    },
    Source: 'Pulse@demo.barathisridhar.me', 
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
 