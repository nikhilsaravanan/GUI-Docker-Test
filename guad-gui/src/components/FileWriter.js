// FileWriter.js
import React, { useState, useEffect } from 'react';
 
const FileWriter = ({ data }) => {
  const [fileWriter, setFileWriter] = useState(null);
 
  const openFileWriter = async () => {
    try {
      const handle = await window.showSaveFilePicker();
      const writable = await handle.createWritable();
      setFileWriter(writable);
    } catch (error) {
      console.error('Error accessing file system:', error);
    }
  };
 
  const writeDataToFile = async () => {
    if (!fileWriter || !data) return; // Exit if fileWriter or data is not available
  
    try {
      // Convert data to a Blob object
      const blob = new Blob([JSON.stringify(data)], { type: 'text/plain' });
  
      // Write the Blob to the file
      await fileWriter.write(blob);
  
      console.log('Data written to file successfully');
    } catch (error) {
      console.error('Error writing to file:', error);
    }
  };
 
  useEffect(() => {
    writeDataToFile(); // Call writeDataToFile whenever there's new data or fileWriter changes
  }, [data, fileWriter]);
 
  const closeFileWriter = () => {
    if (fileWriter) {
      fileWriter.close(); // Close the file writer
      console.log('FileWriter closed');
      setFileWriter(null); // Reset fileWriter state
    }
  };
 
  return (
    <div>
      <button onClick={openFileWriter}>Open File Writer</button>
      <button onClick={closeFileWriter}>Close File Writer</button>
    </div>
  );
};
 
export default FileWriter;