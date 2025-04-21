import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Scatter,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
  ComposedChart
} from 'recharts';

// Colors
const ALICE_COLOR = "#3498db";
const BOB_COLOR = "#e67e22";
const CHARLIE_COLOR = "#2ecc71";
const ACCENT_COLOR = "#4CAF50";
const PRIMARY_COLOR = "#2c3e50";
const ERROR_COLOR = "#e74c3c";
const AMP_COLOR = "#9c27b0";
const FV_COLOR = "#e91e63";

// Simulation Engine
const SimulationEngine = {
  // Simulate one round of message exchange
  simulateRound: function(values, p, algorithm = "auto", meetingPoint = 0.5, fvMethod = "average") {
    if (algorithm === "auto") {
      algorithm = p > 0.5 ? "AMP" : "FV";
    }
    
    const processCount = values.length;
    const newValues = [...values];
    const messages = [];
    const messageDelivery = {};
    
    // Generate message delivery matrix
    for (let i = 0; i < processCount; i++) {
      for (let j = 0; j < processCount; j++) {
        if (i !== j) {
          const delivered = Math.random() < p;
          const key = `from${i}to${j}`;
          messageDelivery[key] = delivered;
          messages.push({
            from: i,
            to: j,
            fromName: ["Alice", "Bob", "Charlie"][i],
            toName: ["Alice", "Bob", "Charlie"][j],
            delivered: delivered,
            value: values[i]
          });
        }
      }
    }
    
    // Process messages for each process
    for (let i = 0; i < processCount; i++) {
      const receivedMessages = [];
      const receivedFrom = [];
      
      // Collect received messages
      for (let j = 0; j < processCount; j++) {
        if (i !== j && messageDelivery[`from${j}to${i}`]) {
          receivedMessages.push(values[j]);
          receivedFrom.push(j);
        }
      }
      
      // Apply algorithm if received any messages
      if (receivedMessages.length > 0) {
        if (algorithm === "AMP") {
          // AMP always uses meeting point
          newValues[i] = meetingPoint;
        } else { // FV algorithm
          if (receivedMessages.length === 1 || processCount === 2) {
            // If received only one message or we're in 2-process mode, adopt that value
            newValues[i] = receivedMessages[0];
          } else if (processCount === 3) {
            // If received multiple messages in 3-process mode, apply selected FV method
            switch(fvMethod) {
              case "average":
                // Average of received values
                newValues[i] = receivedMessages.reduce((sum, val) => sum + val, 0) / receivedMessages.length;
                break;
              case "median":
                // Median considering own value and received values
                const allValues = [values[i], ...receivedMessages].sort((a, b) => a - b);
                newValues[i] = allValues[Math.floor(allValues.length / 2)];
                break;
              case "weighted":
                // Weighted blend based on probability
                const pesoPropio = Math.pow(1-p, receivedMessages.length);
                const pesoExterno = p / receivedMessages.length;
                newValues[i] = values[i] * pesoPropio + 
                              receivedMessages.reduce((sum, val) => sum + val * pesoExterno, 0);
                break;
              case "accelerated":
                // Accelerated convergence to center
                const medianValues = [values[i], ...receivedMessages].sort((a, b) => a - b);
                const mediana = medianValues[Math.floor(medianValues.length / 2)];
                const centroRango = 0.5;
                const factorAceleracion = p;
                newValues[i] = mediana + factorAceleracion * (centroRango - mediana);
                break;
              case "first":
                // Use first received value
                newValues[i] = receivedMessages[0];
                break;
              default:
                // Default to average
                newValues[i] = receivedMessages.reduce((sum, val) => sum + val, 0) / receivedMessages.length;
            }
          }
        }
      }
    }
    
    // Calculate max discrepancy
    let maxDiscrepancy = 0;
    for (let i = 0; i < processCount; i++) {
      for (let j = i+1; j < processCount; j++) {
        const discrepancy = Math.abs(newValues[i] - newValues[j]);
        if (discrepancy > maxDiscrepancy) {
          maxDiscrepancy = discrepancy;
        }
      }
    }
    
    return {
      newValues,
      messages,
      messageDelivery,
      discrepancy: maxDiscrepancy
    };
  },
  
  // Run a complete experiment
  runExperiment: function(initialValues, p, rounds, algorithm = "auto", meetingPoint = 0.5, fvMethod = "average") {
    let values = [...initialValues];
    const processCount = values.length;
    const processNames = ["Alice", "Bob", "Charlie"];
    
    // Calculate initial discrepancy
    let initialDiscrepancy = 0;
    for (let i = 0; i < processCount; i++) {
      for (let j = i+1; j < processCount; j++) {
        const discrepancy = Math.abs(values[i] - values[j]);
        if (discrepancy > initialDiscrepancy) {
          initialDiscrepancy = discrepancy;
        }
      }
    }
    
    // Simulation history
    const history = [{
      round: 0,
      values: [...values],
      processValues: values.reduce((obj, val, idx) => {
        obj[processNames[idx].toLowerCase()] = val;
        return obj;
      }, {}),
      discrepancy: initialDiscrepancy,
      messages: []
    }];
    
    // Run rounds
    for (let r = 1; r <= rounds; r++) {
      const result = SimulationEngine.simulateRound(values, p, algorithm, meetingPoint, fvMethod);
      values = result.newValues;
      
      // Record results for this round
      history.push({
        round: r,
        values: [...values],
        processValues: values.reduce((obj, val, idx) => {
          obj[processNames[idx].toLowerCase()] = val;
          return obj;
        }, {}),
        discrepancy: result.discrepancy,
        messageDelivery: result.messageDelivery,
        messages: result.messages
      });
    }
    
    return history;
  },
  
  // Run multiple experiments for statistical analysis
  runMultipleExperiments: function(initialValues, p, rounds, repetitions, algorithm = "auto", meetingPoint = 0.5, fvMethod = "average") {
    const allDiscrepancies = [];
    const allRuns = [];
    const processCount = initialValues.length;
    
    // Only use FV methods for 3 processes
    const useFVMethod = processCount === 3 ? fvMethod : "average";
    
    // Determine actual algorithm if auto
    const actualAlgorithm = algorithm === "auto" ? (p > 0.5 ? "AMP" : "FV") : algorithm;
    
    // Execute multiple simulations
    for (let i = 0; i < repetitions; i++) {
      const history = SimulationEngine.runExperiment(
        initialValues, 
        p, 
        rounds, 
        algorithm, 
        meetingPoint, 
        useFVMethod
      );
      
      const finalDiscrepancy = history[history.length - 1].discrepancy;
      allDiscrepancies.push(finalDiscrepancy);
      allRuns.push(history);
    }
    
    // Calculate statistics
    const mean = allDiscrepancies.reduce((a, b) => a + b, 0) / allDiscrepancies.length;
    const sorted = [...allDiscrepancies].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0 ? 
      (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : 
      sorted[Math.floor(sorted.length / 2)];
    const min = Math.min(...allDiscrepancies);
    const max = Math.max(...allDiscrepancies);
    const variance = allDiscrepancies.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / allDiscrepancies.length;
    const std = Math.sqrt(variance);
    
    // Calculate theoretical discrepancy for 2 processes (we don't have formula for 3 yet)
    const theoretical = processCount === 2 ? 
      SimulationEngine.calculateExpectedDiscrepancy(p, algorithm) : 
      null;
    
    return {
      mean,
      median,
      min,
      max,
      std,
      allValues: allDiscrepancies,
      theoretical,
      algorithm: actualAlgorithm,
      processCount,
      allRuns
    };
  },
  
  // Calculate theoretical expected discrepancy
  calculateExpectedDiscrepancy: function(p, algorithm = "auto") {
    if (algorithm === "auto") {
      algorithm = p > 0.5 ? "AMP" : "FV";
    }
    
    // Only have formulas for 2 processes
    return algorithm === "AMP" ? (1 - p) : (Math.pow(1 - p, 2) + Math.pow(p, 2));
  }
};

// UI Components

// Simple logo component
function AppLogo() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="40" fill="#f5f5f5" />
      <polygon points="50,30 65,37.5 65,62.5 50,70 35,62.5 35,37.5" fill="#4e54c8" stroke="#36389c" strokeWidth="1" />
    </svg>
  );
}

