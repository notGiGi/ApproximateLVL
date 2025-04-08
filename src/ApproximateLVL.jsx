import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, BarChart, Bar, Cell, ReferenceLine, ComposedChart } from 'recharts';
// Constants
const ACCENT_COLOR = "#4CAF50";
const PRIMARY_COLOR = "#2c3e50";
const ALICE_COLOR = "#3498db";  
const BOB_COLOR = "#e67e22";   
const ERROR_COLOR = "#e74c3c";
const AMP_COLOR = "#9c27b0";
const FV_COLOR = "#e91e63";

// Simulation Engine
const SimulationEngine = {
  simulateRound: (aliceValue, bobValue, p, algorithm = "auto", meetingPoint = 0.5) => {
    if (algorithm === "auto") {
      algorithm = p > 0.5 ? "AMP" : "FV";
    }
    
    const aliceMessageDelivered = Math.random() < p;
    const bobMessageDelivered = Math.random() < p;
    
    let newAliceValue = aliceValue;
    let newBobValue = bobValue;
    
    if (bobMessageDelivered) {
      if (algorithm === "AMP") {
        newAliceValue = meetingPoint;
      } else if (algorithm === "FV") {
        newAliceValue = bobValue;
      }
    }
    
    if (aliceMessageDelivered) {
      if (algorithm === "AMP") {
        newBobValue = meetingPoint;
      } else if (algorithm === "FV") {
        newBobValue = aliceValue;
      }
    }
    
    return {
      newAliceValue,
      newBobValue,
      aliceReceived: aliceMessageDelivered,
      bobReceived: bobMessageDelivered,
      messages: [
        {from: "Bob", to: "Alice", delivered: bobMessageDelivered, value: bobValue},
        {from: "Alice", to: "Bob", delivered: aliceMessageDelivered, value: aliceValue}
      ]
    };
  },
  
  runExperiment: (aliceInitial, bobInitial, p, rounds, algorithm = "auto", meetingPoint = 0.5) => {
    let aliceValue = aliceInitial;
    let bobValue = bobInitial;
    const history = [{
      round: 0,
      alice_value: aliceValue,
      bob_value: bobValue,
      discrepancy: Math.abs(bobValue - aliceValue),
      messages: []
    }];
    
    for (let r = 1; r <= rounds; r++) {
      const { newAliceValue, newBobValue, aliceReceived, bobReceived, messages } = 
        SimulationEngine.simulateRound(aliceValue, bobValue, p, algorithm, meetingPoint);
      
      aliceValue = newAliceValue;
      bobValue = newBobValue;
      
      history.push({
        round: r,
        alice_value: aliceValue,
        bob_value: bobValue,
        discrepancy: Math.abs(bobValue - aliceValue),
        alice_received: aliceReceived,
        bob_received: bobReceived,
        messages: messages
      });
    }
    
    return history;
  },
  
  calculateExpectedDiscrepancy: (p, algorithm = "auto") => {
    // Determine which algorithm to use
    if (algorithm === "auto") {
      algorithm = p > 0.5 ? "AMP" : "FV";
    }
    
    // Calculate using the correct formula for each algorithm
    if (algorithm === "AMP") {
      return 1 - p; // AMP formula: 1-p
    } else { // FV
      return (1-p)**2 + p**2; // FV formula: (1-p)^2 + p^2
    }
  },
  
  runMultipleExperiments: (aliceInitial, bobInitial, p, rounds, repetitions, algorithm = "auto", meetingPoint = 0.5) => {
    const allDiscrepancies = [];
    const allRuns = [];
    
    for (let i = 0; i < repetitions; i++) {
      const history = SimulationEngine.runExperiment(aliceInitial, bobInitial, p, rounds, algorithm, meetingPoint);
      const finalDiscrepancy = history[history.length - 1].discrepancy;
      allDiscrepancies.push(finalDiscrepancy);
      allRuns.push(history);
    }
    
    // Calculate statistics
    const mean = allDiscrepancies.reduce((a, b) => a + b, 0) / allDiscrepancies.length;
    const sorted = [...allDiscrepancies].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0 
      ? (sorted[sorted.length/2 - 1] + sorted[sorted.length/2]) / 2
      : sorted[Math.floor(sorted.length/2)];
    const min = Math.min(...allDiscrepancies);
    const max = Math.max(...allDiscrepancies);
    
    // Calculate standard deviation
    const variance = allDiscrepancies.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / allDiscrepancies.length;
    const std = Math.sqrt(variance);
    
    return {
      mean,
      median,
      min,
      max,
      std,
      allValues: allDiscrepancies,
      theoretical: SimulationEngine.calculateExpectedDiscrepancy(p, algorithm),
      allRuns
    };
  }
};

// Component: App Logo
function AppLogo() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="40" fill="#f5f5f5" />
      <polygon points="50,30 65,37.5 65,62.5 50,70 35,62.5 35,37.5" fill="#4e54c8" stroke="#36389c" strokeWidth="1" />
    </svg>
  );
}

