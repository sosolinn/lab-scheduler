import fs from "node:fs";
import path from "node:path";

import LegacyScriptRunner from "./LegacyScriptRunner";

export const dynamic = "force-static";

function readProjectFile(filename) {
  return fs.readFileSync(path.join(process.cwd(), filename), "utf8");
}

function getLegacyMarkup() {
  const html = readProjectFile("index.html");
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

  if (!bodyMatch) {
    throw new Error("无法从 index.html 中读取页面主体内容。");
  }

  return bodyMatch[1].replace(
    /\s*<script[^>]*src=["']script\.js["'][^>]*><\/script>\s*/i,
    ""
  );
}

export default function HomePage() {
  const markup = getLegacyMarkup();
  const scriptSource = readProjectFile("script.js");

  return (
    <>
      <div
        style={{ display: "contents" }}
        dangerouslySetInnerHTML={{ __html: markup }}
      />
      <LegacyScriptRunner source={scriptSource} />
    </>
  );
}
