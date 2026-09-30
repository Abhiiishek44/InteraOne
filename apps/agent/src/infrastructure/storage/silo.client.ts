import { Client as S3Client } from "minio";
import config from "../../config";

export const siloClient = new S3Client({
  endPoint: config.silo.endpoint || "localhost",
  port: config.silo.port,
  useSSL: config.silo.useSSL,
  accessKey: config.silo.accessKey || "",
  secretKey: config.silo.secretKey || "",
});
