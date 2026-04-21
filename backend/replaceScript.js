const fs = require('fs');
const content = fs.readFileSync('src/controllers/fileController.ts', 'utf8');

const newEmptyTrash = `// @desc  Empty trash bin
export const emptyTrash = async (req: Request, res: Response) => {
  try {
    const trashedFiles = await FileMetadata.find({ rootId: DRIVE_FOLDER_ID, status: 'trashed' });
    
    let deletedCount = 0;
    for (const file of trashedFiles) {
      try {
        await drive.files.delete({ fileId: file.fileId });
        deletedCount++;
      } catch (e) {
        console.warn(\`Drive delete failed for \${file.fileId}:\`, (e as Error).message);
      }
    }
    
    await FileMetadata.deleteMany({ rootId: DRIVE_FOLDER_ID, status: 'trashed' });
    await logActivity((req as any).user?._id, 'empty_trash', \`Permanently deleted \${deletedCount} items from trash bin\`);
    res.json({ message: 'Trash emptied' });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};`;

const startIndex = content.indexOf('// @desc  Empty trash bin');
const nextDescIndex = content.indexOf('// @desc  Get all users', startIndex);

if (startIndex !== -1 && nextDescIndex !== -1) {
  const newContent = content.substring(0, startIndex) + newEmptyTrash + '\n\n' + content.substring(nextDescIndex);
  fs.writeFileSync('src/controllers/fileController.ts', newContent);
  console.log('Replaced successfully');
} else {
  console.log('Could not find indices');
}