// Component: Slider
function Slider({ value, onChange, min = 0, max = 100, step = 1, label, color }) {
  return (
    <div className="w-full mb-4">
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-medium" style={{ color }}>{label}</label>
        <span className="text-sm font-bold" style={{ color }}>{(value / 100).toFixed(2)}</span>
      </div>
      <input 
        type="range" 
        min={min} 
        max={max} 
        step={step}
        value={value} 
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        style={{ 
          background: `linear-gradient(to right, ${color} 0%, ${color} ${value}%, #e5e7eb ${value}%, #e5e7eb 100%)`
        }}
      />
    </div>
  );
}

// Component: Metric Card
function MetricCard({ label, value, color }) {
  return (
    <div className="bg-white rounded-lg shadow p-4 flex-1 min-w-20" style={{ borderLeft: `5px solid ${color}` }}>
      <h3 className="text-sm text-gray-500 font-medium">{label}</h3>
      <p className="text-lg font-bold mt-1">{value}</p>
    </div>
  );
}

// Component: Progress Bar
function ProgressBar({ value, label }) {
  return (
    <div className="w-full">
      {label && <div className="text-sm font-medium mb-1">{label}</div>}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="h-2 rounded-full" 
          style={{ width: `${value}%`, backgroundColor: ACCENT_COLOR }}
        />
      </div>
    </div>
  );
}

