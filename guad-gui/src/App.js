import React, { useState, useEffect, useReducer, useCallback } from 'react';
import SemiCircleProgressBar from "react-progressbar-semicircle";
import FileWriter from './components/FileWriter';
import logo from './components/white_guad.png'; // Make sure the path is correct
import podImage from './components/pod_top.png';
import './App.css';

const initialState = {
  tempSensors: Array(12).fill(0),
  hallEffectSensors: Array(8).fill(0),
  imuData: {
    rear: {
      accelerometer: { x: 0, y: 0, z: 0 },
      gyroscope: { x: 0, y: 0, z: 0 }
    },
    center: {
      accelerometer: { x: 0, y: 0, z: 0 },
      gyroscope: { x: 0, y: 0, z: 0 }
    },
    front: {
      accelerometer: { x: 0, y: 0, z: 0 },
      gyroscope: { x: 0, y: 0, z: 0 }
    }
  },
  gapHeightSensors: Array(8).fill(0.00),
  batteryVoltages: Array(144).fill(0.00),
};

const sensorReducer = (state, action) => {
  switch (action.type) {
    case 'UPDATE_TEMP_SENSORS':
      return { ...state, tempSensors: action.payload };
    case 'UPDATE_HALL_EFFECT_SENSORS':
      return { ...state, hallEffectSensorsSensors: action.payload };
    case 'UPDATE_GAP_HEIGHT_SENSORS':
      return { ...state, gapHeightSensors: action.payload };
      case 'UPDATE_IMU_DATA':
      const { position, data } = action.payload;
      return {
        ...state,
        imuData: {
          ...state.imuData,
          [position]: data
        }
      };
    default:
      return state;
  }
};

