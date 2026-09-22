const availableScripts = [
  "seed:email-templates",
  "migrate:companies",
];

console.log("Available scripts:");
for (const script of availableScripts) {
  console.log(`- ${script}`);
}
