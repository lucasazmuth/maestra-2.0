import fs from 'fs';
import path from 'path';

it('conecta o autosave sem avançar a etapa', () => {
  const chat = fs.readFileSync(path.join(__dirname, '..', 'NytaChat.tsx'), 'utf8');
  expect(chat).toContain('onProgress={(strategies) => { persist({ strategies }); }}');
});
