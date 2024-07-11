import React, { useState, useEffect, useReducer, useCallback, useRef } from 'react';
import SemiCircleProgressBar from "react-progressbar-semicircle";
import FileWriter from './components/FileWriter';
import logo from './components/white_guad.png'; // Make sure the path is correct
import podImage from './components/pod_top.png';
import './App.css';

const stateDescriptions = [
  { name: "Initialization",
    commands: [
      { text: "Run Health Check", command: "2", targetState: "Ready" }
    ]},
  { name: "Health Check", commands: [] }, // No button for this state
  { name: "Ready",
    commands: [
      { text: "Levitation On", command: "3", targetState: "Levitation" }
    ]},
  { name: "Levitation",
    commands: [
      { text: "Levitation Off", command: "4", targetState: "Ready" },
      { text: "Propulsion On", command: "5", targetState: "Propulsion" }
    ]},
  { name: "Propulsion", commands: [] }, // No button for this state
  { name: "Coasting",
    commands: [
      { text: "Braking", command: "6", targetState: "Stopped" }
    ]},
  { name: "Braking", commands: [] }, // No button for this state
  { name: "Stopped", commands: [] } // No button for this state
];

const initialState = {
  tempSensors: Array(12).fill(0),  // This could be adjusted or used differently depending on your exact needs
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
  podState: stateDescriptions[0].name,
  podHealth: true,
  gapHeightSensors: Array(8).fill(0.00),
  batteryVoltages: Array(144).fill(0.00),
  limTemps: {
    frontRight: 0, frontLeft: 0, backRight: 0, backLeft: 0
  },
  yokeTemps: {
    verticalFrontRight: 0, verticalFrontLeft: 0, verticalBackRight: 0, verticalBackLeft: 0,
    lateralFrontRight: 0, lateralFrontLeft: 0, lateralBackRight: 0, lateralBackLeft: 0
  }
};

const sensorReducer = (state, action) => {
  switch (action.type) {
    case 'UPDATE_POD_STATE':
      return { ...state, podState: action.payload };
    case 'UPDATE_POD_HEALTH':
      return { ...state, podHealth: action.payload };
      case 'UPDATE_IMU_DATA':
        const { position, sensorType, data } = action.payload;
        if (!state.imuData[position]) {
          console.warn(`No position found in IMU data for position: ${position}`);
          return state;
        }
        return {
          ...state,
          imuData: {
            ...state.imuData,
            [position]: {
              ...state.imuData[position],
              [sensorType]: {
                ...state.imuData[position][sensorType],
                ...data
              },
            },
          },
        };
      
    case 'UPDATE_HALL_EFFECT_SENSORS':
      return { ...state, hallEffectSensors: action.payload };
    case 'UPDATE_TEMPERATURES':
      return {
        ...state,
        limTemps: {
          ...state.limTemps,
          ...action.payload.limTemps
        },
        yokeTemps: {
          ...state.yokeTemps,
          ...action.payload.yokeTemps
        }
      };
    default:
      return state;
  }
};