function App() {
  const [port, setPort] = useState();
  const [reader, setReader] = useState(null);
  const [displayedData, dispatch] = useReducer(sensorReducer, initialState);
  const [bufferedData, setBufferedData] = useState([]);
  const [podConnected, setPodConnected] = useState(false);
  const [commandToBeSent, setCommand] = useState("");
  const [podStatus, setPodStatus] = useState({
    brakes: 'OK',
    CCU: 'OK',
    VCU: 'OK',
    BMS: 'OK',
  });
  const [podData, setPodData] = useState({
    speed: 0,
    acceleration: 0,
  });
  const [errors, setErrors] = useState([
    { name: 'Main Emergency', status: 'OK', message: 'No emergency' },
    { name: 'CCU Error', status: 'OK', message: 'No CCU error' },
    { name: 'VCU Error', status: 'OK', message: 'No VCU error' }
  ]);
  const dataProcessingInterval = 1000; // Interval for processing buffered data
  const [activeTab, setActiveTab] = useState('battery'); // Default active tab
  // Calculate low, high, and average temperatures
  const lowTemperature = Math.min(...displayedData.tempSensors);
  const highTemperature = Math.max(...displayedData.tempSensors);
  const averageTemperature = displayedData.tempSensors.reduce((acc, curr) => acc + curr, 0) / displayedData.tempSensors.length;

  // Ensure values are finite or set a default/fallback value
  const lowTemp = isFinite(lowTemperature) ? lowTemperature.toFixed(2) : 'N/A';
  const highTemp = isFinite(highTemperature) ? highTemperature.toFixed(2) : 'N/A';
  const avgTemp = isFinite(averageTemperature) ? averageTemperature.toFixed(2) : 'N/A';

  const highestCellVoltage = Math.max(...displayedData.batteryVoltages);
  const lowestCellVoltage = Math.min(...displayedData.batteryVoltages);
  const averageCellVoltage = displayedData.batteryVoltages.length > 0 
    ? displayedData.batteryVoltages.reduce((acc, curr) => acc + curr, 0) / displayedData.batteryVoltages.length 
    : 0;

  // Format to two decimal places
  const highestVoltage = isFinite(highestCellVoltage) ? highestCellVoltage.toFixed(2) : 'N/A';
  const lowestVoltage = isFinite(lowestCellVoltage) ? lowestCellVoltage.toFixed(2) : 'N/A';
  const averageVoltage = isFinite(averageCellVoltage) ? averageCellVoltage.toFixed(2) : 'N/A';


  // Function to change the active tab
  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
  };

  const updateError = (name, status, message) => {
    setErrors(prevErrors => {
      return prevErrors.map(error => {
        if (error.name === name) {
          return { ...error, status, message };
        }
        return error;
      });
    });
  };

  // Modular approach for processing different sensor data packets
  const processTempSensorsData = (values) => {
    dispatch({ type: 'UPDATE_TEMP_SENSORS', payload: values });
  };

  const processHallEffectData = (values) => {
    dispatch({ type: 'UPDATE_HALL_EFFECT_SENSORS', payload: values });
  };

  const processIMUData = (position, values) => {
    if (position === 'Rear') {
      dispatch({ type: 'UPDATE_REAR_IMU', payload: { accel: { x: values[0], y: values[1], z: values[2] }, angular: { x: values[3], y: values[4], z: values[5] } } });
    } else if (position === 'Center') {
      dispatch({ type: 'UPDATE_CENTER_IMU', payload: { accel: { x: values[0], y: values[1], z: values[2] }, angular: { x: values[3], y: values[4], z: values[5] } } });
    } else if (position === 'Front') {
      dispatch({ type: 'UPDATE_FRONT_IMU', payload: { accel: { x: values[0], y: values[1], z: values[2] }, angular: { x: values[3], y: values[4], z: values[5] } } });
    }
  };

  const processGapHeightData = (values) => {
    dispatch({ type: 'UPDATE_GAP_HEIGHT_SENSORS', payload: values });
  };

  const processBatteryData = (values) => {
    dispatch({ type: 'UPDATE_BATTERY_VOLTAGES', payload: values });
  };  

  // Map packet identifiers to their processing functions
  const packetHandlers = {
    "Temp Sensors": processTempSensorsData,
    "Hall Effect": processHallEffectData,
    "Rear IMU Data": (values) => {
      dispatch({ type: 'UPDATE_IMU_DATA', payload: { position: 'rear', data: { accelerometer: { x: values[0], y: values[1], z: values[2] }, gyroscope: { x: values[3], y: values[4], z: values[5] } } } });
    },
    "Center IMU Data": (values) => {
      dispatch({ type: 'UPDATE_IMU_DATA', payload: { position: 'center', data: { accelerometer: { x: values[0], y: values[1], z: values[2] }, gyroscope: { x: values[3], y: values[4], z: values[5] } } } });
    },
    "Front IMU Data": (values) => {
      dispatch({ type: 'UPDATE_IMU_DATA', payload: { position: 'front', data: { accelerometer: { x: values[0], y: values[1], z: values[2] }, gyroscope: { x: values[3], y: values[4], z: values[5] } } } });
    },
    "Gap Height": processGapHeightData,
    "Battery Data": processBatteryData,
    // Future packet types and their handler functions will be added here
  };

    // Utility function to extract sensor values from a data string
  const extractSensorValues = (dataString) => {
    // This regex matches both integer and floating-point numbers
    const sensorRegex = /-?\d+(\.\d+)?/g; 
    const matches = dataString.match(sensorRegex);
    return matches ? matches.map(parseFloat) : [];
  };

  const processSerialData = (dataString) => {
    console.log("Processing data string:", dataString);
  
    if (dataString.trim() === "lost") {
      setPodConnected(false);
    } else {
      setPodConnected(true);
    }
  
    // Dynamically identify and process different sensor packets
    Object.keys(packetHandlers).forEach((key) => {
      if (dataString.startsWith(key)) {
        const values = extractSensorValues(dataString);
        packetHandlers[key](values); // Call the handler function based on packet type
      }
    });
  };
  

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
      // Optionally set podConnected to true here if you want immediate feedback
      // setPodConnected(true);
    } catch (error) {
      console.error("Failed to open serial port:", error);
      // Consider setting podConnected to false here to indicate failure to connect
      setPodConnected(false);
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

  const sendCommand = useCallback(async (command) => {
    if (!port || !port.writable) {
      console.log("Port is not open or writable");
      return;
    }
  
    try {
      console.log(`Sending command: ${command}`);
      const writer = port.writable.getWriter();
      setCommand("A COMMAND WAS SENT TO THE POD: " + command);
      const data = new TextEncoder().encode(`${command}\n`);
      await writer.write(data);
      writer.releaseLock();
      // await writeDataToFile(data);
    } catch (error) {
      console.error("Error sending command:", error);
    }
  }, [port]); // Dependency array includes `port` since the function uses it

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

  function formatNumberWithSign(number) {
    // Ensure the number has exactly two decimal places
    const fixedNumber = number.toFixed(2);
    // Prepend a plus sign for positive numbers
    return number >= 0 ? `+${fixedNumber}` : fixedNumber;
  }

  return (
    <div className="App">
      <div className="navbar-top">
        <img src={logo} className="logo" alt="Logo" />
      </div>
      <div className="content">
        <div className="container">
          <div className="main-content">
            {!podConnected && (
              <div className="disconnected-banner">
                Pod Disconnected
              </div>
            )}    
            <div className="hero-section">
              <div className="col1">
                <div className="button-section">
                  {/* Navbar with buttons */}
                  <button onClick={openSerialPort}>Open Serial Port</button>
                  <button onClick={() => sendCommand('1')}>Levitation On</button>
                  <button onClick={() => sendCommand('0')}>Levitation Off</button>
                  <button onClick={toggleLED}>Toggle LED</button>
                  <button onClick={toggleLED}>Toggle LED</button>
                  <button onClick={() => sendCommand('1')}>Run</button>
                  <button style={{backgroundColor: '#FF0000'}} onClick={() => sendCommand('1')}>Emergency Stop</button>
                  <FileWriter data={displayedData} sentData={commandToBeSent} />
                </div>

                <div className="pod-image-container">
                  <img src={podImage} alt="Pod" className="pod-image" />
                  <div className="pod-status-grid">
                    <div className="status-item">
                      <div className={`status-indicator ${podStatus.BMS.toLowerCase()}`}></div>
                      <span>BMS: {podStatus.BMS}</span>
                    </div>
                    <div className="status-item">
                      <div className={`status-indicator ${podStatus.CCU.toLowerCase()}`}></div>
                      <span>CCU: {podStatus.CCU}</span>
                    </div>
                    <div className="status-item">
                      <div className={`status-indicator ${podStatus.VCU.toLowerCase()}`}></div>
                      <span>VCU: {podStatus.VCU}</span>
                    </div>
                    <div className="status-item">
                      <div className={`status-indicator ${podStatus.brakes.toLowerCase()}`}></div>
                      <span>Brakes: {podStatus.brakes}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col2">
                <div className="speed-acceleration-section">
                  {/* Display speed and acceleration as progress bars */}
                  <div className="progress-bars">
                    <div className="progress-bar">
                      <h5 style={{margin: 0}}>Speed</h5>
                      <SemiCircleProgressBar 
                        percentage={podData.speed} 
                        diameter={150} 
                        showPercentValue={false}
                        strokeWidth={20} 
                        background={"#7d818a"} 
                        className="progressBar" 
                        style={{ right: "100" }} 
                      />
                      <p className="unit">m/s</p>
                    </div>
                    <div className="progress-bar">
                      <h5 style={{margin: 0}}>Acceleration</h5>
                      <SemiCircleProgressBar 
                        percentage={podData.acceleration} 
                        diameter={150} 
                        showPercentValue={false}
                        strokeWidth={20} 
                        background={"#7d818a"} 
                        className="progressBar" 
                        style={{ right: "100" }} 
                      />
                      <p className="unit">m²/s</p>
                    </div>
                  </div>
                </div>
                <div className="sensor-data-section">
                  <h4>Temperature</h4>
                  <table>
                  <thead>
                    <tr>
                      <th className="numeric-column">Low</th>
                      <th className="numeric-column">High</th>
                      <th className="numeric-column">Average</th>
                      <th>Units</th>
                    </tr>
                  </thead>
                  <tbody>
                        <tr>
                          <td className="numeric-column">{lowTemp}</td>
                          <td className="numeric-column">{highTemp}</td>
                          <td className="numeric-column">{avgTemp}</td>
                          <td>°C</td>
                        </tr>
                  </tbody>
                </table>
                </div>
                <div className="sensor-data-section">
                  <h4>Braking, Embedded</h4>
                </div>
              </div>
              
              <div className="col3">
                <div className="sensor-data-section">
                  <h4>Gap Height</h4>
                  <div className="barsContainer">
                    {displayedData.gapHeightSensors.map((gapHeight, index) => (
                      <div key={`gapHeight-${index}`}>
                        <div className="labelSide">20mm</div>
                        <div className="gapHeightBarContainer">
                          {/* Invert the moving bar's position logic */}
                          <div
                            className="movingBar"
                            style={{ 
                              top: `${(Math.min(gapHeight, 20) / 20 * 100)}%`, // Invert movement
                              transition: 'top 0.3s ease', // Smooth transition for the movement
                              backgroundColor: gapHeight < 8 ? '#00FF00' :  // Green for 0-7
                                gapHeight < 13 ? '#FFFF00' : // Yellow for 8-12
                                '#FF0000' // Red for 13-20
                            }}
                          ></div>
                        </div>
                        <div className="valueIndicator">
                          {gapHeight.toFixed(2)}mm</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="sensor-data-section">
                  <h4>Battery</h4>
                  <h5>Cell Voltage</h5>
                  <table>
                    <thead>
                      <tr>
                        <th className="numeric-column">Low</th>
                        <th className="numeric-column">High</th>
                        <th className="numeric-column">Average</th>
                        <th>Units</th>
                      </tr>
                    </thead>
                    <tbody>
                          <tr>
                            <td className="numeric-column">{lowestVoltage}</td>
                            <td className="numeric-column">{highestVoltage}</td>
                            <td className="numeric-column">{averageVoltage}</td>
                            <td>V</td>
                          </tr>
                    </tbody>
                  </table>
                  <h5>Resistance</h5>
                  <table>
                    <thead>
                      <tr>
                        <th className="numeric-column">Low</th>
                        <th className="numeric-column">High</th>
                        <th className="numeric-column">Average</th>
                        <th>Units</th>
                      </tr>
                    </thead>
                    <tbody>
                          <tr>
                            <td className="numeric-column">FILLER</td>
                            <td className="numeric-column">FILLER</td>
                            <td className="numeric-column">FILLER</td>
                            <td>Ω</td>
                          </tr>
                    </tbody>
                </table>
                <h5>Pack </h5>
                  <table>
                    <thead>
                      <tr>
                        <th className="numeric-column">Low</th>
                        <th className="numeric-column">High</th>
                        <th className="numeric-column">Average</th>
                        <th>Units</th>
                      </tr>
                    </thead>
                    <tbody>
                          <tr>
                            <td className="numeric-column">FILLER</td>
                            <td className="numeric-column">FILLER</td>
                            <td className="numeric-column">FILLER</td>
                            <td>?</td>
                          </tr>
                    </tbody>
                </table>
                </div>
              </div>

            </div>
            <div className="console">
              <h4>Console</h4>
              <p>12:35:36 PM: Pre-Run Check: CCU</p>
              <p>12:35:36 PM: SUCCESS</p>
              <p>12:35:36 PM: Pre-Run Check: VCU</p>
              <p>12:35:36 PM: !!!ERROR!!!: VCU</p>
            </div>
          </div>

          <div className="side-panel">
            <div className="tabs">
              <button onClick={() => handleTabChange('battery')}>Battery Data</button>
              <button onClick={() => handleTabChange('sensors')}>Sensors</button>
            </div>

            <div className={`tab-content ${activeTab === 'sensors' ? 'active-tab-content' : ''}`}>
              <div className="sensor-data-section">
                <h4>IMU Data</h4>
                <table>
                  <thead>
                    <tr>
                      <th>Pos.</th>
                      <th>Sensor</th>
                      <th className="numeric-column">X</th>
                      <th className="numeric-column">Y</th>
                      <th className="numeric-column">Z</th>
                      <th>Units</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(displayedData.imuData).map(([position, sensors]) => (
                      <React.Fragment key={position}>
                        <tr>
                          <td rowSpan="2">{position}</td>
                          <td>Accelerometer</td>
                          <td className="numeric-column">{sensors.accelerometer.x.toFixed(2)}</td>
                          <td className="numeric-column">{sensors.accelerometer.y.toFixed(2)}</td>
                          <td className="numeric-column">{sensors.accelerometer.z.toFixed(2)}</td>
                          <td>m/s²</td>
                        </tr>
                        <tr>
                          <td>Gyroscope</td>
                          <td className="numeric-column">{sensors.gyroscope.x.toFixed(2)}</td>
                          <td className="numeric-column">{sensors.gyroscope.y.toFixed(2)}</td>
                          <td className="numeric-column">{sensors.gyroscope.z.toFixed(2)}</td>
                          <td>rad/s</td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

      
              <div className="sensor-data-section">
                <h4>Gap Height</h4>
                <table>
                  <thead>
                    <tr>
                      <th>Position</th>
                      <th>1 (mm)</th>
                      <th>2 (mm)</th>
                      <th>3 (mm)</th>
                      <th>4 (mm)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Vertical Sensors */}
                    <tr>
                      <td>Vertical</td>
                      {displayedData.gapHeightSensors.slice(0, 4).map((gapHeight, index) => (
                        <td key={`vertical-${index}`}>{gapHeight.toFixed(2)}</td>
                      ))}
                    </tr>
                    {/* Lateral Sensors */}
                    <tr>
                      <td>Lateral</td>
                      {displayedData.gapHeightSensors.slice(4, 8).map((gapHeight, index) => (
                        <td key={`lateral-${index}`}>{gapHeight.toFixed(2)}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="sensor-data-section">
                <h4>Temperature</h4>
                <table>
                  <thead>
                    <tr>
                      <th>Sensor 1 (°C)</th>
                      <th>Sensor 2 (°C)</th>
                      <th>Sensor 3 (°C)</th>
                      <th>Sensor 4 (°C)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...Array(Math.ceil(displayedData.tempSensors.length / 4))].map((_, rowIndex) => (
                      <tr key={`temp-row-${rowIndex}`}>
                        {displayedData.tempSensors.slice(rowIndex * 4, (rowIndex + 1) * 4).map((temp, index) => (
                          <td key={`temp-${rowIndex}-${index}`}>{temp}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="sensor-data-section">
                <h4>Hall Effect</h4>
                <table>
                  <thead>
                    <tr>
                      <th>Sensor 1 (Oersted)</th>
                      <th>Sensor 2 (Oersted)</th>
                      <th>Sensor 3 (Oersted)</th>
                      <th>Sensor 4 (Oersted)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...Array(Math.ceil(displayedData.hallEffectSensors.length / 4))].map((_, rowIndex) => (
                      <tr key={`hallEffect-row-${rowIndex}`}>
                        {displayedData.hallEffectSensors.slice(rowIndex * 4, (rowIndex + 1) * 4).map((hallEffect, index) => (
                          <td key={`hallEffect-${rowIndex}-${index}`}>{hallEffect}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={`tab-content ${activeTab === 'battery' ? 'active-tab-content' : ''}`}>
            <div className="sensor-data-section">
                <h4>Battery Voltages</h4>
                <table>
                  <tbody>
                    {Array.from({ length: 18 }, (_, rowIndex) => rowIndex * 8).map(rowStartIndex => (
                      <tr key={`row-${rowStartIndex / 8}`}>
                        {Array.from({ length: 8 }, (_, colIndex) => rowStartIndex + colIndex).map(cellIndex => (
                          <td key={`cell-${cellIndex}`}>
                            {/* Ensuring that a default value of 0 is displayed */}
                            {displayedData.batteryVoltages[cellIndex]?.toFixed(2) || '0.00'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default App;