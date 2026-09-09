// Export the existing runtime drawing as static icons. Never installs dependencies at runtime.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.argv[2] || path.join(root, 'test-results', `icons-${Date.now()}`));
const source = fs.readFileSync(path.join(root, 'background.js'), 'utf8');
const drawing = source.match(/async function updateIcon\(\) \{[\s\S]*?\r?\n\}/)?.[0];
if (!drawing) throw new Error('Runtime icon drawing was not found.');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const images = await page.evaluate(async code => {
      const render = new Function(`return (async()=>{
        let images;
        const settings={bgTabsEnabled:true,searchEnabled:true};
        const api={action:{async setIcon(value){images=value.imageData;},async setTitle(){}}};
        ${code}
        await updateIcon();
        return Object.entries(images).map(([size,pixels])=>{
          const canvas=document.createElement('canvas');canvas.width=+size;canvas.height=+size;
          canvas.getContext('2d').putImageData(pixels,0,0);
          return [size,canvas.toDataURL('image/png').split(',')[1]];
        });
      })();`);
      return render();
    }, drawing);
    for (const [size, data] of images) fs.writeFileSync(path.join(output, `${size}.png`), Buffer.from(data, 'base64'));
    console.log(JSON.stringify({ output, sizes: images.map(([size]) => +size), source: 'background.js updateIcon' }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
