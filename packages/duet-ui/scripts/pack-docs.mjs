// The repo README is the package README too. npm renders it away from the repo, so relative links become absolute.
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
const REPO = "https://github.com/JayFarei/duet", RAW = "https://raw.githubusercontent.com/JayFarei/duet/main";
const md = readFileSync("../../README.md", "utf8")
  .replace(/\]\((?!https?:|#)([^)]+\.(?:webp|png|jpg|gif|mp4))\)/g, `](${RAW}/$1)`)
  .replace(/\]\((?!https?:|#)([^)]+)\)/g, `](${REPO}/tree/main/$1)`);
writeFileSync("README.md", md);
copyFileSync("../../LICENSE", "LICENSE");