function App() {
  const [isSendingIdle, setIsSendingIdle] = useState(false); // Initially, do not send idle commands
  const [idleCommandAllowed, setIdleCommandAllowed] = useState(true); // Control idle commands based on state changes
  const [port, setPort] = useState();
  const [reader, setReader] = useState(null);
  const [displayedData, dispatch] = useReducer(sensorReducer, initialState);
  const [bufferedData, setBufferedData] = useState([]);
  const [podConnected, setPodConnected] = useState(false);
  const [commandToBeSent, setCommand] = useState("");
  const [fileWriterData, setFileWriterData] = useState("");
  const [consoleMessages, setConsoleMessages] = useState([]); // State to store console messages
  const consoleRef = useRef(null);
  const [spacePressCount, setSpacePressCount] = useState(0);
  const spaceTimeoutRef = useRef(null);
  const [currentCommand, setCurrentCommand] = useState({ commandText: '', commandCode: '', targetState: '' });
  const [keepSendingCommand, setKeepSendingCommand] = useState(false);


  const addToConsole = (msg) => {
    setConsoleMessages(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);
  };

  useEffect(() => {
    if (consoleRef.current) {
        consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
}, [consoleMessages]);

  const dataProcessingInterval = 1000; // Interval for processing buffered data
  const [activeTab, setActiveTab] = useState('sensors'); // Default active tab
  // Calculate low, high, and average temperatures
  const flattenTemps = (temps) => {
    // Extract all temperature values into a single array
    return Object.values(temps).flat();
  };
  
  const allTemps = [
    ...flattenTemps(displayedData.limTemps),
    ...flattenTemps(displayedData.yokeTemps)
  ];
  
  const lowTemperature = Math.min(...allTemps);
  const highTemperature = Math.max(...allTemps);
  const averageTemperature = allTemps.reduce((acc, curr) => acc + curr, 0) / allTemps.length;
  

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

  const packetHandlers = {
    1: (values) => { // IMU Angular velocities for Rear, Center, Front and Lateral Hall Effect Sensors
      dispatch({ type: 'UPDATE_IMU_DATA', payload: { position: 'rear', sensorType: 'gyroscope', data: { x: values[0], y: values[1], z: values[2] } } });
      dispatch({ type: 'UPDATE_IMU_DATA', payload: { position: 'center', sensorType: 'gyroscope', data: { x: values[3], y: values[4], z: values[5] } } });
      dispatch({ type: 'UPDATE_IMU_DATA', payload: { position: 'front', sensorType: 'gyroscope', data: { x: values[6], y: values[7], z: values[8] } } });
      dispatch({ type: 'UPDATE_HALL_EFFECT_SENSORS', payload: values.slice(9, 13) }); // Assuming these are the Lateral Hall Effect Sensors
    },
    2: (values) => { // IMU Accelerations for Rear, Center, Front and Vertical Hall Effect Sensors
      dispatch({ type: 'UPDATE_IMU_DATA', payload: { position: 'rear', sensorType: 'accelerometer', data: { x: values[0], y: values[1], z: values[2] } } });
      dispatch({ type: 'UPDATE_IMU_DATA', payload: { position: 'center', sensorType: 'accelerometer', data: { x: values[3], y: values[4], z: values[5] } } });
      dispatch({ type: 'UPDATE_IMU_DATA', payload: { position: 'front', sensorType: 'accelerometer', data: { x: values[6], y: values[7], z: values[8] } } });
      dispatch({ type: 'UPDATE_HALL_EFFECT_SENSORS', payload: values.slice(9, 13) }); // Assuming these are the Vertical Hall Effect Sensors
    },
    3: (values) => { // Lateral and Vertical Gap Sensors
      dispatch({ type: 'UPDATE_GAP_HEIGHT_SENSORS', payload: {
        lateral: { frontRight: values[0], frontLeft: values[1], backRight: values[2], backLeft: values[3] },
        vertical: { frontRight: values[4], frontLeft: values[5], backRight: values[6], backLeft: values[7] }
      }});
    },
    4: (values) => { // Temperatures for various components
      dispatch({ type: 'UPDATE_TEMPERATURES', payload: {
        limTemps: { frontRight: values[0], frontLeft: values[1], backRight: values[2], backLeft: values[3] },
        yokeTemps: {
          verticalFrontRight: values[4], verticalFrontLeft: values[5], verticalBackRight: values[6], verticalBackLeft: values[7],
          lateralFrontRight: values[8], lateralFrontLeft: values[9], lateralBackRight: values[10], lateralBackLeft: values[11]
        }
      }});
    }
  };  

    // Utility function to extract sensor values from a data string
  const extractSensorValues = (dataString) => {
    // This regex matches both integer and floating-point numbers
    const sensorRegex = /-?\d+(\.\d+)?/g; 
    const matches = dataString.match(sensorRegex);
    return matches ? matches.map(parseFloat) : [];
  };

  const processSerialData = (dataString) => {
    console.log("Received data:", dataString);  // Log the raw data for debugging

    if (!dataString || dataString === "lost") {
        console.error("Connection lost or invalid data.");
        setPodConnected(false);  // Update connection status
        addToConsole("Radio Connection Lost");  // Add to console
        return;
    }
  
    let packetInfo, data;
    try {
      [packetInfo, data] = dataString.split(':');
      if (!packetInfo || !data) {
        console.error("Data string is not in the expected format:", dataString);
        return;
      }
    } catch (error) {
      console.error("Error splitting data string:", dataString, error);
      return;
    }
  
    let packetType = parseInt(packetInfo.trim(), 10);
    let values = data.split(',').map(Number);
    
    let stateCode = values[1];
    let newState = stateDescriptions[stateCode].name || 'Unknown State';
    let healthStatus = values[2] === 1;
    
    dispatch({ type: 'UPDATE_POD_STATE', payload: newState });
    dispatch({ type: 'UPDATE_POD_HEALTH', payload: healthStatus });
  
    if (packetHandlers.hasOwnProperty(packetType)) {
      packetHandlers[packetType](values.slice(3)); // Pass only the data values
    }
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
      setPodConnected(true); // Explicitly set when the port is successfully opened
      console.log("Serial port opened");
      readSerialData(); // Start reading after opening the port
      addToConsole("Serial port opened successfully.");
    } catch (error) {
      console.error("Failed to open serial port:", error);
      setPodConnected(false); // Set to false if opening the port fails
      addToConsole("Failed to open serial port.");
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
  
    const textDecoder = new TextDecoder("utf-8", { stream: true });
    let buffer = "";
    const BUFFER_LIMIT = 1024; // Set according to your testing
  
    try {
      while (true) {
        const { value, done } = await newReader.read();
        if (done) {
          // Ensure remaining buffer is processed before closing
          if (buffer.length > 0) {
            processSerialData(buffer);
          }
          newReader.releaseLock();
          setReader(null);
          break;
        }
  
        const text = textDecoder.decode(value, { stream: true });
        buffer += text;
  
        if (buffer.length > BUFFER_LIMIT) {
          console.warn("Buffer limit reached, data might be lost.");
          // Optionally process what you can before clearing
          processSerialData(buffer);
          buffer = ""; // Clear buffer after processing to handle new data
        }
  
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.substring(0, newlineIndex + 1);
          setFileWriterData(line);
          processSerialData(line.trim());
          buffer = buffer.substring(newlineIndex + 1);
        }
      }
    } catch (error) {
      console.error("Error reading from serial port:", error);
      setPodConnected(false);
      newReader.releaseLock();
      setReader(null);
    }
  };

  // Function to send the idle command
  const sendIdleCommand = useCallback(async () => {
    if (!port || !port.writable || !isSendingIdle || !idleCommandAllowed) {
      console.log("Cannot send idle command, port not writable or not allowed.");
      return;
    }
    try {
      const writer = port.writable.getWriter();
      setCommand('8')
      const data = new TextEncoder().encode('8\n');
      await writer.write(data);
      writer.releaseLock();
    } catch (error) {
      console.error("Error sending idle command:", error);
    }
  }, [port, isSendingIdle, idleCommandAllowed]);

  // Set up an interval for sending the idle command
  useEffect(() => {
    const interval = setInterval(() => {
      if (isSendingIdle && idleCommandAllowed) {
        sendIdleCommand();
      }
    }, 1000); // Every second, send an idle command if allowed

    return () => clearInterval(interval);
  }, [sendIdleCommand, isSendingIdle, idleCommandAllowed]);

  // Send command function updated to prevent idle command during command sending
  const sendCommand = useCallback(async (commandText, commandCode, targetState = '', initialCall = false) => {
    setIsSendingIdle(false);
    setIdleCommandAllowed(false); // Disallow idle command sending when a command is being sent
    setCurrentCommand({ commandText, commandCode, targetState });
    setKeepSendingCommand(true);

    if (!port || !port.writable) {
      if (initialCall) {
        addToConsole(`Port is not open or writable. Could not send command: '${commandText}'`);
      }
      return;
    }
    try {
      if (initialCall) {
        console.log(`Attempting to send command: ${commandText}, ${commandCode}`);
        addToConsole(`Attempting to send command: ${commandText}, ${commandCode}`);
      }
      setCommand(commandCode)
      const writer = port.writable.getWriter();
      const data = new TextEncoder().encode(`${commandCode}\n`);
      await writer.write(data);
      writer.releaseLock();
    } catch (error) {
      console.error("Error sending command:", error);
      addToConsole(`Failed to send command: ${commandText}`);
    } finally {
      setIsSendingIdle(true);
    }
  }, [port]);
  
  useEffect(() => {
    if (displayedData.podState === currentCommand.targetState) {
      setIdleCommandAllowed(true);
    }
    let commandInterval;
    if (keepSendingCommand && currentCommand.targetState) {
      if (displayedData.podState !== currentCommand.targetState) {
        commandInterval = setInterval(() => {
          // Call sendCommand without the initialCall flag after the first time
          sendCommand(currentCommand.commandText, currentCommand.commandCode, currentCommand.targetState);
        }, 100); // Continuously send command every second until state changes
      } else {
        addToConsole(`Command '${currentCommand.commandText}, ${currentCommand.commandCode}' sent successfully.`);
        clearInterval(commandInterval);
        setKeepSendingCommand(false);
        setCurrentCommand({ commandText: '', commandCode: '', targetState: '' });
      }
    }
  
    return () => clearInterval(commandInterval);
  }, [keepSendingCommand, currentCommand, displayedData.podState, sendCommand]);  

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

  useEffect(() => {
    const handleKeyDown = (event) => {
        if (event.key === " ") {
            event.preventDefault(); // Prevent default behavior if needed
            setSpacePressCount(prevCount => {
                if (prevCount === 2) {
                    sendCommand('Emergency Stop', '7', 'Stopped', true);
                    return 0; // Reset counter after sending command
                }
                return prevCount + 1;
            });
        }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        if (spaceTimeoutRef.current) {
            clearTimeout(spaceTimeoutRef.current);
        }
    };
}, [sendCommand]);

useEffect(() => {
  if (spacePressCount > 0) {
      spaceTimeoutRef.current = setTimeout(() => {
          setSpacePressCount(0); // Reset count after 1 second of inactivity
      }, 1000); // Adjust timeout as necessary

      return () => {
          if (spaceTimeoutRef.current) {
              clearTimeout(spaceTimeoutRef.current);
          }
      };
  }
}, [spacePressCount]);


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
            <div className="state-pills-container">
              <div className="state-pills-bar">
                {stateDescriptions.map(state => (
                  <div key={state.name} className={`state-pill ${displayedData.podState === state.name ? "active" : ""}`}>
                    {state.name}
                  </div>
                ))}

                {/* Dynamically generate buttons for the active state */}
                {stateDescriptions
                  .filter(state => state.name === displayedData.podState)
                  .flatMap(state => state.commands)
                  .map((command, index) => (
                    <button key={index} className="state-change-button" onClick={() => sendCommand(command.text, command.command, command.targetState, true)}>
                      {command.text}
                    </button>
                ))}
              </div>
            </div>

            <div className="hero-section">
              <div className="half1">
                <div className="col1">
                  <div className="button-section">
                    {/* Navbar with buttons */}
                    <button onClick={openSerialPort}>Open Serial Port</button>
                    <button style={{backgroundColor: '#FF0000'}} onClick={() => sendCommand('Emergency Stop', '7', 'Stopped', true)}>Emergency Stop</button>
                    <FileWriter data={fileWriterData} sentData={commandToBeSent} />
                  </div>

                  {/* <div className="pod-image-container">
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
                  </div> */}
                </div>

                <div className="col2">
                  <div className="speed-acceleration-section">
                    <div className="progress-bars">
                      <div className="progress-bar">
                        <h5 style={{margin: 0}}>Speed</h5>
                        <SemiCircleProgressBar 
                          percentage={Math.abs(displayedData.imuData.front.accelerometer.x * 10)}
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
                          percentage={Math.abs(displayedData.imuData.front.accelerometer.x * 10)}
                          diameter={150} 
                          showPercentValue={false}
                          strokeWidth={20} 
                          background={"#7d818a"} 
                          className="progressBar" 
                          style={{ right: "100" }} 
                        />
                        <p className="unit">m/s²</p>
                      </div>
                    </div>
                  </div>
                  <div className="pod-image-container">
                    <img src={podImage} alt="Pod" className="pod-image" />
                  </div>
                </div>
                
                <div className="console" ref={consoleRef}>
                  <h4>Console</h4>
                  <h4>*PRESS SPACE BAR 3 TIMES TO EMERGENCY STOP*</h4>
                  <h4>Use ctrl + '+' or ctrl + '-' to resize GUI</h4>
                  {consoleMessages.map((msg, index) => (
                    <p key={index}>{msg}</p>
                  ))}
                </div>
              </div>

              <div className="col3">
                <div className="allbarsdiv">
                <div className="sensor-data-section">
                    <h4>Vertical (mm)</h4>
                    <div className="barsContainer">
                    {displayedData.gapHeightSensors.slice(0, 4).map((gapHeight, index) => (
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
                            {gapHeight.toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="sensor-data-section">
                    <h4>Lateral (mm)</h4>
                    <div className="barsContainer">
                    {displayedData.gapHeightSensors.slice(4, 8).map((gapHeight, index) => (
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
                            {gapHeight.toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
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
              </div>
            </div>
          </div>

          <div className="side-panel">
            <div className="tabs">
              <button onClick={() => handleTabChange('sensors')}>Sensors</button>
              <button onClick={() => handleTabChange('battery')}>Battery Data</button>
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
                      <th>Front left</th>
                      <th>Front right</th>
                      <th>Back left</th>
                      <th>Back right</th>
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
                <h4>Yoke Temperatures (°C)</h4>
                <table>
                  <thead>
                    <tr>
                      <th></th>
                      <th>Front Right</th>
                      <th>Front Left</th>
                      <th>Back Right</th>
                      <th>Back Left</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Vertical</td>
                      <td>{displayedData.yokeTemps.verticalFrontRight.toFixed(2)}</td>
                      <td>{displayedData.yokeTemps.verticalFrontLeft.toFixed(2)}</td>
                      <td>{displayedData.yokeTemps.verticalBackRight.toFixed(2)}</td>
                      <td>{displayedData.yokeTemps.verticalBackLeft.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td>Lateral</td>
                      <td>{displayedData.yokeTemps.lateralFrontRight.toFixed(2)}</td>
                      <td>{displayedData.yokeTemps.lateralFrontLeft.toFixed(2)}</td>
                      <td>{displayedData.yokeTemps.lateralBackRight.toFixed(2)}</td>
                      <td>{displayedData.yokeTemps.lateralBackLeft.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="sensor-data-section">
                <h4>Lim Temperatures (°C)</h4>
                <table>
                  <thead>
                    <tr>
                      <th></th>
                      <th>Front Right</th>
                      <th>Front Left</th>
                      <th>Back Right</th>
                      <th>Back Left</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Temperature</td>
                      <td>{displayedData.limTemps.frontRight.toFixed(2)}</td>
                      <td>{displayedData.limTemps.frontLeft.toFixed(2)}</td>
                      <td>{displayedData.limTemps.backRight.toFixed(2)}</td>
                      <td>{displayedData.limTemps.backLeft.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="sensor-data-section">
                <h4>Hall Effect (Oersted)</h4>
                <table>
                  <thead>
                    <tr>
                      <th>Sensor 1</th>
                      <th>Sensor 2</th>
                      <th>Sensor 3</th>
                      <th>Sensor 4</th>
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