// Slider control
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
        style={{ background: `linear-gradient(to right, ${color} 0%, ${color} ${value}%, #e5e7eb ${value}%, #e5e7eb 100%)` }}
      />
    </div>
  );
}

// Metric card for displaying values
function MetricCard({ label, value, color }) {
  return (
    <div className="bg-white rounded-lg shadow p-4 flex-1 min-w-20" style={{ borderLeft: `5px solid ${color}` }}>
      <h3 className="text-sm text-gray-500 font-medium">{label}</h3>
      <p className="text-lg font-bold mt-1">{value}</p>
    </div>
  );
}

// Progress bar
function ProgressBar({ value, label }) {
  return (
    <div className="w-full">
      {label && <div className="text-sm font-medium mb-1">{label}</div>}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className="h-2 rounded-full" style={{ width: `${value}%`, backgroundColor: ACCENT_COLOR }} />
      </div>
    </div>
  );
}

// Visualization of experiment data
function ExperimentVisualization({ experimentData, currentRound = 0, processCount = 2 }) {
  if (!experimentData || !Array.isArray(experimentData) || experimentData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-400">No experiment data available</p>
      </div>
    );
  }
  
  const roundData = experimentData.slice(0, Math.min(currentRound + 1, experimentData.length));
  
  const chartData = roundData.map(d => {
    const round = d && typeof d.round === 'number' ? d.round : 0;
    const discrepancy = d && typeof d.discrepancy === 'number' ? d.discrepancy : 0;
    
    const alice = d && d.values && typeof d.values[0] === 'number' ? d.values[0] : 0;
    const bob = d && d.values && typeof d.values[1] === 'number' ? d.values[1] : 0;
    const charlie = processCount > 2 && d && d.values && typeof d.values[2] === 'number' ? d.values[2] : 0;
    
    return {
      round,
      alice,
      bob,
      charlie,
      discrepancy
    };
  });
  
  return (
    <div className="bg-white rounded-lg shadow p-4 h-64">
      <h3 className="text-lg font-semibold mb-4">Experiment Visualization</h3>
      <ResponsiveContainer width="100%" height="80%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="round" />
          <YAxis domain={[0, 1]} />
          <Tooltip 
            formatter={(value) => value !== undefined && !isNaN(value) ? value.toFixed(4) : 'N/A'}
            labelFormatter={(value) => `Round: ${value}`}
          />
          <Legend />
          <Line type="monotone" dataKey="alice" name="Alice" stroke={ALICE_COLOR} strokeWidth={3}
            dot={{ r: 5, strokeWidth: 2, fill: "white" }} />
          <Line type="monotone" dataKey="bob" name="Bob" stroke={BOB_COLOR} strokeWidth={3}
            dot={{ r: 5, strokeWidth: 2, fill: "white" }} />
          {processCount > 2 && (
            <Line type="monotone" dataKey="charlie" name="Charlie" stroke={CHARLIE_COLOR} strokeWidth={3}
              dot={{ r: 5, strokeWidth: 2, fill: "white" }} />
          )}
          <Line type="monotone" dataKey="discrepancy" name="Discrepancy" stroke="#9b59b6" strokeWidth={2}
            dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Results table
function ResultsTable({ experimentData, processCount = 2 }) {
  if (!experimentData || !Array.isArray(experimentData) || experimentData.length === 0) {
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
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alice</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bob</th>
            {processCount > 2 && (
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Charlie</th>
            )}
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discrepancy</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {experimentData.map((data, index) => (
            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{data.round}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: ALICE_COLOR }}>
                {data.values && data.values[0] !== undefined ? data.values[0].toFixed(4) : 'N/A'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: BOB_COLOR }}>
                {data.values && data.values[1] !== undefined ? data.values[1].toFixed(4) : 'N/A'}
              </td>
              {processCount > 2 && (
                <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: CHARLIE_COLOR }}>
                  {data.values && data.values[2] !== undefined ? data.values[2].toFixed(4) : 'N/A'}
                </td>
              )}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {data.discrepancy !== undefined ? data.discrepancy.toFixed(4) : 'N/A'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Histogram plot
function HistogramPlot({ discrepancies, theoretical, experimental }) {
  if (!discrepancies || !Array.isArray(discrepancies) || discrepancies.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-400">No data available</p>
      </div>
    );
  }
  
  const validDiscrepancies = discrepancies.filter(d => typeof d === 'number' && !isNaN(d) && isFinite(d));
  
  if (validDiscrepancies.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-400">No valid data points available</p>
      </div>
    );
  }
  
  const min = Math.min(...validDiscrepancies);
  const max = Math.max(...validDiscrepancies);
  
  if (min === max) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-400">All data points have the same value: {min.toFixed(4)}</p>
      </div>
    );
  }
  
  const binCount = 10;
  const binWidth = (max - min) / binCount;
  const bins = Array(binCount).fill(0).map((_, i) => ({
    x: min + i * binWidth,
    count: 0
  }));
  
  validDiscrepancies.forEach(d => {
    const binIndex = Math.min(Math.floor((d - min) / binWidth), binCount - 1);
    if (binIndex >= 0) bins[binIndex].count++;
  });
  
  const mean = validDiscrepancies.reduce((a, b) => a + b, 0) / validDiscrepancies.length;
  
  const showTheoreticalRef = theoretical !== undefined && typeof theoretical === 'number' && !isNaN(theoretical);
  const showExperimentalRef = experimental !== undefined && typeof experimental === 'number' && !isNaN(experimental);
  
  return (
    <div className="bg-white rounded-lg shadow p-4 h-64">
      <h3 className="text-lg font-semibold mb-4">Distribution of Final Discrepancies</h3>
      <ResponsiveContainer width="100%" height="80%">
        <BarChart data={bins} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis 
            dataKey="x" 
            tickFormatter={(value) => value !== undefined && !isNaN(value) ? value.toFixed(2) : 'N/A'}
          />
          <YAxis />
          <Tooltip 
            formatter={(value) => value !== undefined && !isNaN(value) ? value : 'N/A'}
            labelFormatter={(value) => `Value: ${value !== undefined && !isNaN(value) ? value.toFixed(4) : 'N/A'}`}
          />
          <Bar dataKey="count" fill={ACCENT_COLOR} />
          <ReferenceLine x={mean} stroke="green" strokeWidth={2} strokeDasharray="3 3" label={{ value: 'Mean', position: 'top' }}/>
          {showTheoreticalRef && (
            <ReferenceLine x={theoretical} stroke="red" strokeWidth={2} strokeDasharray="3 3" label={{ value: 'Theoretical', position: 'insideTopLeft' }}/>
          )}
          {showExperimentalRef && (
            <ReferenceLine x={experimental} stroke="blue" strokeWidth={2} strokeDasharray="3 3" label={{ value: 'Experimental', position: 'insideTopRight' }}/>
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Theory plot
function TheoryPlot({ currentP, experimentalData, displayCurves }) {
  if (!currentP && currentP !== 0) currentP = 0.5;
  
  const validExperimentalData = Array.isArray(experimentalData) ? 
    experimentalData.filter(item => 
      item && 
      typeof item.p === 'number' && 
      typeof item.discrepancy === 'number'
    ) : [];
  
  const ampData = [];
  const fvData = [];
  for (let p = 0; p <= 1; p += 0.02) {
    ampData.push({ p, discrepancy: 1 - p });
    fvData.push({ p, discrepancy: Math.pow(1 - p, 2) + Math.pow(p, 2) });
  }
  
  const currentPoint = {
    p: currentP,
    expectedDiscrepancy: SimulationEngine.calculateExpectedDiscrepancy(currentP)
  };

  const showAMP = displayCurves?.theoreticalAmp !== false;
  const showFV = displayCurves?.theoreticalFv !== false;
  const showExperimental = displayCurves?.experimental !== false && validExperimentalData.length > 0;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold mb-2">Expected Discrepancy vs. Probability</h3>

      <div className="mb-3 text-sm text-gray-600 flex flex-wrap items-center gap-4">
        {showFV && (
          <div className="flex items-center">
            <span className="inline-block w-3 h-3 bg-red-500 mr-1 rounded-sm"></span>
            <span>FV: (1-p)² + p²</span>
          </div>
        )}
        {showAMP && (
          <div className="flex items-center">
            <span className="inline-block w-3 h-3 bg-green-500 mr-1 rounded-sm"></span>
            <span>AMP: 1-p</span>
          </div>
        )}
        {showExperimental && (
          <div className="flex items-center">
            <span className="inline-block w-4 h-4 rounded-full bg-purple-500 mr-1"></span>
            <span>Experimental Curve</span>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={400}>
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
          <Tooltip 
            formatter={(value) => value !== undefined && !isNaN(value) ? value.toFixed(4) : 'N/A'} 
            labelFormatter={(value) => `Probability: ${value !== undefined && !isNaN(value) ? value.toFixed(2) : 'N/A'}`}
          />
          <Legend verticalAlign="top" height={36} />

          {showAMP && (
            <Line data={ampData} type="monotone" dataKey="discrepancy" name="AMP Algorithm" stroke="#2ecc71" strokeWidth={2} dot={false} />
          )}
          {showFV && (
            <Line data={fvData} type="monotone" dataKey="discrepancy" name="FV Algorithm" stroke="#e74c3c" strokeWidth={2} dot={false} />
          )}
          {showExperimental && validExperimentalData.length > 0 && (
            <Line data={validExperimentalData} type="monotone" dataKey="discrepancy" name="Experimental Curve" stroke="purple" strokeWidth={2} dot={{ r: 3, stroke: "purple", fill: "white" }} />
          )}
          <Scatter data={[currentPoint]} fill="blue" name="Current Setting">
            <Cell fill="blue" r={6} />
          </Scatter>
          <ReferenceLine x={0.5} stroke="#666" strokeDasharray="3 3" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// FV method comparison chart
function FVMethodComparisonChart({ comparisonResults }) {
  if (!comparisonResults || !Array.isArray(comparisonResults) || comparisonResults.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-400">No comparison data available</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow p-4 mt-4">
      <h3 className="text-lg font-semibold mb-4">FV Methods Comparison</h3>
      
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={comparisonResults} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="method" />
          <YAxis yAxisId="left" orientation="left" label={{ value: 'Final Discrepancy', angle: -90, position: 'insideLeft' }} />
          <YAxis yAxisId="right" orientation="right" label={{ value: 'Rounds to Converge', angle: 90, position: 'insideRight' }} />
          <Tooltip />
          <Legend />
          <Bar yAxisId="left" dataKey="avgDiscrepancy" name="Avg. Discrepancy" fill="#8884d8" />
          <Bar yAxisId="right" dataKey="avgConvergenceRound" name="Avg. Rounds to Converge" fill="#82ca9d" />
        </BarChart>
      </ResponsiveContainer>
      
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg. Discrepancy</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg. Convergence</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {comparisonResults.map((result, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {result.method}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {result.avgDiscrepancy.toFixed(4)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {result.avgConvergenceRound.toFixed(2)} rounds
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {result.method === "average" && "Average of received values"}
                  {result.method === "median" && "Median of own and received values"}
                  {result.method === "weighted" && "Weighted blend based on probability"}
                  {result.method === "accelerated" && "Accelerated convergence toward center"}
                  {result.method === "first" && "First received value only"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Animation controls
function AnimationControls({ currentRound, totalRounds, onPlay, onPause, onReset, onSliderChange, isPlaying }) {
  return (
    <div className="flex items-center space-x-4 bg-white rounded-lg shadow p-4">
      <button onClick={onReset} className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700">
        ⏮️
      </button>
      {isPlaying ? (
        <button onClick={onPause} className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700">
          ⏸️
        </button>
      ) : (
        <button onClick={onPlay} className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700">
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
}

// Range experiments results table
function RangeResultsTable({ results, processCount = 2, forcedAlgorithm, fvMethod }) {
  if (!results || !Array.isArray(results) || results.length === 0) {
    return (
      <div className="bg-gray-100 p-4 rounded-lg text-center text-gray-500">
        No results available yet. Run the simulation to see results.
      </div>
    );
  }

  // Filter invalid results
  const validResults = results.filter(result => 
    result && 
    typeof result.p === 'number' && 
    typeof result.discrepancy === 'number' && 
    typeof result.algorithm === 'string'
  );

  if (validResults.length === 0) {
    return (
      <div className="bg-gray-100 p-4 rounded-lg text-center text-gray-500">
        No valid experimental results found.
      </div>
    );
  }

  // Sort by probability
  const sortedResults = [...validResults].sort((a, b) => a.p - b.p);
  
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                Probability (p)
              </th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                Algorithm
              </th>
              {forcedAlgorithm === "FV" && processCount === 3 && (
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                  FV Method
                </th>
              )}
              <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                Experimental
              </th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                Samples
              </th>
              {processCount === 2 && (
                <>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                    Theoretical
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                    Error
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedResults.map((result, index) => {
              // Calculate the error (difference between theoretical and experimental)
              const error = processCount === 2 && typeof result.theoretical === 'number' ? 
                Math.abs(result.theoretical - result.discrepancy) : null;
              // Avoid division by zero
              const errorPercent = error !== null && result.theoretical !== 0 ? 
                (error / result.theoretical) * 100 : 0;
              
              return (
                <tr key={index} className={index % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900">{result.p.toFixed(2)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                      result.algorithm === 'AMP' 
                        ? 'bg-green-100 text-green-800 border border-green-300' 
                        : 'bg-red-100 text-red-800 border border-red-300'
                    }`}>
                      {result.algorithm}
                    </span>
                  </td>
                  {forcedAlgorithm === "FV" && processCount === 3 && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {result.fvMethod || fvMethod}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono text-gray-900">{result.discrepancy.toFixed(4)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {result.samples || '?'}
                  </td>
                  {processCount === 2 && (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono text-gray-900">{result.theoretical ? result.theoretical.toFixed(4) : 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {error !== null && (
                          <div className="flex items-center">
                            <span className={`text-sm font-mono mr-2 ${
                              errorPercent < 5 ? 'text-green-600' : 
                              errorPercent < 10 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {error.toFixed(4)}
                            </span>
                            <span className="text-xs text-gray-500">
                              ({errorPercent.toFixed(2)}%)
                            </span>
                          </div>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
        <div className="text-sm text-gray-500">
          <span className="font-semibold">Total points:</span> {sortedResults.length}
          {sortedResults.length > 0 && processCount === 2 && (
            <>
              <span className="ml-4 font-semibold">Average accuracy:</span> {
                (sortedResults.reduce((acc, result) => {
                  if (typeof result.theoretical !== 'number') return acc;
                  
                  const error = Math.abs(result.theoretical - result.discrepancy);
                  const errorPercentage = result.theoretical !== 0 ? (error / result.theoretical) * 100 : 0;
                  return acc + (100 - errorPercentage);
                }, 0) / sortedResults.length).toFixed(2)
              }%
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Main component
function CompleteDistributedComputingSimulator() {
  // Configuration states
  const [processCount, setProcessCount] = useState(2);
  const [aliceValue, setAliceValue] = useState(0);
  const [bobValue, setBobValue] = useState(100);
  const [charlieValue, setCharlieValue] = useState(50);
  const [probability, setProbability] = useState(70);
  const [algorithm, setAlgorithm] = useState("auto");
  const [fvMethod, setFvMethod] = useState("average");
  const [meetingPoint, setMeetingPoint] = useState(1);
  const [rounds, setRounds] = useState(1);
  const [repetitions, setRepetitions] = useState(50);

  // Range experiments states
  const [rangeExperiments, setRangeExperiments] = useState({
    minP: 0.1,
    maxP: 0.9,
    steps: 10
  });
  const [forcedAlgorithm, setForcedAlgorithm] = useState("auto");

  // Visualization states
  const [experimentData, setExperimentData] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [currentAnimation, setCurrentAnimation] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState('simulation');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentRepetition, setCurrentRepetition] = useState(0);
  const [logs, setLogs] = useState(["Welcome to the simulator. Configure the parameters and click 'Start Simulation'."]);
  const [experimentalResults, setExperimentalResults] = useState([]);
  const [rangeDisplayCurves, setRangeDisplayCurves] = useState({
    experimental: true,
    theoreticalAmp: true,
    theoreticalFv: true
  });
  const [comparisonResults, setComparisonResults] = useState(null);
  const animationTimerRef = useRef(null);

  // Helper functions
  function addLog(message) {
    setLogs(prevLogs => [...prevLogs, `> ${message}`]);
  }

  function getOptimalAlgorithm(p) {
    return p > 0.5 ? "AMP" : "FV";
  }
  
  function getDisplayAlgorithm(alg, p) {
    return alg === "auto" ? getOptimalAlgorithm(p / 100) : alg;
  }
  
  // Get initial values for processes
  function getInitialValues() {
    if (processCount === 2) {
      return [aliceValue / 100, bobValue / 100];
    } else {
      // For Charlie, allow values up to 2.0
      return [aliceValue / 100, bobValue / 100, charlieValue / 100];
    }
  }

  // Run a single experiment
  function runSingleExperiment() {
    setIsRunning(true);
    setProgress(10);
    
    const initialValues = getInitialValues();
    const p = probability / 100;
    const useFVMethod = processCount === 3 ? fvMethod : "average"; // Only use custom FV methods for 3 processes
    
    const logMessage = processCount === 3 
      ? `Starting simulation with ${processCount} processes, values=[${initialValues.map(v => v.toFixed(2)).join(", ")}], p=${p.toFixed(2)}, algorithm=${algorithm}, fvMethod=${useFVMethod}`
      : `Starting simulation with ${processCount} processes, values=[${initialValues.map(v => v.toFixed(2)).join(", ")}], p=${p.toFixed(2)}, algorithm=${algorithm}`;
    
    addLog(logMessage);
    
    try {
      const data = SimulationEngine.runExperiment(
        initialValues,
        p,
        rounds,
        algorithm,
        meetingPoint,
        useFVMethod
      );
      
      setExperimentData(data);
      setCurrentAnimation(0);
      setProgress(50);
      
      const finalDiscrepancy = data[data.length - 1].discrepancy;
      addLog(`Simulation completed. Final discrepancy: ${finalDiscrepancy.toFixed(4)}`);
      
      setTimeout(() => {
        try {
          const stats = SimulationEngine.runMultipleExperiments(
            initialValues,
            p,
            rounds,
            repetitions,
            algorithm,
            meetingPoint,
            useFVMethod
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
  }

  // Run range experiments with progressive visualization
  function runRangeExperiments() {
    if (isRunning) return;
    
    // Clear previous results
    setExperimentalResults([]);
    setIsRunning(true);
    setProgress(0);
    setCurrentRepetition(0);
    
    // Get current configuration
    const initialProcessValues = getInitialValues();
    const { minP, maxP, steps } = rangeExperiments;
    const actualMeetingPoint = meetingPoint;
    const actualRounds = rounds;
    const actualRepetitions = repetitions;
    
    // Log the start of the experiment
    addLog(`Starting range experiments with ${processCount} processes`);
    addLog(`Values: [${initialProcessValues.map(v => v.toFixed(2)).join(", ")}], Rounds: ${actualRounds}, Repetitions: ${actualRepetitions}`);
    
    // Generate probability points to test
    const stepSize = (maxP - minP) / (Math.max(steps - 1, 1));
    const allProbabilities = [];
    for (let i = 0; i < steps; i++) {
      allProbabilities.push(minP + i * stepSize);
    }
    
    // Initialize results array
    const results = [];
    for (let i = 0; i < allProbabilities.length; i++) {
      const p = allProbabilities[i];
      const actualAlgorithm = forcedAlgorithm === "auto" ? (p > 0.5 ? "AMP" : "FV") : forcedAlgorithm;
      
      results.push({
        p,
        algorithm: actualAlgorithm,
        fvMethod: (actualAlgorithm === "FV" || (forcedAlgorithm === "auto" && p <= 0.5)) && processCount === 3 ? fvMethod : null,
        theoretical: processCount === 2 ? SimulationEngine.calculateExpectedDiscrepancy(p, actualAlgorithm) : null,
        discrepancy: 0,
        samples: 0,
        discrepancies: []
      });
    }
    
    // Show initial empty results
    setExperimentalResults(results);
    
    // Run repetitions one by one to see the curve evolve
    let currentRep = 0;
    
    function runNextRepetition() {
      if (currentRep >= actualRepetitions) {
        // All repetitions completed
        setIsRunning(false);
        setProgress(100);
        addLog(`Range experiments completed with ${results.length} data points x ${actualRepetitions} repetitions`);
        return;
      }
      
      // Update current repetition in UI
      setCurrentRepetition(currentRep + 1);
      
      // For each probability point, run one more repetition
      for (let i = 0; i < allProbabilities.length; i++) {
        const p = allProbabilities[i];
        const result = results[i];
        const actualAlgorithm = result.algorithm;
        const actualFvMethod = processCount === 3 ? fvMethod : "average";
        
        // Run one repetition for this probability
        const history = SimulationEngine.runExperiment(
          initialProcessValues,
          p,
          actualRounds,
          actualAlgorithm,
          actualMeetingPoint,
          actualFvMethod
        );
        
        // Get the final discrepancy
        const finalDiscrepancy = history[history.length - 1].discrepancy;
        
        // Update the result
        result.discrepancies.push(finalDiscrepancy);
        result.samples = result.discrepancies.length;
        result.discrepancy = result.discrepancies.reduce((sum, val) => sum + val, 0) / result.samples;
      }
      
      // Update UI to show the evolving curve
      setExperimentalResults([...results]);
      
      // Update progress
      const progressValue = Math.round(((currentRep + 1) / actualRepetitions) * 100);
      setProgress(progressValue);
      
      // Increment repetition counter
      currentRep++;
      
      // Run next repetition after a small delay so the UI can update
      setTimeout(() => {
        runNextRepetition();
      }, 50); // Add a small delay to see the curve evolve
    }
    
    // Start with the first repetition
    setTimeout(() => {
      runNextRepetition();
    }, 10);
  }

  // Compare FV methods (only for 3 processes)
  function runFVMethodComparison() {
    // Only allow for 3 processes
    if (processCount !== 3) {
      addLog("FV method comparison is only available with 3 processes selected");
      return;
    }
    
    setIsRunning(true);
    addLog("Comparing different FV methods...");
    
    const initialValues = getInitialValues();
    const p = probability / 100;
    const methods = ["average", "median", "weighted", "accelerated", "first"];
    let results = [];
    
    // Process methods one by one
    let currentMethod = 0;
    
    function processNextMethod() {
      if (currentMethod >= methods.length) {
        // All methods processed
        setComparisonResults(results);
        addLog("FV method comparison completed");
        setIsRunning(false);
        setProgress(100);
        return;
      }
      
      const method = methods[currentMethod];
      addLog(`Testing FV method: ${method}...`);
      
      // Run simulations for this method
      setTimeout(() => {
        let totalDiscrepancy = 0;
        let totalConvergenceRound = 0;
        
        for (let i = 0; i < repetitions; i++) {
          const history = SimulationEngine.runExperiment(
            initialValues,
            p,
            rounds,
            "FV",
            meetingPoint,
            method
          );
          
          const finalDiscrepancy = history[history.length - 1].discrepancy;
          totalDiscrepancy += finalDiscrepancy;
          
          // Find convergence round (when discrepancy drops below 0.1)
          const convergenceRound = history.findIndex(r => r.discrepancy < 0.1);
          totalConvergenceRound += convergenceRound >= 0 ? convergenceRound : rounds;
        }
        
        // Add result for this method
        results.push({
          method,
          avgDiscrepancy: totalDiscrepancy / repetitions,
          avgConvergenceRound: totalConvergenceRound / repetitions
        });
        
        // Update progress
        currentMethod++;
        const progressPercent = Math.round((currentMethod / methods.length) * 100);
        setProgress(progressPercent);
        
        // Process next method
        processNextMethod();
      }, 0);
    }
    
    // Start with the first method
    processNextMethod();
  }

  // Handle curve display settings for range experiments
  function handleCurveDisplayChange(curve) {
    if (curve === 'algorithmChange') {
      let newDisplayCurves;
      if (forcedAlgorithm === 'AMP') {
        newDisplayCurves = {
          experimental: true,
          theoreticalAmp: true,
          theoreticalFv: false
        };
      } else if (forcedAlgorithm === 'FV') {
        newDisplayCurves = {
          experimental: true,
          theoreticalAmp: false,
          theoreticalFv: true
        };
      } else {
        newDisplayCurves = {
          experimental: true,
          theoreticalAmp: true,
          theoreticalFv: true
        };
      }
      setRangeDisplayCurves(newDisplayCurves);
      return;
    }
    
    setRangeDisplayCurves(prev => ({
      ...prev,
      [curve]: !prev[curve]
    }));
  }

  // Animation controls
  function playAnimation() {
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
    }, 800);
  }

  function pauseAnimation() {
    setIsPlaying(false);
    clearInterval(animationTimerRef.current);
  }

  function resetAnimation() {
    setCurrentAnimation(0);
    setIsPlaying(false);
    clearInterval(animationTimerRef.current);
  }

  function handleSliderChange(value) {
    setCurrentAnimation(value);
    if (isPlaying) pauseAnimation();
  }

  // Cleanup animation timer on component unmount
  useEffect(() => {
    return () => clearInterval(animationTimerRef.current);
  }, []);

  // Placeholder functions for saving experiments
  function prepareSingleExperiment() {
    addLog("Experiment saving functionality would be implemented here");
  }

  function prepareRangeExperiment() {
    addLog("Range experiment saving functionality would be implemented here");
  }

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
            <p className="text-sm text-gray-500">Multi-Process Distributed Computing Agreement Simulator</p>
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
              
              {/* Process count selector */}
              <div className="mb-4 bg-blue-50 p-3 rounded-lg">
                <h3 className="text-sm font-semibold mb-2">Number of Processes</h3>
                <div className="flex items-center space-x-4">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      value="2"
                      checked={processCount === 2}
                      onChange={() => setProcessCount(2)}
                      className="form-radio h-4 w-4 text-blue-600"
                    />
                    <span className="ml-2 text-sm">2 Processes (Alice & Bob)</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      value="3"
                      checked={processCount === 3}
                      onChange={() => setProcessCount(3)}
                      className="form-radio h-4 w-4 text-blue-600"
                    />
                    <span className="ml-2 text-sm">3 Processes (Alice, Bob & Charlie)</span>
                  </label>
                </div>
              </div>
              
              <div className="mb-4">
                <h3 className="text-sm font-semibold mb-2 pb-1 border-b">Initial Values</h3>
                <Slider label="Alice" value={aliceValue} onChange={setAliceValue} color={ALICE_COLOR} />
                <Slider label="Bob" value={bobValue} onChange={setBobValue} color={BOB_COLOR} />
                {processCount === 3 && (
                  <div className="mt-3">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-medium" style={{ color: CHARLIE_COLOR }}>Charlie</label>
                      <span className="text-sm font-bold" style={{ color: CHARLIE_COLOR }}>{(charlieValue/100).toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      step="1"
                      value={charlieValue}
                      onChange={(e) => setCharlieValue(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      style={{ background: `linear-gradient(to right, ${CHARLIE_COLOR} 0%, ${CHARLIE_COLOR} ${charlieValue/2}%, #e5e7eb ${charlieValue/2}%, #e5e7eb 100%)` }}
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0.0</span>
                      <span>1.0</span>
                      <span>2.0</span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="mb-4">
                <h3 className="text-sm font-semibold mb-2 pb-1 border-b">Delivery Probability (p)</h3>
                <Slider label="Probability" value={probability} onChange={setProbability} color="#9b59b6" />
              </div>
              
              <div className="mb-4">
                <h3 className="text-sm font-semibold mb-2 pb-1 border-b">Algorithm</h3>
                <div className="mb-4">
                  <select value={algorithm} onChange={(e) => setAlgorithm(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md">
                    <option value="auto">Automatic (based on p)</option>
                    <option value="AMP">Agreed Meeting Point (AMP)</option>
                    <option value="FV">Flip Value (FV)</option>
                  </select>
                </div>
                
                {(algorithm === "FV" || algorithm === "auto") && processCount === 3 && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">FV Method (3-process only):</label>
                    <select
                      value={fvMethod}
                      onChange={(e) => setFvMethod(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    >
                      <option value="average">Average of received values</option>
                      <option value="median">Median (with own value)</option>
                      <option value="weighted">Probability-weighted blend</option>
                      <option value="accelerated">Accelerated convergence</option>
                      <option value="first">First received value</option>
                    </select>
                    
                    <div className="mt-2 bg-gray-50 p-2 rounded text-xs">
                      {fvMethod === "average" && "Uses the average of received values."}
                      {fvMethod === "median" && "Uses the median of own value and received values."}
                      {fvMethod === "weighted" && "Weighted blend based on probability p."}
                      {fvMethod === "accelerated" && "Accelerated convergence toward center."}
                      {fvMethod === "first" && "Simply uses first received value."}
                    </div>
                  </div>
                )}
                
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
              
              {activeTab !== 'theory' && (
                <>
                  <button 
                    onClick={runSingleExperiment} 
                    disabled={isRunning}
                    className={`w-full py-3 px-4 rounded-md font-semibold text-white ${isRunning ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}
                  >
                    {isRunning ? 'Simulating...' : '▶️ Start Simulation'}
                  </button>
                  
                  {isRunning && (
                    <div className="mt-4">
                      <ProgressBar value={progress} />
                    </div>
                  )}
                </>
              )}
            </div>
            
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
            <div className="border-b border-gray-200 mb-4">
              <nav className="flex">
                <button 
                  onClick={() => setActiveTab('simulation')}
                  className={`px-4 py-2 font-medium text-sm ${activeTab === 'simulation' ? 'border-b-2 border-green-500 text-green-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  📊 Single Simulation
                </button>
                <button 
                  onClick={() => setActiveTab('statistics')}
                  className={`px-4 py-2 font-medium text-sm ${activeTab === 'statistics' ? 'border-b-2 border-green-500 text-green-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  📈 Statistical Analysis
                </button>
                <button 
                  onClick={() => setActiveTab('theory')}
                  className={`px-4 py-2 font-medium text-sm ${activeTab === 'theory' ? 'border-b-2 border-green-500 text-green-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  🔍 Theoretical Comparison
                </button>
                {processCount === 3 && (
                  <button 
                    onClick={() => setActiveTab('methods')}
                    className={`px-4 py-2 font-medium text-sm ${activeTab === 'methods' ? 'border-b-2 border-green-500 text-green-600' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    🧪 Method Comparison
                  </button>
                )}
                <button 
                  onClick={() => setActiveTab('saved')}
                  className={`px-4 py-2 font-medium text-sm ${activeTab === 'saved' ? 'border-b-2 border-green-500 text-green-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  💾 Saved Experiments
                </button>
              </nav>
            </div>

            {/* Single Simulation tab */}
            {activeTab === 'simulation' && (
              <div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <MetricCard label="Alice Initial" value={(aliceValue/100).toFixed(2)} color={ALICE_COLOR} />
                  <MetricCard label="Bob Initial" value={(bobValue/100).toFixed(2)} color={BOB_COLOR} />
                  {processCount === 3 && (
                    <MetricCard label="Charlie Initial" value={(charlieValue/100).toFixed(2)} color={CHARLIE_COLOR} />
                  )}
                  <MetricCard label="Probability (p)" value={(probability/100).toFixed(2)} color="#9b59b6" />
                  <MetricCard label="Algorithm" value={getDisplayAlgorithm(algorithm, probability)} color={ACCENT_COLOR} />
                </div>
                
                <div className="mb-4">
                  <ExperimentVisualization 
                    experimentData={experimentData} 
                    currentRound={currentAnimation}
                    processCount={processCount}
                  />
                </div>
                
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
                
                <div className="mb-4">
                  <h3 className="text-lg font-semibold mb-4">Round Data</h3>
                  <ResultsTable 
                    experimentData={experimentData}
                    processCount={processCount}
                  />
                </div>
                
                {statsData && (
                  <div className="mt-6 text-center">
                    <button
                      onClick={prepareSingleExperiment}
                      className="px-4 py-2 bg-green-600 text-white rounded shadow hover:bg-green-700 transition-colors"
                    >
                      💾 Save This Experiment
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Statistical Analysis tab */}
            {activeTab === 'statistics' && (
              <div>
                {statsData && (
                  <div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                      <MetricCard label="Mean Discrepancy" value={statsData.mean.toFixed(4)} color="#3498db" />
                      <MetricCard label="Median Discrepancy" value={statsData.median.toFixed(4)} color="#2ecc71" />
                      {/* For 2 processes, we show the theoretical values - for 3 processes we don't have a formula yet */}
                      {processCount === 2 && (
                        <MetricCard label="Theoretical" value={statsData.theoretical.toFixed(4)} color="#9b59b6" />
                      )}
                      <MetricCard label="Minimum Discrepancy" value={statsData.min.toFixed(4)} color="#e74c3c" />
                      <MetricCard label="Maximum Discrepancy" value={statsData.max.toFixed(4)} color="#f39c12" />
                      <MetricCard label="Standard Deviation" value={statsData.std.toFixed(4)} color="#34495e" />
                    </div>
                    
                    <div className="bg-gray-50 p-3 rounded-lg border text-sm mb-4">
                      <p className="font-medium">Simulation Parameters:</p>
                      <ul className="mt-1 space-y-1">
                        <li>Processes: {processCount} ({processCount === 2 ? "Alice, Bob" : "Alice, Bob, Charlie"})</li>
                        <li>Probability: p = {(probability/100).toFixed(2)}</li>
                        <li>Algorithm: {statsData.algorithm} {processCount === 3 && statsData.algorithm === "FV" && `(${fvMethod})`}</li>
                        <li>Repetitions: {repetitions}</li>
                        {processCount === 3 && (
                          <li className="text-orange-600 font-medium">Note: Theoretical formulas are only available for 2 processes</li>
                        )}
                      </ul>
                    </div>
                    
                    <div className="mb-4">
                      <HistogramPlot 
                        discrepancies={statsData?.allValues} 
                        theoretical={processCount === 2 ? statsData?.theoretical : null} 
                        experimental={statsData?.mean} 
                      />
                    </div>
                  </div>
                )}
                
                {!statsData && (
                  <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
                    <p className="mb-4">Run a simulation first to see statistical analysis.</p>
                    <button 
                      onClick={runSingleExperiment} 
                      disabled={isRunning}
                      className="px-4 py-2 bg-blue-600 text-white rounded"
                    >
                      Start Simulation
                    </button>
                  </div>
                )}
                
                {statsData && (
                  <div className="mt-6 text-center">
                    <button
                      onClick={prepareSingleExperiment}
                      className="px-4 py-2 bg-green-600 text-white rounded shadow hover:bg-green-700 transition-colors"
                    >
                      💾 Save Statistical Results
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Theoretical Comparison tab */}
            {activeTab === 'theory' && (
              <div>
                <div className="mb-4">
                  <TheoryPlot 
                    currentP={probability/100} 
                    experimentalData={experimentalResults} 
                    displayCurves={rangeDisplayCurves} 
                  />
                </div>
                
                <div className="bg-white rounded-lg shadow p-4 mb-4">
                  <h3 className="text-lg font-semibold mb-4">Range Experiments</h3>
                  
                  <div className="mb-4 bg-blue-50 p-3 rounded-lg">
                    <h4 className="font-bold text-blue-800 mb-2">Theoretical Background:</h4>
                    <p className="text-sm mb-2">
                      From the paper, there are two optimal algorithms depending on p:
                    </p>
                    <ul className="list-disc pl-5 mb-2 text-sm space-y-1">
                      <li>
                        <span className="font-bold">Agreed Meeting Point (AMP)</span>: For p &gt; 0.5. Expected discrepancy: <span className="font-mono">1-p</span>
                      </li>
                      <li>
                        <span className="font-bold">Flip Value (FV)</span>: For p &lt;= 0.5. Expected discrepancy: <span className="font-mono">(1-p)² + p²</span>
                      </li>
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
                              setRangeExperiments((prev) => ({ ...prev, minP: newValue }));
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
                              setRangeExperiments((prev) => ({ ...prev, maxP: newValue }));
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
                              setRangeExperiments((prev) => ({ ...prev, steps: newValue }));
                            }}
                            className="w-full p-2 border border-gray-300 rounded-md"
                            disabled={isRunning}
                          >
                            <option value="3">3 points</option>
                            <option value="5">5 points</option>
                            <option value="7">7 points</option>
                            <option value="10">10 points</option>
                            <option value="15">15 points</option>
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
                            onChange={(e) => {
                              setForcedAlgorithm(e.target.value);
                              handleCurveDisplayChange('algorithmChange');
                            }}
                            className="w-full p-2 border border-gray-300 rounded-md"
                            disabled={isRunning}
                          >
                            <option value="auto">Auto (Based on Theory)</option>
                            <option value="AMP">Force AMP Algorithm</option>
                            <option value="FV">Force FV Algorithm</option>
                          </select>
                        </div>
                        
                        {(forcedAlgorithm === "FV" || forcedAlgorithm === "auto") && processCount === 3 && (
                          <div>
                            <label className="block text-sm font-medium mb-1">FV Method (3-process only):</label>
                            <select
                              value={fvMethod}
                              onChange={(e) => setFvMethod(e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded-md"
                              disabled={isRunning}
                            >
                              <option value="average">Average of received values</option>
                              <option value="median">Median (with own value)</option>
                              <option value="weighted">Probability-weighted blend</option>
                              <option value="accelerated">Accelerated convergence</option>
                              <option value="first">First received value</option>
                            </select>
                            
                            <div className="mt-2 bg-gray-50 p-2 rounded text-xs">
                              <p className="font-medium">Method description:</p>
                              {fvMethod === "average" && "Uses the average of received values."}
                              {fvMethod === "median" && "Uses the median of own value and received values."}
                              {fvMethod === "weighted" && "Weighted blend based on probability p."}
                              {fvMethod === "accelerated" && "Accelerated convergence toward center."}
                              {fvMethod === "first" && "Simply uses first received value."}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2 border-b pb-1">Display Options</h4>
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="showExperimental"
                            checked={rangeDisplayCurves.experimental}
                            onChange={() => handleCurveDisplayChange('experimental')}
                            className="mr-2"
                            disabled={isRunning}
                          />
                          <label htmlFor="showExperimental" className="text-sm">Show Experimental Curve</label>
                        </div>
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="showTheoreticalAmp"
                            checked={rangeDisplayCurves.theoreticalAmp}
                            onChange={() => handleCurveDisplayChange('theoreticalAmp')}
                            className="mr-2"
                            disabled={isRunning}
                          />
                          <label htmlFor="showTheoreticalAmp" className="text-sm">Show AMP Curve (1-p)</label>
                        </div>
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="showTheoreticalFv"
                            checked={rangeDisplayCurves.theoreticalFv}
                            onChange={() => handleCurveDisplayChange('theoreticalFv')}
                            className="mr-2"
                            disabled={isRunning}
                          />
                          <label htmlFor="showTheoreticalFv" className="text-sm">Show FV Curve ((1-p)² + p²)</label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={runRangeExperiments}
                    disabled={isRunning}
                    className="w-full py-3 px-4 mb-4 rounded-lg font-semibold text-white"
                    style={{ backgroundColor: isRunning ? '#9CA3AF' : '#2563EB' }}
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
                        <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${progress}%` }}></div>
                      </div>
                      {currentRepetition !== undefined && (
                        <div className="text-xs text-center mt-1 text-gray-600">
                          Current repetition: {currentRepetition} of {repetitions}
                        </div>
                      )}
                    </div>
                  )}

                  {experimentalResults && experimentalResults.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Results Summary:</h4>
                      <div className="bg-gray-50 p-3 rounded-lg border text-sm">
                        <p>
                          Tested {experimentalResults.length} probability points from {rangeExperiments.minP} to {rangeExperiments.maxP} with {processCount} processes.
                        </p>
                        <p className="mt-2">
                          The algorithm {forcedAlgorithm === "auto" ? "automatically selected" : `was forced to use ${forcedAlgorithm}`} for each test.
                          {forcedAlgorithm === "FV" && processCount === 3 && ` Using FV method: ${fvMethod}.`}
                        </p>
                      </div>
                      
                      <div className="mt-6">
                        <h4 className="font-medium mb-3 text-lg text-gray-700 flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z" clipRule="evenodd" />
                          </svg>
                          Detailed Results
                        </h4>
                        <RangeResultsTable 
                          results={experimentalResults} 
                          processCount={processCount}
                          forcedAlgorithm={forcedAlgorithm}
                          fvMethod={fvMethod}
                        />
                      </div>
                      
                      {processCount === 3 && (
                        <div className="mt-6 bg-gray-50 p-4 rounded-lg border">
                          <h4 className="font-medium mb-2 text-orange-600">Note About 3-Process Theoretical Predictions</h4>
                          <p className="text-sm text-gray-700 mb-2">
                            The theoretical formulas shown are derived for 2-process systems. For 3-process systems:
                          </p>
                          <ul className="list-disc pl-5 text-sm text-gray-700">
                            <li>Experimental results may differ from theoretical predictions</li>
                            <li>The maximum discrepancy among all process pairs is used</li>
                            <li>Advanced FV methods may perform differently than in 2-process systems</li>
                          </ul>
                        </div>
                      )}
                      
                      <div className="mt-6 text-center">
                        <button
                          onClick={prepareRangeExperiment}
                          className="px-4 py-2 bg-green-600 text-white rounded shadow hover:bg-green-700 transition-colors"
                        >
                          💾 Save Range Experiment
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
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

            {/* Method Comparison tab */}
            {activeTab === 'methods' && processCount === 3 && (
              <div>
                <div className="bg-white rounded-lg shadow p-4 mt-4">
                  <h3 className="text-lg font-semibold mb-4">FV Method Comparison</h3>
                  
                  <div className="bg-blue-50 p-3 rounded-lg mb-4 text-sm">
                    <p>This tool lets you compare how different FV methods perform with {processCount} processes:</p>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                      <li><strong>Average:</strong> Uses average of received values</li>
                      <li><strong>Median:</strong> Uses median of own and received values</li>
                      <li><strong>Weighted:</strong> Blend weighted by probability p</li>
                      <li><strong>Accelerated:</strong> Converges faster toward mid-range</li>
                      <li><strong>First:</strong> Only uses first received value</li>
                    </ul>
                  </div>
                  
                  <div className="mb-4">
                    <div className="text-sm text-gray-600 mb-2">
                      Using current settings: p={probability/100}, {rounds} rounds, {repetitions} repetitions, {processCount} processes
                    </div>
                    <button 
                      onClick={runFVMethodComparison}
                      disabled={isRunning}
                      className="px-4 py-2 bg-blue-600 text-white rounded"
                    >
                      {isRunning ? "Comparing..." : "Compare FV Methods"}
                    </button>
                  </div>
                  
                  {comparisonResults && <FVMethodComparisonChart comparisonResults={comparisonResults} />}
                </div>
              </div>
            )}
            
            {/* Saved Experiments tab */}
            {activeTab === 'saved' && (
              <div>
                <div className="bg-white rounded-lg shadow p-4 mb-4">
                  <h3 className="text-lg font-semibold mb-4">Saved Experiments</h3>
                  
                  <div className="p-8 text-center text-gray-500">
                    <div className="text-6xl mb-4">💾</div>
                    <p className="mb-4">You currently have no saved experiments.</p>
                    <p>Run simulations and save them to see them here.</p>
                  </div>
                </div>
              </div>
            )}
            
          </div>
        </div>
      </main>

      <footer className="bg-white shadow rounded-lg p-4 text-center">
        <p className="text-sm text-gray-500">
          ApproximateLVL - Multi-Process Distributed Computing Agreement Simulator
        </p>
      </footer>
    </div>
  );
}

export default CompleteDistributedComputingSimulator;