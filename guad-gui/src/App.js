import React, { useState, useEffect, useReducer, useCallback } from 'react';
import FileWriter from './components/FileWriter';
import './App.css';

const initialState = {
  tempSensors: Array(10).fill(0),
  distanceSensors: Array(10).fill(0),
  accelerometer: { x: 0, y: 0, z: 0 },
  magnetometer: { x: 0, y: 0, z: 0 },
  gyroscope: { x: 0, y: 0, z: 0 },
  gapHeightSensors: Array(2).fill(0),
};

const sensorReducer = (state, action) => {
  switch (action.type) {
    case 'UPDATE_TEMP_SENSORS':
      return { ...state, tempSensors: action.payload };
    case 'UPDATE_DISTANCE_SENSORS':
      return { ...state, distanceSensors: action.payload };
    case 'UPDATE_ACCELEROMETER':
      return { ...state, accelerometer: action.payload };
    case 'UPDATE_MAGNETOMETER':
      return { ...state, magnetometer: action.payload };
    case 'UPDATE_GYROSCOPE':
      return { ...state, gyroscope: action.payload };
    case 'UPDATE_GAP_HEIGHT_SENSORS':
      return { ...state, gapHeightSensors: action.payload };
    default:
      return state;
  }
};

function App() {
  const [port, setPort] = useState();
  const [reader, setReader] = useState(null);
  const [displayedData, dispatch] = useReducer(sensorReducer, initialState);
  const [bufferedData, setBufferedData] = useState([]);
  const dataProcessingInterval = 1000; // Interval for processing buffered data

  // Modular approach for processing different sensor data packets
  const processTempSensorsData = (values) => {
    dispatch({ type: 'UPDATE_TEMP_SENSORS', payload: values });
  };

  const processDistanceData = (values) => {
    dispatch({ type: 'UPDATE_DISTANCE_SENSORS', payload: values });
  };

  const processAccelerometerData = (values) => {
    dispatch({ type: 'UPDATE_ACCELEROMETER', payload: { x: values[0], y: values[1], z: values[2] } });
  };

  const processMagnetometerData = (values) => {
    dispatch({ type: 'UPDATE_MAGNETOMETER', payload: { x: values[0], y: values[1], z: values[2] } });
  };

  const processGyroscopeData = (values) => {
    dispatch({ type: 'UPDATE_GYROSCOPE', payload: { x: values[0], y: values[1], z: values[2] } });
  };

  const processGapHeightData = (values) => {
    dispatch({ type: 'UPDATE_GAP_HEIGHT_SENSORS', payload: values });
  };

  // Map packet identifiers to their processing functions
  const packetHandlers = {
    "Temp Sensors": processTempSensorsData,
    "Distance": processDistanceData,
    "Accelerometer": processAccelerometerData,
    "Magnetometer": processMagnetometerData,
    "Gyroscope": processGyroscopeData,
    "Gap Height": processGapHeightData,
    // Future packet types and their handler functions will be added here
  };

  // Utility function to extract sensor values from a data string
  const extractSensorValues = (dataString) => {
    const sensorRegex = /[\d]+/g; // Matches any number of digits
    const matches = dataString.match(sensorRegex);
    return matches ? matches.map(Number) : [];
  };

  // Main function to process the incoming serial data
  const processSerialData = (dataString) => {
    console.log("Processing data string:", dataString);

    // Dynamically identify and process different sensor packets
    Object.keys(packetHandlers).forEach((key) => {
      if (dataString.startsWith(key)) {
        const values = extractSensorValues(dataString);
        packetHandlers[key](values); // Call the handler function based on packet type
      }
    });
  };

  // Function to open the serial port
  const openSerialPort = async () => {
    if (port) {
      console.log("Serial port is already opened");
      return;
    }

    try {
      const tempPort = await navigator.serial.requestPort();
      await tempPort.open({ baudRate: 115200 });
      setPort(tempPort);
      console.log("Serial port opened");
      readSerialData(); // Start reading after opening the port
    } catch (error) {
      console.error("Failed to open serial port:", error);
    }
  };

  // Function to read data from the serial port
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
    // Use a Svelte store or React's useState hook to update the reader state
    setReader(newReader);
  
    const textDecoder = new TextDecoder();
    let buffer = "";
  
    try {
      while (true) {
        const { value, done } = await newReader.read();
        if (done) {
          // Don't forget to process any remaining buffer content before breaking
          if (buffer.length > 0) {
            processSerialData(buffer);
          }
          newReader.releaseLock();
          setReader(null);
          break;
        }
        const text = textDecoder.decode(value, {stream: true}); // Use stream option for partial decoding
        buffer += text;
  
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.substring(0, newlineIndex + 1); // Include the newline character
          processSerialData(line); // Process each complete line
          buffer = buffer.substring(newlineIndex + 1); // Keep remaining data in the buffer
        }
      }
    } catch (error) {
      console.error("Error reading from serial port:", error);
      newReader.releaseLock();
      setReader(null);
    }
  };

  // Function to toggle the LED
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

  // Effect to process buffered data at regular intervals
  useEffect(() => {
    const processDataInterval = setInterval(() => {
      if (bufferedData.length > 0) {
        dispatch({ type: 'UPDATE_SENSORS', payload: bufferedData });
        setBufferedData([]);
      }
    }, dataProcessingInterval);

    return () => clearInterval(processDataInterval);
  }, [bufferedData]);

  // Effect to start reading data when the port is set
  useEffect(() => {
    readSerialData();

    return () => {
      if (reader) {
        reader.cancel();
        reader.releaseLock();
      }
      if (port) {
        port.close();
      }
    };
  }, [port]);

  return (
    <div className="App">
      <div className="container">
        <button onClick={openSerialPort}>Open Serial Port</button>
        <button onClick={toggleLED}>Toggle LED</button>
        <button onClick={() => console.log('Test button clicked')}>Test Button</button>
        <FileWriter data={displayedData} />
  
        <div className="sensors-container">
          <div className="sensor-data-section">
            {/* Sensor Data for Accelerometer, Gyroscope, and Magnetometer */}
            <h2>Sensor Data</h2>
            <table>
              <thead>
                <tr>
                  <th>Sensor</th>
                  <th>X</th>
                  <th>Y</th>
                  <th>Z</th>
                  <th>Units</th>
                </tr>
              </thead>
              <tbody>
              <tr>
                <td>Accelerometer</td>
                <td>{displayedData.accelerometer.x}</td>
                <td>{displayedData.accelerometer.y}</td>
                <td>{displayedData.accelerometer.z}</td>
                <td>m/s²</td>
              </tr>
              <tr>
                <td>Gyroscope</td>
                <td>{displayedData.gyroscope.x}</td>
                <td>{displayedData.gyroscope.y}</td>
                <td>{displayedData.gyroscope.z}</td>
                <td>rad/s</td>
              </tr>
              {/* Optionally, add Magnetometer data in similar fashion if needed */}
              <tr>
                <td>Magnetometer</td>
                <td>{displayedData.magnetometer.x}</td>
                <td>{displayedData.magnetometer.y}</td>
                <td>{displayedData.magnetometer.z}</td>
                <td>µT</td>
              </tr>
              </tbody>
            </table>
          </div>
  
          <div className="sensor-data-section">
            <h2>Gap Height Sensors</h2>
            <div className="barsContainer">
              {displayedData.gapHeightSensors.map((gapHeight, index) => (
                <div key={`gapHeight-${index}`}>
                  <div className="labelSide">20mm</div>
                  <div className="gapHeightBarContainer">
                    {/* Invert the moving bar's position logic */}
                    <div
                      className="movingBar"
                      style={{ 
                        top: `${((gapHeight / 20)) * 100}%`, // Invert movement
                        transition: 'top 0.3s ease', // Smooth transition for the movement
                        backgroundColor: gapHeight < 8 ? '#00FF00' :  // Green for 0-7
                           gapHeight < 13 ? '#FFFF00' : // Yellow for 8-12
                           '#FF0000' // Red for 13-20
                      }}
                    ></div>
                  </div>
                  <div className="valueIndicator">{gapHeight}mm</div>
                </div>
              ))}
            </div>
          </div>

          <div className="sensor-data-section">
            <h2>Temperature Sensors</h2>
            <table>
              <thead>
                <tr>
                  <th>Sensor</th>
                  <th>Temperature (°C)</th>
                </tr>
              </thead>
              <tbody>
                  {displayedData.tempSensors.map((temp, index) => (
                  <tr key={`temp-${index}`}>
                    <td>Temp Sensor {index + 1}</td>
                    <td>{temp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
  
          <div className="sensor-data-section">
            <h2>Distance Sensors</h2>
            <table>
              <thead>
                <tr>
                  <th>Sensor</th>
                  <th>Distance (cm)</th>
                </tr>
              </thead>
              <tbody>
                  {displayedData.distanceSensors.map((distance, index) => (
                  <tr key={`distance-${index}`}>
                    <td>Distance Sensor {index + 1}</td>
                    <td>{distance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
);}
  
  export default App;