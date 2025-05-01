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
  ComposedChart,
  ScatterChart,
  ZAxis,
  Area
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

// Utility functions for experiment analysis
function calculateExperimentStats(experiment) {
  if (!experiment || !experiment.results || experiment.results.length === 0) {
    return null;
  }
  
  const discrepancies = experiment.results.map(r => r.discrepancy);
  
  // Basic statistics
  const mean = discrepancies.reduce((a, b) => a + b, 0) / discrepancies.length;
  const min = Math.min(...discrepancies);
  const max = Math.max(...discrepancies);
  
  // Standard deviation
  const variance = discrepancies.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / discrepancies.length;
  const stdDev = Math.sqrt(variance);
  
  // Errors compared to theoretical
  const errorsPercent = experiment.results
    .filter(r => r.theoretical)
    .map(r => Math.abs(r.discrepancy - r.theoretical) / r.theoretical * 100);
  
  const avgErrorPercent = errorsPercent.length > 0 ? 
    errorsPercent.reduce((a, b) => a + b, 0) / errorsPercent.length : null;
  
  // Algorithms used
  const algorithmsUsed = [...new Set(experiment.results.map(r => r.algorithm))];
  
  return {
    mean,
    min,
    max,
    stdDev,
    avgErrorPercent,
    algorithmsUsed,
    sampleSize: discrepancies.length
  };
}

// Function to find interesting points in the experiments
function findInterestingPoints(experiments) {
  if (!experiments || experiments.length === 0) return [];
  
  const interestingPoints = [];
  
  // Look for the crossover point p=0.5
  experiments.forEach(exp => {
    const nearCrossover = exp.results.find(r => Math.abs(r.p - 0.5) < 0.01);
    if (nearCrossover) {
      interestingPoints.push({
        type: 'crossover',
        p: nearCrossover.p,
        description: 'Theoretical crossover point (p=0.5)',
        experimentId: exp.metadata.id
      });
    }
  });
  
  // Find extreme values
  experiments.forEach(exp => {
    const discrepancies = exp.results.map(r => r.discrepancy);
    const maxIndex = discrepancies.indexOf(Math.max(...discrepancies));
    const minIndex = discrepancies.indexOf(Math.min(...discrepancies));
    
    if (maxIndex !== -1) {
      interestingPoints.push({
        type: 'max',
        p: exp.results[maxIndex].p,
        description: `Maximum discrepancy (${exp.results[maxIndex].discrepancy.toFixed(4)})`,
        experimentId: exp.metadata.id
      });
    }
    
    if (minIndex !== -1) {
      interestingPoints.push({
        type: 'min',
        p: exp.results[minIndex].p,
        description: `Minimum discrepancy (${exp.results[minIndex].discrepancy.toFixed(4)})`,
        experimentId: exp.metadata.id
      });
    }
  });
  
  return interestingPoints;
}

// Helper function for color interpolation
function interpolateColor(color1, color2, factor) {
  // Convert hexadecimal colors to RGB components
  const hex1 = color1.replace('#', '');
  const hex2 = color2.replace('#', '');
  
  // Get RGB components
  const r1 = parseInt(hex1.substring(0, 2), 16);
  const g1 = parseInt(hex1.substring(2, 4), 16);
  const b1 = parseInt(hex1.substring(4, 6), 16);
  
  const r2 = parseInt(hex2.substring(0, 2), 16);
  const g2 = parseInt(hex2.substring(2, 4), 16);
  const b2 = parseInt(hex2.substring(4, 6), 16);
  
  // Interpolate
  const r = Math.round(r1 + factor * (r2 - r1));
  const g = Math.round(g1 + factor * (g2 - g1));
  const b = Math.round(b1 + factor * (b2 - b1));
  
  // Convert back to hex
  const rHex = r.toString(16).padStart(2, '0');
  const gHex = g.toString(16).padStart(2, '0');
  const bHex = b.toString(16).padStart(2, '0');
  
  return `#${rHex}${gHex}${bHex}`;
}

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

