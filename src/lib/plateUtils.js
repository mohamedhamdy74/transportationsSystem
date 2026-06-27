export function parsePlate(plateStr) {
  if (!plateStr) return { numbers: '', letters: '' };
  const clean = plateStr.replace(/[\s\-\_\,\.]/g, '');
  const numbersMatch = clean.match(/\d+/g);
  const numbers = numbersMatch ? numbersMatch.join('') : '';
  const lettersMatch = clean.match(/[\u0600-\u06FF]+/g);
  let letters = lettersMatch ? lettersMatch.join('') : '';
  letters = letters.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
  return { numbers, letters };
}

export function platesMatch(plate1, plate2) {
  const p1 = parsePlate(plate1);
  const p2 = parsePlate(plate2);
  if (!p1.numbers || !p2.numbers) return false;
  if (p1.numbers !== p2.numbers) return false;
  const letters1 = p1.letters.split('').sort().join('');
  const letters2 = p2.letters.split('').sort().join('');
  return letters1 === letters2 || p1.letters === p2.letters;
}