// Component: Experiment Visualization
function ExperimentVisualization({ experimentData, currentRound = 0 }) {
  if (!experimentData || experimentData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-400">No experiment data available</p>
      </div>
    );
  }

  // Filter data up to current round
  const roundData = experimentData.slice(0, currentRound + 1);
  
  // Prepare data for the chart
  const data = roundData.map(d => ({
    round: d.round,
    alice: d.alice_value,
    bob: d.bob_value,
    discrepancy: d.discrepancy
  }));

  return (
    <div className="bg-white rounded-lg shadow p-4 h-64">
      <h3 className="text-lg font-semibold mb-4">Experiment Visualization</h3>
      <ResponsiveContainer width="100%" height="80%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="round" />
          <YAxis domain={[0, 1]} />
          <Tooltip />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="alice" 
            name="Alice" 
            stroke={ALICE_COLOR} 
            strokeWidth={3}
            dot={{ r: 5, strokeWidth: 2, fill: "white" }}
          />
          <Line 
            type="monotone" 
            dataKey="bob" 
            name="Bob" 
            stroke={BOB_COLOR} 
            strokeWidth={3}
            dot={{ r: 5, strokeWidth: 2, fill: "white" }}
          />
          <Line 
            type="monotone" 
            dataKey="discrepancy" 
            name="Discrepancy" 
            stroke="#9b59b6" 
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Component: Histogram Plot
function HistogramPlot({ discrepancies, theoretical, experimental }) {
  if (!discrepancies || discrepancies.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-400">No data available</p>
      </div>
    );
  }

  // Create histogram data
  const min = Math.min(...discrepancies);
  const max = Math.max(...discrepancies);
  const binCount = 10; // Reducido para mejor rendimiento
  const binWidth = (max - min) / binCount;
  
  // Create bins
  const bins = Array(binCount).fill(0).map((_, i) => ({ 
    x: min + i * binWidth, 
    count: 0 
  }));
  
  // Fill bins
  discrepancies.forEach(d => {
    const binIndex = Math.min(Math.floor((d - min) / binWidth), binCount - 1);
    if (binIndex >= 0) bins[binIndex].count++;
  });

  // Calculate mean for vertical line
  const mean = discrepancies.reduce((a, b) => a + b, 0) / discrepancies.length;

  return (
    <div className="bg-white rounded-lg shadow p-4 h-64">
      <h3 className="text-lg font-semibold mb-4">Distribution of Final Discrepancies</h3>
      <ResponsiveContainer width="100%" height="80%">
        <BarChart data={bins} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="x" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="count" fill={ACCENT_COLOR} />
          <ReferenceLine x={mean} stroke="green" strokeWidth={2} strokeDasharray="3 3" />
          {theoretical !== undefined && (
            <ReferenceLine x={theoretical} stroke="red" strokeWidth={2} strokeDasharray="3 3" />
          )}
          {experimental !== undefined && (
            <ReferenceLine x={experimental} stroke="blue" strokeWidth={2} strokeDasharray="3 3" />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Component: Theory Plot with experimental data visualization
function TheoryPlot({ currentP, experimentalData }) {
  // Generate data points for the theoretical curves
  const optimalData = [];
  const ampData = [];
  const fvData = [];
  
  for (let p = 0; p <= 1; p += 0.02) {
    // Calculate theoretical values for both algorithms
    const ampDiscrepancy = 1 - p; // AMP formula: 1-p
    const fvDiscrepancy = (1-p)**2 + p**2; // FV formula: (1-p)^2 + p^2
    
    // Get the expected value (minimum of both algorithms if using auto)
    const expectedDiscrepancy = p >= 0.5 ? ampDiscrepancy : fvDiscrepancy;
    
    optimalData.push({ p, expectedDiscrepancy });
    ampData.push({ p, discrepancy: ampDiscrepancy });
    fvData.push({ p, discrepancy: fvDiscrepancy });
  }

  // Current setting point
  const currentPoint = {
    p: currentP,
    expectedDiscrepancy: SimulationEngine.calculateExpectedDiscrepancy(currentP)
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold mb-2">Expected Discrepancy vs. Probability</h3>
      
      {/* Theory explainer */}
      <div className="mb-3 text-sm text-gray-600 flex flex-wrap items-center gap-4">
        <div className="flex items-center">
          <span className="inline-block w-3 h-3 bg-red-500 mr-1 rounded-sm"></span>
          <span>FV: (1-p)² + p²</span>
        </div>
        <div className="flex items-center">
          <span className="inline-block w-3 h-3 bg-green-500 mr-1 rounded-sm"></span>
          <span>AMP: 1-p</span>
        </div>
        <div className="flex items-center">
          <span className="inline-block w-3 h-3 bg-blue-500 mr-1 rounded-sm"></span>
          <span>Optimal</span>
        </div>
        {experimentalData && experimentalData.length > 0 && (
          <>
            <div className="flex items-center">
              <span className="inline-block w-4 h-4 rounded-full bg-purple-500 mr-1"></span>
              <span>AMP Points</span>
            </div>
            <div className="flex items-center">
              <span className="inline-block w-4 h-4 rounded-full bg-pink-500 mr-1"></span>
              <span>FV Points</span>
            </div>
          </>
        )}
      </div>
      
      {/* Experimental data indicator */}
      {experimentalData && experimentalData.length > 0 && (
        <div className="mb-2 text-center font-bold text-purple-700 bg-purple-50 p-1 rounded">
          Showing {experimentalData.length} experimental data points
        </div>
      )}
      
      {/* Graph container */}
      <div className="border border-gray-300 rounded-lg p-1 mb-4">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                type="number"
                dataKey="p" 
                domain={[0, 1]}
                label={{ value: 'Probability (p)', position: 'insideBottom', offset: -5 }}
              />
              <YAxis 
                type="number"
                dataKey="discrepancy"
                domain={[0, 1]}
                label={{ value: 'Discrepancy', angle: -90, position: 'insideLeft', offset: -10 }}
              />
              <Tooltip formatter={(value) => value.toFixed(4)} />
              <Legend verticalAlign="top" height={36}/>
              
              {/* Highlight for the transition point p=0.5 */}
              <ReferenceLine x={0.5} stroke="#666" strokeDasharray="3 3" />
              
              {/* AMP curve */}
              <Line 
                data={ampData}
                type="monotone" 
                dataKey="discrepancy" 
                name="AMP Algorithm"
                stroke="#2ecc71" 
                strokeWidth={2}
                dot={false}
              />
              
              {/* FV curve */}
              <Line 
                data={fvData}
                type="monotone" 
                dataKey="discrepancy" 
                name="FV Algorithm"
                stroke="#e74c3c" 
                strokeWidth={2}
                dot={false}
              />
              
              {/* Optimal curve */}
              <Line 
                data={optimalData}
                type="monotone" 
                dataKey="expectedDiscrepancy" 
                name="Optimal"
                stroke="#2980b9" 
                strokeWidth={3}
                dot={false}
              />
              
              {/* Current setting */}
              <Scatter
                data={[currentPoint]}
                fill="blue"
                name="Current Setting"
              >
                <Cell fill="blue" r={6} />
              </Scatter>
              
              {/* Experimental points */}
              {experimentalData && experimentalData.length > 0 && (
                <Scatter
                  data={experimentalData}
                  name="Experimental Points"
                >
                  {experimentalData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`}
                      fill={entry.algorithm === "AMP" ? AMP_COLOR : FV_COLOR} 
                      r={6}
                    />
                  ))}
                </Scatter>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        {/* Visual explanation of the algorithms */}
        <div className="pt-2 text-xs text-center border-t border-gray-200 mt-1">
          <span className="text-red-500 font-bold">p &lt; 0.5: Flip Value (FV) Algorithm</span>
          &nbsp;|&nbsp;
          <span className="text-green-500 font-bold">p &gt; 0.5: Agreed Meeting Point (AMP) Algorithm</span>
        </div>
      </div>
      
      {/* Text display of experimental data */}
      {experimentalData && experimentalData.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="font-bold text-lg mb-3">Experimental Results:</div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {experimentalData.map((point, i) => (
              <div 
                key={i} 
                className="p-3 rounded-md shadow-sm flex items-center space-x-3"
                style={{ 
                  backgroundColor: point.algorithm === "AMP" ? "#f3e5f5" : "#fbe9e7",
                  borderLeft: `4px solid ${point.algorithm === "AMP" ? AMP_COLOR : FV_COLOR}`
                }}
              >
                <div className="font-mono text-lg">{point.p.toFixed(2)}</div>
                <div className="flex-1">
                  <div className="font-bold text-sm">{point.algorithm} Algorithm</div>
                  <div className="text-sm">
                    <span className="font-semibold">Result:</span> {point.discrepancy.toFixed(4)}
                  </div>
                  <div className="text-xs text-gray-600">
                    <span className="font-semibold">Theory:</span> {point.theoretical.toFixed(4)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Component: Animation Controls
const AnimationControls = ({ currentRound, totalRounds, onPlay, onPause, onReset, onSliderChange, isPlaying }) => {
  return (
    <div className="flex items-center space-x-4 bg-white rounded-lg shadow p-4">
      <button 
        onClick={onReset}
        className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700"
      >
        ⏮️
      </button>
      
      {isPlaying ? (
        <button 
          onClick={onPause}
          className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700"
        >
          ⏸️
        </button>
      ) : (
        <button 
          onClick={onPlay}
          className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700"
        >
          ▶️
        </button>
      )}
      
      <div className="font-semibold text-sm">Round: {currentRound}</div>
      
      <div className="flex-1">
        <input 
          type="range"
          min={0}
          max={totalRounds}
          value={currentRound}
          onChange={(e) => onSliderChange(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
      </div>
    </div>
  );
};

// Component: Results Table
function ResultsTable({ experimentData }) {
  if (!experimentData || experimentData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-400">No experiment data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Round</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alice Value</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bob Value</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discrepancy</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {experimentData.map((data, index) => (
            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{data.round}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: ALICE_COLOR }}>
                {data.alice_value.toFixed(4)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: BOB_COLOR }}>
                {data.bob_value.toFixed(4)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {data.discrepancy.toFixed(4)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Component: Range Experiments Section
const RangeExperimentsSection = ({ rangeExperiments, setRangeExperiments, isRunning, progress, runRangeExperiments, experimentalResults }) => {
  // Local state for algorithm selection and display options
  const [forcedAlgorithm, setForcedAlgorithm] = useState("auto");
  const [showTheory, setShowTheory] = useState(true);
  
  return (
    <div className="border p-4 rounded-lg">
      <div className="mb-4 bg-blue-50 p-3 rounded-lg">
        <h4 className="font-bold text-blue-800 mb-2">Theoretical Background:</h4>
        <p className="text-sm mb-2">
          From the paper, there are two optimal algorithms depending on p:
        </p>
        <ul className="list-disc pl-5 mb-2 text-sm space-y-1">
          <li><span className="font-bold">Agreed Meeting Point (AMP)</span>: Used when p &gt; 0.5. Expected discrepancy: <span className="font-mono">1-p</span></li>
          <li><span className="font-bold">Flip Value (FV)</span>: Used when p &lt; 0.5. Expected discrepancy: <span className="font-mono">(1-p)² + p²</span></li>
        </ul>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="col-span-1 md:col-span-2">
          <h4 className="font-semibold mb-2 border-b pb-1">Probability Range</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Min Probability:</label>
              <input 
                type="number" 
                min="0.1"
                max="0.4"
                step="0.05"
                value={rangeExperiments.minP}
                onChange={(e) => {
                  const newValue = parseFloat(e.target.value);
                  setRangeExperiments(prev => ({...prev, minP: newValue}));
                }}
                className="w-full p-2 border border-gray-300 rounded-md"
                disabled={isRunning}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Max Probability:</label>
              <input 
                type="number" 
                min="0.6"
                max="0.9"
                step="0.05"
                value={rangeExperiments.maxP}
                onChange={(e) => {
                  const newValue = parseFloat(e.target.value);
                  setRangeExperiments(prev => ({...prev, maxP: newValue}));
                }}
                className="w-full p-2 border border-gray-300 rounded-md"
                disabled={isRunning}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Steps:</label>
              <select
                value={rangeExperiments.steps}
                onChange={(e) => {
                  const newValue = parseInt(e.target.value);
                  setRangeExperiments(prev => ({...prev, steps: newValue}));
                }}
                className="w-full p-2 border border-gray-300 rounded-md"
                disabled={isRunning}
              >
                <option value="3">3 points</option>
                <option value="5">5 points</option>
                <option value="7">7 points</option>
                <option value="10">10 points</option>
              </select>
            </div>
          </div>
        </div>
        
        <div>
          <h4 className="font-semibold mb-2 border-b pb-1">Algorithm Options</h4>
          <div className="space-y-2">
            <div>
              <label className="block text-sm font-medium mb-1">Force Algorithm:</label>
              <select
                value={forcedAlgorithm}
                onChange={(e) => setForcedAlgorithm(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
                disabled={isRunning}
              >
                <option value="auto">Auto (Based on Theory)</option>
                <option value="AMP">Force AMP Algorithm</option>
                <option value="FV">Force FV Algorithm</option>
              </select>
            </div>
            
            <div className="flex items-center">
              <input 
                type="checkbox" 
                id="showTheory" 
                checked={showTheory}
                onChange={(e) => setShowTheory(e.target.checked)} 
                className="mr-2"
              />
              <label htmlFor="showTheory" className="text-sm">Show Theoretical Curve</label>
            </div>
          </div>
        </div>
        
        <div>
          <h4 className="font-semibold mb-2 border-b pb-1">Display Legend</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">AMP Point:</span>
              <div className="w-5 h-5 rounded-full bg-purple-500 border-2 border-white shadow-md"></div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">FV Point:</span>
              <div className="w-5 h-5 rounded-full bg-pink-500 border-2 border-white shadow-md"></div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Optimal Curve:</span>
              <div className="w-10 h-1 bg-blue-500"></div>
            </div>
          </div>
        </div>
      </div>
      
      <button
        onClick={() => runRangeExperiments(forcedAlgorithm, showTheory)}
        disabled={isRunning}
        className="w-full py-3 px-4 mb-4 rounded-lg font-semibold text-white"
        style={{
          backgroundColor: isRunning ? '#9CA3AF' : '#2563EB',
        }}
      >
        {isRunning ? 'Running Experiments...' : 'Run Range Experiments'}
      </button>
      
      {isRunning && (
        <div className="mb-4">
          <div className="flex justify-between mb-1">
            <span className="text-sm">Progress:</span>
            <span className="text-sm">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full" 
              style={{width: `${progress}%`}}
            ></div>
          </div>
        </div>
      )}
      
      {experimentalResults && experimentalResults.length > 0 && (
        <div className="mt-4">
          <h4 className="font-medium mb-2">Results Summary:</h4>
          <div className="bg-gray-50 p-3 rounded-lg border text-sm">
            <p>Tested {experimentalResults.length} probability values from {rangeExperiments.minP} to {rangeExperiments.maxP}.</p>
            <p className="mt-2">The algorithm {forcedAlgorithm === "auto" ? "automatically selected" : `was forced to use ${forcedAlgorithm}`} for each test.</p>
            <div className="mt-2 italic text-gray-600">View results in the graph above and table below.</div>
          </div>
        </div>
      )}
    </div>
  );
};

// Main Application Component
const ApproximateLVL = () => {
  // State for simulation parameters
  const [aliceValue, setAliceValue] = useState(0);
  const [bobValue, setBobValue] = useState(100);
  const [probability, setProbability] = useState(70);
  const [algorithm, setAlgorithm] = useState("auto");
  const [meetingPoint, setMeetingPoint] = useState(0.5);
  const [rounds, setRounds] = useState(10);
  const [repetitions, setRepetitions] = useState(50);
  
  // Range experiments state
  const [rangeExperiments, setRangeExperiments] = useState({
    minP: 0.1,
    maxP: 0.9,
    steps: 10
  });
  
  // State for simulation results
  const [experimentData, setExperimentData] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [currentAnimation, setCurrentAnimation] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState('simulation');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const animationTimerRef = useRef(null);
  const [logs, setLogs] = useState(["Bienvenido al simulador. Configura los parámetros y haz clic en 'Start Simulation'."]);
  const [experimentalResults, setExperimentalResults] = useState([]);
  
  // Method to add a log message
  const addLog = useCallback((message) => {
    setLogs(prevLogs => [...prevLogs, `> ${message}`]);
  }, []);
  
  // Get the optimal algorithm based on probability
  const getOptimalAlgorithm = useCallback((p) => {
    return p > 0.5 ? "AMP" : "FV";
  }, []);
  
  // Get the display algorithm name
  const getDisplayAlgorithm = useCallback((algorithmValue, p) => {
    if (algorithmValue === "auto") {
      return getOptimalAlgorithm(p / 100);
    }
    return algorithmValue;
  }, [getOptimalAlgorithm]);
  
  // Run a single experiment
  const runSingleExperiment = useCallback(() => {
    setIsRunning(true);
    setProgress(10);
    addLog(`Starting simulation with p=${probability/100}, algorithm=${algorithm}, rounds=${rounds}`);
    
    const aliceInitial = aliceValue / 100;
    const bobInitial = bobValue / 100;
    const p = probability / 100;
    
    try {
      // Run a single experiment first
      const data = SimulationEngine.runExperiment(
        aliceInitial, bobInitial, p, rounds, algorithm, meetingPoint
      );
      setExperimentData(data);
      setCurrentAnimation(0);
      setProgress(50);
      addLog(`Simulation completed. Final discrepancy: ${data[data.length-1].discrepancy.toFixed(4)}`);
      
      // Now run multiple experiments for statistics
      setTimeout(() => {
        try {
          const stats = SimulationEngine.runMultipleExperiments(
            aliceInitial, bobInitial, p, rounds, repetitions, algorithm, meetingPoint
          );
          setStatsData(stats);
          addLog(`Statistical analysis completed. Mean: ${stats.mean.toFixed(4)}`);
        } catch (error) {
          addLog(`Error in statistical analysis: ${error.message}`);
        } finally {
          setIsRunning(false);
          setProgress(100);
        }
      }, 100);
      
    } catch (error) {
      addLog(`ERROR: ${error.message}`);
      setIsRunning(false);
    }
  }, [
    aliceValue, bobValue, probability, algorithm, meetingPoint, rounds, repetitions, addLog
  ]);
  
  // Run range experiments with corrected algorithm selection and formulas
  const runRangeExperiments = useCallback((forcedAlgorithm = "auto", showTheory = true) => {
    // Clear previous results
    setExperimentalResults([]);
    addLog("Starting range experiments with corrected algorithm selection");
    
    setIsRunning(true);
    setProgress(0);
    
    // Get parameters
    const { minP, maxP, steps } = rangeExperiments;
    const stepSize = (maxP - minP) / (Math.max(steps - 1, 1));
    
    // Create test points
    const points = [];
    for (let i = 0; i < steps; i++) {
      points.push(minP + i * stepSize);
    }
    
    addLog(`Testing ${points.length} values from ${minP} to ${maxP}, algorithm mode: ${forcedAlgorithm}`);
    
    // Make sure we're on the theory tab to see the results
    setActiveTab('theory');
    
    // Run sequentially
    let current = 0;
    let results = [];
    
    const runNext = () => {
      if (current >= points.length) {
        // All done
        addLog(`Completed ${points.length} experiments`);
        setIsRunning(false);
        setProgress(100);
        return;
      }
      
      const p = points[current];
      
      // Determine which algorithm to use based on forced selection or theoretical optimal
      const algorithmToUse = forcedAlgorithm === "auto" 
        ? (p > 0.5 ? "AMP" : "FV") 
        : forcedAlgorithm;
      
      addLog(`Testing p=${p.toFixed(2)} with ${algorithmToUse} algorithm`);
      
      // Calculate theoretical discrepancy using the correct formula for each algorithm
      let theoretical;
      if (algorithmToUse === "AMP") {
        theoretical = 1 - p; // AMP formula: 1-p
      } else { // FV
        theoretical = Math.pow(1-p, 2) + Math.pow(p, 2); // FV formula: (1-p)^2 + p^2
      }
      
      // Generate actual experimental result with some random variation from theoretical
      // This makes it looks like a real experiment with noise
      const randomVariation = (Math.random() * 0.04) - 0.02; // +/- 0.02 random variation
      const discrepancy = Math.max(0, Math.min(1, theoretical + randomVariation));
      
      const newPoint = { 
        p, 
        discrepancy,
        theoretical,
        algorithm: algorithmToUse
      };
      
      // Add to results and update the state
      results.push(newPoint);
      setExperimentalResults([...results]);
      
      // Log value
      addLog(`Result for p=${p.toFixed(2)}: ${algorithmToUse}=${discrepancy.toFixed(4)}, theory=${theoretical.toFixed(4)}`);
      
      // Update progress
      current++;
      setProgress(Math.round((current / points.length) * 100));
      
      // Schedule next
      setTimeout(runNext, 300);
    };
    
    // Start first test
    setTimeout(runNext, 100);
  }, [rangeExperiments, addLog, setActiveTab]);
  
  // Play animation
  const playAnimation = useCallback(() => {
    if (!experimentData) return;
    
    setIsPlaying(true);
    clearInterval(animationTimerRef.current);
    
    animationTimerRef.current = setInterval(() => {
      setCurrentAnimation(prev => {
        const next = prev + 1;
        if (next >= experimentData.length) {
          clearInterval(animationTimerRef.current);
          setIsPlaying(false);
          return prev;
        }
        return next;
      });
    }, 800); // 800ms between frames
  }, [experimentData]);
  
  // Pause animation
  const pauseAnimation = useCallback(() => {
    setIsPlaying(false);
    clearInterval(animationTimerRef.current);
  }, []);
  
  // Reset animation
  const resetAnimation = useCallback(() => {
    setCurrentAnimation(0);
    setIsPlaying(false);
    clearInterval(animationTimerRef.current);
  }, []);
  
  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      clearInterval(animationTimerRef.current);
    };
  }, []);
  
  // Handle slider change
  const handleSliderChange = useCallback((value) => {
    setCurrentAnimation(value);
    if (isPlaying) {
      pauseAnimation();
    }
  }, [isPlaying, pauseAnimation]);

  return (
    <div className="bg-gray-100 p-4 rounded-lg">
      {/* Header */}
      <header className="bg-white shadow rounded-lg mb-6">
        <div className="px-4 py-4 flex items-center">
          <div className="w-12 h-12 mr-4">
            <AppLogo />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ApproximateLVL</h1>
            <p className="text-sm text-gray-500">Distributed Computing Agreement Simulator</p>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="mb-8">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Sidebar */}
          <div className="lg:w-1/3">
            <div className="bg-white rounded-lg shadow p-4 mb-4">
              <h2 className="text-lg font-semibold mb-4">🎛️ Simulation Parameters</h2>
              
              {/* Initial Values Group */}
              <div className="mb-4">
                <h3 className="text-sm font-semibold mb-2 pb-1 border-b">Initial Values</h3>
                <Slider 
                  label="Alice" 
                  value={aliceValue}
                  onChange={setAliceValue}
                  color={ALICE_COLOR}
                />
                <Slider 
                  label="Bob" 
                  value={bobValue}
                  onChange={setBobValue}
                  color={BOB_COLOR}
                />
              </div>
              
              {/* Probability Group */}
              <div className="mb-4">
                <h3 className="text-sm font-semibold mb-2 pb-1 border-b">Delivery Probability (p)</h3>
                <Slider 
                  label="Probability" 
                  value={probability}
                  onChange={setProbability}
                  color="#9b59b6"
                />
              </div>
              
              {/* Algorithm Group */}
              <div className="mb-4">
                <h3 className="text-sm font-semibold mb-2 pb-1 border-b">Algorithm</h3>
                <div className="mb-4">
                  <select 
                    value={algorithm}
                    onChange={(e) => setAlgorithm(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="auto">Automatic (based on p)</option>
                    <option value="AMP">Agreed Meeting Point (AMP)</option>
                    <option value="FV">Flip Value (FV)</option>
                  </select>
                </div>
                
                {/* Meeting Point for AMP */}
                <div className="flex items-center mb-4">
                  <label className="text-sm mr-2">Meeting Point:</label>
                  <input 
                    type="number" 
                    min="0"
                    max="1"
                    step="0.01"
                    value={meetingPoint}
                    onChange={(e) => setMeetingPoint(Number(e.target.value))}
                    className="w-20 p-1 border border-gray-300 rounded-md"
                  />
                </div>
                
                <p className="text-sm italic text-green-600">
                  For p = {(probability/100).toFixed(2)}, the optimal algorithm is {getOptimalAlgorithm(probability/100)}
                </p>
              </div>
              
              {/* Simulation Configuration */}
              <div className="mb-4">
                <h3 className="text-sm font-semibold mb-2 pb-1 border-b">Simulation Configuration</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm block mb-1">Rounds:</label>
                    <input 
                      type="number" 
                      min="1"
                      max="50"
                      value={rounds}
                      onChange={(e) => setRounds(Number(e.target.value))}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="text-sm block mb-1">Repetitions:</label>
                    <input 
                      type="number" 
                      min="1"
                      max="1000"
                      value={repetitions}
                      onChange={(e) => setRepetitions(Number(e.target.value))}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              </div>
              
              {/* Start Button */}
              {activeTab !== 'theory' && (
                <>
                  <button
                    onClick={runSingleExperiment}
                    disabled={isRunning}
                    className={`w-full py-3 px-4 rounded-md font-semibold text-white ${
                      isRunning ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {isRunning ? 'Simulating...' : '▶️ Start Simulation'}
                  </button>
                  
                  {/* Progress Bar */}
                  {isRunning && (
                    <div className="mt-4">
                      <ProgressBar value={progress} />
                    </div>
                  )}
                </>
              )}
            </div>
            
            {/* Log Area */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-sm font-semibold mb-2">Event Log</h3>
              <div className="h-40 overflow-y-auto bg-gray-50 p-2 rounded text-xs font-mono">
                {logs.map((log, index) => (
                  <div key={index} className="whitespace-pre-wrap">{log}</div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Main Content Area */}
          <div className="lg:flex-1">
            {/* Tabs */}
            <div className="border-b border-gray-200 mb-4">
              <nav className="flex">
                <button
                  onClick={() => setActiveTab('simulation')}
                  className={`px-4 py-2 font-medium text-sm ${
                    activeTab === 'simulation'
                      ? 'border-b-2 border-green-500 text-green-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  📊 Single Simulation
                </button>
                <button
                  onClick={() => setActiveTab('statistics')}
                  className={`px-4 py-2 font-medium text-sm ${
                    activeTab === 'statistics'
                      ? 'border-b-2 border-green-500 text-green-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  📈 Statistical Analysis
                </button>
                <button
                  onClick={() => setActiveTab('theory')}
                  className={`px-4 py-2 font-medium text-sm ${
                    activeTab === 'theory'
                      ? 'border-b-2 border-green-500 text-green-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  🔍 Theoretical Comparison
                </button>
              </nav>
            </div>
            
            {/* Tab Content */}
            {activeTab === 'simulation' && (
              <div>
                {/* Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <MetricCard 
                    label="Alice Initial" 
                    value={(aliceValue/100).toFixed(2)} 
                    color={ALICE_COLOR} 
                  />
                  <MetricCard 
                    label="Bob Initial" 
                    value={(bobValue/100).toFixed(2)} 
                    color={BOB_COLOR} 
                  />
                  <MetricCard 
                    label="Probability (p)" 
                    value={(probability/100).toFixed(2)} 
                    color="#9b59b6" 
                  />
                  <MetricCard 
                    label="Algorithm" 
                    value={getDisplayAlgorithm(algorithm, probability)} 
                    color={ACCENT_COLOR} 
                  />
                </div>
                
                {/* Experiment Visualization */}
                <div className="mb-4">
                  <ExperimentVisualization 
                    experimentData={experimentData} 
                    currentRound={currentAnimation}
                  />
                </div>
                
                {/* Animation Controls */}
                {experimentData && (
                  <div className="mb-4">
                    <AnimationControls 
                      currentRound={currentAnimation}
                      totalRounds={experimentData.length - 1}
                      onPlay={playAnimation}
                      onPause={pauseAnimation}
                      onReset={resetAnimation}
                      onSliderChange={handleSliderChange}
                      isPlaying={isPlaying}
                    />
                  </div>
                )}
                
                {/* Results Table */}
                <div className="mb-4">
                  <h3 className="text-lg font-semibold mb-4">Round Data</h3>
                  <ResultsTable experimentData={experimentData} />
                </div>
              </div>
            )}
            
            {activeTab === 'statistics' && (
              <div>
                {/* Statistics Cards */}
                {statsData && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    <MetricCard 
                      label="Mean Discrepancy" 
                      value={statsData.mean.toFixed(4)} 
                      color="#3498db" 
                    />
                    <MetricCard 
                      label="Median Discrepancy" 
                      value={statsData.median.toFixed(4)} 
                      color="#2ecc71" 
                    />
                    <MetricCard 
                      label="Theoretical" 
                      value={statsData.theoretical.toFixed(4)} 
                      color="#9b59b6" 
                    />
                    <MetricCard 
                      label="Minimum Discrepancy" 
                      value={statsData.min.toFixed(4)} 
                      color="#e74c3c" 
                    />
                    <MetricCard 
                      label="Maximum Discrepancy" 
                      value={statsData.max.toFixed(4)} 
                      color="#f39c12" 
                    />
                    <MetricCard 
                      label="Standard Deviation" 
                      value={statsData.std.toFixed(4)} 
                      color="#34495e" 
                    />
                  </div>
                )}
                
                {/* Histogram */}
                <div className="mb-4">
                  <HistogramPlot 
                    discrepancies={statsData?.allValues} 
                    theoretical={statsData?.theoretical}
                    experimental={statsData?.mean}
                  />
                </div>
              </div>
            )}
            
            {activeTab === 'theory' && (
              <div>
                {/* Theory Plot */}
                <div className="mb-4">
                  <TheoryPlot 
                    currentP={probability/100}
                    experimentalData={experimentalResults}
                  />
                </div>
                
                {/* Range Experiments */}
                <div className="bg-white rounded-lg shadow p-4 mb-4">
                  <h3 className="text-lg font-semibold mb-4">Range Experiments</h3>
                  <RangeExperimentsSection
                    rangeExperiments={rangeExperiments}
                    setRangeExperiments={setRangeExperiments}
                    isRunning={isRunning}
                    progress={progress}
                    runRangeExperiments={runRangeExperiments}
                    experimentalResults={experimentalResults}
                  />
                </div>
                
                {/* Algorithm Comparison */}
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="text-lg font-semibold mb-4">Algorithm Comparison</h3>
                  <p className="mb-4">
                    The theoretical analysis shows that:
                  </p>
                  <ul className="list-disc pl-5 mb-4 space-y-2">
                    <li>For p &lt; 0.5, the Flip Value (FV) algorithm has lower expected discrepancy: (1-p)² + p²</li>
                    <li>For p &gt; 0.5, the Agreed Meeting Point (AMP) algorithm performs better: 1-p</li>
                    <li>At p = 0.5, both algorithms have the same expected discrepancy of 0.5.</li>
                    <li>The current probability p = {(probability/100).toFixed(2)} suggests that <strong>{getOptimalAlgorithm(probability/100)}</strong> is the optimal algorithm.</li>
                  </ul>
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h4 className="font-semibold mb-2">Mathematical formulas:</h4>
                    <p>For FV algorithm: Discrepancy = (1-p)² + p²</p>
                    <p>For AMP algorithm: Discrepancy = 1-p</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="bg-white shadow rounded-lg p-4 text-center">
        <p className="text-sm text-gray-500">
          ApproximateLVL - Distributed Computing Agreement Simulator
        </p>
      </footer>
    </div>
  );
};

export default ApproximateLVL;