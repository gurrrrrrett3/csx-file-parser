import fs, { fstatSync } from "fs";
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

if (!fs.existsSync("input")) {
  fs.mkdirSync("input");
  console.error("input folder not found, creating one, please populate it with your files");
  process.exit(1);
}

const files = fs.readdirSync("input");

type File = {
  name: string;
  extension: string;
  buffer: Buffer;
};

let fileStorage: File[] = [];
const allowedFileExtensions = ["sbb", "sbl", "png"];

for (let i = 0; i < files.length; i++) {
  if (fs.statSync(path.join("input", files[i])).isDirectory()) continue;

  const fileExtension = files[i].split(".").pop();
  if (!fileExtension || !allowedFileExtensions.includes(fileExtension)) continue;

  const name = files[i].split(".").slice(0, -1).join(".");

  fileStorage.push({
    name,
    extension: fileExtension,
    buffer: fs.readFileSync(path.join("input", files[i])),
  });

  console.log(`Added ${files[i]} to file storage`);
}

const fileTable: {
  name: string;
  offset: number;
  size: number;
  magic: number;
}[] = [];

const fileMagics = {
    sbb: 0x02,
    sbl: 0x01,
    png: 0x04,
}

const offsets = {
    "sbl": 0x0,
    "sbb": 0x0,
    "png": 0x4c,
}

//  0x02005A58
const magicBytes = Buffer.from([0x00, 0x00 , 0x5a, 0x58]);
const headerMagic = Buffer.from([0x01, 0x7e, 0xf1, 0xc5]);

const header = Buffer.concat([
    headerMagic,
    Buffer.alloc(4),
    Buffer.alloc(4),
])

header.writeUInt32LE(fileStorage.length, 8)

const table = Buffer.alloc(fileStorage.length * 0x40);

let offset = 0;
let tableOffset = header.length;

for (let i = 0; i < fileStorage.length; i++) {

    const file = fileStorage[i];

    const fileOffset = tableOffset + (fileStorage.length * 0x40) + offset;

    const magicBuffer = magicBytes
    magicBuffer.writeUInt32LE(fileMagics[file.extension as "sbl" | "sbb" | "png"], 0);
    table.write(magicBuffer.toString("ascii"), tableOffset, 4, "ascii");
    table.writeUInt32LE(fileOffset, tableOffset + 4);
    table.writeUInt32LE(file.buffer.length, tableOffset + 8);
    table.write(file.name, tableOffset + 12, 52, "ascii");

    offset += file.buffer.length;
    tableOffset += 0x40;
}

const data = Buffer.concat([
    header,
    ...fileStorage.map(file => file.buffer),
    table,
])

fs.writeFileSync("output.csx", data);