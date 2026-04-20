import fs from "node:fs";
import path from "node:path";
import https from "node:https";

const BASE_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model";
const MODEL_FILES = [
  "tiny_face_detector_model-weights_manifest.json",
  "tiny_face_detector_model.bin",
  "face_expression_model-weights_manifest.json",
  "face_expression_model.bin",
];

const rootDir = process.cwd();
const targetDir = path.join(rootDir, "public", "models", "face-api");

function download(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);

    const request = https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.rmSync(outputPath, { force: true });
        resolve(download(res.headers.location, outputPath));
        return;
      }

      if (res.statusCode !== 200) {
        file.close();
        fs.rmSync(outputPath, { force: true });
        reject(new Error(`Download failed: ${url}, status=${res.statusCode}`));
        return;
      }

      res.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
    });

    request.on("error", (err) => {
      file.close();
      fs.rmSync(outputPath, { force: true });
      reject(err);
    });
  });
}

async function ensureModels() {
  fs.mkdirSync(targetDir, { recursive: true });

  for (const fileName of MODEL_FILES) {
    const localPath = path.join(targetDir, fileName);
    if (fs.existsSync(localPath) && fs.statSync(localPath).size > 0) {
      console.log(`skip: ${fileName}`);
      continue;
    }

    const url = `${BASE_URL}/${fileName}`;
    console.log(`download: ${fileName}`);
    await download(url, localPath);
  }

  console.log(`face models ready: ${targetDir}`);
}

ensureModels().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
