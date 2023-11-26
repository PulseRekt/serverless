import axios from "axios";
import * as fs from "fs";
import { Storage } from "@google-cloud/storage";
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
 
    console.log("upload completed");
  } catch (err) {
    console.log("error " + err);
  }
 
}