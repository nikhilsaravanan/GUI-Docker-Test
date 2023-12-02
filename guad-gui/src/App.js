import React, { useState, useEffect } from 'react';
import SemiCircleProgressBar from "react-progressbar-semicircle";
import LiveGraph from './components/LiveGraph';
import './App.css';

function App() {
  const [port, setPort] = useState();
  const [reader, setReader] = useState(null); // State for managing the reader
  const [displayedData, setDisplayedData] = useState(Array(6).fill(0)); 

  const openSerialPort = async () => {
    if (port) {
      console.log("Serial port is already opened");
      return;
    }

    try {
      const tempPort = await navigator.serial.requestPort();
      await tempPort.open({ baudRate: 9600 });
      setPort(tempPort);
      console.log("Serial port opened");
      readSerialData(); // Start reading after opening the port
    } catch (error) {
      console.error("Failed to open serial port:", error);
    }
  };

  const readSerialData = async () => {
    if (!port) {
      console.log("Serial port is not set");
      return;
    }
    
    if (reader) {
      console.log("Reader is already in use");
      return;
    }

    const newReader = port.readable.getReader();
    setReader(newReader);

    const textDecoder = new TextDecoder();

    try {
      while (true) {
        const { value, done } = await newReader.read();
        if (done) {
          newReader.releaseLock();
          setReader(null);
          break;
        }
        console.log("Received raw data:", value);
        processSerialData(textDecoder.decode(value));
      }
    } catch (error) {
      console.error("Error reading from serial port:", error);
      newReader.releaseLock();
      setReader(null);
    }
  };

  const processSerialData = (dataString) => {
    console.log("Processing data string:", dataString);
  
    const match = dataString.match(/\b\d+\b/);
    if (match) {
      const sensorValue = Number(match[0]);
      console.log("Processed sensor value:", sensorValue);
      setDisplayedData(displayedData.map(() => sensorValue));
    } else {
      console.log("No numeric value found in data string");
    }
  };

  const toggleLED = async () => {
    try {
      console.log("toggleLED function called");
      if (!port || !port.writable) {
        console.log("Port is not open or writable");
        return;
      }
  
      console.log("Sending toggle command to Arduino");
      const writer = port.writable.getWriter();
      const data = new TextEncoder().encode('toggleLED\n');
      await writer.write(data);
      writer.releaseLock();
    } catch (error) {
      console.error("Error in toggleLED function:", error);
    }
  };
  
  useEffect(() => {
    // No need to use interval here as readSerialData already has a while loop
    readSerialData();

    return () => {
      if (reader) {
        reader.cancel(); // Cancel the ongoing read operation
        reader.releaseLock();
      }
      if (port) {
        port.close();
      }
      console.log("Cleaned up on component unmount");
    };
  }, [port]); // Removed reader from the dependency array

  return (
    <div className="App">
      <button onClick={openSerialPort}>Open Serial Port</button>
      <button onClick={toggleLED}>Toggle LED</button>
      <button onClick={() => console.log('Test button clicked')}>Test Button</button>
      
      <div className="flex-container">
        {displayedData.map((value, index) => (
          <div className="flex-item" key={index}>
            <div className="card">
              <div className="card-content">
                <h4>Sensor {index + 1}</h4>
                <div className='progBarContainer'>
                  <SemiCircleProgressBar
                    percentage={value}
                    diameter={200}
                    showPercentValue
                    strokeWidth={20}
                    background={"#202226"}
                    className="progressBar"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <LiveGraph />
    </div>
  );
}

export default App;



// import logo from './logo.svg';
// import './App.css';
// import React, { useState, useEffect, useMemo, useRef } from 'react';
// import SemiCircleProgressBar from "react-progressbar-semicircle";
// import LiveGraph from './components/LiveGraph';
// // import { Card, CardContent, Typography, Grid } from '@material-ui';

// function App() {
//  const[port, setPort] =  useState();
//  const [bit_val, setBit_val] = useState(49);
//  const [readval, setReadVal] = useState("");
//  const[led_style, setLedStyle] = useState("");
//  const[sensor_array, setSensorArray] = useState([]);
//  const[displayed_data, setDisplayedData] = useState([1,2,3,4,5,6]);
//  const[count,setCount] = useState(0)
// const sty = useRef()
//   const openSerialPort = async () =>{
   
//    const temp_port = await navigator.serial.requestPort();
//       await temp_port.open({
//         baudRate: 9600
//       });
//       setPort(temp_port);
    
//   }

//   const flash = async() => {
    
//    let writer = port.writable.getWriter()
    
//     // if (writer['desiredSize'] != undefined){
//     //   console.log("writer is: "+ writer['desiredSize'])
//     const data = new Uint8Array([49,49,49,49,49,49]); // hello
//     await writer.write(data);
    
//     // Allow the serial port to be closed later.
//     writer.releaseLock();
//     console.log("writing 1");
//   }
  
// const off = async()=>{
//   let writer = port.writable.getWriter()

//   const data = new Uint8Array([48,48,48,48,48,48]); // hello
//   await writer.write(data);
//   console.log("writing 0");
 
//   // Allow the serial port to be closed later.
//   writer.releaseLock();
// }

// useEffect(()=>{ console.log(sensor_array)},[sensor_array])
// useEffect(()=>{
  
//   const interval = setInterval(() => {
//     setCount(count + 1);
//     if(sensor_array.length > 0){
//       setDisplayedData(sensor_array)
//     }
    
// }, 100);
// //Clearing the interval
// return () => clearInterval(interval);
// },[count])
// const read =async() =>{
// // Listen to data coming from the serial device.
// const textDecoder = new TextDecoder();
// // Listen to data coming from the serial device.
// const reader = port.readable.getReader();
// let tempstring = "";
// while (true) {
//   const { value, done } = await reader.read();
//   if (done) {
//     // Allow the serial port to be closed later.
//     reader.releaseLock();
//     break;
//   }
//  //Ravi logic for sensor packet decode
//  let packet_array = []
//  let super_value = textDecoder.decode(value)
//  tempstring+=super_value;
//  packet_array = tempstring.split("\r\n");
//  tempstring = packet_array[packet_array.length -1];
//  packet_array = packet_array.slice(0,packet_array.length -1);
//  for(let i =0; i< packet_array.length; i++){
//   if(packet_array[i].substring(1,2) == "1"){
//     let temp_array = packet_array[i].split(",");
//     temp_array =temp_array.slice(2,temp_array.length)
//     for(let j =0; j<temp_array.length; j++){
//       temp_array[j] = Number(temp_array[j].substring(temp_array[j].length-2,temp_array[j].length));
//     }
    
//     setSensorArray(temp_array)
//   }
//  }

 
//   // if(textDecoder.decode(value) == "1" ){
//   //   if(sty.current.className!="led-blue"){
//   //     sty.current.className = "led-blue"
//   //   }
    
//   //   console.log(sty.current.className)
//   //   }else if(textDecoder.decode(value) == "0"  ){
//   //     if (sty.current.className != "led-off"){
//   //       sty.current.className = "led-off"
//   //     }
      
//   //   }
    
 
// }
// }
// const toggle_light = async() => {
//   let writer = port.writable.getWriter()
  
//   const data = new Uint8Array([bit_val]); // hello
//   await writer.write(data);
 
//   // Allow the serial port to be closed later.
//   writer.releaseLock();
//   if ( bit_val == 48){
//     setBit_val(49)
//   }else {
//     setBit_val(48)
//   }
// }





  
//   return (
//     <div className="App">
//     <button onClick={() => openSerialPort()}> Open Serial Port </button>
//     <button onClick={() => flash()}> on </button>
//     <button onClick={() => off()}> off </button>
//     <button onClick={()=> read()}> read</button>
//     <button onClick={()=> toggle_light()}> light toggle</button>
//     {/* <h1>{sensor_display}</h1>
//     <div className="led-box">  </div>
//     <div ref = {sty}></div> */}
    
//     {/* <div className='progBarContainer'>
//     <div className="semicircle-container" style={{position: "absolute"}}><svg width="150" height="75" style={{transform: "rotateY(180deg)", overflow: "hidden"}}><circle cx="75" cy="75" r="70" fill="none" stroke="#202226" strokeWidth="5" strokeDasharray="219.9114857512855" style={{strokeDashoffset: "219.911"}}></circle><circle cx="75" cy="75" r="70" fill="none" stroke="#02B732" strokeWidth="5" strokeDasharray="200.9114857512855" style={{strokeDashoffset: "150", transition: "stroke-dashoffset 0.3s ease 0s, stroke-dasharray 0.3s ease 0s, stroke 0.3s ease 0s;"}}></circle>
//     <circle cx="75" cy="75" r="70" fill="none" stroke="#E0B037" strokeWidth="5" strokeDasharray="219.9114857512855" style={{strokeDashoffset: "360", transition: "stroke-dashoffset 0.3s ease 0s, stroke-dasharray 0.3s ease 0s, stroke 0.3s ease 0s;"}}></circle>
//     <circle cx="75" cy="75" r="70" fill="none" stroke="#AC2838" strokeWidth="5" strokeDasharray="219.9114857512855" style={{strokeDashoffset: "420", transition: "stroke-dashoffset 0.3s ease 0s, stroke-dasharray 0.3s ease 0s, stroke 0.3s ease 0s;"}}></circle>
//     </svg></div>

//     <SemiCircleProgressBar percentage={33} diameter ={150} showPercentValue strokeWidth={20} background={"#202226"} className="progressBar" style={{right:"100%"}} direction={'left'}/>    
//     </div> */}
   
 
//   <div className="flex-container">
//   {Array(1)
//     .fill()
//     .map(
//       (_, rowIdx) => 
//       <div className="flex-row">
//         {Array(6)
//           .fill()
//           .map(
//             (_, colIdx) => 
//             <div className="flex-item">
//               <div className="card">
//                 <div className="card-content">
//                   <h4>Sensor {rowIdx * 6 + colIdx + 1}</h4>
//                                   <div className='progBarContainer'>
//                     <SemiCircleProgressBar percentage={displayed_data[rowIdx * 6 + colIdx ]} diameter ={200} showPercentValue strokeWidth={20} background={"#202226"} className="progressBar" style={{right:"100%"}}/>    
//                     </div>
//                 </div>
//               </div>
//             </div>
          
//           )
//           }
//       </div>
    
//     )
//     }
// </div>
// <LiveGraph />
//     </div>
//   );
// }

// export default App;
