import fs from "fs";
import path from "path";

function getString(dataView: Buffer, offset: number, length: number) {
  let str = "";
  for (let i = 0; i < length; i++) {
    const char = dataView.readUint8(offset + i);
    if (char === 0) {
      break;
    }
    str += String.fromCharCode(char);
  }
  return str;
}

const buffer = fs.readFileSync("test.csx");

// help from noche and checkraisefold with this

/*
        4 bytes - Magic, value 0x017EF1C5
        4 bytes - Offset from beginning of file where lookup table starts
        4 bytes - Amount of 0x40 byte segments in lookup table/assets stored by CSX file
        
        Rest of file until offset - Data.
        Rest of file at/after offset - 0x40 byte segments for lookup table

        Lookup table segments:
        each starting with 0x02005A58 magic (02 can be 01 or 04 instead, file type?)
        4 bytes - Offset from start of file where beginning of 0x4C file header starts. This file header seems to be mostly useless information?
        4 bytes - File size. This ends at the actual last byte from the file if you offset from the start of the file header.
        52 bytes - File name. This is padded with 0x00 bytes at the end.
      */

const magic = buffer.readUint32LE(0);
const tableOffset = buffer.readUint32LE(4);
const tableSize = buffer.readUint32LE(8);

let offset = tableOffset;

let fileTable: {
  name: string;
  offset: number;
  size: number;
  magic: number;
}[] = [];

for (let i = 0; i < tableSize; i++) {
  const magic = buffer.readUint8(offset);
  const fileOffset = buffer.readUint32LE(offset + 4);
  const fileSize = buffer.readUint32LE(offset + 8);
  const fileName = getString(buffer, offset + 12, 52);

  fileTable.push({
    name: fileName,
    offset: fileOffset,
    size: fileSize,
    magic: magic,
  });

  console.log(`${i}/${tableSize}`, fileName, magic.toString(16));
  offset += 0x40;
}

// save files

for (let i = 0; i < fileTable.length; i++) {
  const file = fileTable[i];

  const filePathArray = file.name.split("/");
  filePathArray.pop();
  const filePath = filePathArray.join("/");

  fs.mkdirSync(path.join(__dirname, "output", filePath), { recursive: true });

  switch (file.magic) {
    case 0x01: {
      const fileData = buffer.subarray(file.offset, file.offset + file.size);
      fs.writeFileSync(path.join(__dirname, "output", "sbl", file.name + ".sbl"), fileData);
      break;
    }
    case 0x02: {
      const fileData = buffer.subarray(file.offset, file.offset + file.size);
      fs.writeFileSync(path.join(__dirname, "output", "sbb", file.name + ".sbb"), fileData);
      break;
    }
    case 0x04: {
      const fileData = buffer.subarray(file.offset + 0x4c, file.offset + file.size);
      fs.writeFileSync(path.join(__dirname, "output", "png", file.name + ".png"), fileData);
      break;
    }
  }
}