// Component for comparing experiments with advanced features
// Component for comparing experiments with advanced features
// Component for comparing experiments with advanced features
function ExperimentComparison({ experiments }) {
  if (!experiments || experiments.length === 0) return null;
  
  const colors = [
    "#3498db", "#e67e22", "#2ecc71", "#9b59b6", "#e74c3c", 
    "#f39c12", "#16a085", "#8e44ad", "#c0392b", "#27ae60"
  ];
  
  const [viewMode, setViewMode] = useState('chart'); // 'chart', 'detail', 'combined'
  const [selectedMetric, setSelectedMetric] = useState('discrepancy'); // 'discrepancy', 'errorPercent', 'theoretical'
  const [normalizeProbability, setNormalizeProbability] = useState(false);
  const [highlightCrossover, setHighlightCrossover] = useState(true);
  const [legendPosition, setLegendPosition] = useState('top'); // 'top', 'bottom', 'right'
  const [showGrid, setShowGrid] = useState(true);
  const [showDataPoints, setShowDataPoints] = useState(true);
  
  // For range experiment comparisons
  if (experiments[0].type === 'range') {
    // Prepare combined data for all charts
    const chartData = [];
    const algorithmColors = {
      'AMP': '#e74c3c',  // Red
      'FV': '#3498db'    // Blue
    };
    
    // Advanced data processing for all visualizations
    experiments.forEach((experiment, index) => {
      const expColor = colors[index % colors.length];
      
      // For each data point in the experiment
      experiment.results.forEach(result => {
        // Calculate variance if available in discrepancies array
        let variance = 0;
        let stdDev = 0;
        
        if (result.discrepancies && result.discrepancies.length > 1) {
          const mean = result.discrepancy;
          variance = result.discrepancies.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / result.discrepancies.length;
          stdDev = Math.sqrt(variance);
        }
        
        // Normalize values if enabled
        const normalizedP = normalizeProbability ? 
          (result.p - experiment.parameters.minP) / (experiment.parameters.maxP - experiment.parameters.minP) : 
          result.p;
        
        const dataPoint = {
          p: normalizedP,
          rawP: result.p,
          [experiment.metadata.name]: result.discrepancy,
          variance: variance,
          stdDev: stdDev,
          experimentId: experiment.metadata.id,
          algorithm: result.algorithm,
          expColor: expColor,
          algorithmColor: algorithmColors[result.algorithm] || expColor,
          theoretical: result.theoretical,
          error: result.theoretical ? Math.abs(result.theoretical - result.discrepancy) : null,
          errorPercent: result.theoretical && result.theoretical !== 0 ? 
            (Math.abs(result.theoretical - result.discrepancy) / result.theoretical) * 100 : null
        };
        
        // Add the selected metric property for easy plotting
        if (selectedMetric === 'errorPercent') {
          dataPoint[`${experiment.metadata.name}_${selectedMetric}`] = dataPoint.errorPercent;
        } else if (selectedMetric === 'theoretical') {
          dataPoint[`${experiment.metadata.name}_theoretical`] = dataPoint.theoretical;
          dataPoint[`${experiment.metadata.name}_experimental`] = result.discrepancy;
        } else {
          // Default is discrepancy, which is already added
        }
        
        chartData.push(dataPoint);
      });
    });
    
    // Sort by probability and group by experiment
    chartData.sort((a, b) => a.rawP - b.rawP);
    
    // Find the crossover point (when AMP outperforms FV)
    const crossoverPoint = chartData.find(point => point.rawP > 0.5);
    
    // Determine Y-axis range for consistency
    const allDiscrepancies = chartData.map(d => {
      const values = experiments.map(exp => d[exp.metadata.name]).filter(v => v !== undefined);
      return Math.max(...values);
    });
    const maxDiscrepancy = Math.max(...allDiscrepancies);
    const yAxisDomain = [0, Math.min(Math.ceil(maxDiscrepancy * 10) / 10, 1)];
    
    return (
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Range Experiments Comparison</h3>
          
          <div className="flex space-x-3">
            <select 
              value={viewMode} 
              onChange={(e) => setViewMode(e.target.value)}
              className="px-2 py-1 border rounded text-sm"
            >
              <option value="chart">Chart</option>
              <option value="detail">Details</option>
              <option value="combined">Combined</option>
            </select>
            
            <select 
              value={selectedMetric} 
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="px-2 py-1 border rounded text-sm"
            >
              <option value="discrepancy">Discrepancy</option>
              <option value="errorPercent">Error %</option>
              <option value="theoretical">Theoretical vs Experimental</option>
            </select>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 mb-3 bg-gray-50 p-2 rounded">
          <label className="flex items-center text-sm">
            <input 
              type="checkbox" 
              checked={normalizeProbability}
              onChange={() => setNormalizeProbability(!normalizeProbability)}
              className="mr-1"
            />
            Normalize Probability
          </label>
          
          <label className="flex items-center text-sm">
            <input 
              type="checkbox" 
              checked={highlightCrossover}
              onChange={() => setHighlightCrossover(!highlightCrossover)}
              className="mr-1"
            />
            Highlight Crossover
          </label>
          
          <label className="flex items-center text-sm">
            <input 
              type="checkbox" 
              checked={showDataPoints}
              onChange={() => setShowDataPoints(!showDataPoints)}
              className="mr-1"
            />
            Show Data Points
          </label>
          
          <label className="flex items-center text-sm">
            <input 
              type="checkbox" 
              checked={showGrid}
              onChange={() => setShowGrid(!showGrid)}
              className="mr-1"
            />
            Show Grid
          </label>
          
          <select 
            value={legendPosition} 
            onChange={(e) => setLegendPosition(e.target.value)}
            className="px-1 py-0.5 border rounded text-xs"
          >
            <option value="top">Legend Top</option>
            <option value="bottom">Legend Bottom</option>
            <option value="right">Legend Right</option>
          </select>
        </div>
        
        <div className="mb-3 text-sm">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {experiments.map((exp, index) => (
              <div key={exp.metadata.id} className="flex items-center">
                <span 
                  className="inline-block w-3 h-3 mr-1 rounded-sm" 
                  style={{ backgroundColor: colors[index % colors.length] }}
                ></span>
                <span>{exp.metadata.name}</span>
              </div>
            ))}
          </div>
        </div>
        
        {(viewMode === 'chart' || viewMode === 'combined') && (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={showGrid ? "#ddd" : "transparent"} />
              <XAxis
                type="number"
                dataKey="p"
                domain={normalizeProbability ? [0, 1] : [0, 1]}
                label={{ 
                  value: normalizeProbability ? 'Normalized Probability' : 'Probability (p)', 
                  position: 'insideBottom', 
                  offset: -5 
                }}
                tickFormatter={value => value.toFixed(2)}
              />
              <YAxis
                type="number"
                domain={yAxisDomain}
                label={{ 
                  value: selectedMetric === 'discrepancy' ? 'Discrepancy' : 
                         selectedMetric === 'errorPercent' ? 'Error %' : 
                         'Value', 
                  angle: -90, 
                  position: 'insideLeft', 
                  offset: -10 
                }}
              />
              <Tooltip 
                formatter={(value) => value !== undefined && !isNaN(value) ? value.toFixed(4) : 'N/A'} 
                labelFormatter={(value) => `Probability: ${value.toFixed(2)}`}
              />
              <Legend verticalAlign={legendPosition === 'bottom' ? 'bottom' : 'top'} height={36} />
              
              {selectedMetric === 'discrepancy' && experiments.map((experiment, index) => (
                <Line 
                  key={experiment.metadata.id}
                  data={chartData.filter(d => d.experimentId === experiment.metadata.id)}
                  type="monotone" 
                  dataKey={experiment.metadata.name} 
                  name={experiment.metadata.name} 
                  stroke={colors[index % colors.length]} 
                  strokeWidth={2} 
                  dot={showDataPoints ? { r: 3, strokeWidth: 1 } : false} 
                  connectNulls 
                />
              ))}
              
              {selectedMetric === 'errorPercent' && experiments.map((experiment, index) => (
                <Line 
                  key={experiment.metadata.id}
                  data={chartData.filter(d => d.experimentId === experiment.metadata.id && d.errorPercent !== null)}
                  type="monotone" 
                  dataKey="errorPercent" 
                  name={`${experiment.metadata.name} (Error %)`} 
                  stroke={colors[index % colors.length]} 
                  strokeWidth={2} 
                  dot={showDataPoints ? { r: 3, strokeWidth: 1 } : false}
                  connectNulls 
                />
              ))}
              
              {selectedMetric === 'theoretical' && experiments.map((experiment, index) => {
                const expColor = colors[index % colors.length];
                return (
                  <React.Fragment key={experiment.metadata.id}>
                    <Line 
                      data={chartData.filter(d => d.experimentId === experiment.metadata.id && d.theoretical !== null)}
                      type="monotone" 
                      dataKey="theoretical" 
                      name={`${experiment.metadata.name} (Theoretical)`} 
                      stroke={expColor} 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={showDataPoints ? { r: 3, strokeWidth: 1 } : false}
                      connectNulls 
                    />
                    <Line 
                      data={chartData.filter(d => d.experimentId === experiment.metadata.id)}
                      type="monotone" 
                      dataKey={experiment.metadata.name} 
                      name={`${experiment.metadata.name} (Experimental)`} 
                      stroke={expColor} 
                      strokeWidth={2} 
                      dot={showDataPoints ? { r: 3, strokeWidth: 1 } : false}
                      connectNulls 
                    />
                  </React.Fragment>
                );
              })}
              
              {highlightCrossover && (
                <ReferenceLine x={0.5} stroke="#666" strokeDasharray="3 3" label={{ 
                  value: 'Crossover Point (p=0.5)', 
                  position: 'insideBottomRight', 
                  fill: '#666',
                  fontSize: 11
                }} />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
        
        {(viewMode === 'detail' || viewMode === 'combined') && (
          <div className="mt-4">
            <h4 className="font-medium mb-2">Experiment Details:</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Processes</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Algorithm</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Range</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data Points</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Avg Discrepancy</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Avg Variance</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {experiments.map((exp, index) => {
                    // Calculate average discrepancy and variance
                    const discrepancies = exp.results.map(r => r.discrepancy);
                    const avgDiscrepancy = discrepancies.reduce((sum, d) => sum + d, 0) / discrepancies.length;
                    
                    // Calculate average variance
                    let totalVariance = 0;
                    let countWithVariance = 0;
                    
                    exp.results.forEach(result => {
                      if (result.discrepancies && result.discrepancies.length > 1) {
                        const mean = result.discrepancy;
                        const variance = result.discrepancies.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / result.discrepancies.length;
                        totalVariance += variance;
                        countWithVariance++;
                      }
                    });
                    
                    const avgVariance = countWithVariance > 0 ? totalVariance / countWithVariance : null;
                    
                    return (
                      <tr key={exp.metadata.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium" style={{ color: colors[index % colors.length] }}>
                          {exp.metadata.name}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          {exp.parameters.processCount}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          {exp.parameters.algorithm}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          {exp.parameters.minP.toFixed(2)} - {exp.parameters.maxP.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          {exp.results.length}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          {new Date(exp.metadata.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-mono">
                          {avgDiscrepancy.toFixed(4)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-mono">
                          {avgVariance !== null ? avgVariance.toFixed(6) : 'N/A'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Metadata and tags section */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {experiments.map((exp, index) => (
                <div key={exp.metadata.id} className="bg-gray-50 p-3 rounded border">
                  <h5 className="font-medium mb-2" style={{ color: colors[index % colors.length] }}>
                    {exp.metadata.name}
                  </h5>
                  
                  {exp.metadata.description && (
                    <p className="text-sm text-gray-600 mb-2">{exp.metadata.description}</p>
                  )}
                  
                  <div className="flex flex-wrap gap-1 mb-2">
                    {exp.metadata.tags && exp.metadata.tags.map((tag, i) => (
                      <span key={i} className="text-xs bg-white text-gray-600 px-1.5 py-0.5 rounded border">
                        {tag}
                      </span>
                    ))}
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    Created: {new Date(exp.metadata.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Advanced statistical analysis */}
        {experiments.length > 1 && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium mb-3">Comparative Statistical Analysis</h4>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 border">
                <thead className="bg-blue-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Experiment</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Avg Disc.</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Min Disc.</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Max Disc.</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Variance</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Std. Deviation</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Avg Error (%)</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {experiments.map((exp, index) => {
                    // Statistical calculations
                    const discrepancies = exp.results.map(r => r.discrepancy);
                    const mean = discrepancies.reduce((a, b) => a + b, 0) / discrepancies.length;
                    const min = Math.min(...discrepancies);
                    const max = Math.max(...discrepancies);
                    
                    // Calculate variance and standard deviation
                    const variance = discrepancies.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / discrepancies.length;
                    const stdDev = Math.sqrt(variance);
                    
                    // Calculate average error compared to theoretical (if available)
                    const errorsPercent = exp.results
                      .filter(r => r.theoretical)
                      .map(r => Math.abs(r.discrepancy - r.theoretical) / r.theoretical * 100);
                    
                    const avgErrorPercent = errorsPercent.length > 0 ? 
                      errorsPercent.reduce((a, b) => a + b, 0) / errorsPercent.length : null;
                    
                    return (
                      <tr key={exp.metadata.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium" style={{ color: colors[index % colors.length] }}>
                          {exp.metadata.name}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-mono">
                          {mean.toFixed(4)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-mono">
                          {min.toFixed(4)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-mono">
                          {max.toFixed(4)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-mono">
                          {variance.toFixed(6)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-mono">
                          {stdDev.toFixed(4)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-mono">
                          {avgErrorPercent !== null ? avgErrorPercent.toFixed(2) + '%' : 'N/A'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Variance Visualization - Con mayor altura y mejores márgenes */}
            <div className="mt-6">
              <h4 className="font-medium mb-3">Variance Analysis</h4>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart
                  data={experiments.map(exp => {
                    // Calculate variance across all data points
                    const discrepancies = exp.results.map(r => r.discrepancy);
                    const mean = discrepancies.reduce((a, b) => a + b, 0) / discrepancies.length;
                    const variance = discrepancies.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / discrepancies.length;
                    const stdDev = Math.sqrt(variance);
                    
                    // Prepare shortened name for display
                    const shortName = exp.metadata.name.length > 12 ? 
                      exp.metadata.name.substring(0, 12) + '...' : exp.metadata.name;
                    
                    return {
                      name: shortName,
                      fullName: exp.metadata.name,
                      variance: variance,
                      stdDev: stdDev
                    };
                  })}
                  margin={{ top: 30, right: 40, left: 50, bottom: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    tick={{angle: -45, textAnchor: 'end', dominantBaseline: 'auto'}}
                    height={80}
                    label={{ value: 'Experiment', position: 'insideBottom', offset: -60 }}
                  />
                  <YAxis 
                    label={{ value: 'Value', angle: -90, position: 'insideLeft', offset: -35 }}
                    tickMargin={10}
                  />
                  <Tooltip 
                    formatter={(value, name) => [value.toFixed(6), name === 'variance' ? 'Variance' : 'Std Deviation']}
                    labelFormatter={(label, data) => data[0]?.payload?.fullName || label}
                  />
                  <Legend verticalAlign="top" height={40} />
                  <Bar dataKey="variance" name="Variance" fill="#8884d8" />
                  <Bar dataKey="stdDev" name="Standard Deviation" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            {/* Automated conclusions section */}
            <div className="mt-6 p-3 bg-white rounded border">
              <h5 className="font-medium mb-2">Automated Conclusions</h5>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {experiments.length > 1 && (() => {
                  // Find the best experiment by average discrepancy
                  const bestExpIndex = experiments
                    .map((exp, idx) => ({
                      idx,
                      avgDisc: exp.results.reduce((sum, r) => sum + r.discrepancy, 0) / exp.results.length
                    }))
                    .sort((a, b) => a.avgDisc - b.avgDisc)[0].idx;
                  
                  // Find the experiment with lowest variance
                  const lowestVarianceExpIndex = experiments
                    .map((exp, idx) => {
                      let totalVariance = 0;
                      let count = 0;
                      
                      exp.results.forEach(result => {
                        if (result.discrepancies && result.discrepancies.length > 1) {
                          const mean = result.discrepancy;
                          const variance = result.discrepancies.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / result.discrepancies.length;
                          totalVariance += variance;
                          count++;
                        }
                      });
                      
                      return {
                        idx,
                        avgVariance: count > 0 ? totalVariance / count : Infinity
                      };
                    })
                    .sort((a, b) => a.avgVariance - b.avgVariance)[0].idx;
                  
                  return (
                    <>
                      <li className="text-green-700">
                        <strong>{experiments[bestExpIndex].metadata.name}</strong> shows the lowest average discrepancy ({
                          (experiments[bestExpIndex].results.reduce((sum, r) => sum + r.discrepancy, 0) / 
                          experiments[bestExpIndex].results.length).toFixed(4)
                        }),
                        suggesting it's the most effective experiment.
                      </li>
                      
                      <li className="text-blue-700">
                        <strong>{experiments[lowestVarianceExpIndex].metadata.name}</strong> shows the lowest variance,
                        indicating it produces the most consistent results.
                      </li>
                    </>
                  );
                })()}
                
                {(() => {
                  // Check if there are any mixed algorithm experiments
                  const mixedAlgExps = experiments.filter(exp => 
                    exp.parameters.algorithm === "auto" || 
                    exp.results.some(r => r.algorithm !== exp.results[0].algorithm)
                  );
                  
                  if (mixedAlgExps.length > 0) {
                    return (
                      <li>
                        Experiments with automatic algorithm selection demonstrate the expected behavior
                        around the crossover point (p=0.5).
                      </li>
                    );
                  }
                  return null;
                })()}
                
                {(() => {
                  // Detect if there are experiments crossing the p=0.5 point
                  const crossoverExps = experiments.filter(exp => 
                    exp.parameters.minP < 0.5 && exp.parameters.maxP > 0.5
                  );
                  
                  if (crossoverExps.length > 0) {
                    return (
                      <li>
                        The expected theoretical behavior is observed where FV is better for p&lt;0.5 and
                        AMP is better for p&gt;0.5.
                      </li>
                    );
                  }
                  return null;
                })()}
              </ul>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  // For other experiment types (currently we only have range)
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <h3 className="text-lg font-semibold mb-4">Experiment Comparison</h3>
      <p className="text-gray-500">This experiment type doesn't support comparison currently.</p>
    </div>
  );
}

// Component for advanced visualization and 3D comparison
// Component for advanced visualization and comparison
function AdvancedComparisonView({ experiments }) {
  if (!experiments || experiments.length === 0) return null;
  
  const [viewType, setViewType] = useState('2d'); // '2d', 'heatmap'
  
  // Data for charts
  const all2DData = [];
  experiments.forEach((experiment, expIndex) => {
    experiment.results.forEach((result, resultIndex) => {
      all2DData.push({
        experimentName: experiment.metadata.name,
        experimentIndex: expIndex,
        p: result.p,
        algorithm: result.algorithm,
        discrepancy: result.discrepancy,
        theoretical: result.theoretical || 0,
        error: result.theoretical ? Math.abs(result.theoretical - result.discrepancy) : 0,
        errorPercent: result.theoretical && result.theoretical !== 0 ? 
          (Math.abs(result.theoretical - result.discrepancy) / result.theoretical) * 100 : 0,
        pointIndex: resultIndex,
        time: new Date(experiment.metadata.createdAt).getTime()
      });
    });
  });
  
  // Colors for experiments
  const colors = ['#4285F4', '#EA4335', '#FBBC05', '#34A853', '#8A2BE2', '#FF6B6B'];
  
  // Data for heatmap
  const heatmapData = experiments.map((experiment, index) => {
    // Group by probability ranges for heatmap
    const groups = [];
    const pRanges = [...Array(10)].map((_, i) => i / 10);
    
    pRanges.forEach(minP => {
      const maxP = minP + 0.1;
      const resultsInRange = experiment.results.filter(r => r.p >= minP && r.p < maxP);
      
      if (resultsInRange.length > 0) {
        const avgDiscrepancy = resultsInRange.reduce((sum, r) => sum + r.discrepancy, 0) / resultsInRange.length;
        groups.push({
          pRange: `${minP.toFixed(1)}-${maxP.toFixed(1)}`,
          value: avgDiscrepancy,
          count: resultsInRange.length
        });
      }
    });
    
    return {
      name: experiment.metadata.name,
      color: colors[index % colors.length],
      data: groups
    };
  });
  
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Advanced Visualization</h3>
        
        <div className="flex space-x-2">
          <select 
            value={viewType} 
            onChange={(e) => setViewType(e.target.value)}
            className="px-2 py-1 border rounded text-sm"
          >
            <option value="2d">2D Chart</option>
            <option value="heatmap">Heat Map</option>
          </select>
        </div>
      </div>
      
      {viewType === '2d' && (
        <div className="h-64 md:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              margin={{ top: 10, right: 30, left: 40, bottom: 30 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="p" 
                type="number" 
                label={{ value: 'Probability (p)', position: 'insideBottom', offset: -10 }}
                domain={[0, 1]}
                tickFormatter={value => value.toFixed(1)}
              />
              <YAxis
                label={{ value: 'Discrepancy', angle: -90, position: 'insideLeft', offset: -20 }}
                domain={[0, 1]}
                tickMargin={10}
              />
              <Tooltip formatter={(value) => value.toFixed(4)} />
              <Legend verticalAlign="top" height={36} />
              
              {experiments.map((experiment, index) => {
                // Prepare data for this experiment
                const data = experiment.results.map(result => ({
                  p: result.p,
                  experimentName: experiment.metadata.name,
                  [experiment.metadata.name]: result.discrepancy,
                  algorithm: result.algorithm
                }));
                
                return (
                  <Line
                    key={experiment.metadata.id}
                    data={data}
                    type="monotone"
                    dataKey={experiment.metadata.name}
                    stroke={colors[index % colors.length]}
                    strokeWidth={2}
                    dot={{ r: 3, strokeWidth: 1 }}
                  />
                );
              })}
              
              <ReferenceLine x={0.5} stroke="#666" strokeDasharray="3 3" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      
      {viewType === 'heatmap' && (
        <div className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {experiments.map((experiment, index) => {
              // Convert data for heatmap
              const heatmapSpecificData = [];
              
              // Create a 2D array for heatmap
              for (let alg of ['AMP', 'FV']) {
                for (let i = 0; i < 10; i++) {
                  const minP = i / 10;
                  const maxP = (i + 1) / 10;
                  
                  const resultsInRange = experiment.results.filter(
                    r => r.p >= minP && r.p < maxP && r.algorithm === alg
                  );
                  
                  if (resultsInRange.length > 0) {
                    const avgDiscrepancy = resultsInRange.reduce((sum, r) => sum + r.discrepancy, 0) / resultsInRange.length;
                    
                    heatmapSpecificData.push({
                      x: minP.toFixed(1),
                      y: alg,
                      value: avgDiscrepancy,
                      count: resultsInRange.length
                    });
                  }
                }
              }
              
              return (
                <div key={experiment.metadata.id} className="bg-gray-50 p-3 rounded-lg border">
                  <h4 className="font-medium text-center mb-2" style={{ color: colors[index % colors.length] }}>
                    {experiment.metadata.name}
                  </h4>
                  
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart
                        margin={{ top: 20, right: 20, bottom: 20, left: 50 }}
                      >
                        <CartesianGrid />
                        <XAxis 
                          type="category" 
                          dataKey="x" 
                          name="Probability" 
                          allowDuplicatedCategory={false}
                          label={{ value: 'Probability Range', position: 'insideBottom', offset: -10 }}
                        />
                        <YAxis 
                          type="category" 
                          dataKey="y" 
                          name="Algorithm" 
                          label={{ value: 'Algorithm', angle: -90, position: 'insideLeft', offset: -30 }}
                        />
                        <ZAxis 
                          dataKey="value" 
                          range={[50, 1000]} 
                          name="Discrepancy" 
                        />
                        <Tooltip 
                          formatter={(value) => value.toFixed(4)}
                          labelFormatter={() => ''}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-white p-2 border shadow rounded">
                                  <p className="font-medium text-sm">{`${payload[0].payload.y} - ${payload[0].payload.x}`}</p>
                                  <p className="text-sm">{`Discrepancy: ${payload[0].payload.value.toFixed(4)}`}</p>
                                  <p className="text-xs">{`Samples: ${payload[0].payload.count}`}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Scatter
                          data={heatmapSpecificData}
                          fill={colors[index % colors.length]}
                        >
                          {heatmapSpecificData.map((entry, i) => (
                            <Cell
                              key={`cell-${i}`}
                              fill={interpolateColor(
                                '#c6f6d5', // Light green for low values (better)
                                '#f56565', // Red for high values (worse)
                                Math.min(1, entry.value)
                              )}
                            />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="flex justify-center mt-2">
                    <div className="w-full max-w-xs h-4 bg-gradient-to-r from-green-200 to-red-400 rounded">
                      <div className="flex justify-between text-xs px-1">
                        <span>0.0</span>
                        <span>Discrepancy</span>
                        <span>1.0</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Pattern analysis and conclusions - Gráficas mejoradas con mayor altura y márgenes */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium mb-3">Pattern Analysis</h4>
        
        <div className="grid grid-cols-1 gap-8 mb-4">
          <div className="bg-white p-6 rounded border">
            <h5 className="font-medium mb-4 text-green-700">Performance by Algorithm</h5>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart
                data={experiments.map(exp => {
                  // Separate by algorithm
                  const ampResults = exp.results.filter(r => r.algorithm === 'AMP');
                  const fvResults = exp.results.filter(r => r.algorithm === 'FV');
                  
                  const ampAvg = ampResults.length > 0 ?
                    ampResults.reduce((sum, r) => sum + r.discrepancy, 0) / ampResults.length : 0;
                  const fvAvg = fvResults.length > 0 ?
                    fvResults.reduce((sum, r) => sum + r.discrepancy, 0) / fvResults.length : 0;
                  
                  return {
                    name: exp.metadata.name.length > 12 ? 
                      exp.metadata.name.substring(0, 12) + '...' : exp.metadata.name,
                    fullName: exp.metadata.name,
                    AMP: ampAvg,
                    FV: fvAvg,
                    color: colors[experiments.indexOf(exp) % colors.length]
                  };
                })}
                margin={{ top: 30, right: 40, left: 50, bottom: 80 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  tick={{angle: -45, textAnchor: 'end', dominantBaseline: 'auto'}}
                  height={80}
                  label={{ value: 'Experiment', position: 'insideBottom', offset: -60 }}
                />
                <YAxis 
                  label={{ value: 'Avg. Discrepancy', angle: -90, position: 'insideLeft', offset: -35 }}
                  tickMargin={10}
                />
                <Tooltip 
                  formatter={(value) => value.toFixed(4)}
                  labelFormatter={(label, data) => data[0]?.payload?.fullName || label}
                />
                <Legend verticalAlign="top" height={40} />
                <Bar dataKey="AMP" fill="#f56565" name="AMP Algorithm" />
                <Bar dataKey="FV" fill="#4299e1" name="FV Algorithm" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          {/* Segunda gráfica mejorada */}
          <div className="bg-white p-6 rounded border">
            <h5 className="font-medium mb-4 text-blue-700">Variance Analysis</h5>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart
                data={experiments.map(exp => {
                  // Calculate variance across all data points
                  const discrepancies = exp.results.map(r => r.discrepancy);
                  const mean = discrepancies.reduce((a, b) => a + b, 0) / discrepancies.length;
                  const variance = discrepancies.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / discrepancies.length;
                  const stdDev = Math.sqrt(variance);
                  
                  // Prepare shortened name for display
                  const shortName = exp.metadata.name.length > 12 ? 
                    exp.metadata.name.substring(0, 12) + '...' : exp.metadata.name;
                  
                  return {
                    name: shortName,
                    fullName: exp.metadata.name,
                    variance: variance,
                    stdDev: stdDev
                  };
                })}
                margin={{ top: 30, right: 40, left: 50, bottom: 80 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  tick={{angle: -45, textAnchor: 'end', dominantBaseline: 'auto'}}
                  height={80}
                  label={{ value: 'Experiment', position: 'insideBottom', offset: -60 }}
                />
                <YAxis 
                  label={{ value: 'Value', angle: -90, position: 'insideLeft', offset: -35 }}
                  tickMargin={10}
                />
                <Tooltip 
                  formatter={(value, name) => [value.toFixed(6), name === 'variance' ? 'Variance' : 'Std Deviation']}
                  labelFormatter={(label, data) => data[0]?.payload?.fullName || label}
                />
                <Legend verticalAlign="top" height={40} />
                <Bar dataKey="variance" name="Variance" fill="#8884d8" />
                <Bar dataKey="stdDev" name="Standard Deviation" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple logo component
function AppLogo() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="40" fill="#f5f5f5" />
      <polygon points="50,30 65,37.5 65,62.5 50,70 35,62.5 35,37.5" fill="#4e54c8" stroke="#36389c" strokeWidth="1" />
    </svg>
  );
}

// Input Number component with label
function NumberInput({ value, onChange, min = 0, max = 1, step = 0.01, label, color }) {
  return (
    <div className="w-full mb-4">
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-medium" style={{ color }}>{label}</label>
      </div>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const newValue = Math.max(min, Math.min(max, parseFloat(e.target.value) || min));
          onChange(newValue);
        }}
        className="w-full p-2 border rounded-md"
        style={{ borderColor: color }}
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

  // Always generate complete theoretical points (from 0 to 1)
  const ampData = [];
  const fvData = [];

  // Generate complete theoretical curves regardless of experimental data
  for (let p = 0; p <= 1; p += 0.02) {
    ampData.push({ 
      p, 
      discrepancy: 1 - p 
    });
    fvData.push({ 
      p, 
      discrepancy: Math.pow(1 - p, 2) + Math.pow(p, 2) 
    });
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
            <Line data={ampData} type="monotone" dataKey="discrepancy" name="AMP Algorithm" stroke="#2ecc71" strokeWidth={2} dot={false} connectNulls />
          )}
          {showFV && (
            <Line data={fvData} type="monotone" dataKey="discrepancy" name="FV Algorithm" stroke="#e74c3c" strokeWidth={2} dot={false} connectNulls />
          )}
          {showExperimental && validExperimentalData.length > 0 && (
            <Line data={validExperimentalData} type="monotone" dataKey="discrepancy" name="Experimental Curve" stroke="purple" strokeWidth={2} dot={{ r: 3, stroke: "purple", fill: "white" }} connectNulls />
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

// Improved modal for saving experiments
function SaveExperimentModal({ showSaveModal, setShowSaveModal, experimentMetadata, setExperimentMetadata, currentExperimentToSave, setSavedExperiments, addLog }) {
  if (!showSaveModal) return null;
  
  const handleClose = () => {
    setShowSaveModal(false);
    setExperimentMetadata({ name: '', tags: '', description: '' });
  };
  
  const handleSave = () => {
    if (!experimentMetadata.name.trim()) {
      addLog("Please provide a name for the experiment", "warning");
      return;
    }
    
    try {
      // Add categories automatically based on values
      let autoCategories = [];
      
      if (currentExperimentToSave?.parameters?.algorithm === "AMP") {
        autoCategories.push("AMP");
      } else if (currentExperimentToSave?.parameters?.algorithm === "FV") {
        autoCategories.push("FV");
      } else if (currentExperimentToSave?.parameters?.algorithm === "auto") {
        autoCategories.push("AUTO");
      }
      
      // Analyze probability ranges
      if (currentExperimentToSave?.type === 'range') {
        if (currentExperimentToSave.parameters.minP < 0.3) autoCategories.push("low-p");
        if (currentExperimentToSave.parameters.maxP > 0.7) autoCategories.push("high-p");
        if (currentExperimentToSave.parameters.minP < 0.5 && currentExperimentToSave.parameters.maxP > 0.5) {
          autoCategories.push("crossover");
        }
      }
      
      // Consider process count
      if (currentExperimentToSave?.parameters?.processCount === 3) {
        autoCategories.push("3-processes");
      } else {
        autoCategories.push("2-processes");
      }
      
      // Get user tags and add automatic ones
      const userTags = experimentMetadata.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag);
      
      // Combine avoiding duplicates
      const allTags = [...new Set([...userTags, ...autoCategories])];
      
      const experiment = {
        ...currentExperimentToSave,
        metadata: {
          ...experimentMetadata,
          id: Date.now().toString(),
          createdAt: new Date().toISOString(),
          tags: allTags,
          autoGenerated: autoCategories
        }
      };
      
      setSavedExperiments(prev => [...prev, experiment]);
      addLog(`Experiment "${experimentMetadata.name}" saved successfully`, "success");
      handleClose();
    } catch (error) {
      addLog(`Error saving experiment: ${error.message}`, "error");
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Save Experiment</h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Experiment Name*</label>
          <input
            type="text"
            value={experimentMetadata.name}
            onChange={(e) => setExperimentMetadata(prev => ({ ...prev, name: e.target.value }))}
            className="w-full p-2 border rounded-md"
            placeholder="Give a descriptive name"
            required
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Tags</label>
          <input
            type="text"
            value={experimentMetadata.tags}
            onChange={(e) => setExperimentMetadata(prev => ({ ...prev, tags: e.target.value }))}
            className="w-full p-2 border rounded-md"
            placeholder="Tags (comma separated)"
          />
          <p className="text-xs text-gray-500 mt-1">E.g., AMP, high-probability, p=0.8</p>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={experimentMetadata.description}
            onChange={(e) => setExperimentMetadata(prev => ({ ...prev, description: e.target.value }))}
            className="w-full p-2 border rounded-md h-24"
            placeholder="Describe the purpose of this experiment"
          />
        </div>
        
        <div className="bg-gray-50 p-3 rounded-lg mb-4">
          <h4 className="text-sm font-semibold mb-2">Experiment Details</h4>
          <div className="text-xs space-y-1">
            <p><span className="font-medium">Type:</span> {currentExperimentToSave?.type === 'single' ? 'Single Experiment' : 'Range Experiment'}</p>
            <p><span className="font-medium">Processes:</span> {currentExperimentToSave?.parameters?.processCount}</p>
            <p><span className="font-medium">Probability:</span> {
              currentExperimentToSave?.type === 'single' 
                ? currentExperimentToSave?.parameters?.probability.toFixed(2) 
                : `${currentExperimentToSave?.parameters?.minP.toFixed(2)} to ${currentExperimentToSave?.parameters?.maxP.toFixed(2)}`
            }</p>
            <p><span className="font-medium">Algorithm:</span> {
              currentExperimentToSave?.parameters?.algorithm
            }</p>
            {currentExperimentToSave?.parameters?.fvMethod && (
              <p><span className="font-medium">FV Method:</span> {currentExperimentToSave?.parameters?.fvMethod}</p>
            )}
            <p><span className="font-medium">Data points:</span> {
              currentExperimentToSave?.type === 'range' ? 
                currentExperimentToSave?.results?.length : 
                '1'
            }</p>
          </div>
          
          <div className="mt-3 text-xs text-blue-600">
            <p>Tags will be automatically added based on the experiment.</p>
          </div>
        </div>
        
        <div className="flex justify-end space-x-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 border rounded-md hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Save Experiment
          </button>
        </div>
      </div>
    </div>
  );
}

// Main component
function CompleteDistributedComputingSimulator() {
  // Configuration states
  const [processCount, setProcessCount] = useState(2);
  const [aliceValue, setAliceValue] = useState(0.00);
  const [bobValue, setBobValue] = useState(1.00);
  const [charlieValue, setCharlieValue] = useState(0.50);
  const [probability, setProbability] = useState(0.70);
  const [algorithm, setAlgorithm] = useState("auto");
  const [fvMethod, setFvMethod] = useState("average");
  const [meetingPoint, setMeetingPoint] = useState(1);
  const [rounds, setRounds] = useState(1);
  const [repetitions, setRepetitions] = useState(50);

  // Range experiments states
  const [rangeExperiments, setRangeExperiments] = useState({
    minP: 0.0,
    maxP: 1.0,
    steps: 51,
    customSteps: false,
    customStepValue: 51
  });

  // States for saved experiments and modal
  const [savedExperiments, setSavedExperiments] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [currentExperimentToSave, setCurrentExperimentToSave] = useState(null);
  const [experimentMetadata, setExperimentMetadata] = useState({
    name: '',
    tags: '',
    description: ''
  });
  const [selectedExperiments, setSelectedExperiments] = useState([]);
  const [comparisonView, setComparisonView] = useState('chart'); // 'chart', 'table', 'details'
  const [forcedAlgorithm, setForcedAlgorithm] = useState("auto");

  // Visualization states
  const [experimentData, setExperimentData] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [currentAnimation, setCurrentAnimation] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState('theory');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentRepetition, setCurrentRepetition] = useState(0);
  const [logs, setLogs] = useState(["Welcome to the simulator. Configure the parameters and click 'Start Simulation'."]);
  const [showLogs, setShowLogs] = useState(true);
  const [experimentalResults, setExperimentalResults] = useState([]);
  const [rangeDisplayCurves, setRangeDisplayCurves] = useState({
    experimental: true,
    theoreticalAmp: true,
    theoreticalFv: true
  });
  const [comparisonResults, setComparisonResults] = useState(null);
  const animationTimerRef = useRef(null);

// Helper functions
function addLog(message, type = "info") {
  const timestamp = new Date().toLocaleTimeString();
  let prefix = "";
  
  switch (type) {
    case "error":
      prefix = "❌ ERROR: ";
      break;
    case "warning":
      prefix = "⚠️ WARNING: ";
      break;
    case "success":
      prefix = "✅ SUCCESS: ";
      break;
    default:
      prefix = "ℹ️ INFO: ";
  }
  
  const formattedMessage = `[${timestamp}] ${prefix}${message}`;
  setLogs(prevLogs => [...prevLogs, formattedMessage]);
}

function getOptimalAlgorithm(p) {
  return p > 0.5 ? "AMP" : "FV";
}

function getDisplayAlgorithm(alg, p) {
  return alg === "auto" ? getOptimalAlgorithm(p) : alg;
}

// Get initial values for processes
function getInitialValues() {
  if (processCount === 2) {
    return [aliceValue, bobValue];
  } else {
    return [aliceValue, bobValue, charlieValue];
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
  const { minP, maxP, steps, customSteps, customStepValue } = rangeExperiments;
  const actualMeetingPoint = meetingPoint;
  const actualRounds = rounds;
  const actualRepetitions = repetitions;
  const actualSteps = customSteps ? customStepValue : steps;
  
  // Log the start of the experiment
  addLog(`Starting simulation with ${processCount} processes`);
  addLog(`Values: [${initialProcessValues.map(v => v.toFixed(2)).join(", ")}], Rounds: ${actualRounds}, Repetitions: ${actualRepetitions}, Steps: ${actualSteps}`);
  
  // Generate probability points to test
  const stepSize = (maxP - minP) / (Math.max(actualSteps - 1, 1));
  const allProbabilities = [];
  for (let i = 0; i < actualSteps; i++) {
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
      addLog(`Simulation completed with ${results.length} data points x ${actualRepetitions} repetitions`, "success");
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
    addLog("FV method comparison is only available with 3 processes selected", "warning");
    return;
  }
  
  setIsRunning(true);
  addLog("Comparing different FV methods...");
  
  const initialValues = getInitialValues();
  const p = probability;
  const methods = ["average", "median", "weighted", "accelerated", "first"];
  let results = [];
  
  // Process methods one by one
  let currentMethod = 0;
  
  function processNextMethod() {
    if (currentMethod >= methods.length) {
      // All methods processed
      setComparisonResults(results);
      addLog("FV method comparison completed", "success");
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

// Functions for saving experiments
function prepareRangeExperiment() {
  if (!experimentalResults || experimentalResults.length === 0) {
    addLog("No range experiment data available to save", "warning");
    return;
  }
  
  try {
    // Prepare data to save
    const experimentData = {
      type: "range",
      timestamp: new Date().toISOString(),
      parameters: {
        processCount,
        initialValues: getInitialValues(),
        minP: rangeExperiments.minP,
        maxP: rangeExperiments.maxP,
        steps: rangeExperiments.steps,
        algorithm: forcedAlgorithm,
        fvMethod: processCount === 3 ? fvMethod : null,
        meetingPoint,
        rounds,
        repetitions
      },
      results: experimentalResults.map(result => ({
        p: result.p,
        algorithm: result.algorithm,
        discrepancy: result.discrepancy,
        theoretical: result.theoretical,
        samples: result.samples
      }))
    };
    
    // Prepare to save
    setCurrentExperimentToSave(experimentData);
    setShowSaveModal(true);
    
    // Suggest a default name
    const defaultName = `Range P=${rangeExperiments.minP.toFixed(2)}-${rangeExperiments.maxP.toFixed(2)} ${forcedAlgorithm}`;
    setExperimentMetadata({
      name: defaultName,
      tags: `range,${forcedAlgorithm},${processCount}-processes`,
      description: `Simulation with range  from p=${rangeExperiments.minP.toFixed(2)} to p=${rangeExperiments.maxP.toFixed(2)} with ${rangeExperiments.steps} points`
    });
  } catch (error) {
    addLog(`Error preparing simulation: ${error.message}`, "error");
  }
}

return (
  <div className="bg-gray-100 p-4 rounded-lg">
    {/* Save Experiment Modal */}
    <SaveExperimentModal 
      showSaveModal={showSaveModal}
      setShowSaveModal={setShowSaveModal}
      experimentMetadata={experimentMetadata}
      setExperimentMetadata={setExperimentMetadata}
      currentExperimentToSave={currentExperimentToSave}
      setSavedExperiments={setSavedExperiments}
      addLog={addLog}
    />
    
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
        <div className="lg:w-1/4">
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
              <h3 className="text-sm font-semibold mb-2 pb-1 border-b">Initial Values & Probability</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium" style={{ color: ALICE_COLOR }}>Alice</label>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={aliceValue}
                    onChange={(e) => {
                      const value = Math.max(0, Math.min(1, parseFloat(e.target.value) || 0));
                      setAliceValue(value);
                    }}
                    className="w-full p-1 text-sm border rounded-md"
                    style={{ borderColor: ALICE_COLOR }}
                  />
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium" style={{ color: BOB_COLOR }}>Bob</label>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={bobValue}
                    onChange={(e) => {
                      const value = Math.max(0, Math.min(1, parseFloat(e.target.value) || 0));
                      setBobValue(value);
                    }}
                    className="w-full p-1 text-sm border rounded-md"
                    style={{ borderColor: BOB_COLOR }}
                  />
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium" style={{ color: "#9b59b6" }}>Probability (p)</label>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={probability}
                    onChange={(e) => {
                      const value = Math.max(0, Math.min(1, parseFloat(e.target.value) || 0));
                      setProbability(value);
                    }}
                    className="w-full p-1 text-sm border rounded-md"
                    style={{ borderColor: "#9b59b6" }}
                  />
                </div>
              </div>
              
              {processCount === 3 && (
                <div className="mt-3">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium" style={{ color: CHARLIE_COLOR }}>Charlie (0.00-2.00)</label>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.01"
                    value={charlieValue}
                    onChange={(e) => {
                      const value = Math.max(0, Math.min(2, parseFloat(e.target.value) || 0));
                      setCharlieValue(value);
                    }}
                    className="w-full p-1 text-sm border rounded-md"
                    style={{ borderColor: CHARLIE_COLOR }}
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Min: 0.00</span>
                    <span>Max: 2.00</span>
                  </div>
                </div>
              )}
            </div>
            <div className="mb-4">
              <h4 className="text-xs font-semibold mb-1">Algorithm Settings:</h4>
                <div className="mb-3">
                <label className="block text-xs mb-1">Select algorithm:</label>
                  <select
                    value={forcedAlgorithm}
                    onChange={(e) => {
                      setForcedAlgorithm(e.target.value);
                      handleCurveDisplayChange('algorithmChange');
                    }}
                    className="w-full p-1 text-sm border border-gray-300 rounded-md"
                    disabled={isRunning}
                  >
                    <option value="auto">Optimized based on probability</option>
                    <option value="AMP">Use only AMP Algorithm</option>
                    <option value="FV">Use only Algorithm</option>
                  </select>
                </div>
                
                <div className="grid grid-cols-1 mb-3">
                  {(forcedAlgorithm === "FV" || forcedAlgorithm === "auto") && processCount === 3 && (
                    <div>
                      <label className="block text-xs mb-1">FV Method (3-process):</label>
                      <select
                        value={fvMethod}
                        onChange={(e) => setFvMethod(e.target.value)}
                        className="w-full p-1 text-sm border border-gray-300 rounded-md"
                        disabled={isRunning}
                      >
                        <option value="average">Average of received values</option>
                        <option value="median">Median (with own value)</option>
                        <option value="weighted">Probability-weighted blend</option>
                        <option value="accelerated">Accelerated convergence</option>
                        <option value="first">First received value</option>
                      </select>
                    </div>
                  )}
                </div>
                
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
                  For p = {probability.toFixed(2)}, the optimal algorithm is {getOptimalAlgorithm(probability)}
                </p>
              </div>
              
              <div className="mb-4">
                <h3 className="text-sm font-semibold mb-2 pb-1 border-b">Simulation Configuration</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-xs block mb-1">Rounds:</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="50" 
                      value={rounds} 
                      onChange={(e) => setRounds(Number(e.target.value))} 
                      className="w-full p-1 text-sm border border-gray-300 rounded-md" 
                    />
                  </div>
                  <div>
                    <label className="text-xs block mb-1">Repetitions:</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="1000" 
                      value={repetitions} 
                      onChange={(e) => setRepetitions(Number(e.target.value))} 
                      className="w-full p-1 text-sm border border-gray-300 rounded-md" 
                    />
                  </div>
                </div>
                
                <h4 className="text-xs font-semibold mb-1">Probability Range Settings:</h4>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <label className="block text-xs mb-1">Min Probability:</label>
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
                      className="w-full p-1 text-sm border border-gray-300 rounded-md"
                      disabled={isRunning}
                    />
                  </div>

                  <div>
                    <label className="block text-xs mb-1">Max Probability:</label>
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
                      className="w-full p-1 text-sm border border-gray-300 rounded-md"
                      disabled={isRunning}
                    />
                  </div>

              <div>
                  <label className="block text-xs mb-1">Steps:</label>
                  <div className="grid grid-cols-2 gap-1">
                    <select
                      value={rangeExperiments.customSteps ? "custom" : rangeExperiments.steps.toString()}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "custom") {
                          setRangeExperiments((prev) => ({ 
                            ...prev, 
                            customSteps: true,
                          }));
                        } else {
                          setRangeExperiments((prev) => ({ 
                            ...prev, 
                            steps: parseInt(value), 
                            customSteps: false 
                          }));
                        }
                      }}
                      className="w-full p-1 text-sm border border-gray-300 rounded-md"
                      disabled={isRunning}
                    >
                      <option value="51">Default</option>
                      <option value="3">3 points</option>
                      <option value="5">5 points</option>
                      <option value="10">10 points</option>
                      <option value="15">15 points</option>
                      <option value="25">25 points</option>
                      <option value="custom">Custom</option>
                    </select>
                    
                    {rangeExperiments.customSteps && (
                      <input
                        type="number"
                        min="2"
                        max="100"
                        value={rangeExperiments.customStepValue}
                        onChange={(e) => {
                          const value = Math.max(2, Math.min(100, parseInt(e.target.value) || 2));
                          setRangeExperiments((prev) => ({ 
                            ...prev, 
                            customStepValue: value,
                            steps: value
                          }));
                        }}
                        className="w-full p-1 text-sm border border-gray-300 rounded-md"
                        disabled={isRunning}
                      />
                    )}
                  </div>
                </div>
              </div>
              
              
              <h4 className="text-xs font-semibold mb-1">Display Options:</h4>
              <div className="grid grid-cols-1 gap-1 mb-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="showExperimental"
                    checked={rangeDisplayCurves.experimental}
                    onChange={() => handleCurveDisplayChange('experimental')}
                    className="mr-2"
                    disabled={isRunning}
                  />
                  <label htmlFor="showExperimental" className="text-xs">Show Experimental Curve</label>
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
                  <label htmlFor="showTheoreticalAmp" className="text-xs">Show AMP Curve (1-p)</label>
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
                  <label htmlFor="showTheoreticalFv" className="text-xs">Show FV Curve ((1-p)² + p²)</label>
                </div>
              </div>
            </div>
            
            {activeTab === 'theory' && (
              <button
                onClick={runRangeExperiments}
                disabled={isRunning}
                className={`w-full py-3 px-4 rounded-md font-semibold text-white ${isRunning ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}
              >
                {isRunning ? 'Running...' : 'Run'}
              </button>
            )}
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold">Event Log</h3>
              <button 
                onClick={() => setShowLogs(!showLogs)} 
                className="text-xs bg-gray-100 hover:bg-gray-200 py-1 px-2 rounded"
              >
                {showLogs ? 'Hide' : 'Show'} Log
              </button>
            </div>
            
            {showLogs && (
              <div className="h-40 overflow-y-auto bg-gray-50 p-2 rounded text-xs font-mono">
                {logs.map((log, index) => {
                  // Determine log type for styling
                  const isError = log.includes("ERROR");
                  const isWarning = log.includes("WARNING");
                  const isSuccess = log.includes("SUCCESS");
                  
                  let logStyle = "text-gray-700"; // default
                  if (isError) logStyle = "text-red-600 font-semibold";
                  if (isWarning) logStyle = "text-orange-600";
                  if (isSuccess) logStyle = "text-green-600";
                  
                  return (
                    <div key={index} className={`whitespace-pre-wrap mb-1 ${logStyle}`}>
                      {log}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        {/* Main Content Area */}
        <div className="lg:flex-1">
          <div className="border-b border-gray-200 mb-4">
            <nav className="flex">
              <button 
                onClick={() => setActiveTab('theory')}
                className={`px-4 py-2 font-medium text-sm ${activeTab === 'theory' ? 'border-b-2 border-green-500 text-green-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                🔍 Theoretical Comparison
              </button>
              <button 
                onClick={() => setActiveTab('statistics')}
                className={`px-4 py-2 font-medium text-sm ${activeTab === 'statistics' ? 'border-b-2 border-green-500 text-green-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                📈 Statistical Analysis
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

          {/* Theoretical Comparison tab */}
          {activeTab === 'theory' && (
          <div>
            <div className="mb-4">
              <TheoryPlot 
                currentP={probability} 
                experimentalData={experimentalResults} 
                displayCurves={rangeDisplayCurves} 
              />
            </div>
            
            <div className="bg-white rounded-lg shadow p-4 mb-4">
              <h3 className="text-lg font-semibold mb-4">Simulation Experiments</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="col-span-1 md:col-span-2">
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
                </div>
              </div>

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
                      💾 Save Experiment
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
                <li>The current probability p = {probability.toFixed(2)} suggests that <strong>{getOptimalAlgorithm(probability)}</strong> is the optimal algorithm.</li>
              </ul>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-semibold mb-2">Mathematical formulas:</h4>
                <p>For FV algorithm: Discrepancy = (1-p)² + p²</p>
                <p>For AMP algorithm: Discrepancy = 1-p</p>
              </div>
            </div>
          </div>
        )}
        {/* Statistical Analysis tab */}
        {activeTab === 'statistics' && (
            <div>
              {experimentalResults && experimentalResults.length > 0 ? (
                <div>
                  <div className="bg-white rounded-lg shadow p-4 mb-4">
                    <h3 className="text-lg font-semibold mb-3">Simulation Results</h3>
                    
                    <div className="bg-gray-50 p-3 rounded-lg border text-sm mb-4">
                      <p className="font-medium">Experiment Parameters:</p>
                      <ul className="mt-1 space-y-1">
                        <li>Processes: {processCount} ({processCount === 2 ? "Alice, Bob" : "Alice, Bob, Charlie"})</li>
                        <li>Probability Range: {rangeExperiments.minP.toFixed(2)} to {rangeExperiments.maxP.toFixed(2)}</li>
                        <li>Algorithm: {forcedAlgorithm === "auto" ? "Optimized based on p" : forcedAlgorithm}</li>
                        {processCount === 3 && forcedAlgorithm !== "AMP" && (
                          <li>FV Method: {fvMethod}</li>
                        )}
                        <li>Data Points: {experimentalResults.length}</li>
                        <li>Repetitions per point: {repetitions}</li>
                      </ul>
                    </div>
                    
                    <div className="mb-6">
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
                    
                    {/* Accuracy Graph */}
                    <div className="mb-6">
                      <h4 className="font-medium mb-3 text-gray-700">Accuracy Analysis</h4>
                      <div className="bg-white border rounded-lg p-4">
                        {processCount === 2 ? (
                          <ResponsiveContainer width="100%" height={300}>
                            <LineChart 
                              data={experimentalResults.map(result => ({
                                p: result.p,
                                accuracy: result.theoretical && result.discrepancy ? 
                                  (1 - Math.abs(result.theoretical - result.discrepancy) / result.theoretical) * 100 : 
                                  null
                              }))}
                              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="p" label={{ value: 'Probability (p)', position: 'insideBottom', offset: -5 }} />
                              <YAxis domain={[0, 100]} label={{ value: 'Accuracy (%)', angle: -90, position: 'insideLeft' }} />
                              <Tooltip formatter={(value) => value !== null ? `${value.toFixed(2)}%` : 'N/A'} />
                              <Legend />
                              <Line type="monotone" dataKey="accuracy" name="Accuracy %" stroke="#2ecc71" strokeWidth={2} />
                              <ReferenceLine y={95} stroke="red" strokeDasharray="3 3" label={{ value: '95% Accuracy', position: 'right' }} />
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="text-center p-4 text-gray-500">
                            Accuracy analysis is only available for 2-process experiments where theoretical predictions exist.
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Error by Repetitions */}
                    <div className="mb-4">
                      <h4 className="font-medium mb-3 text-gray-700">Error Reduction with Repetitions</h4>
                      <div className="bg-white border rounded-lg p-4">
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart
                            data={[...Array(repetitions)].map((_, i) => {
                              // Calculate average error after i+1 repetitions
                              const avgError = experimentalResults.reduce((sum, result) => {
                                if (!result.discrepancies || !result.theoretical) return sum;
                                // Take first i+1 discrepancies
                                const samplesUsed = Math.min(i+1, result.discrepancies.length);
                                if (samplesUsed === 0) return sum;
                                
                                // Calculate average of those discrepancies
                                const avgDisc = result.discrepancies.slice(0, samplesUsed).reduce((a, b) => a + b, 0) / samplesUsed;
                                // Calculate error
                                const error = Math.abs(result.theoretical - avgDisc);
                                return sum + error;
                              }, 0) / experimentalResults.length;
                              
                              return {
                                repetitions: i+1,
                                error: avgError
                              };
                            })}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="repetitions" label={{ value: 'Repetitions', position: 'insideBottom', offset: -5 }} />
                            <YAxis label={{ value: 'Average Error', angle: -90, position: 'insideLeft' }} />
                            <Tooltip formatter={(value) => value.toFixed(4)} />
                            <Legend />
                            <Line type="monotone" dataKey="error" name="Avg. Error" stroke="#e74c3c" strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    
                    <div className="mt-6 text-center">
                      <button
                        onClick={prepareRangeExperiment}
                        className="px-4 py-2 bg-green-600 text-white rounded shadow hover:bg-green-700 transition-colors"
                      >
                        💾 Save Range Experiment Results
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
                  <p className="mb-4">Run a simulation first to see statistical analysis.</p>
                  <button 
                    onClick={() => setActiveTab('theory')}
                    className="px-4 py-2 bg-blue-600 text-white rounded"
                  >
                    Go to Theoretical Comparison
                  </button>
                </div>
              )}
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
                    Using current settings: p={probability.toFixed(2)}, {rounds} rounds, {repetitions} repetitions, {processCount} processes
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
                <h3 className="text-lg font-semibold mb-2">Saved Experiments</h3>
                <p className="text-sm text-gray-600 mb-4">Save and compare your experiments to analyze different parameters and algorithms.</p>
                
                {savedExperiments.length === 0 ? (
                  <div className="bg-blue-50 p-6 rounded-lg mb-4 text-center">
                    <div className="flex justify-center mb-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h4 className="font-semibold text-lg mb-2">No Experiments Saved Yet</h4>
                    <p className="text-gray-600 mb-3">Run simulations and save them to analyze and compare results.</p>
                    <div className="flex flex-col sm:flex-row gap-2 justify-center">
                      <button
                        onClick={() => setActiveTab('theory')}
                        className="px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition-colors"
                      >
                        Run Simulation
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-4 border-b pb-2">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium">Available Experiments</h4>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setComparisonView('chart')}
                            className={`px-3 py-1 rounded-md text-sm ${comparisonView === 'chart' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}
                          >
                            Chart View
                          </button>
                          <button
                            onClick={() => setComparisonView('details')}
                            className={`px-3 py-1 rounded-md text-sm ${comparisonView === 'details' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}
                          >
                            Details
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg border mb-6">
                      <h4 className="font-medium mb-3 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Range Experiments ({savedExperiments.length})
                      </h4>
                      <div className="max-h-64 overflow-y-auto">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {savedExperiments.map(exp => (
                            <div 
                              key={exp.metadata.id} 
                              className={`flex items-center justify-between bg-white p-3 rounded border ${
                                selectedExperiments.includes(exp.metadata.id) ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
                              } cursor-pointer hover:bg-blue-50 transition-colors`}
                              onClick={() => {
                                if (selectedExperiments.includes(exp.metadata.id)) {
                                  setSelectedExperiments(prev => prev.filter(id => id !== exp.metadata.id));
                                } else {
                                  setSelectedExperiments(prev => [...prev, exp.metadata.id]);
                                }
                              }}
                            >
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  id={`exp-${exp.metadata.id}`}
                                  checked={selectedExperiments.includes(exp.metadata.id)}
                                  onChange={(e) => e.stopPropagation()}
                                  className="mr-2"
                                />
                                <div>
                                  <label htmlFor={`exp-${exp.metadata.id}`} className="text-sm font-medium block">
                                    {exp.metadata.name}
                                  </label>
                                  <div className="flex mt-1 space-x-1">
                                    {exp.metadata.tags && exp.metadata.tags.length > 0 && exp.metadata.tags.slice(0, 2).map((tag, i) => (
                                      <span key={i} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                        {tag}
                                      </span>
                                    ))}
                                    {exp.metadata.tags && exp.metadata.tags.length > 2 && (
                                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                        +{exp.metadata.tags.length - 2}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded mb-1">
                                  {exp.parameters.minP.toFixed(2)}-{exp.parameters.maxP.toFixed(2)}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {new Date(exp.metadata.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {selectedExperiments.length === 0 ? (
                      <div className="bg-yellow-50 p-4 rounded-lg mb-4 text-center">
                        <p className="text-yellow-700">Select experiments to compare them</p>
                      </div>
                    ) : (
                      <div className="mb-4">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-medium">Comparison ({selectedExperiments.length} selected)</h4>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => setSelectedExperiments([])}
                              className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300"
                            >
                              Clear Selection
                            </button>
                          </div>
                        </div>
                        
                        {(() => {
                          const selectedExps = savedExperiments.filter(exp => 
                            selectedExperiments.includes(exp.metadata.id)
                          );
                          
                          if (selectedExps.length === 0) return null;
                          
                          if (comparisonView === 'chart') {
                            return <ExperimentComparison experiments={selectedExps} />;
                          } else if (comparisonView === 'details') {
                            return <AdvancedComparisonView experiments={selectedExps} />;
                          }
                        })()}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Resto del contenido de esta pestaña */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="text-lg font-semibold mb-3">Quick Analysis Guide</h3>
                  <div className="space-y-2 text-sm">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <h4 className="font-medium mb-1 text-blue-700">1. Run Experiments</h4>
                      <p>Run range experiments with different parameters to generate data.</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <h4 className="font-medium mb-1 text-blue-700">2. Save Experiments</h4>
                      <p>Save your experiments with meaningful names, tags, and descriptions for easy reference.</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <h4 className="font-medium mb-1 text-blue-700">3. Compare Results</h4>
                      <p>Select multiple experiments to visually compare their performance.</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="text-lg font-semibold mb-3">Analysis Tips</h3>
                  <ul className="list-disc pl-5 space-y-2 text-sm">
                    <li><span className="font-medium">Compare algorithms:</span> Run experiments with different algorithms using the same probability.</li>
                    <li><span className="font-medium">Study convergence:</span> Analyze how different process counts affect convergence rates.</li>
                    <li><span className="font-medium">Test FV methods:</span> For 3-process systems, compare the performance of different FV methods.</li>
                    <li><span className="font-medium">Validate theory:</span> Check how experimental results align with theoretical predictions across probability ranges.</li>
                  </ul>
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
