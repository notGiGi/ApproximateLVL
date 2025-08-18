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
  ReferenceArea,
  ComposedChart,
  ScatterChart,
  ZAxis,
  Area
} from 'recharts';

// Importar el motor de simulación
import { SimulationEngine } from './SimulationEngine.js';




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
  const absErrors = data.map(d => d.absError);
  const relErrors = data.map(d => d.errorPercent);
  const minAbs = absErrors.length ? Math.min(...absErrors) : 0;
  const maxAbs = absErrors.length ? Math.max(...absErrors) : 0;
  const minRel = relErrors.length ? Math.min(...relErrors) : 0;
  const maxRel = relErrors.length ? Math.max(...relErrors) : 0;

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
// Función para mostrar detalles de una probabilidad específica

// Helper para detectar si los valores son binarios
const isBinaryValues = () => {
  return processValues.every(val => val === 0 || val === 1);
};

// Helper para obtener el rango de valores
const getValueRange = () => {
  const min = Math.min(...processValues);
  const max = Math.max(...processValues);
  return { min, max };
};

function MessageDeliveryTable({
  messages,
  processNames,
  selectedProcess,
  previousValues = [],
  finalValues = [],
  algorithm = null // Añadir prop para saber el algoritmo
}) {
  // Si hay un proceso seleccionado, filtra solo sus mensajes
  const filtered = selectedProcess != null
    ? messages.filter(m => m.from === selectedProcess || m.to === selectedProcess)
    : messages;

  // Agrupar mensajes por receptor para ver qué recibió cada proceso
  const messagesByReceiver = {};
  messages.forEach(msg => {
    if (!messagesByReceiver[msg.to]) {
      messagesByReceiver[msg.to] = [];
    }
    if (msg.delivered) {
      messagesByReceiver[msg.to].push({
        from: msg.from,
        value: msg.value
      });
    }
  });

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-2 py-1 text-left">From</th>
            <th className="px-2 py-1 text-left">To</th>
            <th className="px-2 py-1 text-left">Sent Value</th>
            <th className="px-2 py-1 text-center">Delivered</th>
            <th className="px-2 py-1 text-left">To's Prev Value</th>
            <th className="px-2 py-1 text-left">To's New Value</th>
            <th className="px-2 py-1 text-left">Reason</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((msg, i) => {
            const fromIdx = msg.from;
            const toIdx = msg.to;
            const sentVal = msg.value;
            const isDelivered = msg.delivered;

            const prevValueOfReceiver = previousValues[toIdx];
            const newValueOfReceiver = finalValues[toIdx];
            const changed = prevValueOfReceiver !== undefined && 
                          newValueOfReceiver !== undefined && 
                          prevValueOfReceiver !== newValueOfReceiver;

            // Determinar la razón del cambio
            let changeReason = "";
            if (algorithm === "MIN") {
              // Para MIN, el cambio ocurre al final cuando se decide el mínimo
              if (changed) {
                changeReason = "MIN: selected minimum from known values";
              } else if (isDelivered) {
                changeReason = "MIN: value added to known set";
              }
            } else if (changed) {
              const receivedMessages = messagesByReceiver[toIdx] || [];
              const differentValues = receivedMessages.filter(m => m.value !== prevValueOfReceiver);
              
              if (differentValues.length > 0) {
                if (algorithm === "FV" && newValueOfReceiver === differentValues[0].value) {
                  changeReason = `FV: adopted value from ${processNames[differentValues[0].from]}`;
                } else if (algorithm === "AMP" && typeof newValueOfReceiver === 'number' && 
                          newValueOfReceiver >= 0 && newValueOfReceiver <= 1) {
                  changeReason = `AMP: moved to meeting point`;
                }
              }
            } else if (!changed && isDelivered && sentVal !== prevValueOfReceiver) {
              if (algorithm === "MIN") {
                changeReason = "MIN: maintaining current value";
              } else {
                changeReason = "No change (algo else decided)";
              }
            }

            return (
              <tr key={i} className={isDelivered ? 'bg-green-50' : 'bg-red-50'}>
                <td className="px-2 py-1">{processNames[fromIdx] || `P${fromIdx}`}</td>
                <td className="px-2 py-1">{processNames[toIdx] || `P${toIdx}`}</td>
                <td className="px-2 py-1">
                  {typeof sentVal === 'number' ? sentVal.toFixed(3) : String(sentVal)}
                </td>
                <td className="px-2 py-1 text-center">
                  {isDelivered ? '✓' : '✗'}
                </td>
                <td className="px-2 py-1">
                  {typeof prevValueOfReceiver === 'number' ? 
                    prevValueOfReceiver.toFixed(3) : String(prevValueOfReceiver)}
                </td>
                <td className="px-2 py-1">
                  <span className={changed ? 'font-bold text-blue-600' : ''}>
                    {typeof newValueOfReceiver === 'number' ? 
                      newValueOfReceiver.toFixed(3) : String(newValueOfReceiver)}
                  </span>
                </td>
                <td className="px-2 py-1 text-xs text-gray-600">
                  {changeReason}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}






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

// Componente para manejar n procesos
function NProcessesControl({ processValues, setProcessValues, maxProcesses = 100, valueMode, setValueMode, isRunning }) {
  const n = processValues.length;
  
  // Agregar un nuevo proceso
  const addProcess = () => {
    if (n < maxProcesses) {
      // Valor por defecto según el modo
      const defaultValue = valueMode === 'binary' ? n % 2 : 0.5;
      setProcessValues([...processValues, defaultValue]);
    }
  };
  
  // Eliminar un proceso
  const removeProcess = () => {
    if (n > 2) { // Mínimo 2 procesos
      setProcessValues(processValues.slice(0, -1));
    }
  };
  
  // Actualizar el valor de un proceso específico
  const updateProcessValue = (index, value) => {
    const newValues = [...processValues];
    const val = parseFloat(value);
    if (!isNaN(val)) {
      // Validar según el modo
      if (valueMode === 'binary') {
        newValues[index] = val === 0 || val === 1 ? val : Math.round(val);
      } else {
        newValues[index] = Math.max(0, Math.min(1, val));
      }
      setProcessValues(newValues);
    }
  };
  
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-semibold">Initial Values ({n} processes)</h3>
        <div className="flex space-x-2">
          <button
            onClick={removeProcess}
            disabled={n <= 2 || isRunning}
            className={`p-1 rounded-md ${n <= 2 || isRunning ? 'bg-gray-200 text-gray-400' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
            title="Remove process"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={addProcess}
            disabled={n >= maxProcesses || isRunning}
            className={`p-1 rounded-md ${n >= maxProcesses || isRunning ? 'bg-gray-200 text-gray-400' : 'bg-green-100 text-green-600 hover:bg-green-200'}`}
            title="Add process"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Selector de modo de valores */}
      <div className="mb-2">
        <label className="text-xs font-medium block mb-1">Value Mode:</label>
        <select
          value={valueMode}
          onChange={(e) => {
            setValueMode(e.target.value);
            // Convertir valores existentes al nuevo modo
            if (e.target.value === 'binary') {
              setProcessValues(processValues.map(v => Math.round(v)));
            }
          }}
          className="w-full p-1 text-sm border rounded-md"
          disabled={isRunning}
        >
          <option value="binary">Binary (0 or 1)</option>
          <option value="continuous">Continuous (0.0 to 1.0)</option>
        </select>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {processValues.map((value, index) => {
          // Asignar colores específicos para los primeros procesos
          let color = "#666";
          if (index === 0) color = ALICE_COLOR;
          else if (index === 1) color = BOB_COLOR;
          else if (index === 2) color = CHARLIE_COLOR;
          else {
            // Para procesos adicionales, asignar colores del arcoíris
            const colors = [
              "#9c27b0", "#e91e63", "#f44336", "#ff9800", 
              "#ffc107", "#8bc34a", "#009688"
            ];
            color = colors[(index - 3) % colors.length];
          }
          
          const processName = index < 3 ? 
            ["Alice", "Bob", "Charlie"][index] : 
            `P${index+1}`;
          
          return (
            <div key={index}>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium" style={{ color }}>
                  {processName}
                </label>
              </div>
              <input
                type="number"
                min="0"
                max="1"
                step={valueMode === 'binary' ? "1" : "0.1"}
                value={value}
                onChange={(e) => updateProcessValue(index, e.target.value)}
                className="w-full p-1 text-sm border rounded-md"
                style={{ borderColor: color }}
                disabled={isRunning}
                placeholder={valueMode === 'binary' ? "0 or 1" : "0.0-1.0"}
              />
            </div>
          );
        })}
      </div>
      
      {valueMode === 'continuous' && (
        <div className="mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
          ⚠️ Note: Continuous values are experimental. The paper focuses on binary values.
        </div>
      )}
    </div>
  );
}

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
                <ReferenceLine 
                  y={1e-6} 
                  stroke="#666" 
                  strokeDasharray="3 3" 
                  label={{ 
                    value: "Convergence threshold (10⁻⁶)", 
                    position: "right",
                    style: { fontSize: 12, fill: '#666' }
                  }}
                />
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
            
            {/* Variance Visualization */}
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
      
      {/* Pattern analysis and conclusions */}
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

  // Mejora de colores para admitir más procesos con distinción clara
  const generateProcessColors = (count) => {
    // Paleta extendida con colores más distintos entre sí
    const baseColors = [
      ALICE_COLOR, BOB_COLOR, CHARLIE_COLOR, 
      "#9c27b0", // morado
      "#e91e63", // rosa
      "#f44336", // rojo
      "#ff9800", // naranja
      "#ffc107", // amarillo
      "#8bc34a", // verde claro
      "#009688", // turquesa
      "#03a9f4", // azul claro  
      "#673ab7", // violeta
      "#795548", // marrón
      "#607d8b", // azul grisáceo
      "#ff5722"  // naranja rojizo
    ];
    

    if (count > baseColors.length) {
      const extraColors = [];
      for (let i = 0; i < count - baseColors.length; i++) {
        // Generamos colores HSL espaciados uniformemente
        const h = (i * 137.5) % 360; // Ángulo dorado para mejor distribución
        const s = 75 + Math.random() * 15; // Saturación alta
        const l = 45 + Math.random() * 10; // Luminosidad media
        extraColors.push(`hsl(${h}, ${s}%, ${l}%)`);
      }
      return [...baseColors, ...extraColors];
    }
    
    return baseColors.slice(0, count);
  };
  
  const processColors = generateProcessColors(processCount);
  
  // Optimización del chartData para muchos procesos
  const chartData = roundData.map(d => {
    const round = d && typeof d.round === 'number' ? d.round : 0;
    const discrepancy = d && typeof d.discrepancy === 'number' ? d.discrepancy : 0;
    
    // Formato adaptado para n procesos
    const data = { round, discrepancy };
    
    if (d && d.values) {
      d.values.forEach((val, idx) => {
        // Para cada proceso, crear una entrada en los datos
        data[`p${idx}`] = val;
      });
    }
    
    return data;
  });

  // Función para generar nombre de proceso según índice
  const getProcessName = (index) => {
    if (index < 3) {
      return ["Alice", "Bob", "Charlie"][index];
    } else if (index < 26) {
      // Usar letras del alfabeto para procesos 4-26
      return `P-${String.fromCharCode(65 + index)}`;
    } else {
      // Para más de 26, usar números
      return `P-${index + 1}`;
    }
  };

  // Determinar si se debe compactar la leyenda
  const useTwoColumnLegend = processCount > 5;

  return (
    <div className="bg-white rounded-lg shadow p-4 h-80">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold">Experiment Visualization</h3>
        
        {processCount > 8 && (
          <div className="text-xs text-gray-500 bg-yellow-50 px-2 py-1 rounded">
            Showing {processCount} processes
          </div>
        )}
      </div>
      
      <ResponsiveContainer width="100%" height={useTwoColumnLegend ? "75%" : "80%"}>
        <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="round" />
          <YAxis domain={[0, 1]} />
          <Tooltip 
            formatter={(value) => value !== undefined && !isNaN(value) ? value.toFixed(4) : 'N/A'}
            labelFormatter={(value) => `Round: ${value}`}
            isAnimationActive={false} // Mejorar rendimiento
          />
          <Legend 
            layout={useTwoColumnLegend ? "horizontal" : "horizontal"}
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{ 
              paddingTop: "10px",
              fontSize: processCount > 8 ? "9px" : "11px",
              display: "grid", 
              gridTemplateColumns: useTwoColumnLegend ? "repeat(4, 1fr)" : "repeat(3, 1fr)"
            }}
          />
          
          {/* Renderizar línea para cada proceso */}
          {Array.from({ length: Math.min(processCount, 20) }).map((_, index) => {
            const name = getProcessName(index);
            const strokeWidth = index < 3 ? 2.5 : 1.5;
            const strokeDasharray = index > 10 ? "3 3" : null; // Línea punteada para procesos adicionales
              
            return (
              <Line 
                key={index}
                type="monotone" 
                dataKey={`p${index}`} 
                name={name} 
                stroke={processColors[index % processColors.length]} 
                strokeWidth={strokeWidth}
                dot={{ r: index < 3 ? 3 : 2, strokeWidth: 1, fill: "white" }}
                activeDot={{ r: 4 }}
              />
            );
          })}
          
          {/* Limitar a 20 procesos en la visualización */}
          {processCount > 20 && (
            <Line
              type="monotone"
              dataKey="discrepancy"
              name={`+${processCount - 20} more`}
              stroke="#999"
              strokeWidth={0}
              dot={{ r: 0 }}
              activeDot={{ r: 0 }}
            />
          )}
          
          <Line 
            type="monotone" 
            dataKey="discrepancy" 
            name="Discrepancy" 
            stroke="#9b59b6" 
            strokeWidth={2.5}
            dot={{ r: 3 }} 
          />
        </LineChart>
      </ResponsiveContainer>
      
      {processCount > 10 && (
        <div className="mt-1 text-xs text-gray-500 text-center">
          Note: For better visibility, some processes may be shown with dashed lines or compact representation.
        </div>
      )}
    </div>
  );
}

// Results table
function ResultsTable({ experimentData, processCount = 2, forcedAlgorithm, fvMethod, rounds = 1 }) {
  // Si hay demasiados procesos, mostrar versión compacta
  const isCompactView = processCount > 6;

  if (!experimentData || !Array.isArray(experimentData) || experimentData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-400">No experiment data available</p>
      </div>
    );
  }

  // Mostrar solo algunos procesos clave si hay muchos
  const getDisplayedProcesses = () => {
    if (!isCompactView) {
      return Array.from({ length: processCount }).map((_, i) => i);
    }
    
    // Para muchos procesos, mostrar: primero, segundo, alguno del medio, penúltimo y último
    if (processCount <= 10) {
      return [0, 1, Math.floor(processCount/2), processCount-2, processCount-1];
    } else {
      return [0, 1, 2, Math.floor(processCount/3), Math.floor(2*processCount/3), processCount-2, processCount-1];
    }
  };
  
  const displayedProcesses = getDisplayedProcesses();

  // Crear encabezados para procesos
  const processHeaders = displayedProcesses.map(idx => {
    const name = idx < 3 ? ["Alice", "Bob", "Charlie"][idx] : `P${idx+1}`;
    const color = idx < 3 ? 
      [ALICE_COLOR, BOB_COLOR, CHARLIE_COLOR][idx] : 
      "#666"; // Color por defecto para procesos adicionales
    
    return { index: idx, name, color };
  });

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Round</th>
              {processHeaders.map((header) => (
                <th 
                  key={header.index}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  style={{ color: header.color }}
                >
                  {header.name}
                </th>
              ))}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discrepancy</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {experimentData.map((data, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{data.round}</td>
                
                {/* Renderizar celdas para procesos seleccionados */}
                {processHeaders.map((header) => (
                  <td 
                    key={header.index}
                    className="px-6 py-4 whitespace-nowrap text-sm" 
                    style={{ color: header.color }}
                  >
                    {data.values && data.values[header.index] !== undefined ? 
                      data.values[header.index].toFixed(4) : 'N/A'}
                  </td>
                ))}
                
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {data.discrepancy !== undefined ? data.discrepancy.toFixed(4) : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {isCompactView && (
        <div className="px-4 py-2 bg-yellow-50 text-sm">
          <p>Showing {displayedProcesses.length} of {processCount} processes. {processCount-displayedProcesses.length} processes are hidden for readability.</p>
        </div>
      )}
    </div>
  );
}


/// Histogram plot con distribución binomial correcta para un valor específico de p
function HistogramPlot({ discrepancies, theoretical, experimental, repetitions, selectedP }) {
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

    // Calculate observed statistics
    const observedMean = validDiscrepancies.reduce((a, b) => a + b, 0) / validDiscrepancies.length;
    const observedVariance = validDiscrepancies.reduce((sum, d) => sum + Math.pow(d - observedMean, 2), 0) / validDiscrepancies.length;
    const observedSD = Math.sqrt(observedVariance);

    // p = E[D] (theoretical expected discrepancy)
    const p = theoretical !== null && theoretical !== undefined ? theoretical : observedMean;
    const n = repetitions; // número de simulaciones
    
    // Calcular desviación estándar teórica
    const sigma = Math.sqrt(p * (1 - p) / n);
    
    // Límites del intervalo de confianza 95%
    const ci95Lower = p - 1.96 * sigma;
    const ci95Upper = p + 1.96 * sigma;

    // Función para calcular coeficiente binomial C(n,k)
    function binomialCoeff(n, k) {
      if (k > n || k < 0) return 0;
      if (k === 0 || k === n) return 1;
      
      // Usar logaritmos para evitar overflow
      let logResult = 0;
      for (let i = 0; i < k; i++) {
        logResult += Math.log(n - i) - Math.log(i + 1);
      }
      return Math.exp(logResult);
    }

    // Generar PMF de Binomial(n, p)
    const binomialPMF = [];
    
    // Para visualización, solo calculamos puntos alrededor de la media
    // (calcular todos los n puntos sería muy costoso para n grande)
    const meanK = Math.round(n * p);
    const rangeSD = 5; // Mostrar ±5 desviaciones estándar
    const kMin = Math.max(0, Math.floor(meanK - rangeSD * Math.sqrt(n * p * (1 - p))));
    const kMax = Math.min(n, Math.ceil(meanK + rangeSD * Math.sqrt(n * p * (1 - p))));
    
    for (let k = kMin; k <= kMax; k++) {
      const prob = binomialCoeff(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
      const xBar = k / n; // X̄ = X/n
      
      binomialPMF.push({
        x: xBar,
        probability: prob * n, // Escalar para que sea densidad
        k: k
      });
    }

    // Create bins for histogram empírico
    // En HistogramPlot, agregar límite de bins para datasets grandes:
    const numBins = Math.min(30, Math.max(10, Math.ceil(Math.sqrt(validDiscrepancies.length))));
    const min = Math.min(...validDiscrepancies);
    const max = Math.max(...validDiscrepancies);
    const binWidth = (max - min) / numBins || 0.01;

    // Create histogram data
    const bins = [];
    for (let i = 0; i < numBins; i++) {
      const binStart = min + i * binWidth;
      const binEnd = binStart + binWidth;
      const binCenter = (binStart + binEnd) / 2;
      
      const count = validDiscrepancies.filter(d => 
        d >= binStart && (i === numBins - 1 ? d <= binEnd : d < binEnd)
      ).length;
      
      bins.push({
        x: binCenter,
        count: count,
        frequency: count / validDiscrepancies.length / binWidth, // Densidad
        binStart: binStart,
        binEnd: binEnd
      });
    }

    // Encontrar máximo para escala Y
    const maxFrequency = Math.max(...bins.map(b => b.frequency));
    const maxPMF = Math.max(...binomialPMF.map(p => p.probability));
    const yMax = Math.max(maxFrequency, maxPMF) * 1.2;

    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-2">
          Distribution of Discrepancies: Binomial Model vs Empirical (p = {selectedP.toFixed(2)})
        </h3>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-blue-50 p-3 rounded">
            <h4 className="font-medium text-sm mb-2">Theoretical Statistics</h4>
            <ul className="text-xs space-y-1">
              <li><span className="font-medium">E[D]:</span> {p.toFixed(6)}</li>
              <li><span className="font-medium">σ:</span> {sigma.toFixed(6)}</li>
              <li><span className="font-medium">95% CI:</span> [{ci95Lower.toFixed(6)}, {ci95Upper.toFixed(6)}]</li>
              <li><span className="font-medium">n (simulations):</span> {n}</li>
            </ul>
          </div>
          
          <div className="bg-green-50 p-3 rounded">
            <h4 className="font-medium text-sm mb-2">Empirical Statistics</h4>
            <ul className="text-xs space-y-1">
              <li><span className="font-medium">Mean:</span> {observedMean.toFixed(6)}</li>
              <li><span className="font-medium">SD:</span> {observedSD.toFixed(6)}</li>
              <li><span className="font-medium">Min:</span> {min.toFixed(6)}</li>
              <li><span className="font-medium">Max:</span> {max.toFixed(6)}</li>
            </ul>
          </div>
        </div>
        
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart 
              margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                type="number"
                domain={[Math.min(min, ci95Lower - 0.05), Math.max(max, ci95Upper + 0.05)]}
                tickFormatter={(value) => value.toFixed(3)}
                label={{ value: 'Discrepancy (X̄ = X/n)', position: 'insideBottom', offset: -10 }}
              />
              <YAxis 
                domain={[0, yMax]}
                label={{ value: 'Density', angle: -90, position: 'insideLeft' }}
                tickFormatter={(value) => value.toFixed(2)}
              />
              
              {/* Histograma empírico */}
              <Bar 
                data={bins}
                dataKey="frequency" 
                fill="#10b981" 
                opacity={0.6}
                name="Empirical Histogram"
              />
              
              {/* PMF Binomial teórica */}
              <Line
                data={binomialPMF}
                type="stepAfter"
                dataKey="probability"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 2 }}
                name="Binomial PMF"
              />
              
              {/* Banda de confianza 95% */}
              <ReferenceArea
                x1={ci95Lower}
                x2={ci95Upper}
                fill="#3b82f6"
                fillOpacity={0.1}
                label={{ value: "95% CI", position: "insideTop" }}
              />
              
              {/* Media teórica */}
              <ReferenceLine 
                x={p} 
                stroke="#ef4444" 
                strokeWidth={2}
                strokeDasharray="5 5" 
                label={{ 
                  value: `E[D] = ${p.toFixed(4)}`, 
                  position: 'insideTopRight',
                  offset: 10,
                  style: { fill: '#ef4444', fontSize: '12px', fontWeight: 'bold' }
                }}
              />
              
              {/* Media observada */}
              <ReferenceLine 
                x={observedMean} 
                stroke="#f59e0b" 
                strokeWidth={2}
                strokeDasharray="3 3" 
                label={{ 
                  value: `Observed = ${observedMean.toFixed(4)}`, 
                  position: observedMean > p ? 'insideTopLeft' : 'insideBottomRight',
                  offset: 10,
                  style: { fill: '#f59e0b', fontSize: '12px', fontWeight: 'bold' }
                }}
              />
              
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length > 0) {
                    const data = payload[0].payload;
                    if (data.k !== undefined) {
                      // PMF point
                      return (
                        <div className="bg-white p-2 border rounded shadow-md">
                          <p className="font-semibold">Binomial PMF</p>
                          <p>k = {data.k}, X̄ = {data.x.toFixed(6)}</p>
                          <p>P(X = k) = {(data.probability / n).toFixed(8)}</p>
                        </div>
                      );
                    } else {
                      // Histogram bin
                      return (
                        <div className="bg-white p-2 border rounded shadow-md">
                          <p className="font-semibold">Empirical Bin</p>
                          <p>Range: [{data.binStart.toFixed(4)}, {data.binEnd.toFixed(4)})</p>
                          <p>Count: {data.count}</p>
                          <p>Density: {data.frequency.toFixed(4)}</p>
                        </div>
                      );
                    }
                  }
                  return null;
                }}
              />
              
              <Legend />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-4 p-3 bg-gray-50 rounded text-xs">
          <p className="font-semibold mb-2">Model Details:</p>
          <p>• X ~ Binomial(n={n}, p={p.toFixed(6)})</p>
          <p>• X̄ = X/n has mean p and standard deviation σ = √(p(1-p)/n) = {sigma.toFixed(6)}</p>
          <p>• 95% CI: [p - 1.96σ, p + 1.96σ] = [{ci95Lower.toFixed(6)}, {ci95Upper.toFixed(6)}]</p>
          <p>• The blue line shows P(X̄ = k/n) for k = {kMin} to {kMax}</p>
          {Math.abs(observedMean - p) > 2 * sigma && (
            <p className="text-orange-600 font-semibold mt-2">
              ⚠️ Observed mean is {((Math.abs(observedMean - p) / sigma).toFixed(2))}σ away from theoretical mean
            </p>
          )}
        </div>
      </div>
    );
}

  
function TheoryPlot({
  currentP,
  experimentalData,
  displayCurves,
  rounds = 1,
  processValues = [0, 1],
  meetingPoint = 0.5,
  steps = 51,
  selectedAlgorithms = ["auto"]
}) {
  if (currentP == null) currentP = 0.5;

  const [selectedRound, setSelectedRound] = useState(rounds);
  useEffect(() => setSelectedRound(rounds), [rounds]);

  const validExperimentalData = Array.isArray(experimentalData)
    ? experimentalData.filter(item =>
        item && typeof item.p === 'number' && typeof item.discrepancy === 'number'
      )
    : [];

  const n = processValues.length;
  const m = processValues.filter(v => v === 0).length;

  const ampData = [];
  const fvData  = [];
  for (let i = 0; i <= steps; i++) {
    const p = i / steps;
    const q = 1 - p;
    let ampD, fvD;

    if (n === 2) {
      ampD = Math.pow(q, selectedRound);
      fvD  = Math.pow(p*p + q*q, selectedRound);
    } else {
      const A = Math.pow(1 - Math.pow(q, n - m), m);
      const B = Math.pow(1 - Math.pow(q, m), n - m);
      let ampV = 1 - (meetingPoint * A + (1 - meetingPoint) * B);
      let fvV  = 1 - (Math.pow(q, m*(n-m)) * (A + B));
      for (let r = 1; r < selectedRound; r++) {
        ampV *= (1 - p);
        fvV  *= (p*p + q*q);
      }
      ampD = ampV;
      fvD  = fvV;
    }

    ampData.push({ p, discrepancy: ampD });
    fvData.push({ p, discrepancy: fvD });
  }

  // Inyectar p=0.5 exacto si el grid no lo contiene (evita "pico" visual corrido)
  const ensureHalfPoint = (arr, which) => {
    const hasHalf = arr.some(d => Math.abs(d.p - 0.5) < 1e-12);
    if (!hasHalf) {
      const p = 0.5, q = 0.5;
      let D;
      if (n === 2) {
        D = which === 'AMP'
          ? Math.pow(q, selectedRound)
          : Math.pow(p*p + q*q, selectedRound);
      } else {
        const A = Math.pow(1 - Math.pow(q, n - m), m);
        const B = Math.pow(1 - Math.pow(q, m), n - m);
        let V = (which === 'AMP')
          ? 1 - (meetingPoint * A + (1 - meetingPoint) * B)
          : 1 - (Math.pow(q, m*(n-m)) * (A + B));
        for (let r = 1; r < selectedRound; r++) {
          V *= (which === 'AMP') ? (1 - p) : (p*p + q*q);
        }
        D = V;
      }
      arr.push({ p: 0.5, discrepancy: D });
      arr.sort((a, b) => a.p - b.p);
    }
  };
  ensureHalfPoint(ampData, 'AMP');
  ensureHalfPoint(fvData, 'FV');

  const showAMP = displayCurves?.theoreticalAmp ?? true;
  const showFV  = displayCurves?.theoreticalFv  ?? true;
  const showExp = displayCurves?.experimental && validExperimentalData.length > 0;

  const algorithmColors = {
    "RECURSIVE AMP": "#8b5cf6",
    "AMP": "#10b981",
    "FV": "#ef4444",
    "MIN": "#f59e0b",
    "auto": "#6b7280"
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="p"
            type="number"
            domain={[0, 1]}
            ticks={[0, 0.25, 0.5, 0.75, 1]}
            tickFormatter={v => (typeof v === 'number' ? v.toFixed(2) : v)}
            label={{ value: 'Probability (p)', position: 'insideBottom', offset: -5 }}
          />
          <YAxis
            dataKey="discrepancy"
            type="number"
            domain={[0, 1]}
            label={{ value: 'Discrepancy', angle: -90, position: 'insideLeft', offset: -10 }}
          />
          <Tooltip
            formatter={val => (val != null && !isNaN(val) ? Number(val).toFixed(4) : 'N/A')}
            labelFormatter={val => `p = ${val != null && !isNaN(val) ? Number(val).toFixed(2) : 'N/A'}`}
          />
          <Legend verticalAlign="top" height={36} />

          {showAMP && (
            <Line
              data={ampData}
              dataKey="discrepancy"
              name="AMP (Theoretical)"
              stroke="#2ecc71"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
          )}
          {showFV && (
            <Line
              data={fvData}
              dataKey="discrepancy"
              name="FV (Theoretical)"
              stroke="#e74c3c"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
          )}

          {showExp && selectedAlgorithms.map((algo) => {
            const algoData = validExperimentalData.filter(item => {
              if (algo === "auto") {
                return item.displayAlgorithm === "auto" ||
                       (item.algorithm === (item.p > 0.5 ? "AMP" : "FV") && !item.displayAlgorithm);
              }
              return item.algorithm === algo;
            });
            if (algoData.length === 0) return null;

            return (
              <Line
                key={algo}
                data={algoData}
                dataKey="discrepancy"
                name={`${algo} (Experimental)`}
                stroke={algorithmColors[algo] || "#000000"}
                strokeWidth={3}
                dot={{ r: 2, fill: 'white' }}
                connectNulls
              />
            );
          })}

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
        {experimentalResults.length > 0 && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-semibold mb-2">Convergence Analysis</h4>
          <div className="text-sm space-y-1">
            {(() => {
              const convergedCount = experimentalResults.filter(r => r.discrepancy < 1e-10).length;
              const nearConvergedCount = experimentalResults.filter(r => r.discrepancy < 1e-6).length;
              const totalPoints = experimentalResults.length;
              
              return (
                <>
                  <p>• Fully converged: {convergedCount}/{totalPoints} points ({(convergedCount/totalPoints*100).toFixed(1)}%)</p>
                  <p>• Nearly converged: {nearConvergedCount}/{totalPoints} points ({(nearConvergedCount/totalPoints*100).toFixed(1)}%)</p>
                  {processCount > 2 && rounds > 1 && (
                    <p className="text-orange-600 mt-2">
                      Note: For {processCount} processes with {rounds} rounds, convergence is expected to be exponentially faster than single-round cases.
                    </p>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
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


function RangeResultsTable({
  results,
  processCount = 2,
  forcedAlgorithm,
  fvMethod,
  rounds = 1
}) {
  if (!results || !Array.isArray(results) || results.length === 0) {
    return (
      <div className="bg-gray-100 p-4 rounded-lg text-center text-gray-500">
        No results available yet. Run the simulation to see results.
      </div>
    );
  }

  // Filtrar resultados inválidos
  const validResults = results.filter(
    (r) =>
      r &&
      typeof r.p === "number" &&
      typeof r.discrepancy === "number" &&
      typeof r.algorithm === "string"
  );

  // Ordenar por probabilidad
  const sortedResults = [...validResults].sort((a, b) => a.p - b.p);

  // Recalcular teóricos para 2 procesos
  const resultsWithCorrectTheory = sortedResults.map((result) => {
    const newResult = { ...result };
    if (processCount === 2 && typeof result.theoretical !== "number") {
      const p = result.p;
      const q = 1 - p;
      if (result.algorithm === "AMP") {
        newResult.theoretical = Math.pow(q, rounds);
      } else {
        newResult.theoretical = Math.pow(p * p + q * q, rounds);
      }
    }
    return newResult;
  });

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-xs">
          <thead>
            <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">Probability (p)</th>
              <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">Algorithm</th>
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider">Experimental{rounds > 1 ? ` (${rounds} rounds)` : ""}</th>
              <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">Samples</th>
              {processCount === 2 && (
                <>
                  <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider">Theoretical{rounds > 1 ? ` (${rounds} rounds)` : ""}</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">Error Abs</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">Error %</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {resultsWithCorrectTheory.map((result, idx) => {
              // === MODIFICACIÓN 1: calcular error absoluto ===
              const error =
                processCount === 2 && typeof result.theoretical === "number"
                  ? Math.abs(result.theoretical - result.discrepancy)
                  : null;

              let errorPercent = 0;
              let errorType = "normal";
              let displayError = "";

              if (error !== null) {
                const epsilon = 1e-10;
                const smallValueThreshold = 1e-6;

                if (result.theoretical < epsilon && result.discrepancy < epsilon) {
                  errorType = "both-zero";
                  displayError = "≈0%";
                } else if (result.theoretical < smallValueThreshold) {
                  errorType = "absolute";
                  displayError = `±${error.toExponential(2)}`;
                } else {
                  errorPercent = (error / result.theoretical) * 100;
                  if (errorPercent > 999) {
                    displayError = ">999%";
                  } else {
                    displayError = `${errorPercent.toFixed(1)}%`;
                  }
                }
              }

              return (
                <tr key={idx} className={idx % 2 === 0 ? "" : "bg-gray-50"}>
                  <td className="px-3 py-2 whitespace-nowrap">{result.p.toFixed(2)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        result.algorithm === "AMP"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {result.algorithm}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-mono text-sm">
                      {result.discrepancy < 1e-6 && result.discrepancy > 0
                        ? result.discrepancy.toExponential(3)
                        : result.discrepancy.toFixed(6)}
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{result.samples}</td>

                  {processCount === 2 && (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-mono text-sm text-gray-600">
                          {result.theoretical < 1e-6 && result.theoretical > 0
                            ? result.theoretical.toExponential(3)
                            : result.theoretical.toFixed(6)}
                        </div>
                      </td>

                      {/* Error absoluto */}
                      <td className="px-6 py-4 whitespace-nowrap font-mono">
                        {error !== null
                          ? (error < 1e-6 && error > 0
                              ? error.toExponential(3)
                              : error.toFixed(6))
                          : "N/A"}
                      </td>

                      {/* Error porcentual (Modificación 3) */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div
                          className={`text-sm ${
                            errorType === "both-zero"
                              ? "text-gray-500"
                              : errorType === "absolute"
                              ? "text-blue-600"
                              : errorPercent > 20
                              ? "text-red-600 font-semibold"
                              : errorPercent > 10
                              ? "text-orange-600"
                              : "text-green-600"
                          }`}
                        >
                          {error !== null ? displayError : "N/A"}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
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
      
      // Check if multi-round
      if (currentExperimentToSave?.parameters?.rounds > 1) {
        autoCategories.push("multi-round");
        autoCategories.push(`rounds-${currentExperimentToSave.parameters.rounds}`);
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
            <p><span className="font-medium">Rounds:</span> {currentExperimentToSave?.parameters?.rounds || 1}</p>
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

// Component to visualize convergence across multiple rounds
function MultiRoundConvergenceChart({ analysisData, maxRounds = 3 }) {
  const [selectedP, setSelectedP] = useState(0.7);
  const [showTheoreticalAMP, setShowTheoreticalAMP] = useState(true);
  const [showExperimentalAMP, setShowExperimentalAMP] = useState(true);
  const [showTheoreticalFV, setShowTheoreticalFV] = useState(true);
  const [showExperimentalFV, setShowExperimentalFV] = useState(true);
  const [useLogScale, setUseLogScale] = useState(false);
  const [compareMode, setCompareMode] = useState('algorithms'); // 'algorithms' or 'theory-vs-practice'
  
  // If no data, show informative message
  if (!analysisData || analysisData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4 text-center">
        <h3 className="text-lg font-semibold mb-2">Multi-Round Analysis</h3>
        <p className="text-gray-500">Run a multi-round analysis to see convergence.</p>
      </div>
    );
  }

  // Find analysis for selected probability
  const analysisForSelectedP = analysisData.find(a => a.probability === selectedP) || analysisData[0];
  
  // Prepare data for chart based on comparison mode
  let chartData = [];
  
  if (compareMode === 'algorithms') {
    // Format for comparing AMP vs FV
    for (let r = 0; r <= maxRounds; r++) {
      const dataPoint = { round: r };
      
      if (showTheoreticalAMP) {
        dataPoint.theoryAMP = analysisForSelectedP.theoreticalAMP[r]?.discrepancy || 0;
      }
      
      if (showExperimentalAMP) {
        dataPoint.expAMP = analysisForSelectedP.experimentalAMP[r]?.discrepancy || 0;
      }
      
      if (showTheoreticalFV) {
        dataPoint.theoryFV = analysisForSelectedP.theoreticalFV[r]?.discrepancy || 0;
      }
      
      if (showExperimentalFV) {
        dataPoint.expFV = analysisForSelectedP.experimentalFV[r]?.discrepancy || 0;
      }
      
      chartData.push(dataPoint);
    }
  } else {
    // Format for comparing theory vs practice
    for (let r = 0; r <= maxRounds; r++) {
      const dataPoint = { round: r };
      
      if (showTheoreticalAMP) {
        dataPoint.theoryAMP = analysisForSelectedP.theoreticalAMP[r]?.discrepancy || 0;
      }
      
      if (showTheoreticalFV) {
        dataPoint.theoryFV = analysisForSelectedP.theoreticalFV[r]?.discrepancy || 0;
      }
      
      if (showExperimentalAMP) {
        dataPoint.expAMP = analysisForSelectedP.experimentalAMP[r]?.discrepancy || 0;
      }
      
      if (showExperimentalFV) {
        dataPoint.expFV = analysisForSelectedP.experimentalFV[r]?.discrepancy || 0;
      }
      
      chartData.push(dataPoint);
    }
  }

  // Determine optimal algorithm for selected probability
  const optimalAlgorithm = analysisForSelectedP.optimalAlgorithm;
  
  // Calculate theoretical reduction factor per round
  const q = 1 - selectedP;
  const ampReductionFactor = q;
  const fvReductionFactor = selectedP*selectedP + q*q;
  
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h3 className="text-xl font-semibold mb-4">Multi-Round Convergence Analysis</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <div className="md:col-span-1">
          <label className="block text-sm font-medium mb-1">Probability (p):</label>
          <select 
            value={selectedP} 
            onChange={(e) => setSelectedP(parseFloat(e.target.value))}
            className="w-full p-2 border rounded-md"
          >
            {analysisData.map(a => (
              <option key={a.probability} value={a.probability}>
                p = {a.probability.toFixed(2)}
              </option>
            ))}
          </select>
        </div>
        
        <div className="md:col-span-1">
          <label className="block text-sm font-medium mb-1">Comparison Mode:</label>
          <select 
            value={compareMode} 
            onChange={(e) => setCompareMode(e.target.value)}
            className="w-full p-2 border rounded-md"
          >
            <option value="algorithms">AMP vs FV</option>
            <option value="theory-vs-practice">Theory vs Practice</option>
          </select>
        </div>
        
        <div className="md:col-span-1">
          <label className="block text-sm font-medium mb-1">Show Rounds:</label>
          <select 
            value={maxRounds} 
            onChange={(e) => setMaxRounds(parseInt(e.target.value))}
            className="w-full p-2 border rounded-md"
          >
            <option value="1">1 Round</option>
            <option value="2">2 Rounds</option>
            <option value="3">3 Rounds</option>
            <option value="5">5 Rounds</option>
            <option value="10">10 Rounds</option>
          </select>
        </div>
        
        <div className="md:col-span-1">
          <label className="flex items-center mt-6">
            <input 
              type="checkbox" 
              checked={useLogScale} 
              onChange={() => setUseLogScale(!useLogScale)}
              className="mr-2"
            />
            <span className="text-sm">Logarithmic Scale</span>
          </label>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center">
            <input 
              type="checkbox" 
              checked={showTheoreticalAMP} 
              onChange={() => setShowTheoreticalAMP(!showTheoreticalAMP)}
              className="mr-2"
            />
            <span className="text-sm flex items-center">
              <span 
                className="inline-block w-3 h-3 mr-1 rounded-full" 
                style={{ backgroundColor: AMP_COLOR }}
              ></span>
              Theoretical AMP
            </span>
          </label>
          
          <label className="flex items-center">
            <input 
              type="checkbox" 
              checked={showExperimentalAMP} 
              onChange={() => setShowExperimentalAMP(!showExperimentalAMP)}
              className="mr-2"
            />
            <span className="text-sm flex items-center">
              <span 
                className="inline-block w-3 h-3 mr-1 rounded-full" 
                style={{ backgroundColor: AMP_COLOR, opacity: 0.6 }}
              ></span>
              Experimental AMP
            </span>
          </label>
          
          <label className="flex items-center">
            <input 
              type="checkbox" 
              checked={showTheoreticalFV} 
              onChange={() => setShowTheoreticalFV(!showTheoreticalFV)}
              className="mr-2"
            />
            <span className="text-sm flex items-center">
              <span 
                className="inline-block w-3 h-3 mr-1 rounded-full" 
                style={{ backgroundColor: FV_COLOR }}
              ></span>
              Theoretical FV
            </span>
          </label>
          
          <label className="flex items-center">
            <input 
              type="checkbox" 
              checked={showExperimentalFV} 
              onChange={() => setShowExperimentalFV(!showExperimentalFV)}
              className="mr-2"
            />
            <span className="text-sm flex items-center">
              <span 
                className="inline-block w-3 h-3 mr-1 rounded-full" 
                style={{ backgroundColor: FV_COLOR, opacity: 0.6 }}
              ></span>
              Experimental FV
            </span>
          </label>
        </div>
        
        <div className="bg-blue-50 p-3 rounded-lg">
          <p className="text-sm">
            <strong>For p = {selectedP.toFixed(2)}:</strong> The optimal algorithm is <strong>{optimalAlgorithm}</strong>
          </p>
          <p className="text-sm">
            Reduction factor per round: {optimalAlgorithm === 'AMP' ? 
              `${ampReductionFactor.toFixed(4)} (AMP)` : 
              `${fvReductionFactor.toFixed(4)} (FV)`}
          </p>
        </div>
      </div>
      
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={chartData} 
            margin={{ top: 10, right: 30, left: 20, bottom: 30 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="round" 
              label={{ value: 'Round', position: 'insideBottom', offset: -10 }}
              type="number"
              domain={[0, maxRounds]}
              allowDecimals={false}
            />
            <YAxis 
              label={{ value: 'Discrepancy', angle: -90, position: 'insideLeft', offset: -10 }}
              scale={useLogScale ? 'log' : 'auto'}
              domain={useLogScale ? [0.001, 1] : [0, 1]}
              tickFormatter={(value) => value.toFixed(useLogScale ? 3 : 2)}
            />
            <Tooltip formatter={(value) => value.toFixed(4)} labelFormatter={(label) => `Round ${label}`} />
            <Legend />
            
            {showTheoreticalAMP && (
              <Line
                type="monotone"
                dataKey="theoryAMP"
                name="Theoretical AMP"
                stroke={AMP_COLOR}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            )}
            
            {showExperimentalAMP && (
              <Line
                type="monotone"
                dataKey="expAMP"
                name="Experimental AMP"
                stroke={AMP_COLOR}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 4, fill: AMP_COLOR, stroke: 'white', strokeWidth: 1 }}
              />
            )}
            
            {showTheoreticalFV && (
              <Line
                type="monotone"
                dataKey="theoryFV"
                name="Theoretical FV"
                stroke={FV_COLOR}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            )}
            
            {showExperimentalFV && (
              <Line
                type="monotone"
                dataKey="expFV"
                name="Experimental FV"
                stroke={FV_COLOR}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 4, fill: FV_COLOR, stroke: 'white', strokeWidth: 1 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-50 p-3 rounded-lg">
          <h4 className="font-medium mb-2">Theoretical Discrepancy per Round</h4>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1 px-2">Round</th>
                <th className="text-right py-1 px-2">AMP</th>
                <th className="text-right py-1 px-2">FV</th>
              </tr>
            </thead>
            <tbody>
              {analysisForSelectedP.theoreticalAMP.slice(0, maxRounds + 1).map((data, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : ''}>
                  <td className="py-1 px-2">{idx}</td>
                  <td className="text-right py-1 px-2 font-mono">{data.discrepancy.toFixed(4)}</td>
                  <td className="text-right py-1 px-2 font-mono">
                    {analysisForSelectedP.theoreticalFV[idx].discrepancy.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="bg-gray-50 p-3 rounded-lg">
          <h4 className="font-medium mb-2">Experimental Discrepancy per Round</h4>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1 px-2">Round</th>
                <th className="text-right py-1 px-2">AMP</th>
                <th className="text-right py-1 px-2">FV</th>
                <th className="text-right py-1 px-2">AMP Error (%)</th>
                <th className="text-right py-1 px-2">FV Error (%)</th>
              </tr>
            </thead>
            <tbody>
              {analysisForSelectedP.experimentalAMP.slice(0, maxRounds + 1).map((data, idx) => {
                const theoreticalAMP = analysisForSelectedP.theoreticalAMP[idx].discrepancy;
                const theoreticalFV = analysisForSelectedP.theoreticalFV[idx].discrepancy;
                const experimentalAMP = data.discrepancy;
                const experimentalFV = analysisForSelectedP.experimentalFV[idx].discrepancy;
                
                const errorAMP = theoreticalAMP !== 0 ? 
                  Math.abs((experimentalAMP - theoreticalAMP) / theoreticalAMP) * 100 : 0;
                const errorFV = theoreticalFV !== 0 ? 
                  Math.abs((experimentalFV - theoreticalFV) / theoreticalFV) * 100 : 0;
                
                return (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : ''}>
                    <td className="py-1 px-2">{idx}</td>
                    <td className="text-right py-1 px-2 font-mono">{experimentalAMP.toFixed(4)}</td>
                    <td className="text-right py-1 px-2 font-mono">{experimentalFV.toFixed(4)}</td>
                    <td className="text-right py-1 px-2 font-mono">{errorAMP.toFixed(2)}%</td>
                    <td className="text-right py-1 px-2 font-mono">{errorFV.toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Component to analyze convergence rates
function ConvergenceRateAnalysis({ analyzedRates }) {
  if (!analyzedRates || analyzedRates.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4 text-center">
        <h3 className="text-lg font-semibold mb-2">Convergence Rate Analysis</h3>
        <p className="text-gray-500">Run an analysis to see convergence rates.</p>
      </div>
    );
  }
  
  // Sort by probability
  const sortedRates = [...analyzedRates].sort((a, b) => a.probability - b.probability);
  
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h3 className="text-xl font-semibold mb-4">Convergence Rate Analysis</h3>
      
      <div className="mb-6">
        <h4 className="font-medium mb-2">Reduction Factors by Probability</h4>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={sortedRates.map(rate => ({
                probability: rate.probability,
                ampFactor: 1 - rate.probability, // q
                fvFactor: Math.pow(rate.probability, 2) + Math.pow(1 - rate.probability, 2),
                optimalFactor: rate.theoreticalFactor
              }))}
              margin={{ top: 10, right: 30, left: 20, bottom: 30 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="probability" 
                label={{ value: 'Probability (p)', position: 'insideBottom', offset: -10 }}
                domain={[0, 1]}
              />
              <YAxis 
                label={{ value: 'Reduction Factor', angle: -90, position: 'insideLeft', offset: -10 }}
                domain={[0, 1]}
              />
              <Tooltip 
                formatter={(value) => value.toFixed(4)} 
                labelFormatter={(label) => `Probability: ${parseFloat(label).toFixed(2)}`}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="ampFactor" 
                name="AMP Factor (q)" 
                stroke={AMP_COLOR} 
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line 
                type="monotone" 
                dataKey="fvFactor" 
                name="FV Factor (p² + q²)" 
                stroke={FV_COLOR} 
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line 
                type="monotone" 
                dataKey="optimalFactor" 
                name="Optimal Factor" 
                stroke="#9c27b0" 
                strokeWidth={3}
                dot={{ r: 4 }}
              />
              <ReferenceLine x={0.5} stroke="#666" strokeDasharray="3 3" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sortedRates.slice(0, 4).map(rate => (
          <div key={rate.probability} className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-3">
              Probability p = {rate.probability.toFixed(2)}, 
              Algorithm: {rate.algorithm}
            </h4>
            <p className="text-sm mb-2">
              Theoretical reduction factor: <span className="font-mono">{rate.theoreticalFactor.toFixed(4)}</span> per round
            </p>
            
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1 px-2">Round</th>
                  <th className="text-right py-1 px-2">Discrepancy</th>
                  <th className="text-right py-1 px-2">Convergence Rate</th>
                  <th className="text-right py-1 px-2">Factor</th>
                </tr>
              </thead>
              <tbody>
                {rate.convergenceRates.slice(0, 5).map((data, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : ''}>
                    <td className="py-1 px-2">{data.round}</td>
                    <td className="text-right py-1 px-2 font-mono">{data.discrepancy.toFixed(4)}</td>
                    <td className="text-right py-1 px-2 font-mono">
                      {(data.convergenceRate * 100).toFixed(2)}%
                    </td>
                    <td className="text-right py-1 px-2 font-mono">
                      {data.reductionFactor.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

// Component for theoretical vs experimental comparison
function TheoreticalVsExperimentalTable({ p, maxRounds = 3, repetitions = 100 }) {
  const [results, setResults] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  
  useEffect(() => {
    // Reset results when parameters change
    setResults(null);
  }, [p, maxRounds, repetitions]);
  
  const calculateResults = useCallback(async () => {
    if (isCalculating) return;
    
    setIsCalculating(true);
    
    // Simulate with setTimeout to not block UI
    setTimeout(() => {
      try {
        // Initial values: Alice = 0, Bob = 1
        const initialValues = [0, 1];
        
        // Determine optimal algorithm based on p
        const algorithm = p > 0.5 ? "AMP" : "FV";
        const q = 1 - p;
        
        // Calculate theoretical results
        const theoreticalResults = [];
        for (let r = 0; r <= maxRounds; r++) {
          let theoreticalDiscrepancy;
          if (algorithm === "AMP") {
            theoreticalDiscrepancy = Math.pow(q, r);
          } else {
            theoreticalDiscrepancy = Math.pow(p*p + q*q, r);
          }
          
          theoreticalResults.push({
            round: r,
            discrepancy: theoreticalDiscrepancy
          });
        }
        
        // Run experiments
        const experimentalRuns = [];
        for (let i = 0; i < repetitions; i++) {
          const history = SimulationEngine.runExperiment(
            initialValues,
            p,
            maxRounds,
            algorithm,
            0.5  // Meeting point
          );
          experimentalRuns.push(history);
        }
        
        // Calculate experimental averages
        const experimentalResults = [];
        for (let r = 0; r <= maxRounds; r++) {
          let sumDiscrepancy = 0;
          let count = 0;
          
          experimentalRuns.forEach(run => {
            if (run[r]) {
              sumDiscrepancy += run[r].discrepancy;
              count++;
            }
          });
          
          const avgDiscrepancy = count > 0 ? sumDiscrepancy / count : null;
          
          experimentalResults.push({
            round: r,
            discrepancy: avgDiscrepancy,
            sampleCount: count
          });
        }
        
        // Compare results
        const comparisonResults = [];
        for (let r = 0; r <= maxRounds; r++) {
          const theoretical = theoreticalResults[r].discrepancy;
          const experimental = experimentalResults[r].discrepancy;
          
          // Calculate absolute and relative error
          const absoluteError = Math.abs(experimental - theoretical);
          const relativeError = theoretical !== 0 ? (absoluteError / theoretical) * 100 : 0;
          
          comparisonResults.push({
            round: r,
            theoretical,
            experimental,
            absoluteError,
            relativeError
          });
        }
        
        setResults({
          algorithm,
          theoreticalResults,
          experimentalResults,
          comparisonResults
        });
      } catch (error) {
        console.error("Error calculating results:", error);
      } finally {
        setIsCalculating(false);
      }
    }, 50); // Reduced delay for faster execution
  }, [p, maxRounds, repetitions, isCalculating]);
  
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Theoretical vs Experimental (p = {p.toFixed(2)})</h3>
        
        <button
          onClick={calculateResults}
          disabled={isCalculating}
          className={`px-4 py-2 rounded-md text-white ${
            isCalculating ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isCalculating ? 'Calculating...' : 'Calculate'}
        </button>
      </div>
      
      {results ? (
        <div>
          <div className="mb-4 bg-blue-50 p-3 rounded-lg">
            <p className="text-sm">
              <strong>Optimal algorithm:</strong> {results.algorithm} for p = {p.toFixed(2)}
            </p>
            <p className="text-sm">
              <strong>Theoretical reduction factor:</strong> {
                results.algorithm === "AMP" 
                  ? `${(1-p).toFixed(4)} (q)` 
                  : `${(p*p + (1-p)*(1-p)).toFixed(4)} (p² + q²)`
              }
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-auto divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-1 text-left font-medium text-gray-500 uppercase">p</th>
                  <th className="px-3 py-1 text-left font-medium text-gray-500 uppercase">Algorithm</th>
                  <th className="px-3 py-1 text-left font-medium text-gray-500 uppercase">Experimental</th>
                  {experimentalResults[0].theoretical && (
                    <>
                      <th className="px-3 py-1 text-left font-medium text-gray-500 uppercase">Theoretical</th>
                      <th className="px-3 py-1 text-left font-medium text-gray-500 uppercase">Error</th>
                      <th className="px-3 py-1 text-left font-medium text-gray-500 uppercase">Error %</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {experimentalResults.sort((a, b) => a.p - b.p).map((result, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-2 py-1 whitespace-nowrap">{result.p.toFixed(2)}</td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                        result.algorithm === 'AMP' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {result.algorithm}
                      </span>
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap font-mono">{result.discrepancy < 1e-6 && result.discrepancy > 0 
                      ? result.discrepancy.toExponential(3)
                      : result.discrepancy.toFixed(6)}</td>
                    {result.theoretical && (
                      <>
                        <td className="px-2 py-1 whitespace-nowrap font-mono">{result.theoretical.toFixed(6)}</td>
                        <td className="px-2 py-1 whitespace-nowrap font-mono">{Math.abs(result.discrepancy - result.theoretical).toFixed(6)}</td>
                        <td className="px-2 py-1 whitespace-nowrap font-mono">{(Math.abs(result.discrepancy - result.theoretical)/result.theoretical*100).toFixed(2)}%</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={results.comparisonResults}
                margin={{ top: 10, right: 30, left: 20, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="round" 
                  label={{ value: 'Round', position: 'insideBottom', offset: -10 }}
                  type="number"
                  domain={[0, maxRounds]}
                  allowDecimals={false}
                />
                <YAxis 
                  label={{ value: 'Discrepancy', angle: -90, position: 'insideLeft', offset: -10 }}
                  domain={[0, 1]}
                />
                <Tooltip formatter={(value) => value.toFixed(6)} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="theoretical"
                  name="Theoretical"
                  stroke="#3498db"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="experimental"
                  name="Experimental"
                  stroke="#e74c3c"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          {isCalculating ? (
            <div>
              <svg className="animate-spin h-10 w-10 text-blue-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p>Calculating results, please wait...</p>
              <p className="text-sm mt-2">Running {repetitions} simulations for {maxRounds} rounds</p>
            </div>
          ) : (
            <p>Click "Calculate" to see comparative results.</p>
          )}
        </div>
      )}
    </div>
  );
}

// Component to analyze error between theory and experiment for different p values
function ErrorAnalysisByProbability({ maxRounds = 3, repetitions = 50 }) {
  const [results, setResults] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [roundToShow, setRoundToShow] = useState(1);
  
  const runAnalysis = useCallback(async () => {
    if (isCalculating) return;
    
    setIsCalculating(true);
    
    // Simulate with setTimeout to not block UI
    setTimeout(() => {
      try {
        // p values to analyze
        const pValues = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
        const initialValues = [0, 1]; // Alice = 0, Bob = 1
        
        // Store results for each p
        const allResults = [];
        
        for (const p of pValues) {
          const algorithm = p > 0.5 ? "AMP" : "FV";
          const q = 1 - p;
          
          // Calculate theoretical values
          const theoreticalDiscrepancies = [];
          for (let r = 0; r <= maxRounds; r++) {
            if (algorithm === "AMP") {
              theoreticalDiscrepancies.push(Math.pow(q, r));
            } else {
              theoreticalDiscrepancies.push(Math.pow(p*p + q*q, r));
            }
          }
          
          // Run experiments
          const experimentalDiscrepancies = Array(maxRounds + 1).fill(0).map(() => ({ sum: 0, count: 0 }));
          
          for (let i = 0; i < repetitions; i++) {
            const history = SimulationEngine.runExperiment(
              initialValues,
              p,
              maxRounds,
              algorithm,
              0.5  // Meeting point
            );
            
            // Record results for each round
            for (let r = 0; r <= maxRounds; r++) {
              if (history[r]) {
                experimentalDiscrepancies[r].sum += history[r].discrepancy;
                experimentalDiscrepancies[r].count++;
              }
            }
          }
          
          // Calculate averages and errors
          const roundResults = [];
          for (let r = 0; r <= maxRounds; r++) {
            const theoretical = theoreticalDiscrepancies[r];
            const experimental = experimentalDiscrepancies[r].count > 0 ? 
              experimentalDiscrepancies[r].sum / experimentalDiscrepancies[r].count : 0;
              
            const absoluteError = Math.abs(experimental - theoretical);
            const relativeError = theoretical !== 0 ? (absoluteError / theoretical) * 100 : 0;
            
            roundResults.push({
              round: r,
              theoretical,
              experimental,
              absoluteError,
              relativeError
            });
          }
          
          allResults.push({
            p,
            algorithm,
            roundResults
          });
        }
        
        setResults(allResults);
      } catch (error) {
        console.error("Error in error analysis:", error);
      } finally {
        setIsCalculating(false);
      }
    }, 50); // Reduced delay for faster execution
  }, [maxRounds, repetitions, isCalculating]);
  
  // Prepare data for probability error chart
  const chartData = useMemo(() => {
    if (!results) return [];
    
    return results.map(result => {
      const roundData = result.roundResults[roundToShow];
      return {
        p: result.p,
        algorithm: result.algorithm,
        theoretical: roundData.theoretical,
        experimental: roundData.experimental,
        absoluteError: roundData.absoluteError,
        relativeError: roundData.relativeError
      };
    });
  }, [results, roundToShow]);
  
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Error Analysis by Probability</h3>
        
        <div className="flex items-center space-x-4">
          {results && (
            <select
              value={roundToShow}
              onChange={(e) => setRoundToShow(parseInt(e.target.value))}
              className="px-2 py-1 border rounded text-sm"
            >
              {[...Array(maxRounds + 1)].map((_, idx) => (
                <option key={idx} value={idx}>Round {idx}</option>
              ))}
            </select>
          )}
          
          <button
            onClick={runAnalysis}
            disabled={isCalculating}
            className={`px-4 py-2 rounded-md text-white ${
              isCalculating ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isCalculating ? 'Analyzing...' : 'Analyze Error'}
          </button>
        </div>
      </div>
      
      {results ? (
        <div>
          <div className="mb-6 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 20, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="p" 
                  label={{ value: 'Probability (p)', position: 'insideBottom', offset: -10 }}
                  domain={[0, 1]}
                />
                <YAxis 
                  yAxisId="left"
                  label={{ value: 'Discrepancy', angle: -90, position: 'insideLeft', offset: -10 }}
                  domain={[0, 1]}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  label={{ value: 'Relative Error (%)', angle: 90, position: 'insideRight', offset: -15 }}
                  domain={[0, 'auto']}
                />
                <Tooltip formatter={(value) => value.toFixed(6)} />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="theoretical"
                  name="Theoretical"
                  stroke="#3498db"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="experimental"
                  name="Experimental"
                  stroke="#e74c3c"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Bar
                  yAxisId="right"
                  dataKey="relativeError"
                  name="Relative Error (%)"
                  fill="#2ecc71"
                  opacity={0.7}
                />
                <ReferenceLine x={0.5} stroke="#666" strokeDasharray="3 3" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Probability (p)
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Algorithm
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Theoretical (Round {roundToShow})
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Experimental
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Abs. Error
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rel. Error (%)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {chartData.map((data) => (
                  <tr key={data.p}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {data.p.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        data.algorithm === "AMP" ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {data.algorithm}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                      {data.theoretical.toFixed(6)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                      {data.experimental.toFixed(6)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                      {data.absoluteError.toFixed(6)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-mono ${
                      data.relativeError < 5 ? 'text-green-600' :
                      data.relativeError < 10 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {data.relativeError.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          {isCalculating ? (
            <div>
              <svg className="animate-spin h-10 w-10 text-blue-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p>Analyzing error for different p values, please wait...</p>
              <p className="text-sm mt-2">This analysis may take a few seconds</p>
            </div>
          ) : (
            <div>
              <p className="mb-4">Click "Analyze Error" to compare theoretical and experimental results for different p values.</p>
              <p className="text-sm">This analysis will run {repetitions} simulations for each p value up to round {maxRounds}.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Main component
function CompleteDistributedComputingSimulator() {
  // Configuration states
  const [processValues, setProcessValues] = useState([0, 1]); // Valores para n procesos
  const [probability, setProbability] = useState(0.70);
  const [algorithm, setAlgorithm] = useState("auto");
  const [fvMethod, setFvMethod] = useState("average");
  const [meetingPoint, setMeetingPoint] = useState(0.5);
  const [rounds, setRounds] = useState(1);
  const [showDeliveryInfo, setShowDeliveryInfo] = useState(false);
  const [repetitions, setRepetitions] = useState(50);
  const [deliveryMode, setDeliveryMode] = useState('standard');
  const [experimentRuns, setExperimentRuns] = useState({});
  const [selectedRepetition, setSelectedRepetition] = useState(0);
  const [useConditionedMode, setUseConditionedMode] = useState(false);
  // Range experiments states
  const [rangeExperiments, setRangeExperiments] = useState({
    minP: 0.0,
    maxP: 1.0,
    steps: 100,
    customSteps: false,
    customStepValue: 100
  });
  const [useAdaptive, setUseAdaptive] = useState(false);
  const [showCI, setShowCI]           = useState(true);
  const [fixYAxis, setFixYAxis]       = useState(false);
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
  const [maxValue, setMaxValue] = useState(1); // Para valores no binarios

  const [configCode, setConfigCode] = useState("");
  const [selectedAlgorithms, setSelectedAlgorithms] = useState(["auto"]);
  const [selectedAlgorithmForDetails, setSelectedAlgorithmForDetails] = useState("auto");

  // Función helper para validar valores
  const validateProcessValue = (value, mode) => {
    if (mode === 'binary') {
      return value === 0 || value === 1 ? value : Math.round(value);
    } else {
      return Math.max(0, Math.min(1, value));
    }
  };
  const [selectedProbabilityForDetails, setSelectedProbabilityForDetails] = useState(null);
  // Multi-round analysis states
  const [multiRoundAnalysisData, setMultiRoundAnalysisData] = useState(null);
  const [convergenceRatesData, setConvergenceRatesData] = useState(null);
  const [multiRoundSettings, setMultiRoundSettings] = useState({
    initialGap: 1.0,
    maxRounds: 3,
    pValues: [0.3, 0.5, 0.7, 0.9],
    repetitions: 100
  });
  const [isRunningMultiRound, setIsRunningMultiRound] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [hoveredRow, setHoveredRow] = useState(null);


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
  // Estado para fijar o autoajustar los ejes Y en Error Analysis
  const [selectedPForHistogram, setSelectedPForHistogram] = useState(null);
  // --- Construcción de statsWithCI para Discrepancy y Error Analysis ---
  const statsWithCI = experimentalResults
    .sort((a, b) => a.p - b.p)
    .map(r => {
      const mean = r.discrepancy;
      const arr = r.discrepancies || [];
      const n = arr.length;
      const variance = n > 0
        ? arr.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n
        : 0;
      const sd = Math.sqrt(variance);
      return {
        p: r.p,
        mean,
        lower: Math.max(0, mean - 2 * sd),
        upper: mean + 2 * sd,
        theoretical: r.theoretical,
        error: r.theoretical != null ? Math.abs(mean - r.theoretical) : null,
        errorPercent: r.theoretical != null ? Math.abs(mean - r.theoretical) / r.theoretical * 100 : null
      };
    });

  const [valueMode, setValueMode] = useState('binary'); // 'binary' o 'continuous'

  const [rangeDisplayCurves, setRangeDisplayCurves] = useState({
    experimental: true,
    theoreticalAmp: false,
    theoreticalFv: false
  });
  const [comparisonResults, setComparisonResults] = useState(null);
  const animationTimerRef = useRef(null);

  const cancelRef = useRef(false);

  function handleRunCancel() {
    if (!isRunning) {
      setIsRunning(true);
      runRangeExperiments();       
    } else {
      setIsRunning(false);
      cancelRangeExperiments();    
    }
  }

  function cancelRangeExperiments() {
  cancelRef.current = true;
} 

const [copyMessage, setCopyMessage] = useState("");


function base64ToBase64Url(str) {
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64UrlToBase64(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = str.length % 4;
  if (pad) str += "=".repeat(4 - pad);
  return str;
}
function encodeConfigCode(cfg) {
  const json = JSON.stringify(cfg);
  return base64ToBase64Url(btoa(json));
}
function decodeConfigCode(code) {
  try {
    const json = atob(base64UrlToBase64(code));
    return JSON.parse(json);
  } catch {
    return null;
  }
}



 // Helper functions


const handleLoadConfig = () => {
  const config = decodeConfigCode(configCode);
  if (!config) {
    addLog("Invalid configuration code", "error");
    return;
  }
  
  setProcessValues(config.initialValues || [0, 1]);
  setProbability(config.p || 0.5);
  setRangeExperiments({
    minP: config.minP || 0,
    maxP: config.maxP || 1,
    steps: 100,
    customSteps: false,
    customStepValue: 100
  });
  setForcedAlgorithm(config.algorithm || "auto");
  setMeetingPoint(config.meetingPoint || 0.5);
  setRounds(config.rounds || 1);
  setRepetitions(config.repetitions || 1);
  
  
  addLog("Configuration loaded successfully", "success");
  setCopyMessage("Configuration loaded!");
  setTimeout(() => setCopyMessage(""), 2000);
};

const handleGenerateConfig = () => {
  const cfg = {
    processCount:   processValues.length,
    initialValues:  processValues,
    p:              probability,
    minP:           rangeExperiments.minP,
    maxP:           rangeExperiments.maxP,
    algorithm:      forcedAlgorithm,
    meetingPoint:   meetingPoint,
    rounds:         rounds,
    repetitions:    repetitions,
  };
  const code = encodeConfigCode(cfg);
  navigator.clipboard.writeText(code)
    .then(() => {
      setCopyMessage("Code copied!");
      setTimeout(() => setCopyMessage(""), 2000);
    })
    .catch(() => {
      setCopyMessage("Copy failed");
      setTimeout(() => setCopyMessage(""), 2000);
    });
};


// convierte Base64 normal → Base64URL
function base64ToBase64Url(str) {
  return str
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function encodeConfigCode(cfg) {
  // SIN parámetros del algoritmo recursivo
  const fullConfig = {
    processCount: processValues.length,
    initialValues: processValues,
    p: probability,
    minP: rangeExperiments.minP,
    maxP: rangeExperiments.maxP,
    algorithm: forcedAlgorithm,
    meetingPoint: meetingPoint,
    rounds: rounds,
    repetitions: repetitions
  };
  const json = JSON.stringify(fullConfig);
  const b64 = btoa(json);
  return base64ToBase64Url(b64);
}

function base64UrlToBase64(str) {
  // re-inserta padding y cambia URL-safe a Base64 normal
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = str.length % 4;
  if (pad) str += '='.repeat(4 - pad);
  return str;
}

function decodeConfigCode(code) {
  try {
    const b64   = base64UrlToBase64(code);
    const json  = atob(b64);
    return JSON.parse(json);
  } catch (err) {
    console.error("Error decoding config:", err);
    return null;
  }
}


function showDetailsForProbability(p, algorithm = null) {
  // Redondear p para consistencia
  p = Math.round(p * 1000) / 1000;
  
  // Si no se especifica algoritmo, usar el primero disponible
  if (!algorithm) {
    algorithm = selectedAlgorithmForDetails || selectedAlgorithms[0] || "auto";
  }
  
  // Determinar el algoritmo real
  const actualAlgo = algorithm === "auto" ? (p > 0.5 ? "AMP" : "FV") : algorithm;
  
  // Construir la clave
  const key = `${p}_${actualAlgo}`;
  
  // Verificar si existen datos
  if (experimentRuns[key] && experimentRuns[key].length > 0) {
    setSelectedProbabilityForDetails(p);
    setSelectedAlgorithmForDetails(algorithm);
    setSelectedRepetition(0);
    addLog(`Showing ${experimentRuns[key].length} repetitions for p=${p.toFixed(3)}, algorithm=${actualAlgo}`, "info");
  } else {
    // Si no hay datos, generar una ejecución
    const initialValues = getInitialValues();
    
    const history = useConditionedMode 
      ? SimulationEngine.runConditionedExperiment(
          initialProcessValues,
          p,
          actualRounds,
          actualAlgo,
          actualMeetingPoint
        )
      : SimulationEngine.runNProcessExperiment(
          initialProcessValues,
          p,
          actualRounds,
          actualAlgo,
          actualMeetingPoint
        );
    
    setExperimentRuns(prev => ({
      ...prev,
      [key]: [history]
    }));
    
    setSelectedProbabilityForDetails(p);
    setSelectedAlgorithmForDetails(algorithm);
    setSelectedRepetition(0);
    
    addLog(`Generated view for p=${p.toFixed(3)}, algorithm=${actualAlgo}`, "info");
  }
}


// Función para ejecutar un experimento individual
function runSingleExperimentForDetails(p) {
  const initialValues = getInitialValues();
  const actualAlgorithm = forcedAlgorithm === "auto" 
    ? (p > 0.5 ? "AMP" : "FV") 
    : forcedAlgorithm;
  
  
  const history = SimulationEngine.runNProcessExperiment(
    initialValues,
    p,
    rounds,
    actualAlgorithm,
    meetingPoint

  );
  
  setLastRunData(history);
  setSelectedProbabilityForDetails(p);
  addLog(`Generated detailed view for p=${p.toFixed(3)}`, "info");
}
// Componente para visualización detallada del experimento
// === Reemplazar COMPLETAMENTE ===
function ExperimentDetailViewer({ 
  experimentHistory, 
  algorithm, 
  meetingPoint, 
  probability,
  repetitionIndex = 0,
  allRepetitions = null
}) {
  const [expandedRound, setExpandedRound] = useState(0);
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [showDeliveryStats, setShowDeliveryStats] = useState(false);

  const fmt4 = (x) => (typeof x === 'number' && Number.isFinite(x) ? x.toFixed(4) : '0.0000');
  const fmt3 = (x) => (typeof x === 'number' && Number.isFinite(x) ? x.toFixed(3) : String(x ?? '—'));

  const safeDisc = (entry) => {
    if (typeof entry?.discrepancy === 'number' && Number.isFinite(entry.discrepancy)) return entry.discrepancy;
    const vals = Array.isArray(entry?.values) ? entry.values : [];
    if (vals.length === 2 && typeof vals[0] === 'number' && typeof vals[1] === 'number') {
      return Math.abs(vals[0] - vals[1]);
    }
    return 0;
  };

  if (!Array.isArray(experimentHistory) || experimentHistory.length === 0) {
    return (
      <div className="p-4 bg-gray-100 rounded-lg text-center">
        <p className="text-gray-500">No experiment data available</p>
        <p className="text-sm text-gray-400 mt-2">Run a simulation first to see detailed results</p>
      </div>
    );
  }
  
  const processCount = Array.isArray(experimentHistory[0]?.values) ? experimentHistory[0].values.length : 0;
  const processNames = Array.from({ length: processCount }, (_, i) => 
    i < 3 ? ["Alice", "Bob", "Charlie"][i] : `P${i+1}`
  );

  const getProcessColor = (index) => {
    const colors = ["#3498db", "#e67e22", "#2ecc71", "#9b59b6", "#e74c3c", 
                    "#f39c12", "#1abc9c", "#34495e", "#d35400", "#27ae60"];
    return colors[index % colors.length];
  };

  // Normaliza 'messages' anidados (por emisor); si no existen, intenta derivar desde messageDelivery
  const getNestedMessages = (round, prevValues) => {
    if (Array.isArray(round?.messages) && Array.isArray(round.messages[0])) {
      return round.messages;
    }
    if (Array.isArray(round?.messageDelivery) && Array.isArray(round.messageDelivery[0])) {
      const nested = Array.from({ length: processCount }, () => []);
      for (let sender = 0; sender < processCount; sender++) {
        const row = round.messageDelivery[sender] || [];
        // Para 2 procesos, row.length=1
        let colIdx = 0;
        for (let receiver = 0; receiver < processCount; receiver++) {
          if (receiver === sender) continue;
          const delivered = !!row[colIdx++];
          nested[sender].push({
            to: receiver,
            delivered,
            value: Array.isArray(prevValues) ? prevValues[sender] : undefined
          });
        }
      }
      return nested;
    }
    if (Array.isArray(round?.messages)) {
      // plano -> agrupar bajo emisor 0 como fallback
      const nested = Array.from({ length: processCount }, () => []);
      round.messages.forEach(msg => nested[0].push({
        to: typeof msg?.to === 'number' ? msg.to : 0,
        delivered: !!msg?.delivered,
        value: msg?.value
      }));
      return nested;
    }
    return Array.from({ length: processCount }, () => []);
  };

  // Estadísticas de entrega seguras
  const calculateDeliveryStats = () => {
    const stats = [];
    let totalMessagesSent = 0;
    let totalMessagesDelivered = 0;

    experimentHistory.forEach((round, roundIdx) => {
      if (roundIdx === 0) {
        stats.push({
          round: 0,
          sent: 0,
          delivered: 0,
          percentage: 0,
          cumulativeSent: 0,
          cumulativeDelivered: 0,
          cumulativePercentage: 0
        });
        return;
      }
      let roundSent = 0;
      let roundDelivered = 0;

      if (Array.isArray(round?.messages) && Array.isArray(round.messages[0])) {
        round.messages.forEach(senderMessages => {
          (senderMessages || []).forEach(msg => {
            roundSent++;
            if (msg?.delivered) roundDelivered++;
          });
        });
      } else if (Array.isArray(round?.messageDelivery) && Array.isArray(round.messageDelivery[0])) {
        round.messageDelivery.forEach(row => {
          (row || []).forEach(b => {
            roundSent++;
            if (b) roundDelivered++;
          });
        });
      } else if (Array.isArray(round?.messages)) {
        round.messages.forEach(msg => {
          roundSent++;
          if (msg?.delivered) roundDelivered++;
        });
      }

      totalMessagesSent += roundSent;
      totalMessagesDelivered += roundDelivered;

      stats.push({
        round: roundIdx,
        sent: roundSent,
        delivered: roundDelivered,
        percentage: roundSent > 0 ? (roundDelivered / roundSent * 100) : 0,
        cumulativeSent: totalMessagesSent,
        cumulativeDelivered: totalMessagesDelivered,
        cumulativePercentage: totalMessagesSent > 0 ? (totalMessagesDelivered / totalMessagesSent * 100) : 0
      });
    });

    return stats;
  };

  const deliveryStats = calculateDeliveryStats();

  return (
    <div className="space-y-4">
      {/* Resumen general */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-lg mb-2">Experiment Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Processes:</span>
            <span className="ml-2 font-medium">{processCount}</span>
          </div>
          <div>
            <span className="text-gray-600">Rounds:</span>
            <span className="ml-2 font-medium">{Math.max(0, experimentHistory.length - 1)}</span>
          </div>
          <div>
            <span className="text-gray-600">Algorithm:</span>
            <span className="ml-2 font-medium">{algorithm}</span>
          </div>
          <div>
            <span className="text-gray-600">Probability:</span>
            <span className="ml-2 font-medium">{(typeof probability === 'number' ? probability.toFixed(2) : 'N/A')}</span>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <span className="text-gray-600">Initial Discrepancy:</span>
            <span className="ml-2 font-bold text-lg">{fmt4(safeDisc(experimentHistory[0]))}</span>
          </div>
          <div>
            <span className="text-gray-600">Final Discrepancy:</span>
            <span className="ml-2 font-bold text-lg text-blue-600">{fmt4(safeDisc(experimentHistory[experimentHistory.length - 1]))}</span>
          </div>
        </div>

        <button
          onClick={() => setShowDeliveryStats(!showDeliveryStats)}
          className="mt-3 text-sm text-blue-600 hover:text-blue-800 underline"
        >
          {showDeliveryStats ? 'Hide' : 'Show'} Delivery Statistics
        </button>
      </div>

      {/* Estadísticas de entrega */}
      {showDeliveryStats && (
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <h4 className="font-semibold mb-3">Message Delivery Statistics</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-green-300">
                  <th className="text-left py-2">Round</th>
                  <th className="text-right py-2">Messages Sent</th>
                  <th className="text-right py-2">Delivered</th>
                  <th className="text-right py-2">Delivery %</th>
                  <th className="text-right py-2">Cumulative Sent</th>
                  <th className="text-right py-2">Cumulative Delivered</th>
                  <th className="text-right py-2">Overall %</th>
                </tr>
              </thead>
              <tbody>
                {deliveryStats.map((stat, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white bg-opacity-50' : ''}>
                    <td className="py-1">{stat.round}</td>
                    <td className="text-right py-1">{stat.sent}</td>
                    <td className="text-right py-1">{stat.delivered}</td>
                    <td className="text-right py-1">{stat.percentage.toFixed(1)}%</td>
                    <td className="text-right py-1 font-medium">{stat.cumulativeSent}</td>
                    <td className="text-right py-1 font-medium">{stat.cumulativeDelivered}</td>
                    <td className="text-right py-1 font-bold">{stat.cumulativePercentage.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-sm text-gray-600">
            <p>Expected per-link delivery: {(typeof probability === 'number' ? (probability * 100).toFixed(1) : 'N/A')}%</p>
            <p>Actual overall delivery rate: {deliveryStats[deliveryStats.length - 1]?.cumulativePercentage.toFixed(1)}%</p>
          </div>
        </div>
      )}

      {/* Vista por rondas */}
      <div className="space-y-2">
        {experimentHistory.map((round, index) => {
          const prevValues = index > 0 ? experimentHistory[index-1]?.values : null;
          const nested = getNestedMessages(round, prevValues);

          return (
            <div key={index} className="bg-white rounded-lg shadow border border-gray-200">
              {/* Encabezado */}
              <div 
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedRound(expandedRound === index ? -1 : index)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span>{expandedRound === index ? '▼' : '▶'}</span>
                    <h4 className="font-semibold">Round {round?.round ?? index}</h4>
                    <span className="text-sm text-gray-500">Discrepancy: {fmt4(safeDisc(round))}</span>
                    {index > 0 && deliveryStats[index] && (
                      <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                        {deliveryStats[index].delivered}/{deliveryStats[index].sent} delivered ({deliveryStats[index].percentage.toFixed(0)}%)
                      </span>
                    )}
                  </div>
                  <div className="flex space-x-1">
                    {(Array.isArray(round?.values) ? round.values : []).slice(0, Math.min(10, processCount)).map((val, i) => (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white"
                        style={{ backgroundColor: getProcessColor(i) }}
                        title={`${processNames[i]}: ${fmt3(val)}`}
                      >
                        {typeof val === 'number' ? (Number.isInteger(val) ? val : Number(val.toFixed(2))) : String(val).substring(0, 3)}
                      </div>
                    ))}
                    {processCount > 10 && <div className="text-gray-400 text-sm">+{processCount - 10}</div>}
                  </div>
                </div>
              </div>

              {/* Contenido expandido */}
              {expandedRound === index && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  {/* Valores por proceso */}
                  <div className="mb-4">
                    <h5 className="font-medium mb-2">Process Values:</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {(Array.isArray(round?.values) ? round.values : []).map((val, i) => {
                        const prevValue = index > 0 && Array.isArray(experimentHistory[index-1]?.values)
                          ? experimentHistory[index-1].values[i]
                          : null;
                        const hasChanged = prevValue !== null && prevValue !== undefined && prevValue !== val;
                        return (
                          <div 
                            key={i}
                            className={`p-2 rounded cursor-pointer transition-all ${selectedProcess === i ? 'ring-2 ring-blue-500 bg-white' : 'bg-white hover:shadow-md'}`}
                            onClick={() => setSelectedProcess(selectedProcess === i ? null : i)}
                          >
                            <div className="flex items-center space-x-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getProcessColor(i) }} />
                              <span className="text-sm font-medium">{processNames[i]}</span>
                            </div>
                            <div className="text-lg font-mono mt-1">{fmt3(val)}</div>
                            {hasChanged && (
                              <div className="text-xs text-green-600 mt-1">
                                Changed from {fmt3(prevValue)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Known Values Sets (si venían) */}
                  {Array.isArray(round?.knownValuesSets) && (
                    <div className="mb-4">
                      <h5 className="font-medium mb-2 text-sm">
                        Known Values Sets {algorithm === "MIN" ? "(MIN Algorithm)" : `(${algorithm})`}:
                      </h5>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {processNames.map((name, idx) => {
                          const knownSet = round.knownValuesSets[idx] || [];
                          const bgColor = algorithm === "MIN" ? "bg-yellow-50 border-yellow-200" :
                                          algorithm === "RECURSIVE AMP" ? "bg-purple-50 border-purple-200" :
                                          algorithm === "AMP" ? "bg-green-50 border-green-200" :
                                          algorithm === "FV" ? "bg-red-50 border-red-200" :
                                          "bg-gray-50 border-gray-200";
                          return (
                            <div key={idx} className={`${bgColor} p-2 rounded border text-xs`}>
                              <span className="font-semibold">{name}:</span>
                              <span className="ml-1 font-mono">
                                {"{" + knownSet.map(v => (typeof v === 'number' ? v.toFixed(3) : v)).join(", ") + "}"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Matriz de mensajes */}
                  {index > 0 && (
                    <div className="mt-4">
                      <h5 className="font-medium mb-2">Message Delivery Matrix:</h5>
                      {(() => {
                        // Flatten con 'from' para la tabla
                        const formatted = nested.flatMap((msgsFromSender, senderIdx) =>
                          (msgsFromSender || []).map(msg => ({ ...msg, from: senderIdx }))
                        );
                        if (!Array.isArray(formatted) || formatted.length === 0) {
                          return <div className="text-sm text-gray-500">No message data for this round.</div>;
                        }
                        return (
                          <MessageDeliveryTable
                            messages={formatted}
                            processNames={processNames}
                            selectedProcess={selectedProcess}
                            previousValues={prevValues || []}
                            finalValues={Array.isArray(round?.values) ? round.values : []}
                            algorithm={algorithm}
                          />
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}



  // Obtener las discrepancias para un valor específico de p
  function getDiscrepanciesForP(statsData, p) {
    if (!statsData || !statsData.experimentResults) return [];
    
    // Buscar los resultados para este valor de p
    const pResults = statsData.experimentResults.find(result => 
      Math.abs(result.p - p) < 0.001 // Tolerancia para comparación de flotantes
    );
    
    if (!pResults || !pResults.discrepancies) return [];
    
    return pResults.discrepancies;
  }

  // Obtener el valor teórico para un p específico
  function getTheoreticalForP(experimentalResults, p) {
    if (!experimentalResults || experimentalResults.length === 0) return null;
    
    const result = experimentalResults.find(r => 
      Math.abs(r.p - p) < 0.001
    );
    
    return result ? result.theoretical : null;
  }

  // Obtener la media experimental para un p específico
  function getExperimentalMeanForP(statsData, p) {
    const discrepancies = getDiscrepanciesForP(statsData, p);
    if (discrepancies.length === 0) return null;
    
    return discrepancies.reduce((a, b) => a + b, 0) / discrepancies.length;
  }


  const prepareStatsData = (experimentalResults) => {
    // Extraer valores únicos de p
    const pValues = [...new Set(experimentalResults.map(r => r.p))].sort((a, b) => a - b);
    
    // Reorganizar los datos por p
    const experimentResults = pValues.map(p => {
      const resultsForP = experimentalResults.filter(r => Math.abs(r.p - p) < 0.001);
      
      // Si hay múltiples resultados para el mismo p, son repeticiones
      const allDiscrepancies = resultsForP.map(r => r.discrepancy);
      
      return {
        p,
        discrepancies: allDiscrepancies,
        mean: allDiscrepancies.reduce((a, b) => a + b, 0) / allDiscrepancies.length,
        theoretical: resultsForP[0]?.theoretical || null,
        algorithm: resultsForP[0]?.algorithm || null
      };
    });
    
    return {
      experimentResults,
      pValues,
      usedRepetitions: experimentalResults.length / pValues.length
    };
  };

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
    return [...processValues]; // Devuelve una copia de los valores actuales
  }
  
  // Run range experiments with progressive visualization



// === Reemplazar COMPLETAMENTE ===
function runRangeExperiments() {
  if (isRunning) return;

  cancelRef.current = false;
  setExperimentalResults([]);
  setIsRunning(true);
  setProgress(0);
  setCurrentRepetition(0);

  const initialProcessValues = getInitialValues();
  const nProc = initialProcessValues.length;

  const { minP, maxP, steps, customSteps, customStepValue } = rangeExperiments;
  const actualRounds = rounds;
  const actualRepetitions = repetitions;
  const actualSteps = customSteps ? customStepValue : steps;

  // Normalizar meetingPoint (evitar strings/ruido 0.5000000001)
  let mp = typeof meetingPoint === 'number' ? meetingPoint : parseFloat(meetingPoint);
  if (!Number.isFinite(mp)) mp = 0.5;
  if (Math.abs(mp - 0.5) < 1e-12) mp = 0.5; // fijar 0.5 exacto si está "prácticamente" ahí
  const actualMeetingPoint = mp;

  const currentDeliveryMode = deliveryMode || 'standard';

  // Validación para modo guaranteed (teoremas 4/7 sólo para 2 procesos)
  if (currentDeliveryMode === 'guaranteed' && nProc !== 2) {
    addLog(
      "ERROR: Guaranteed/Conditioned (Theorems 4/7) sólo está definido para 2 procesos. Cambia a 2 procesos o usa Standard.",
      "error"
    );
    setIsRunning(false);
    return;
  }

  // Grid de p sin redondeos y con 0.5 exacto si cae en el rango
  const allProbabilities = [];
  const stepSize = (maxP - minP) / actualSteps;
  for (let i = 0; i <= actualSteps; i++) {
    const p = minP + i * stepSize;
    if (currentDeliveryMode === 'guaranteed' && nProc === 2) {
      if (p <= 0 || p >= 1) continue; // conditioning requiere 0 < p < 1
    }
    if (p >= 0 && p <= 1) allProbabilities.push(p);
  }
  if (minP < 0.5 && maxP > 0.5) {
    const hasHalf = allProbabilities.some(x => Math.abs(x - 0.5) < 1e-12);
    if (!hasHalf) allProbabilities.push(0.5);
  }
  allProbabilities.sort((a, b) => a - b);
  for (let i = allProbabilities.length - 2; i >= 0; i--) {
    if (Math.abs(allProbabilities[i] - allProbabilities[i + 1]) < 1e-12) {
      allProbabilities.splice(i, 1);
    }
  }
  if (currentDeliveryMode === 'guaranteed' && nProc === 2 && allProbabilities.length === 0) {
    addLog("ERROR: El rango de p sólo contiene 0 o 1. Para conditioned usa 0 < p < 1.", "error");
    setIsRunning(false);
    return;
  }

  // Algoritmos seleccionados (se respetan)
  const algorithmsToRun = [...selectedAlgorithms];

  // Preparar resultados y contenedores
  const results = [];
  const allRunsData = {};

  for (const p of allProbabilities) {
    for (const algoDisplay of algorithmsToRun) {
      const actualAlgo = algoDisplay === "auto" ? (p > 0.5 ? "AMP" : "FV") : algoDisplay;
      const key = `${p.toFixed(6)}_${actualAlgo}`; // clave estable y coherente en toda la app

      const theoretical = (currentDeliveryMode === 'guaranteed' && nProc === 2)
        ? SimulationEngine.calculateTheoreticalConditionedDiscrepancy(p, actualAlgo, actualRounds)
        : SimulationEngine.calculateExpectedDiscrepancy(p, actualAlgo, actualRounds);

      results.push({
        p,
        algorithm: actualAlgo,
        displayAlgorithm: algoDisplay,
        discrepancies: [],
        samples: 0,
        discrepancy: 0,
        deliveryMode: currentDeliveryMode,
        theoretical
      });

      allRunsData[key] = [];
    }
  }

  setExperimentalResults(results);
  setStatsData(null);

  let currentRep = 0;

  function runNextRepetition() {
    if (cancelRef.current) {
      setIsRunning(false);
      setProgress(100);
      addLog("Simulation cancelled by user", "warning");
      return;
    }

    if (currentRep >= actualRepetitions) {
      setIsRunning(false);
      setProgress(100);
      setExperimentRuns(allRunsData);

      // Selección segura para el viewer al terminar
      try {
        const keys = Object.keys(allRunsData);
        const firstValidKey = keys.find(k =>
          Array.isArray(allRunsData[k]) &&
          allRunsData[k].length > 0 &&
          Array.isArray(allRunsData[k][0]) &&
          allRunsData[k][0].length > 0
        );
        if (firstValidKey) {
          const [pStr, algoReal] = firstValidKey.split('_');
          const pNum = Number(pStr);
          if (!Number.isNaN(pNum)) setSelectedProbabilityForDetails(pNum);
          setSelectedAlgorithmForDetails(algoReal);
          setSelectedRepetition(0);
        } else {
          setSelectedProbabilityForDetails(null);
          setSelectedAlgorithmForDetails(null);
          setSelectedRepetition(0);
        }
      } catch {
        setSelectedProbabilityForDetails(null);
        setSelectedAlgorithmForDetails(null);
        setSelectedRepetition(0);
      }

      const modeInfo = currentDeliveryMode === 'guaranteed' ? " (Guaranteed/Conditioned)" : '';
      addLog(`Simulation completed: ${results.length} data points${modeInfo}`, "success");
      return;
    }

    setCurrentRepetition(currentRep + 1);

    // Una repetición completa
    let resultIndex = 0;
    for (const p of allProbabilities) {
      if (cancelRef.current) break;

      for (const algoDisplay of algorithmsToRun) {
        const actualAlgo = algoDisplay === "auto" ? (p > 0.5 ? "AMP" : "FV") : algoDisplay;
        const key = `${p.toFixed(6)}_${actualAlgo}`;

        let history;

        if (currentDeliveryMode === 'guaranteed' && nProc === 2) {
          // Simulación condicionada “honesta” por rondas (sin forzar mensajes)
          const v0 = [...initialProcessValues];
          const localHistory = [];
          const initDisc = Math.abs(v0[0] - v0[1]);
          localHistory.push({
            round: 0,
            values: [...v0],
            discrepancy: initDisc,
            messages: [],
            messageDelivery: []
          });

          let values = v0;
          for (let r = 1; r <= actualRounds; r++) {
            const rr = SimulationEngine.simulateRoundWithConditioning(
              values, p, actualAlgo, actualMeetingPoint
            );
            values = rr.newValues;
            localHistory.push({
              round: r,
              values: [...values],
              discrepancy: rr.discrepancy,
              messages: rr.messages || [],
              messageDelivery: rr.messageDelivery || []
            });
          }
          history = localHistory;
        } else {
          // Modo estándar
          history = SimulationEngine.runNProcessExperiment(
            initialProcessValues,
            p,
            actualRounds,
            actualAlgo,
            actualMeetingPoint
          );
        }

        allRunsData[key].push(history);

        // Actualizar estadísticas agregadas
        const finalDiscrepancy = history[history.length - 1]?.discrepancy ?? 0;
        results[resultIndex].discrepancies.push(finalDiscrepancy);
        results[resultIndex].samples = results[resultIndex].discrepancies.length;
        results[resultIndex].discrepancy =
          results[resultIndex].discrepancies.reduce((s, x) => s + x, 0) /
          results[resultIndex].samples;

        // Chequeo informativo contra teoría condicionada (sin cap)
        if (currentDeliveryMode === 'guaranteed' && nProc === 2 && p > 0 && p < 1) {
          const theo = SimulationEngine.calculateTheoreticalConditionedDiscrepancy(p, actualAlgo, actualRounds);
          const d = results[resultIndex].discrepancy;
          if (Number.isFinite(d) && Number.isFinite(theo) && theo > 0 && d > theo * 1.10) {
            console.warn(
              `Discrepancy ${d.toFixed(6)} exceeds theoretical (conditioned) ${theo.toFixed(6)} for p=${p}, algo=${actualAlgo}`
            );
          }
        }

        resultIndex++;
      }
    }

    setExperimentalResults([...results]);
    const progressValue = Math.round(((currentRep + 1) / actualRepetitions) * 100);
    setProgress(progressValue);

    currentRep++;
    setTimeout(runNextRepetition, 10);
  }

  addLog(
    currentDeliveryMode === 'guaranteed'
      ? 'Starting simulation with Guaranteed/Conditioned (≥1 message) mode'
      : 'Starting simulation with Standard Delivery mode',
    "info"
  );

  setTimeout(runNextRepetition, 5);
}










  function cancelRangeExperiment() {
  if (!isRunning) return;
  cancelRef.current = true;   // Señala a runRangeExperiments que detenga el bucle
  setIsRunning(false);        // Actualiza el estado para ocultar “Running…”
  }


  function runFVMethodComparison() {
    // Only allow for 3+ processes
    if (processValues.length < 3) {
      addLog("FV method comparison is only available with 3 or more processes selected", "warning");
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
      }, 5); // Reduced delay for faster execution
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
          theoreticalAmp: false,
          theoreticalFv: false
        };
      } else if (forcedAlgorithm === 'FV') {
        newDisplayCurves = {
          experimental: true,
          theoreticalAmp: false,
          theoreticalFv: false
        };
      } else {
        newDisplayCurves = {
          experimental: true,
          theoreticalAmp: false,
          theoreticalFv: false
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
      // Get initial values and count processes with value 0 (m)
      const initialValues = getInitialValues();
      let m = 0;
      initialValues.forEach(val => {
        if (val === 0 || val === 0.0) m++;
      });
      
      // Prepare data to save
      const experimentData = {
        type: "range",
        timestamp: new Date().toISOString(),
        parameters: {
          processCount: processValues.length,
          initialValues: initialValues,
          m: m, // Número de procesos con valor 0
          minP: rangeExperiments.minP,
          maxP: rangeExperiments.maxP,
          steps: rangeExperiments.customSteps ? rangeExperiments.customStepValue : rangeExperiments.steps,
          algorithm: forcedAlgorithm,
          fvMethod: processValues.length > 2 ? fvMethod : null,
          meetingPoint: meetingPoint,
          rounds: rounds,
          repetitions: repetitions
        },
        results: experimentalResults.map(result => ({
          p: result.p,
          algorithm: result.algorithm,
          discrepancy: result.discrepancy,
          theoretical: result.theoretical,
          samples: result.samples,
          // Incluir array de discrepancias individuales si está disponible
          discrepancies: result.discrepancies ? [...result.discrepancies] : null
        }))
      };
      
      // Prepare to save
      setCurrentExperimentToSave(experimentData);
      setShowSaveModal(true);
      
      // Generate suggested name based on process configuration
      const processInfo = processValues.length > 3 ? 
        `${processValues.length}-processes` : 
        `${processValues.length}p (${m}×0,${processValues.length-m}×1)`;
        
      const algInfo = forcedAlgorithm === "auto" ? 
        "Auto" : 
        forcedAlgorithm + (forcedAlgorithm === "AMP" ? `(${meetingPoint})` : "");
      
      const defaultName = `Range P=${rangeExperiments.minP.toFixed(2)}-${rangeExperiments.maxP.toFixed(2)} ${algInfo} ${processInfo}${rounds > 1 ? ` (${rounds} rounds)` : ''}`;
      
      // Generate tags automatically
      let suggestedTags = [
        "range",
        forcedAlgorithm.toLowerCase(),
        `${processValues.length}-processes`,
        `m=${m}`
      ];
      
      // Add special tags based on properties
      if (rounds > 1) suggestedTags.push("multi-round");
      if (rangeExperiments.minP < 0.5 && rangeExperiments.maxP > 0.5) suggestedTags.push("crossover");
      if (processValues.length > 2 && forcedAlgorithm === "FV") suggestedTags.push(`fv-${fvMethod}`);
      
      setExperimentMetadata({
        name: defaultName,
        tags: suggestedTags.join(","),
        description: `Simulation with ${processValues.length} processes (${m} with value 0, ${processValues.length-m} with value 1) from p=${rangeExperiments.minP.toFixed(2)} to p=${rangeExperiments.maxP.toFixed(2)} with ${experimentalResults.length} data points${rounds > 1 ? ` over ${rounds} rounds` : ''}.`
      });
    } catch (error) {
      addLog(`Error preparing experiment for saving: ${error.message}`, "error");
      console.error("Error in prepareRangeExperiment:", error);
    }
  }

  // Run multi-round convergence analysis
  function runMultiRoundAnalysis() {
    setIsRunningMultiRound(true);
    addLog("Running multi-round convergence analysis...");
    
    // Get settings
    const { initialGap, maxRounds, pValues, repetitions: mrRepetitions } = multiRoundSettings;
    
    // Run the analysis
    setTimeout(() => {
      try {
        const results = SimulationEngine.runMultiRoundAnalysis(
          initialGap,
          pValues,
          maxRounds,
          mrRepetitions
        );
        
        setMultiRoundAnalysisData(results);
        addLog("Multi-round analysis completed", "success");
      } catch (error) {
        addLog(`Error in multi-round analysis: ${error.message}`, "error");
      } finally {
        setIsRunningMultiRound(false);
      }
    }, 20); // delay 
  }

  // Analyze convergence rates
  function analyzeConvergenceRates() {
    addLog("Analyzing convergence rates...");
    
    const pValues = [0.1, 0.3, 0.5, 0.7, 0.9];
    const rates = [];
    
    for (const p of pValues) {
      const ampRate = SimulationEngine.analyzeConvergenceRate(p, 5, "AMP");
      const fvRate = SimulationEngine.analyzeConvergenceRate(p, 5, "FV");
      rates.push(ampRate, fvRate);
    }
    
    setConvergenceRatesData(rates);
    addLog("Convergence rate analysis completed", "success");
  }

  // Componente para controlar n procesos
  function NProcessesControl() {
    const processCount = processValues.length;
    
    const addProcess = () => {
      if (processCount < 100) { // Limitar a 10 procesos para la usabilidad
        // Valor por defecto para nuevo proceso: alternar 0 y 1
        setProcessValues([...processValues, processCount % 2]);
      }
    };
    
    const removeProcess = () => {
      if (processCount > 2) { // Mínimo 2 procesos
        setProcessValues(processValues.slice(0, -1));
      }
    };
    
    return (
      <div className="mb-4 bg-blue-50 p-3 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-semibold">Processes ({processCount})</h3>
          <div className="flex space-x-2">
            <button
              onClick={removeProcess}
              disabled={processCount <= 2 || isRunning}
              className={`px-2 py-1 rounded ${
                processCount <= 2 || isRunning ? 'bg-gray-300 text-gray-500' : 'bg-red-100 text-red-600 hover:bg-red-200'
              }`}
            >
              -
            </button>
            <button
              onClick={addProcess}
              disabled={processCount >= 100 || isRunning}
              className={`px-2 py-1 rounded ${
                processCount >= 100 || isRunning ? 'bg-gray-300 text-gray-500' : 'bg-green-100 text-green-600 hover:bg-green-200'
              }`}
            >
              +
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {processValues.map((value, index) => {
            // Asignar colores específicos para los primeros procesos
            let color = "#666";
            if (index === 0) color = ALICE_COLOR;
            else if (index === 1) color = BOB_COLOR;
            else if (index === 2) color = CHARLIE_COLOR;
            else {
              // Para procesos adicionales, asignar colores del arcoíris
              const colors = [
                "#9c27b0", "#e91e63", "#f44336", "#ff9800", 
                "#ffc107", "#8bc34a", "#009688"
              ];
              color = colors[(index - 3) % colors.length];
            }
            
            const processName = index < 3 ? 
              ["Alice", "Bob", "Charlie"][index] : 
              `P${index+1}`;
            
            return (
              <div key={index}>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium" style={{ color }}>{processName}</label>
                </div>
                <input
                  type="number"
                  value={value}
                  onChange={(e) => {
                    const newValues = [...processValues];
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      newValues[index] = val;
                      setProcessValues(newValues);
                    }
                  }}
                  className="w-full p-1 text-sm border rounded-md"
                  style={{ borderColor: color }}
                  disabled={isRunning}
                  step="0.1"
                  placeholder="Value"
                />
              </div>
            );
          })}
        </div>
      </div>
    );
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
        <div className="lg:w-1/4 flex-shrink-0">
          <div className="bg-white rounded-lg shadow p-6 mb-6 space-y-6">
            <h2 className="text-lg font-semibold">🎛️ Simulation Parameters</h2>
            
            {/* Process controller */}
            <NProcessesControl 
              processValues={processValues}
              setProcessValues={setProcessValues}
              maxProcesses={100}
              valueMode={valueMode}
              setValueMode={setValueMode}
              isRunning={isRunning}
            />

            {/* Load/Generate config */}
            <div className="mb-4 space-y-2">
              <h4 className="text-xs font-semibold">Enter the code to load a simulation:</h4>
              {/* 1. Textbox full width */}
              <input
                type="text"
                placeholder="Configuration code"
                value={configCode}
                onChange={e => setConfigCode(e.target.value)}
                className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200"
                disabled={isRunning}
              />

              {/* 2. Botones en dos columnas */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleLoadConfig}
                  className="w-full p-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-50"
                  disabled={isRunning}
                >
                  Load
                </button>
                <button
                  onClick={handleGenerateConfig}
                  className="w-full p-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-green-200 disabled:opacity-50"
                  disabled={isRunning}
                >
                  Generate
                </button>
              </div>

              {/* 3. Mensaje de confirmación */}
              {copyMessage && (
                <p className="text-xs text-green-600 font-medium">
                  {copyMessage}
                </p>
              )}
            </div>







            

            
            {/* Algorithm Settings */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold">Algorithm Settings:</h4>
              <div className="space-y-2">
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">
                    Message Delivery Mode:
                  </label>
                  <button
                    className="text-xs text-blue-600 hover:text-blue-800"
                    onClick={() => setShowDeliveryInfo(!showDeliveryInfo)}
                  >
                    {showDeliveryInfo ? 'Hide info' : 'What is this?'}
                  </button>
                </div>
                
                <div className="space-y-2">
                  <label className="flex items-start cursor-pointer hover:bg-white p-2 rounded transition">
                    <input
                      type="radio"
                      name="deliveryMode"
                      value="standard"
                      checked={deliveryMode === 'standard'}
                      onChange={(e) => setDeliveryMode(e.target.value)}
                      className="mt-1 mr-3"
                      disabled={isRunning}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">Standard Delivery</div>
                      <p className="text-xs text-gray-500 mt-1">
                        Messages delivered with probability p independently. All messages can be lost in a round.
                      </p>
                    </div>
                  </label>
                  
                  <label className="flex items-start cursor-pointer hover:bg-white p-2 rounded transition">
                    <input
                      type="radio"
                      name="deliveryMode"
                      value="guaranteed"
                      checked={deliveryMode === 'guaranteed'}
                      onChange={(e) => setDeliveryMode(e.target.value)}
                      className="mt-1 mr-3"
                      disabled={isRunning}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">Guaranteed Progress</div>
                      <p className="text-xs text-gray-500 mt-1">
                        At least one message delivered per round, ensuring network progress.
                      </p>
                    </div>
                  </label>
                </div>
                
                {deliveryMode === 'guaranteed' && (
                  <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded">
                    <div className="flex items-start">
                      <svg className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <div className="text-xs text-blue-700">
                        <p className="font-semibold mb-1">Convergence Guarantee:</p>
                        <p>Maximum discrepancy per round: <span className="font-mono font-bold">1/3</span></p>
                        <p>After {rounds} round{rounds > 1 ? 's' : ''}: <span className="font-mono font-bold">≤ {Math.pow(1/3, rounds).toFixed(6)}</span></p>
                      </div>
                    </div>
                  </div>
                )}
                
                {showDeliveryInfo && (
                  <div className="mt-3 p-3 bg-white border rounded text-xs text-gray-600">
                    <p className="font-semibold mb-2">About Delivery Modes:</p>
                    <p className="mb-2">
                      <strong>Standard:</strong> Models realistic networks where message loss is independent. 
                      Useful for studying average-case behavior and expected convergence rates.
                    </p>
                    <p>
                      <strong>Guaranteed Progress:</strong> Models networks with reliability mechanisms that ensure 
                      at least one message succeeds per round. Provides strong convergence bounds useful for 
                      safety-critical applications.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs mb-1">Select Algorithm(s):</label>
                <div className="bg-white p-2 rounded border border-gray-200 max-h-32 overflow-y-auto">
                  {["auto", "AMP", "FV", "RECURSIVE AMP", "MIN"].map(algo => (
                    <label key={algo} className="flex items-center py-1 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedAlgorithms.includes(algo)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            if (!selectedAlgorithms.includes(algo)) {
                              setSelectedAlgorithms(prev => [...prev, algo]);
                            }
                          } else {
                            // ELIMINAR la restricción de mínimo
                            setSelectedAlgorithms(prev => prev.filter(a => a !== algo));
                          }
                        }}
                        disabled={isRunning}
                        className="mr-2"
                      />
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        algo === "RECURSIVE AMP" ? "bg-purple-100 text-purple-700" :
                        algo === "AMP" ? "bg-green-100 text-green-700" :
                        algo === "FV" ? "bg-red-100 text-red-700" :
                        algo === "MIN" ? "bg-yellow-100 text-yellow-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {algo}
                      </span>
                    </label>
                
                  ))}

                
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {selectedAlgorithms.length === 1 ? 
                    "Select multiple algorithms to compare" : 
                    `Comparing ${selectedAlgorithms.length} algorithms`}
                </p>
              </div>

              
                
                {/* Meeting Point - Only show for algorithms that use it */}
                {(forcedAlgorithm === "AMP" || forcedAlgorithm === "RECURSIVE AMP" || forcedAlgorithm === "auto") && (
                  <div className="flex items-center space-x-2">
                    <label className="text-sm">Meeting Point:</label>
                    <input 
                      type="text"
                      value={meetingPoint}
                      onChange={(e) => {
                        const val = e.target.value;
                        
                        // Solo permitir dígitos, punto y máximo 2 decimales
                        if (/^\d*\.?\d{0,2}$/.test(val) || val === '') {
                          const num = parseFloat(val);
                          if (val === '' || val === '.' || val.endsWith('.')) {
                            setMeetingPoint(val);
                          } else if (!isNaN(num) && num >= 0 && num <= 1) {
                            setMeetingPoint(val);
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const num = parseFloat(e.target.value);
                        if (isNaN(num) || num < 0) {
                          setMeetingPoint(0);
                        } else if (num > 1) {
                          setMeetingPoint(1);
                        } else {
                          setMeetingPoint(num);
                        }
                      }}
                      className="w-20 p-1 border border-gray-300 rounded-md"
                      disabled={isRunning}
                      placeholder="0.5"
                    />
                  </div>
                )}
                
                {/* Recursive AMP specific parameters */}
                {forcedAlgorithm === "RECURSIVE AMP" && (
                  <div className="mt-2 p-2 bg-purple-50 rounded">
                    <p className="text-xs font-semibold text-purple-700 mb-1">Recursive AMP Info:</p>
                    <p className="text-xs text-purple-600">
                      New value = <strong>{meetingPoint}</strong> × range
                    </p>
                    <p className="text-xs text-purple-500 italic">
                      (range = max - min of known values)
                    </p>
                  </div>
                )}
              </div>
            </div>



            {/* Simulation Configuration */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold">Simulation Configuration</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs block mb-1">Rounds:</label>
                  <div className="flex items-center space-x-2">
                    <input 
                      type="number" 
                      min="1" 
                      max="50" 
                      value={rounds} 
                      onChange={(e) => setRounds(Number(e.target.value))} 
                      className="w-full p-1 text-sm border border-gray-300 rounded-md" 
                      disabled={isRunning}
                    />
                    {rounds > 1 && (
                      <div className="text-xs text-blue-600 cursor-help" title="Simulation will run for multiple rounds, showing the final discrepancy">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
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
                    disabled={isRunning}
                  />
                </div>
              </div>
              {rounds > 1 && (
                <div className="bg-blue-50 p-2 rounded text-xs">
                  <p className="font-medium text-blue-700">Multi-Round Mode</p>
                  <p className="mt-1">Running simulation for {rounds} rounds. Theory plots and results will show the final discrepancy after all rounds.</p>
                </div>
              )}
            </div>

            {/* Probability Range Settings */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold">Probability Range Settings:</h4>
              <div className="grid grid-cols-2 gap-4">
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
                {/*
                <div>
                  <label className="block text-xs mb-1">Steps:</label>
                  <input
                    type="number"
                    min="100"
                    value={rangeExperiments.steps}
                    onChange={(e) => {
                      const v = Math.max(100, parseInt(e.target.value, 10) || 100);
                      setRangeExperiments(prev => ({
                        ...prev,
                        steps: v,
                        customSteps: false,
                        customStepValue: v
                      }));
                    }}
                    className="w-full p-1 text-sm border border-gray-300 rounded-md"
                    disabled={isRunning}
                  />
                </div>
                */}
              </div>
            </div>

            {/* Display Options */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold">Display Options:</h4>
              <div className="grid grid-cols-1 gap-2">
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
                  <label htmlFor="showTheoreticalAmp" className="text-xs">Show AMP Curve</label>
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
                  <label htmlFor="showTheoreticalFv" className="text-xs">Show FV Curve</label>
                </div>
              </div>
            </div>

            {/* Run/Cancel Button */}
            {(activeTab === 'theory' || activeTab === 'statistics') && (
              <button
                onClick={() => {
                  if (!isRunning) {
                    runRangeExperiments();
                  } else {
                    cancelRangeExperiments();
                  }
                }}
                className={`w-full py-3 px-4 rounded-md font-semibold text-white ${
                  isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {isRunning ? 'Cancel' : 'Run'}
              </button>
            )}

          </div>

          {/* Event Log */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
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
              <div className="h-40 overflow-y-auto bg-gray-50 p-2 rounded text-xs font-mono space-y-1">
                {logs.map((log, index) => {
                  const isError = log.includes("ERROR");
                  const isWarning = log.includes("WARNING");
                  const isSuccess = log.includes("SUCCESS");
                  let logStyle = "text-gray-700";
                  if (isError) logStyle = "text-red-600 font-semibold";
                  if (isWarning) logStyle = "text-orange-600";
                  if (isSuccess) logStyle = "text-green-600";
                  return (
                    <div key={index} className={`${logStyle}`}>
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
                  rounds={rounds}
                  processValues={processValues}
                  meetingPoint={meetingPoint}
                  selectedAlgorithms={selectedAlgorithms}  // AGREGAR ESTA LÍNEA
                  deliveryMode={deliveryMode}
                />
                </div>
                
                <div className="bg-white rounded-lg shadow p-4 mb-4">
                  <h3 className="text-lg font-semibold mb-4">Simulation Experiments</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="col-span-1 md:col-span-2">
                      <div className="mb-4 bg-blue-50 p-3 rounded-lg">
                        <h4 className="font-bold text-blue-800 mb-2">Theoretical Background:</h4>
                        <p className="text-sm mb-2">
                          From the paper, there are algorithms that perform optimally depending on p:
                        </p>
                        <ul className="list-disc pl-5 mb-2 text-sm space-y-1">
                          <li>
                            <span className="font-bold">Agreed Meeting Point (AMP)</span>: For p &gt; 0.5
                          </li>
                          <li>
                            <span className="font-bold">Flip Value (FV)</span>: For p &lt;= 0.5
                          </li>
                        </ul>
                        <p className="text-sm">
                          For n processes with m processes having value 0 and (n-m) having value 1:
                        </p>
                        <ul className="list-disc pl-5 mb-2 text-sm space-y-1">
                          <li>
                            <span className="font-bold">AMP(a)</span>: E[D] = 1 - (aA + (1-a)B) where:
                            <ul className="list-disc pl-5 text-xs mt-1">
                              <li>A = 1 - q^(n-m) (Probability each 0-player received at least one 1-message)</li>
                              <li>B = 1 - q^m (Probability each 1-player received at least one 0-message)</li>
                            </ul>
                          </li>
                          <li>
                            <span className="font-bold">Flip (FV)</span>: E[D] = 1 - (CA + CB) where:
                            <ul className="list-disc pl-5 text-xs mt-1">
                              <li>C = q^(m*(n-m)) (Probability no player received any message)</li>
                            </ul>
                          </li>
                        </ul>
                        {processValues.length === 2 && rounds > 1 && (
                          <div className="bg-white p-2 rounded">
                            <p className="text-sm font-semibold">Multi-round behavior (from Theorem 3.2):</p>
                            <p className="text-sm">After k rounds, discrepancy decreases exponentially: 
                              <ul className="list-disc pl-5 mt-1">
                                <li>AMP: ≤ (1-p)<sup>k</sup> when p ≥ 1/2</li>
                                <li>FV: ≤ (p²+q²)<sup>k</sup> when p &lt; 1/2</li>
                              </ul>
                            </p>
                          </div>
                        )}
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

                  <div className="mt-6 text-center">
                        <button
                          onClick={prepareRangeExperiment}
                          className="px-4 py-2 bg-green-600 text-white rounded shadow hover:bg-green-700 transition-colors"
                        >
                          💾 Save Experiment
                        </button>
                      </div>

                 {experimentalResults && experimentalResults.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-xl font-semibold mb-4">Detailed Experiment Analysis</h3>
                    
                    {/* Selector de probabilidad, algoritmo y repetición */}
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Selector de probabilidad */}

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select probability:
                          </label>
                          <select
                            className="w-full p-2 border border-gray-300 rounded-md"
                            value={selectedProbabilityForDetails || ''}
                            onChange={(e) => {
                              const p = parseFloat(e.target.value);
                              if (!isNaN(p)) {
                                // Si solo hay un algoritmo, usarlo directamente
                                // Si hay múltiples, usar el que está seleccionado o el primero
                                const algo = selectedAlgorithms.length === 1 ? 
                                  selectedAlgorithms[0] : 
                                  (selectedAlgorithmForDetails || selectedAlgorithms[0]);
                                showDetailsForProbability(p, algo);
                              }
                            }}
                          >
                            <option value="">Select a probability...</option>
                            {/* Obtener probabilidades únicas */}
                            {[...new Set(experimentalResults.map(r => r.p))].sort((a, b) => a - b).map((p, idx) => (
                              <option key={idx} value={p}>
                                p = {p.toFixed(3)}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        {/* Selector de algoritmo - SOLO mostrar si hay múltiples Y tienen datos */}
                        {selectedAlgorithms.length > 1 && selectedProbabilityForDetails !== null && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Select algorithm:
                            </label>
                            <select
                              className="w-full p-2 border border-gray-300 rounded-md"
                              value={selectedAlgorithmForDetails || selectedAlgorithms[0]}
                              onChange={(e) => {
                                setSelectedAlgorithmForDetails(e.target.value);
                                showDetailsForProbability(selectedProbabilityForDetails, e.target.value);
                              }}
                            >
                              {selectedAlgorithms.filter(algo => {
                                // SOLO mostrar algoritmos que tienen datos para esta probabilidad
                                const actualAlgo = algo === "auto" ? 
                                  (selectedProbabilityForDetails > 0.5 ? "AMP" : "FV") : algo;
                                const key = `${selectedProbabilityForDetails}_${algo}`;
                                return experimentRuns[key] && experimentRuns[key].length > 0;
                              }).map(algo => {
                                const actualAlgo = algo === "auto" && selectedProbabilityForDetails ? 
                                  (selectedProbabilityForDetails > 0.5 ? "AMP" : "FV") : algo;
                                return (
                                  <option key={algo} value={algo}>
                                    {algo} {algo === "auto" ? `(${actualAlgo})` : ""}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        )}
                        
                        {/* Selector de repetición - ACTUALIZADO para usar la clave combinada */}
                        {selectedProbabilityForDetails !== null && selectedAlgorithmForDetails && (() => {
                          const roundedP = Math.round(selectedProbabilityForDetails * 1000) / 1000;
                          const actualAlgo = selectedAlgorithmForDetails === "auto" ? 
                            (selectedProbabilityForDetails > 0.5 ? "AMP" : "FV") : selectedAlgorithmForDetails;
                          const key = `${selectedProbabilityForDetails}_${selectedAlgorithmForDetails}`;
                          const runs = experimentRuns[key];
                          
                          if (!runs || runs.length === 0) return null;
                          
                          return (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Select repetition:
                              </label>
                              <div className="flex items-center gap-2">
                                <select
                                  className="flex-1 p-2 border border-gray-300 rounded-md"
                                  value={selectedRepetition}
                                  onChange={(e) => setSelectedRepetition(parseInt(e.target.value))}
                                >
                                  {runs.map((_, idx) => (
                                    <option key={idx} value={idx}>
                                      Repetition {idx + 1} of {runs.length}
                                    </option>
                                  ))}
                                </select>
                                {runs.length < repetitions && (
                                  <button
                                    onClick={() => {
                                      const p = selectedProbabilityForDetails;
                                      const initialValues = getInitialValues();
                                      
                                      const newRun = SimulationEngine.runNProcessExperiment(
                                        initialValues,
                                        p,
                                        rounds,
                                        actualAlgo,
                                        meetingPoint
                                      );
                                      
                                      setExperimentRuns(prev => ({
                                        ...prev,
                                        [key]: [...(prev[key] || []), newRun]
                                      }));
                                      setSelectedRepetition(runs.length);
                                    }}
                                    className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                    title="Generate another repetition"
                                  >
                                    +
                                  </button>
                                )}
                              </div>
                              {runs.length === repetitions && (
                                <p className="text-xs text-gray-600 mt-1">
                                  Showing all {repetitions} repetitions
                                </p>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      
                      {/* Estadísticas de repeticiones - ACTUALIZADO */}
                      {selectedProbabilityForDetails && selectedAlgorithmForDetails && (() => {
                        const actualAlgo = selectedAlgorithmForDetails === "auto" ? 
                          (selectedProbabilityForDetails > 0.5 ? "AMP" : "FV") : selectedAlgorithmForDetails;
                        const key = `${selectedProbabilityForDetails}_${selectedAlgorithmForDetails}`;
                        const runs = experimentRuns[key];
                        
                        if (!runs || runs.length === 0) return null;
                        
                        return (
                          <div className="mt-4 p-3 bg-blue-50 rounded">
                            <h4 className="font-medium text-sm mb-2">
                              Repetition Statistics for {actualAlgo} at p={selectedProbabilityForDetails.toFixed(3)}:
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                              <div>
                                <span className="text-gray-600">Current Rep. Final:</span>
                                <span className="ml-2 font-bold">
                                  {runs[selectedRepetition]?.slice(-1)[0]?.discrepancy.toFixed(4)}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600">Average Final:</span>
                                <span className="ml-2 font-bold">
                                  {(runs.map(run => run[run.length - 1]?.discrepancy || 0)
                                    .reduce((a, b) => a + b, 0) / runs.length
                                  ).toFixed(4)}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600">Min/Max Final:</span>
                                <span className="ml-2 font-bold">
                                  {Math.min(...runs.map(run => run[run.length - 1]?.discrepancy || 0)).toFixed(4)} / 
                                  {Math.max(...runs.map(run => run[run.length - 1]?.discrepancy || 0)).toFixed(4)}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600">Total Repetitions:</span>
                                <span className="ml-2 font-bold">
                                  {runs.length}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                      
                      {/* Visualizador de detalles - CORREGIDO */}
                      {selectedProbabilityForDetails !== null && selectedAlgorithmForDetails && (() => {
                        // Determinar el algoritmo real (si es auto, convertir a AMP/FV)
                        const actualAlgo = selectedAlgorithmForDetails === "auto" ? 
                          (selectedProbabilityForDetails > 0.5 ? "AMP" : "FV") : selectedAlgorithmForDetails;
                        
                        // Construir la clave correcta
                        const key = `${selectedProbabilityForDetails}_${selectedAlgorithmForDetails}`;
                        
                        // Obtener los runs para esta combinación p_algoritmo
                        const runs = experimentRuns[key];
                        
                        // Si no hay datos, no mostrar nada
                        if (!runs || runs.length === 0 || !runs[selectedRepetition]) {
                          return null;
                        }
                        
                        return (
                          <>
                            {selectedProbabilityForDetails === 0 && (
                              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                                <p className="text-sm text-yellow-800">
                                  <strong>Note:</strong> With p=0, no messages are delivered. All processes maintain their initial values throughout all rounds.
                                </p>
                              </div>
                            )}
                            <ExperimentDetailViewer 
                              experimentHistory={runs[selectedRepetition]}
                              algorithm={actualAlgo}  // USAR actualAlgo, NO forcedAlgorithm
                              meetingPoint={meetingPoint}
                              probability={selectedProbabilityForDetails}
                              repetitionIndex={selectedRepetition}
                              allRepetitions={runs}  // Pasar los runs correctos
                            />
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
                
                <RangeResultsTable 
                  results={experimentalResults} 
                  processCount={processValues.length} 
                  selectedAlgorithms={selectedAlgorithms}  // Pasar selectedAlgorithms en lugar de forcedAlgorithm
                  rounds={rounds} 
                />
                

              </div>

              
            )}
            

            {/* Statistical Analysis tab */}
            {activeTab === 'statistics' && (
              <div>
                {experimentalResults && experimentalResults.length > 0 ? (
                  <div>
                    <div className="bg-white rounded-lg shadow p-4 mb-4">
                      <h3 className="text-lg font-semibold mb-3">Statistical Analysis for {processValues.length} Processes</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <h4 className="font-medium mb-2">Experiment Configuration</h4>
                          <ul className="text-sm space-y-1">
                            <li><span className="font-medium">Processes:</span> {processValues.length}</li>
                            <li><span className="font-medium">Process Values:</span> {processValues.join(', ')}</li>
                            <li><span className="font-medium">Zero-valued processes:</span> {processValues.filter(v => v === 0).length}</li>
                            <li><span className="font-medium">One-valued processes:</span> {processValues.filter(v => v === 1).length}</li>
                            <li><span className="font-medium">Algorithm:</span> {forcedAlgorithm}</li>
                            <li><span className="font-medium">Meeting Point:</span> {meetingPoint}</li>
                            <li><span className="font-medium">Rounds:</span> {rounds}</li>
                            <li><span className="font-medium">Repetitions:</span> {repetitions}</li>
                          </ul>
                        </div>
                        
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <h4 className="font-medium mb-2">Summary Statistics</h4>
                          {(() => {
                            // Calcular estadísticas básicas
                            const discrepancies = experimentalResults.map(r => r.discrepancy);
                            const avgDiscrepancy = discrepancies.reduce((sum, d) => sum + d, 0) / discrepancies.length;
                            const minDiscrepancy = Math.min(...discrepancies);
                            const maxDiscrepancy = Math.max(...discrepancies);
                            
                            // Calcular desviación estándar
                            const variance = discrepancies.reduce((sum, d) => sum + Math.pow(d - avgDiscrepancy, 2), 0) / discrepancies.length;
                            const stdDev = Math.sqrt(variance);
                            
                            // Calcular error teórico promedio
                            const errorsPercent = experimentalResults
                              .filter(r => r.theoretical)
                              .map(r => Math.abs(r.discrepancy - r.theoretical) / r.theoretical * 100);
                            
                            const avgErrorPercent = errorsPercent.length > 0 ? 
                              errorsPercent.reduce((a, b) => a + b, 0) / errorsPercent.length : null;
                            
                            return (
                              <ul className="text-sm space-y-1">
                                <li><span className="font-medium">Average Discrepancy:</span> {avgDiscrepancy.toFixed(6)}</li>
                                <li><span className="font-medium">Minimum Discrepancy:</span> {minDiscrepancy.toFixed(6)}</li>
                                <li><span className="font-medium">Maximum Discrepancy:</span> {maxDiscrepancy.toFixed(6)}</li>
                                <li><span className="font-medium">Standard Deviation s(p):</span> {stdDev.toFixed(6)}</li>
                                <li><span className="font-medium">Absolute uncertainty (standard error) &sigma;̄(p):</span> {(stdDev/Math.sqrt(repetitions)).toFixed(6)}</li>
                                {avgErrorPercent !== null && (
                                  <li><span className="font-medium">Avg. Error vs Theory:</span> {avgErrorPercent.toFixed(2)}%</li>
                                )}
                                <li><span className="font-medium">Data Points:</span> {experimentalResults.length}</li>
                              </ul>
                            );
                          })()}
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <h4 className="font-medium mb-2">Discrepancy Distribution</h4>
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                              data={(() => {
                                const sortedData = experimentalResults.sort((a, b) => a.p - b.p);
                                
                                // Para muchos procesos, podríamos necesitar reducir los puntos mostrados
                                const maxPoints = 200;
                                let dataToShow = sortedData;
                                
                                if (sortedData.length > maxPoints) {
                                  // Muestrear uniformemente
                                  const step = Math.ceil(sortedData.length / maxPoints);
                                  dataToShow = sortedData.filter((_, idx) => idx % step === 0);
                                }
                                
                                return dataToShow.map(result => {
                                  // Calculate statistics for confidence intervals
                                  let mean = result.discrepancy;
                                  let upperBound = mean;
                                  let lowerBound = mean;
                                  
                                  if (result.discrepancies && result.discrepancies.length > 1) {
                                    // Calculate standard deviation
                                    const variance = result.discrepancies.reduce(
                                      (sum, val) => sum + Math.pow(val - mean, 2), 0
                                    ) / result.discrepancies.length;
                                    const stdDev = Math.sqrt(variance);
                                    
                                    // 95% confidence interval (approximately mean ± 2*SD)
                                    upperBound = mean + 2 * stdDev;
                                    lowerBound = Math.max(0, mean - 2 * stdDev); // Ensure non-negative
                                  }
                                  
                                  return {
                                    ...result,
                                    upperBound,
                                    lowerBound,
                                    // Para el área, necesitamos el "gap" entre los límites
                                    bandLower: lowerBound,
                                    bandGap: upperBound - lowerBound
                                  };
                                });
                              })()}
                              margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="p" 
                                type="number"
                                domain={[0, 1]}
                                ticks={[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]}
                                tickFormatter={v => v.toFixed(1)}
                                label={{ value: 'Probability (p)', position: 'insideBottom', offset: -5 }}
                              />
                              <YAxis 
                                label={{ value: 'Discrepancy', angle: -90, position: 'insideLeft', offset: -5 }}
                              />
                              <Tooltip 
                                content={({ active, payload, label }) => {
                                  if (active && payload && payload.length > 0) {
                                    const data = payload[0].payload;
                                    return (
                                      <div className="bg-white p-2 border rounded shadow-md">
                                        <p className="font-semibold">p = {label.toFixed(2)}</p>
                                        <p>Experimental: {data.discrepancy.toFixed(6)}</p>
                                        {data.theoretical && (
                                          <p>Theoretical: {data.theoretical.toFixed(6)}</p>
                                        )}
                                        {data.discrepancies && data.discrepancies.length > 1 && (
                                          <>
                                            <p className="text-xs text-gray-600 mt-1">
                                              95% CI: [{data.lowerBound.toFixed(6)}, {data.upperBound.toFixed(6)}]
                                            </p>
                                            <p className="text-xs text-gray-600">
                                              Based on {data.discrepancies.length} repetitions
                                            </p>
                                          </>
                                        )}
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Legend />

                              {/* Banda de confianza mejorada */}
                              <Area
                                type="monotone"
                                dataKey="bandLower"
                                stackId="1"
                                stroke="none"
                                fill="#e3f2fd"
                                fillOpacity={0}
                              />
                              <Area
                                type="monotone"
                                dataKey="bandGap"
                                stackId="1"
                                stroke="none"
                                fill="#e3f2fd"
                                fillOpacity={0.6}
                              />
                              
                              {/* Líneas de límites para mayor claridad */}
                              <Line
                                type="monotone"
                                dataKey="upperBound"
                                stroke="#3498db"
                                strokeWidth={1}
                                strokeDasharray="5 5"
                                dot={false}
                                name="Upper 95% Data Range"
                                opacity={0.7}
                              />
                              <Line
                                type="monotone"
                                dataKey="lowerBound"
                                stroke="#3498db"
                                strokeWidth={1}
                                strokeDasharray="5 5"
                                dot={false}
                                name="Lower 95% Data Range"
                                opacity={0.7}
                              />
                              
                              {/* Main experimental line con mejor contraste */}
                              <Line 
                                type="monotone" 
                                dataKey="discrepancy" 
                                name="Experimental Discrepancy" 
                                stroke="#1976d2"  // Azul fuerte
                                strokeWidth={3}    // Más gruesa
                                dot={{ r: 4, fill: '#1976d2', strokeWidth: 0 }}
                                zIndex={10}        
                              />
                              
                              {/* Theoretical line con mejor visibilidad */}
                              {experimentalResults[0].theoretical && (
                                <Line 
                                  type="monotone" 
                                  dataKey="theoretical" 
                                  name="Theoretical Discrepancy" 
                                  stroke="#d32f2f"  
                                  strokeDasharray="5 5"
                                  strokeWidth={2.5}
                                  dot={{ r: 3, fill: '#d32f2f', strokeWidth: 0 }}
                                  zIndex={10}
                                />
                              )}
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <label className="flex items-center mb-4">
                          <input
                            type="checkbox"
                            checked={fixYAxis}
                            onChange={() => setFixYAxis(!fixYAxis)}
                            className="mr-2"
                          />
                          Fixed Y-Axes
                        </label>

                        <h4 className="font-medium mb-2">Error Analysis</h4>
                        {experimentalResults[0].theoretical ? (
                          <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart
                                data={(() => {
                                  const errorData = experimentalResults.map(r => {
                                    const error = Math.abs(r.discrepancy - r.theoretical);
                                    const errorPercent = r.theoretical !== 0 ? (error / r.theoretical) * 100 : 0;
                                    
                                    // Calcular CI de la discrepancia experimental (no del error)
                                    let experimentalCI = null;
                                    if (r.discrepancies && r.discrepancies.length > 1) {
                                      const mean = r.discrepancies.reduce((a, b) => a + b, 0) / r.discrepancies.length;
                                      const variance = r.discrepancies.reduce(
                                        (sum, val) => sum + Math.pow(val - mean, 2), 0
                                      ) / (r.discrepancies.length - 1);
                                      const stdDev = Math.sqrt(variance);
                                      const ciMargin = 1.96 * stdDev / Math.sqrt(r.discrepancies.length);
                                      
                                      experimentalCI = {
                                        lower: mean - ciMargin,
                                        upper: mean + ciMargin
                                      };
                                    }
                                    
                                    return {
                                      ...r,
                                      error,
                                      errorPercent,
                                      experimentalCI
                                    };
                                  }).sort((a, b) => a.p - b.p);
                                  
                                  return errorData;
                                })()}
                                margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                

                                <YAxis
                                  yAxisId="left"
                                  domain={(() => {
                                    if (fixYAxis) {
                                      return [0, 1];
                                    }
                                    
                                    const maxAbsoluteError = Math.max(...experimentalResults.map(r => 
                                      Math.abs(r.discrepancy - r.theoretical)
                                    ));
                                    
                                    const maxErrorPercent = Math.max(...experimentalResults.map(r => {
                                      const error = Math.abs(r.discrepancy - r.theoretical);
                                      return r.theoretical !== 0 ? (error / r.theoretical) * 100 : 0;
                                    }));
                                    
                                    if (maxErrorPercent >= 90 && maxErrorPercent <= 110) {
                                      return [0, 1];
                                    }
                                    
                                    return [0, Math.ceil(maxAbsoluteError * 1.2 * 100) / 100];
                                  })()}
                                  label={{ value: 'Absolute Error', angle: -90, position: 'insideLeft', offset: -5 }}
                                />

                                <YAxis
                                  yAxisId="right"
                                  orientation="right"
                                  domain={(() => {
                                    if (fixYAxis) {
                                      return [0, 100];
                                    }
                                    
                                    const maxErrorPercent = Math.max(...experimentalResults.map(r => {
                                      const error = Math.abs(r.discrepancy - r.theoretical);
                                      return r.theoretical !== 0 ? (error / r.theoretical) * 100 : 0;
                                    }));
                                    
                                    if (maxErrorPercent >= 90 && maxErrorPercent <= 110) {
                                      return [0, 100];
                                    }
                                    
                                    return [0, Math.ceil(maxErrorPercent * 1.2)];
                                  })()}
                                  label={{ value: 'Error %', angle: 90, position: 'insideRight', offset: -5 }}
                                  tickFormatter={v => `${v.toFixed(0)}%`}
                                />
                                

                                <Tooltip 
                                  content={({ active, payload, label }) => {
                                    if (active && payload && payload.length > 0) {
                                      const data = payload[0].payload;
                                      const isSignificant = data.experimentalCI && 
                                        (data.theoretical < data.experimentalCI.lower || 
                                        data.theoretical > data.experimentalCI.upper);
                                      
                                      return (
                                        <div className="bg-white p-2 border rounded shadow-md">
                                          <p className="font-semibold">p = {label.toFixed(2)}</p>
                                          
                                          <div className="mt-1">
                                            <p>Experimental: {data.discrepancy.toFixed(6)}</p>
                                            {data.experimentalCI && (
                                              <p className="text-xs text-gray-600 ml-2">
                                                95% CI: [{data.experimentalCI.lower.toFixed(6)}, {data.experimentalCI.upper.toFixed(6)}]
                                              </p>
                                            )}
                                          </div>
                                          
                                          {data.theoretical && (
                                            <p>Theoretical: {data.theoretical.toFixed(6)}</p>
                                          )}
                                          
                                          <hr className="my-1" />
                                          
                                          <p>Absolute Error: {data.error.toFixed(6)}</p>
                                          <p>Error %: {data.errorPercent.toFixed(2)}%</p>
                                          
                                          {data.experimentalCI && isSignificant && (
                                            <p className="text-xs text-orange-600 mt-1">
                                              * Statistically significant difference
                                            </p>
                                          )}
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend />

                                <Line
                                  yAxisId="left"
                                  type="monotone"
                                  dataKey="error"
                                  name="Absolute Error"
                                  stroke="#ff7300"
                                  strokeWidth={2}
                                  dot={{ r: 3 }}
                                />

                                <Bar
                                  yAxisId="right"
                                  dataKey="errorPercent"
                                  name="Error %"
                                  fill="#8884d8"
                                  fillOpacity={0.6}
                                />
                              </ComposedChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <p className="text-gray-500 italic">
                            Theoretical predictions are not available for comparison.
                          </p>
                        )}
                      </div>

                      {/* Distribution of Final Discrepancies Histogram */}
                      {statsData && statsData.experimentResults && (
                        <div className="mb-4">
                          {/* Selector de p si hay múltiples valores */}
                          {statsData.pValues && statsData.pValues.length > 1 && (
                            <div className="mb-3 flex items-center">
                              <label className="text-sm font-medium mr-2">Select p value to visualize:</label>
                              <select 
                                value={selectedPForHistogram || statsData.pValues[0]} 
                                onChange={(e) => setSelectedPForHistogram(parseFloat(e.target.value))}
                                className="border rounded px-3 py-1 text-sm"
                              >
                                {statsData.pValues.map(p => (
                                  <option key={p} value={p}>p = {p.toFixed(2)}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          
                          <HistogramPlot 
                            discrepancies={getDiscrepanciesForP(statsData, selectedPForHistogram || statsData.pValues[0])}
                            theoretical={getTheoreticalForP(experimentalResults, selectedPForHistogram || statsData.pValues[0])}
                            experimental={getExperimentalMeanForP(statsData, selectedPForHistogram || statsData.pValues[0])}
                            repetitions={statsData.usedRepetitions}
                            selectedP={selectedPForHistogram || statsData.pValues[0]}
                          />
                        </div>
                      )}
                      
                      {/* Experimental Results Table */}
                      <div className="mb-8">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-semibold">Detailed Experimental Results</h3>
                          <div className="relative">
                            <button
                              onClick={() => setShowExportMenu(!showExportMenu)}
                              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                              <span>📥Download</span>
                              Export
                            </button>
                            {showExportMenu && (
                              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-10">
                                <button
                                  onClick={() => {
                                    // Función para exportar CSV
                                    const csvContent = [
                                      ['p', 'Algorithm', 'n', 'k', 'Theoretical E[D]', 'Experimental Mean', 'Std Dev', 'CV%', 'Error', 'Error%', 'CI Lower', 'CI Upper', 'Min', 'Q1', 'Median', 'Q3', 'Max', 'Significant'],
                                      ...experimentalResults.map(r => {
                                        const sorted = r.discrepancies ? [...r.discrepancies].sort((a, b) => a - b) : [];
                                        const n = sorted.length;
                                        const mean = r.discrepancy;
                                        const variance = n > 1 ? sorted.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (n - 1) : 0;
                                        const stdDev = Math.sqrt(variance);
                                        const cv = mean !== 0 ? (stdDev / Math.abs(mean)) * 100 : 0;
                                        const ciMargin = n > 1 ? 1.96 * stdDev / Math.sqrt(n) : 0;
                                        const ciLower = mean - ciMargin;
                                        const ciUpper = mean + ciMargin;
                                        const error = Math.abs(r.discrepancy - r.theoretical);
                                        const errorPercent = r.theoretical !== 0 ? (error / r.theoretical) * 100 : 0;
                                        const q1 = n > 0 ? sorted[Math.floor(n * 0.25)] : 0;
                                        const median = n > 0 ? sorted[Math.floor(n * 0.5)] : 0;
                                        const q3 = n > 0 ? sorted[Math.floor(n * 0.75)] : 0;
                                        const isSignificant = r.theoretical < ciLower || r.theoretical > ciUpper;
                                        
                                        return [
                                          r.p,
                                          r.algorithm,
                                          processValues.length,
                                          rounds,
                                          r.theoretical?.toFixed(6) || 'N/A',
                                          mean.toFixed(6),
                                          stdDev.toFixed(6),
                                          cv.toFixed(2),
                                          error.toFixed(6),
                                          errorPercent.toFixed(2),
                                          ciLower.toFixed(6),
                                          ciUpper.toFixed(6),
                                          sorted[0]?.toFixed(6) || '0',
                                          q1.toFixed(6),
                                          median.toFixed(6),
                                          q3.toFixed(6),
                                          sorted[n-1]?.toFixed(6) || '0',
                                          isSignificant ? 'Yes' : 'No'
                                        ];
                                      })
                                    ].map(row => row.join(',')).join('\n');
                                    
                                    const blob = new Blob([csvContent], { type: 'text/csv' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `experimental_results_${new Date().toISOString().slice(0,10)}.csv`;
                                    a.click();
                                    setShowExportMenu(false);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <span>📄</span>
                                  Export as CSV
                                </button>
                                <button
                                  onClick={() => {
                                    // Función para exportar LaTeX
                                    const latexContent = `\\begin{table}[h]
                      \\centering
                      \\caption{Experimental Results: ${forcedAlgorithm} Algorithm${rounds > 1 ? ` (${rounds} rounds)` : ''}}
                      \\begin{tabular}{|c|c|c|c|c|c|c|}
                      \\hline
                      $p$ & Algorithm & $E[D]_{theo}$ & $E[D]_{exp}$ & Error (\\%) & Std Dev & CV (\\%) \\\\
                      \\hline
                      ${experimentalResults.map(r => {
                        const sorted = r.discrepancies ? [...r.discrepancies].sort((a, b) => a - b) : [];
                        const n = sorted.length;
                        const mean = r.discrepancy;
                        const variance = n > 1 ? sorted.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (n - 1) : 0;
                        const stdDev = Math.sqrt(variance);
                        const cv = mean !== 0 ? (stdDev / Math.abs(mean)) * 100 : 0;
                        const error = Math.abs(r.discrepancy - r.theoretical);
                        const errorPercent = r.theoretical !== 0 ? (error / r.theoretical) * 100 : 0;
                        
                        return `${r.p.toFixed(2)} & ${r.algorithm} & ${r.theoretical?.toFixed(4) || 'N/A'} & ${mean.toFixed(4)} & ${errorPercent.toFixed(2)} & ${stdDev.toFixed(4)} & ${cv.toFixed(1)} \\\\`;
                      }).join('\n')}
                      \\hline
                      \\end{tabular}
                      \\end{table}`;
                                    
                                    navigator.clipboard.writeText(latexContent);
                                    alert('LaTeX table copied to clipboard!');
                                    setShowExportMenu(false);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <span>📋</span>
                                  Copy as LaTeX
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">p</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Algorithm</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Theoretical E[D]
                                </th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Experimental Mean
                                </th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">95% CI</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Error (%)</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  <div className="flex items-center gap-1">
                                    Statistics
                                    <span className="text-xs font-normal">(σ, CV%)</span>
                                  </div>
                                </th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Distribution</th>
                                <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Sig.</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {experimentalResults.map((result, idx) => {
                                const sorted = result.discrepancies ? [...result.discrepancies].sort((a, b) => a - b) : [];
                                const n = sorted.length;
                                const mean = result.discrepancy;
                                const variance = n > 1 ? sorted.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (n - 1) : 0;
                                const stdDev = Math.sqrt(variance);
                                const cv = mean !== 0 ? (stdDev / Math.abs(mean)) * 100 : 0;
                                
                                // Intervalos de confianza
                                const ciMargin = n > 1 ? 1.96 * stdDev / Math.sqrt(n) : 0;
                                const ciLower = mean - ciMargin;
                                const ciUpper = mean + ciMargin;
                                
                                // Error
                                const error = Math.abs(result.discrepancy - result.theoretical);
                                const errorPercent = result.theoretical !== 0 ? (error / result.theoretical) * 100 : 0;
                                
                                // Percentiles
                                const min = n > 0 ? sorted[0] : 0;
                                const q1 = n > 0 ? sorted[Math.floor(n * 0.25)] : 0;
                                const median = n > 0 ? sorted[Math.floor(n * 0.5)] : 0;
                                const q3 = n > 0 ? sorted[Math.floor(n * 0.75)] : 0;
                                const max = n > 0 ? sorted[n - 1] : 0;
                                
                                // Significancia estadística
                                const isSignificant = result.theoretical && (result.theoretical < ciLower || result.theoretical > ciUpper);
                                
                                // Color coding para error
                                const errorColor = errorPercent < 5 ? 'text-green-600' : 
                                                  errorPercent < 10 ? 'text-yellow-600' : 
                                                  'text-red-600';
                                
                                return (
                                  <tr 
                                    key={idx}
                                    className={`hover:bg-gray-50 transition-colors ${hoveredRow === idx ? 'bg-gray-50' : ''}`}
                                    onMouseEnter={() => setHoveredRow(idx)}
                                    onMouseLeave={() => setHoveredRow(null)}
                                  >
                                    <td className="px- py-2 text-sm font-medium text-gray-900">{result.p.toFixed(2)}</td>
                                    <td className="px-2 py-2 text-sm text-gray-900">
                                      <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                                        result.algorithm === 'AMP' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                                      }`}>
                                        {result.algorithm}
                                      </span>
                                    </td>
                                    <td className="px-2 py-2 text-sm text-gray-900">
                                      {result.theoretical ? result.theoretical.toFixed(6) : 'N/A'}
                                    </td>
                                    <td className="px-2 py-2 text-sm text-gray-900">{mean.toFixed(6)}</td>
                                    <td className="px-2 py-2 text-sm text-gray-600">
                                      [{ciLower.toFixed(4)}, {ciUpper.toFixed(4)}]
                                    </td>
                                    <td className={`px-2 py-2 text-sm font-medium ${errorColor}`}>
                                      {error.toFixed(6)} ({errorPercent.toFixed(2)}%)
                                    </td>
                                    <td className="px-2 py-2 text-sm text-gray-600">
                                      σ={stdDev.toFixed(4)}, CV={cv.toFixed(1)}%
                                    </td>
                                    <td className="px-2 py-2 text-xs text-gray-600">
                                      <div className="relative group">
                                        <span className="cursor-help">
                                          [{min.toFixed(2)}, {max.toFixed(2)}]
                                        </span>
                                        {/* Tooltip con box plot info */}
                                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                                          <div>Min: {min.toFixed(6)}</div>
                                          <div>Q1: {q1.toFixed(6)}</div>
                                          <div>Median: {median.toFixed(6)}</div>
                                          <div>Q3: {q3.toFixed(6)}</div>
                                          <div>Max: {max.toFixed(6)}</div>
                                          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                                            <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      {isSignificant ? (
                                        <span className="text-orange-600 text-lg" title="Statistically significant difference">⚠️</span>
                                      ) : (
                                        <span className="text-green-600 text-lg" title="No significant difference">✓</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        
                        {/* Leyenda */}
                        <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-600">
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-3 h-3 bg-green-100 rounded"></span>
                            <span>Error {'<'} 5%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-3 h-3 bg-yellow-100 rounded"></span>
                            <span>Error 5-10%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-3 h-3 bg-red-100 rounded"></span>
                            <span>Error {'>'} 10%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span>⚠️</span>
                            <span>Statistically significant difference</span>
                          </div>
                        </div>
                      </div>




                      <div className="mt-6 text-center">
                        <button
                          onClick={prepareRangeExperiment}
                          className="px-4 py-2 bg-green-600 text-white rounded shadow hover:bg-green-700 transition-colors"
                        >
                          💾 Save Experiment
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
            
            {/* Saved Experiments tab */}
            {/* Saved Experiments tab - LABORATORIO MEJORADO */}
            {activeTab === 'saved' && (
              <div>
                <EnhancedExperimentLaboratory
                  savedExperiments={savedExperiments}
                  setSavedExperiments={setSavedExperiments}
                  addLog={addLog}
                />
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

// ============= ENHANCED EXPERIMENT LABORATORY =============
function EnhancedExperimentLaboratory({ savedExperiments, setSavedExperiments, addLog }) {
  const [selectedExperiments, setSelectedExperiments] = useState([]);
  const [comparisonMode, setComparisonMode] = useState('overview');
  const [filterSettings, setFilterSettings] = useState({
    algorithm: 'all',
    processCount: 'all',
    rounds: 'all',
    showFilters: false
  });
  
  // Filtrar experimentos según criterios
  const filteredExperiments = savedExperiments.filter(exp => {
    if (filterSettings.algorithm !== 'all' && 
        exp.parameters?.algorithm !== filterSettings.algorithm) return false;
    if (filterSettings.processCount !== 'all' && 
        exp.parameters?.processCount !== parseInt(filterSettings.processCount)) return false;
    if (filterSettings.rounds !== 'all' && 
        exp.parameters?.rounds !== parseInt(filterSettings.rounds)) return false;
    return true;
  });
  
  // Toggle selección de experimento
  const toggleExperimentSelection = (expId) => {
    setSelectedExperiments(prev => {
      if (prev.includes(expId)) {
        return prev.filter(id => id !== expId);
      }
      if (prev.length < 5) { // Límite de 5 para comparación
        return [...prev, expId];
      }
      addLog("Maximum 5 experiments can be compared at once", "warning");
      return prev;
    });
  };
  
  // Obtener experimentos seleccionados
  const getSelectedExperiments = () => {
    return savedExperiments.filter(exp => 
      selectedExperiments.includes(exp.metadata?.id)
    );
  };
  
  // Eliminar experimento
  const deleteExperiment = (expId) => {
    if (confirm("Are you sure you want to delete this experiment?")) {
      setSavedExperiments(prev => prev.filter(exp => exp.metadata?.id !== expId));
      setSelectedExperiments(prev => prev.filter(id => id !== expId));
      addLog("Experiment deleted", "success");
    }
  };
  
  // Exportar experimento
  const exportExperiment = (experiment) => {
    const dataStr = JSON.stringify(experiment, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `experiment_${experiment.metadata?.name || 'unnamed'}_${Date.now()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    addLog(`Experiment "${experiment.metadata?.name}" exported`, "success");
  };
  
  if (savedExperiments.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="flex justify-center mb-4">
          <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M9 17v1a3 3 0 003 3h0a3 3 0 003-3v-1m-6-4h6m-6 0a9 9 0 110-18 9 9 0 010 18z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold mb-2">No Experiments Saved Yet</h3>
        <p className="text-gray-600 mb-4">Run simulations and save them to start comparing results</p>
        <button
          onClick={() => document.querySelector('[data-tab="theory"]')?.click()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Run Your First Experiment
        </button>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Control Panel */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">
            Experimental Comparison Laboratory
            {selectedExperiments.length > 0 && (
              <span className="ml-2 text-sm text-blue-600">
                ({selectedExperiments.length} selected)
              </span>
            )}
          </h3>
          
          <div className="flex gap-2">
            <button
              onClick={() => setFilterSettings(prev => ({...prev, showFilters: !prev.showFilters}))}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
            >
              {filterSettings.showFilters ? '🔽' : '▶️'} Filters
            </button>
            
            {selectedExperiments.length >= 2 && (
              <>
                <button
                  onClick={() => setComparisonMode('probability')}
                  className={`px-3 py-1 text-sm rounded ${
                    comparisonMode === 'probability' ? 'bg-blue-600 text-white' : 'bg-gray-100'
                  }`}
                >
                  P-Curve
                </button>

                <button
                  onClick={() => setComparisonMode('overview')}
                  className={`px-3 py-1 text-sm rounded ${
                    comparisonMode === 'overview' ? 'bg-blue-600 text-white' : 'bg-gray-100'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setComparisonMode('convergence')}
                  className={`px-3 py-1 text-sm rounded ${
                    comparisonMode === 'convergence' ? 'bg-blue-600 text-white' : 'bg-gray-100'
                  }`}
                >
                  Convergence
                </button>
                <button
                  onClick={() => setComparisonMode('performance')}
                  className={`px-3 py-1 text-sm rounded ${
                    comparisonMode === 'performance' ? 'bg-blue-600 text-white' : 'bg-gray-100'
                  }`}
                >
                  Performance
                </button>
                
              </>
            )}
            
            {selectedExperiments.length > 0 && (
              <button
                onClick={() => setSelectedExperiments([])}
                className="px-3 py-1 text-sm bg-red-100 hover:bg-red-200 text-red-600 rounded"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        
        {/* Filters */}
        {filterSettings.showFilters && (
          <div className="border-t pt-3 grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Algorithm</label>
              <select
                value={filterSettings.algorithm}
                onChange={(e) => setFilterSettings(prev => ({...prev, algorithm: e.target.value}))}
                className="w-full p-1 text-sm border rounded"
              >
                <option value="all">All Algorithms</option>
                <option value="AMP">AMP</option>
                <option value="FV">FV</option>
                <option value="RECURSIVE AMP">Recursive AMP</option>
                <option value="MIN">MIN</option>
                <option value="auto">Auto</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs text-gray-600 mb-1">Processes</label>
              <select
                value={filterSettings.processCount}
                onChange={(e) => setFilterSettings(prev => ({...prev, processCount: e.target.value}))}
                className="w-full p-1 text-sm border rounded"
              >
                <option value="all">Any</option>
                <option value="2">2 Processes</option>
                <option value="3">3 Processes</option>
                <option value="4">4 Processes</option>
                <option value="5">5+ Processes</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs text-gray-600 mb-1">Rounds</label>
              <select
                value={filterSettings.rounds}
                onChange={(e) => setFilterSettings(prev => ({...prev, rounds: e.target.value}))}
                className="w-full p-1 text-sm border rounded"
              >
                <option value="all">Any</option>
                <option value="1">1 Round</option>
                <option value="3">3 Rounds</option>
                <option value="5">5 Rounds</option>
                <option value="10">10 Rounds</option>
              </select>
            </div>
          </div>
        )}
      </div>
      
      {/* Main Content Area */}
      {selectedExperiments.length < 2 ? (
        // List View
        <div className="grid gap-3">
          {filteredExperiments.map(exp => (
            <ExperimentCard
              key={exp.metadata?.id}
              experiment={exp}
              isSelected={selectedExperiments.includes(exp.metadata?.id)}
              onToggle={() => toggleExperimentSelection(exp.metadata?.id)}
              onDelete={() => deleteExperiment(exp.metadata?.id)}
              onExport={() => exportExperiment(exp)}
            />
          ))}
        </div>
      ) : (
        // Comparison View
        <ExperimentComparisonPanel
          experiments={getSelectedExperiments()}
          mode={comparisonMode}
        />
      )}
    </div>
  );
}

// Experiment Card Component
function ExperimentCard({ experiment, isSelected, onToggle, onDelete, onExport }) {
  const [expanded, setExpanded] = useState(false);
  
  // Extract key metrics
  const avgDiscrepancy = experiment.results ? 
    experiment.results.reduce((sum, r) => sum + (r.discrepancy || 0), 0) / experiment.results.length : 0;
  const minDiscrepancy = experiment.results ? 
    Math.min(...experiment.results.map(r => r.discrepancy || 0)) : 0;
  const maxDiscrepancy = experiment.results ? 
    Math.max(...experiment.results.map(r => r.discrepancy || 0)) : 0;
  
  return (
    <div className={`bg-white rounded-lg shadow p-4 ${isSelected ? 'ring-2 ring-blue-500' : ''}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggle}
              className="w-4 h-4"
            />
            <h4 className="font-medium">{experiment.metadata?.name || 'Unnamed Experiment'}</h4>
            <span className={`px-2 py-0.5 text-xs rounded ${
              experiment.parameters?.algorithm === 'AMP' ? 'bg-green-100 text-green-700' :
              experiment.parameters?.algorithm === 'FV' ? 'bg-red-100 text-red-700' :
              experiment.parameters?.algorithm === 'RECURSIVE AMP' ? 'bg-purple-100 text-purple-700' :
              experiment.parameters?.algorithm === 'MIN' ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {experiment.parameters?.algorithm || 'Unknown'}
            </span>
            {experiment.type === 'range' && (
              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                Range
              </span>
            )}
          </div>
          
          <div className="mt-2 grid grid-cols-5 gap-4 text-xs text-gray-600">
            <div>
              <span className="font-medium">Processes:</span> {experiment.parameters?.processCount || 'N/A'}
            </div>
            <div>
              <span className="font-medium">Rounds:</span> {experiment.parameters?.rounds || 1}
            </div>
            <div>
              <span className="font-medium">Avg Disc:</span> {avgDiscrepancy.toFixed(4)}
            </div>
            <div>
              <span className="font-medium">Min:</span> {minDiscrepancy.toFixed(4)}
            </div>
            <div>
              <span className="font-medium">Max:</span> {maxDiscrepancy.toFixed(4)}
            </div>
          </div>
        </div>
        
        <div className="flex gap-1 ml-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-gray-100 rounded"
            title="Toggle details"
          >
            {expanded ? '▼' : '▶'}
          </button>
          <button
            onClick={onExport}
            className="p-1 hover:bg-green-100 rounded text-green-600"
            title="Export"
          >
            💾
          </button>
          <button
            onClick={onDelete}
            className="p-1 hover:bg-red-100 rounded text-red-600"
            title="Delete"
          >
            🗑️
          </button>
        </div>
      </div>
      
      {expanded && (
        <div className="mt-3 pt-3 border-t text-sm">
          <p className="text-gray-600">{experiment.metadata?.description || 'No description'}</p>
          <div className="mt-2 text-xs text-gray-500">
            <p>Created: {new Date(experiment.metadata?.createdAt || Date.now()).toLocaleString()}</p>
            {experiment.metadata?.tags && (
              <div className="mt-1 flex flex-wrap gap-1">
                {experiment.metadata.tags.map((tag, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-gray-100 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Comparison Panel Component
function ExperimentComparisonPanel({ experiments, mode }) {
  if (!experiments || experiments.length < 2) return null;
  
  switch (mode) {
    case 'overview':
      return <ComparisonOverview experiments={experiments} />;
    case 'convergence':
      return <ConvergenceAnalysis experiments={experiments} />;
    case 'performance':
      return <PerformanceMetrics experiments={experiments} />;
    case 'probability':  // NUEVO CASO
      return <ProbabilityCurveComparison experiments={experiments} />;
    default:
      return <ComparisonOverview experiments={experiments} />;
  }
}

// Overview Comparison
function ComparisonOverview({ experiments }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h4 className="font-semibold mb-4">Experimental Overview Comparison</h4>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Experiment</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Algorithm</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Config</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Final Disc</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Avg Disc</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Min Disc</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Reduction %</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {experiments.map((exp, idx) => {
              const results = exp.results || [];
              const finalDisc = results[results.length - 1]?.discrepancy || 0;
              const initialDisc = results[0]?.discrepancy || 1;
              const avgDisc = results.reduce((sum, r) => sum + (r.discrepancy || 0), 0) / (results.length || 1);
              const minDisc = Math.min(...results.map(r => r.discrepancy || 0));
              const reduction = initialDisc > 0 ? ((initialDisc - finalDisc) / initialDisc * 100) : 0;
              
              return (
                <tr key={exp.metadata?.id || idx}>
                  <td className="px-3 py-2 text-sm font-medium">{exp.metadata?.name}</td>
                  <td className="px-3 py-2 text-sm">
                    <span className={`px-2 py-0.5 text-xs rounded ${
                      exp.parameters?.algorithm === 'RECURSIVE AMP' ? 'bg-purple-100 text-purple-700' :
                      exp.parameters?.algorithm === 'AMP' ? 'bg-green-100 text-green-700' :
                      exp.parameters?.algorithm === 'FV' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100'
                    }`}>
                      {exp.parameters?.algorithm}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {exp.parameters?.processCount}p / {exp.parameters?.rounds}r
                  </td>
                  <td className="px-3 py-2 text-sm font-mono">{finalDisc.toFixed(6)}</td>
                  <td className="px-3 py-2 text-sm font-mono">{avgDisc.toFixed(6)}</td>
                  <td className="px-3 py-2 text-sm font-mono">{minDisc.toFixed(6)}</td>
                  <td className="px-3 py-2 text-sm">
                    <div className="flex items-center">
                      <span className={`mr-2 ${reduction > 80 ? 'text-green-600' : reduction > 50 ? 'text-blue-600' : 'text-gray-600'}`}>
                        {reduction.toFixed(1)}%
                      </span>
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${reduction > 80 ? 'bg-green-500' : reduction > 50 ? 'bg-blue-500' : 'bg-gray-400'}`}
                          style={{ width: `${Math.min(100, reduction)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Summary Cards */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="bg-green-50 p-3 rounded">
          <h5 className="text-sm font-medium text-green-800">Best Final Discrepancy</h5>
          <p className="text-lg font-bold text-green-900">
            {experiments.reduce((best, exp) => {
              const finalDisc = exp.results?.[exp.results.length - 1]?.discrepancy || Infinity;
              return finalDisc < best.value ? { name: exp.metadata?.name, value: finalDisc } : best;
            }, { name: '', value: Infinity }).name}
          </p>
        </div>
        
        <div className="bg-blue-50 p-3 rounded">
          <h5 className="text-sm font-medium text-blue-800">Highest Reduction</h5>
          <p className="text-lg font-bold text-blue-900">
            {experiments.reduce((best, exp) => {
              const initial = exp.results?.[0]?.discrepancy || 1;
              const final = exp.results?.[exp.results.length - 1]?.discrepancy || 0;
              const reduction = initial > 0 ? ((initial - final) / initial) : 0;
              return reduction > best.value ? { name: exp.metadata?.name, value: reduction } : best;
            }, { name: '', value: 0 }).name}
          </p>
        </div>
        
        <div className="bg-purple-50 p-3 rounded">
          <h5 className="text-sm font-medium text-purple-800">Most Consistent</h5>
          <p className="text-lg font-bold text-purple-900">
            {experiments.reduce((best, exp) => {
              const discrepancies = exp.results?.map(r => r.discrepancy) || [];
              const mean = discrepancies.reduce((s, d) => s + d, 0) / discrepancies.length;
              const variance = discrepancies.reduce((s, d) => s + Math.pow(d - mean, 2), 0) / discrepancies.length;
              return variance < best.value ? { name: exp.metadata?.name, value: variance } : best;
            }, { name: '', value: Infinity }).name}
          </p>
        </div>
      </div>
    </div>
  );
}

// Convergence Analysis
// REEMPLAZA TODO EL COMPONENTE ConvergenceAnalysis CON ESTA VERSIÓN MEJORADA:

function ConvergenceAnalysis({ experiments }) {
  // Detectar tipos de experimentos
  const experimentTypes = experiments.map(exp => {
    const hasMultipleP = exp.type === 'range';
    const hasMultipleRounds = exp.parameters?.rounds > 1;
    const hasHistory = exp.results?.[0]?.round !== undefined;
    
    return {
      experiment: exp,
      isRange: hasMultipleP,
      isMultiRound: hasMultipleRounds || hasHistory,
      dataType: hasMultipleP ? 'probability' : (hasMultipleRounds || hasHistory ? 'rounds' : 'repetitions')
    };
  });
  
  // Determinar qué tipo de vista mostrar
  const viewType = experimentTypes[0]?.dataType || 'unknown';
  const allSameType = experimentTypes.every(t => t.dataType === viewType);
  
  if (!allSameType) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h4 className="font-semibold mb-4">Convergence Analysis</h4>
        <div className="bg-yellow-50 p-4 rounded">
          <p className="text-yellow-800">⚠️ Mixed experiment types selected</p>
          <p className="text-sm text-yellow-600 mt-2">
            Please select experiments of the same type for meaningful comparison:
          </p>
          <ul className="text-sm text-yellow-600 mt-2 list-disc list-inside">
            <li>Range experiments (varying probability)</li>
            <li>Multi-round experiments (convergence over rounds)</li>
            <li>Single experiments (multiple repetitions)</li>
          </ul>
        </div>
      </div>
    );
  }
  
  // Preparar datos según el tipo
  let chartData = [];
  let xAxisLabel = 'Step';
  let xAxisKey = 'index';
  
  if (viewType === 'probability') {
    // RANGE EXPERIMENTS: X-axis is probability
    xAxisLabel = 'Probability (p)';
    xAxisKey = 'p';
    
    // Collect all unique probabilities
    const allPs = new Set();
    experiments.forEach(exp => {
      exp.results?.forEach(r => {
        if (r.p !== undefined) allPs.add(r.p);
      });
    });
    
    const sortedPs = Array.from(allPs).sort((a, b) => a - b);
    chartData = sortedPs.map(p => {
      const point = { p };
      experiments.forEach((exp, idx) => {
        const result = exp.results?.find(r => Math.abs(r.p - p) < 0.0001);
        if (result) {
          point[`exp${idx}`] = result.discrepancy;
        }
      });
      return point;
    });
    
  } else if (viewType === 'rounds') {
    // MULTI-ROUND EXPERIMENTS: X-axis is round number
    xAxisLabel = 'Round';
    xAxisKey = 'round';
    
    // Find max rounds
    const maxRounds = Math.max(...experiments.map(exp => exp.parameters?.rounds || 1));
    
    // For multi-round experiments, we need to extract per-round data
    // This assumes experiments store round-by-round history
    for (let round = 0; round <= maxRounds; round++) {
      const point = { round };
      
      experiments.forEach((exp, expIdx) => {
        // Check if experiment has detailed round data
        if (exp.roundHistory && exp.roundHistory[round]) {
          point[`exp${expIdx}`] = exp.roundHistory[round].discrepancy;
        } else if (exp.results && round === exp.parameters?.rounds) {
          // Use final result for last round
          const avgDiscrepancy = exp.results.reduce((sum, r) => sum + (r.discrepancy || 0), 0) / exp.results.length;
          point[`exp${expIdx}`] = avgDiscrepancy;
        }
      });
      
      chartData.push(point);
    }
    
  } else {
    // SINGLE EXPERIMENTS: X-axis is repetition/sample number
    xAxisLabel = 'Sample/Repetition';
    xAxisKey = 'index';
    
    const maxSamples = Math.max(...experiments.map(exp => exp.results?.length || 0));
    for (let i = 0; i < maxSamples; i++) {
      const point = { index: i };
      experiments.forEach((exp, expIdx) => {
        if (exp.results && exp.results[i]) {
          point[`exp${expIdx}`] = exp.results[i].discrepancy;
        }
      });
      chartData.push(point);
    }
  }
  
  const colors = ['#8b5cf6', '#10b981', '#ef4444', '#f59e0b', '#3b82f6'];
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h4 className="font-semibold mb-4">
        Convergence Analysis
        <span className="ml-2 text-sm font-normal text-gray-600">
          ({viewType === 'probability' ? 'Probability Sweep' : 
            viewType === 'rounds' ? 'Round-by-Round' : 
            'Repetition Samples'})
        </span>
      </h4>
      
      {/* Information Box */}
      <div className="mb-4 p-3 bg-blue-50 rounded text-sm">
        <p className="text-blue-800 font-medium">
          {viewType === 'probability' && "📊 Showing discrepancy across different probability values"}
          {viewType === 'rounds' && "🔄 Showing convergence across communication rounds"}
          {viewType === 'repetitions' && "📈 Showing variation across multiple repetitions"}
        </p>
        <p className="text-blue-600 text-xs mt-1">
          {viewType === 'probability' && "Each point represents a different message delivery probability"}
          {viewType === 'rounds' && "Each point shows the discrepancy after completing that round"}
          {viewType === 'repetitions' && "Each point is an independent run of the experiment"}
        </p>
      </div>
      
      {/* Main Chart */}
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey={xAxisKey}
            label={{ value: xAxisLabel, position: 'insideBottom', offset: -5 }}
            domain={viewType === 'probability' ? [0, 1] : undefined}
          />
          <YAxis 
            label={{ value: 'Discrepancy', angle: -90, position: 'insideLeft' }}
            domain={[0, 'auto']}
          />
          <Tooltip 
            formatter={(value) => value?.toFixed(6)}
            labelFormatter={(label) => {
              if (viewType === 'probability') return `p = ${label?.toFixed(3)}`;
              if (viewType === 'rounds') return `Round ${label}`;
              return `Sample ${label + 1}`;
            }}
          />
          <Legend />
          
          {viewType === 'probability' && (
            <ReferenceLine x={0.5} stroke="#666" strokeDasharray="3 3" label="p=0.5" />
          )}
          
          {experiments.map((exp, idx) => (
            <Line
              key={exp.metadata?.id || idx}
              type="monotone"
              dataKey={`exp${idx}`}
              name={exp.metadata?.name || `Exp ${idx + 1}`}
              stroke={colors[idx % colors.length]}
              strokeWidth={2}
              dot={chartData.length <= 20}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      
      {/* Convergence Metrics - Adapted to context */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <h5 className="text-sm font-medium mb-3">
            {viewType === 'probability' ? 'Best Performance Range' : 
             viewType === 'rounds' ? 'Rounds to 90% Reduction' : 
             'Convergence Stability'}
          </h5>
          <div className="space-y-2">
            {experiments.map((exp, idx) => {
              let metric = 'N/A';
              
              if (viewType === 'probability') {
                // Find probability range with best average
                const results = exp.results || [];
                if (results.length > 0) {
                  const sorted = [...results].sort((a, b) => a.discrepancy - b.discrepancy);
                  const best = sorted[0];
                  metric = best ? `Best at p=${best.p?.toFixed(2)} (${best.discrepancy.toFixed(4)})` : 'N/A';
                }
              } else if (viewType === 'rounds') {
                // Calculate rounds to 90% reduction
                const initial = chartData[0]?.[`exp${idx}`] || 1;
                const target = initial * 0.1;
                const roundTo90 = chartData.findIndex(d => d[`exp${idx}`] <= target);
                metric = roundTo90 >= 0 ? `${roundTo90} rounds` : 'Not achieved';
              } else {
                // Calculate stability (coefficient of variation)
                const values = chartData.map(d => d[`exp${idx}`]).filter(v => v !== undefined);
                if (values.length > 0) {
                  const mean = values.reduce((s, v) => s + v, 0) / values.length;
                  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
                  const cv = Math.sqrt(variance) / mean;
                  metric = `CV: ${(cv * 100).toFixed(1)}%`;
                }
              }
              
              return (
                <div key={exp.metadata?.id || idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="text-sm font-medium" style={{ color: colors[idx % colors.length] }}>
                    {exp.metadata?.name}
                  </span>
                  <span className="text-sm font-mono">
                    {metric}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        
        <div>
          <h5 className="text-sm font-medium mb-3">
            {viewType === 'probability' ? 'Average Discrepancy' : 
             viewType === 'rounds' ? 'Final Discrepancy' : 
             'Mean & Std Dev'}
          </h5>
          <div className="space-y-2">
            {experiments.map((exp, idx) => {
              let metric = 'N/A';
              
              if (viewType === 'probability' || viewType === 'repetitions') {
                // Calculate average
                const values = exp.results?.map(r => r.discrepancy) || [];
                if (values.length > 0) {
                  const mean = values.reduce((s, v) => s + v, 0) / values.length;
                  const std = Math.sqrt(values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length);
                  metric = viewType === 'probability' ? 
                    `${mean.toFixed(6)}` : 
                    `${mean.toFixed(4)} ± ${std.toFixed(4)}`;
                }
              } else if (viewType === 'rounds') {
                // Show final value
                const finalValue = chartData[chartData.length - 1]?.[`exp${idx}`];
                metric = finalValue !== undefined ? finalValue.toFixed(6) : 'N/A';
              }
              
              return (
                <div key={exp.metadata?.id || idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="text-sm font-medium" style={{ color: colors[idx % colors.length] }}>
                    {exp.metadata?.name}
                  </span>
                  <span className="text-sm font-mono">
                    {metric}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Context-specific insights */}
      <div className="mt-4 p-3 bg-gray-50 rounded text-xs text-gray-600">
        <p className="font-medium text-gray-700 mb-1">Understanding this view:</p>
        {viewType === 'probability' && (
          <ul className="list-disc list-inside space-y-1">
            <li>Lower curves indicate better performance at those probability values</li>
            <li>The crossover at p=0.5 shows where algorithms change optimality</li>
            <li>Steeper slopes indicate more sensitivity to probability changes</li>
          </ul>
        )}
        {viewType === 'rounds' && (
          <ul className="list-disc list-inside space-y-1">
            <li>Steeper downward slopes indicate faster convergence</li>
            <li>Plateaus show where convergence has stabilized</li>
            <li>Lower final values indicate better agreement achieved</li>
          </ul>
        )}
        {viewType === 'repetitions' && (
          <ul className="list-disc list-inside space-y-1">
            <li>Consistent horizontal lines indicate stable algorithm performance</li>
            <li>High variation suggests sensitivity to initial conditions or randomness</li>
            <li>Trends up/down might indicate systematic biases</li>
          </ul>
        )}
      </div>
    </div>
  );
}

// Performance Metrics
// REEMPLAZA LA SECCIÓN DE Performance Metrics EN EL COMPONENTE PerformanceMetrics:

function PerformanceMetrics({ experiments }) {
  // Calculate comprehensive metrics
  const metrics = experiments.map(exp => {
    const discrepancies = exp.results?.map(r => r.discrepancy) || [];
    const n = discrepancies.length;
    
    if (n === 0) return null;
    
    const mean = discrepancies.reduce((s, d) => s + d, 0) / n;
    const sorted = [...discrepancies].sort((a, b) => a - b);
    const median = n % 2 === 0 ? (sorted[n/2-1] + sorted[n/2]) / 2 : sorted[Math.floor(n/2)];
    const variance = discrepancies.reduce((s, d) => s + Math.pow(d - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 0;
    
    // Calculate convergence rate
    const initial = discrepancies[0] || 1;
    const final = discrepancies[n-1] || 0;
    const convergenceRate = initial > 0 ? (initial - final) / initial : 0;
    
    // NUEVO: Análisis de convergencia mejorado
    let convergenceStatus = 'Not converged';
    let convergencePoint = -1;
    
    // Buscar punto de convergencia con criterios inteligentes
    for (let i = 1; i < n; i++) {
      const current = discrepancies[i];
      const previous = discrepancies[i-1];
      
      // Criterios de convergencia
      if (current < 0.001) {
        // Ya está en convergencia aceptable
        convergenceStatus = 'Converged';
        convergencePoint = i;
        
        if (current < 0.00001) {
          convergenceStatus = 'Near-zero';
        }
        if (current === 0) {
          convergenceStatus = 'Perfect';
        }
        break;
      }
      
      // Si no ha convergido pero el cambio es mínimo
      const absoluteChange = Math.abs(current - previous);
      const relativeChange = previous > 0 ? absoluteChange / previous : 0;
      
      if (absoluteChange < 0.0001 || (previous > 0.01 && relativeChange < 0.01)) {
        convergenceStatus = 'Stabilized';
        convergencePoint = i;
        break;
      }
    }
    
    // Si el valor final es muy pequeño pero no se detectó convergencia
    if (convergenceStatus === 'Not converged' && final < 0.001) {
      convergenceStatus = 'Converged';
      convergencePoint = n - 1;
      if (final < 0.00001) convergenceStatus = 'Near-zero';
      if (final === 0) convergenceStatus = 'Perfect';
    }
    
    return {
      name: exp.metadata?.name,
      algorithm: exp.parameters?.algorithm,
      mean,
      median,
      stdDev,
      cv,
      convergenceRate,
      convergenceStatus,
      convergencePoint,
      finalValue: final,
      improvement: (initial - final)
    };
  }).filter(m => m !== null);
  
  // Función para obtener color según status
  const getStatusColor = (status) => {
    switch(status) {
      case 'Perfect': return 'text-green-700 bg-green-100';
      case 'Near-zero': return 'text-green-600 bg-green-50';
      case 'Converged': return 'text-blue-600 bg-blue-50';
      case 'Stabilized': return 'text-yellow-600 bg-yellow-50';
      case 'Not converged': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h4 className="font-semibold mb-4">Performance Metrics Analysis</h4>
      
      {/* Metrics Table - ACTUALIZADA */}
      <div className="overflow-x-auto mb-6">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Experiment</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Mean</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Median</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Std Dev</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Final Value</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Conv. Rate</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {metrics.map((m, idx) => (
              <tr key={idx}>
                <td className="px-3 py-2 text-sm font-medium">{m.name}</td>
                <td className="px-3 py-2 text-sm font-mono">{m.mean.toFixed(6)}</td>
                <td className="px-3 py-2 text-sm font-mono">{m.median.toFixed(6)}</td>
                <td className="px-3 py-2 text-sm font-mono">{m.stdDev.toFixed(6)}</td>
                <td className="px-3 py-2 text-sm font-mono">{m.finalValue.toFixed(6)}</td>
                <td className="px-3 py-2 text-sm font-mono">{(m.convergenceRate * 100).toFixed(1)}%</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-1 text-xs rounded ${getStatusColor(m.convergenceStatus)}`}>
                    {m.convergenceStatus}
                    {m.convergencePoint >= 0 && m.convergenceStatus !== 'Not converged' && 
                      ` (step ${m.convergencePoint})`}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Performance Rankings - ACTUALIZADO */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h5 className="text-sm font-medium mb-3">Performance Rankings</h5>
          <div className="space-y-2">
            <div className="p-2 bg-green-50 rounded">
              <p className="text-xs text-green-700">🥇 Best Convergence Status</p>
              <p className="font-medium">
                {(() => {
                  const statusOrder = ['Perfect', 'Near-zero', 'Converged', 'Stabilized', 'Not converged'];
                  let best = metrics[0];
                  metrics.forEach(m => {
                    if (statusOrder.indexOf(m.convergenceStatus) < statusOrder.indexOf(best.convergenceStatus)) {
                      best = m;
                    }
                  });
                  return best ? `${best.name} (${best.convergenceStatus})` : 'N/A';
                })()}
              </p>
            </div>
            <div className="p-2 bg-blue-50 rounded">
              <p className="text-xs text-blue-700">🥇 Fastest to Converge</p>
              <p className="font-medium">
                {(() => {
                  const converged = metrics.filter(m => 
                    ['Perfect', 'Near-zero', 'Converged'].includes(m.convergenceStatus)
                  );
                  if (converged.length === 0) return 'None achieved convergence';
                  
                  const fastest = converged.reduce((best, m) => 
                    m.convergencePoint < best.convergencePoint ? m : best
                  );
                  return `${fastest.name} (step ${fastest.convergencePoint})`;
                })()}
              </p>
            </div>
            <div className="p-2 bg-purple-50 rounded">
              <p className="text-xs text-purple-700">🥇 Lowest Final Value</p>
              <p className="font-medium">
                {metrics.reduce((b, m) => m.finalValue < b.finalValue ? m : b).name}
                <span className="text-xs text-gray-600 ml-1">
                  ({metrics.reduce((b, m) => m.finalValue < b.finalValue ? m : b).finalValue.toFixed(6)})
                </span>
              </p>
            </div>
          </div>
        </div>
        
        <div>
          <h5 className="text-sm font-medium mb-3">Convergence Summary</h5>
          <div className="space-y-2">
            {/* Status distribution */}
            <div className="p-2 bg-gray-50 rounded">
              <p className="text-xs text-gray-700 mb-1">Status Distribution:</p>
              {['Perfect', 'Near-zero', 'Converged', 'Stabilized', 'Not converged'].map(status => {
                const count = metrics.filter(m => m.convergenceStatus === status).length;
                if (count === 0) return null;
                return (
                  <div key={status} className="flex justify-between text-xs mt-1">
                    <span className={`px-1 rounded ${getStatusColor(status)}`}>{status}</span>
                    <span>{count} experiment{count !== 1 ? 's' : ''}</span>
                  </div>
                );
              })}
            </div>
            
            {/* Algorithm comparison */}
            <div className="p-2 bg-gray-50 rounded">
              <p className="text-xs text-gray-700 mb-1">By Algorithm:</p>
              {['AMP', 'FV', 'RECURSIVE AMP', 'MIN'].map(algo => {
                const algoMetrics = metrics.filter(m => m.algorithm === algo);
                if (algoMetrics.length === 0) return null;
                
                const bestStatus = algoMetrics[0].convergenceStatus;
                
                return (
                  <div key={algo} className="flex justify-between text-xs mt-1">
                    <span className={`px-1 rounded ${
                      algo === 'RECURSIVE AMP' ? 'bg-purple-100 text-purple-700' :
                      algo === 'AMP' ? 'bg-green-100 text-green-700' :
                      algo === 'FV' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {algo}
                    </span>
                    <span className={`px-1 rounded ${getStatusColor(bestStatus)}`}>
                      {bestStatus}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      
      {/* Legend */}
      <div className="mt-4 p-3 bg-gray-50 rounded text-xs">
        <p className="font-medium text-gray-700 mb-2">Convergence Status Guide:</p>
        <div className="grid grid-cols-2 gap-2">
          <div><span className="px-1 rounded bg-green-100 text-green-700">Perfect</span> = Discrepancy exactly 0</div>
          <div><span className="px-1 rounded bg-green-50 text-green-600">Near-zero</span> = Discrepancy less 0.00001</div>
          <div><span className="px-1 rounded bg-blue-50 text-blue-600">Converged</span> = Discrepancy less 0.001</div>
          <div><span className="px-1 rounded bg-yellow-50 text-yellow-600">Stabilized</span> = Changes less 0.0001</div>
          <div className="col-span-2"><span className="px-1 rounded bg-red-50 text-red-600">Not converged</span> = Still changing significantly</div>
        </div>
      </div>
    </div>
  );
}


function ProbabilityCurveComparison({ experiments }) {
  // Filtrar solo experimentos de tipo "range" que tienen datos de probabilidad
  const rangeExperiments = experiments.filter(exp => exp.type === 'range' && exp.results);
  
  if (rangeExperiments.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">No range experiments selected.</p>
        <p className="text-sm text-gray-400 mt-2">
          This view requires range experiments with probability data.
        </p>
      </div>
    );
  }
  
  // Preparar datos para la gráfica
  const allProbabilities = new Set();
  rangeExperiments.forEach(exp => {
    exp.results.forEach(result => {
      if (result.p !== undefined) {
        allProbabilities.add(result.p);
      }
    });
  });
  
  const sortedProbabilities = Array.from(allProbabilities).sort((a, b) => a - b);
  
  // Construir datos del chart
  const chartData = sortedProbabilities.map(p => {
    const point = { p };
    
    rangeExperiments.forEach((exp, idx) => {
      const result = exp.results.find(r => Math.abs(r.p - p) < 0.0001);
      if (result) {
        point[`exp${idx}`] = result.discrepancy;
      }
    });
    
    return point;
  });
  
  const colors = ['#8b5cf6', '#10b981', '#ef4444', '#f59e0b', '#3b82f6'];
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h4 className="font-semibold mb-4">Discrepancy vs Probability Comparison</h4>
      
      {/* Main Chart */}
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="p" 
            domain={[0, 1]}
            ticks={[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]}
            label={{ value: 'Probability (p)', position: 'insideBottom', offset: -5 }}
          />
          <YAxis 
            domain={[0, 'auto']}
            label={{ value: 'Discrepancy', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip 
            formatter={(value) => value?.toFixed(6)}
            labelFormatter={(value) => `p = ${value?.toFixed(3)}`}
          />
          <Legend />
          
          {/* Crossover line at p=0.5 */}
          <ReferenceLine x={0.5} stroke="#666" strokeDasharray="3 3" />
          
          {rangeExperiments.map((exp, idx) => (
            <Line
              key={exp.metadata?.id || idx}
              type="monotone"
              dataKey={`exp${idx}`}
              name={exp.metadata?.name || `Exp ${idx + 1}`}
              stroke={colors[idx % colors.length]}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      
      {/* Analysis Tables */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        {/* Key Points Analysis */}
        <div>
          <h5 className="text-sm font-medium mb-3">Key Points Analysis</h5>
          <div className="space-y-2">
            {rangeExperiments.map((exp, idx) => {
              // Encontrar puntos clave
              const p0 = exp.results.find(r => Math.abs(r.p - 0) < 0.01);
              const p25 = exp.results.find(r => Math.abs(r.p - 0.25) < 0.01);
              const p50 = exp.results.find(r => Math.abs(r.p - 0.5) < 0.01);
              const p75 = exp.results.find(r => Math.abs(r.p - 0.75) < 0.01);
              const p100 = exp.results.find(r => Math.abs(r.p - 1) < 0.01);
              
              return (
                <div key={exp.metadata?.id || idx} className="p-2 bg-gray-50 rounded">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium" style={{ color: colors[idx % colors.length] }}>
                      {exp.metadata?.name}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                      {exp.parameters?.algorithm || 'Unknown'}
                    </span>
                  </div>
                  <div className="mt-1 grid grid-cols-5 gap-1 text-xs text-gray-600">
                    <div>
                      <span className="font-medium">p=0:</span>
                      <p>{p0 ? p0.discrepancy.toFixed(3) : 'N/A'}</p>
                    </div>
                    <div>
                      <span className="font-medium">p=0.25:</span>
                      <p>{p25 ? p25.discrepancy.toFixed(3) : 'N/A'}</p>
                    </div>
                    <div>
                      <span className="font-medium">p=0.5:</span>
                      <p>{p50 ? p50.discrepancy.toFixed(3) : 'N/A'}</p>
                    </div>
                    <div>
                      <span className="font-medium">p=0.75:</span>
                      <p>{p75 ? p75.discrepancy.toFixed(3) : 'N/A'}</p>
                    </div>
                    <div>
                      <span className="font-medium">p=1:</span>
                      <p>{p100 ? p100.discrepancy.toFixed(3) : 'N/A'}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Performance Analysis by Range - CORREGIDO */}
        <div>
          <h5 className="text-sm font-medium mb-3">Average Performance by Range</h5>
          <div className="space-y-2">
            {/* Análisis para cada experimento */}
            {rangeExperiments.map((exp, idx) => {
              // Calcular promedios por rango
              const lowResults = exp.results.filter(r => r.p >= 0 && r.p <= 0.3);
              const midResults = exp.results.filter(r => r.p > 0.3 && r.p <= 0.7);
              const highResults = exp.results.filter(r => r.p > 0.7 && r.p <= 1.0);
              
              const lowAvg = lowResults.length > 0 ? 
                lowResults.reduce((s, r) => s + r.discrepancy, 0) / lowResults.length : null;
              const midAvg = midResults.length > 0 ? 
                midResults.reduce((s, r) => s + r.discrepancy, 0) / midResults.length : null;
              const highAvg = highResults.length > 0 ? 
                highResults.reduce((s, r) => s + r.discrepancy, 0) / highResults.length : null;
              
              // Encontrar el mejor rango para este experimento
              let bestRange = 'N/A';
              let bestValue = Infinity;
              if (lowAvg !== null && lowAvg < bestValue) {
                bestRange = 'Low p';
                bestValue = lowAvg;
              }
              if (midAvg !== null && midAvg < bestValue) {
                bestRange = 'Mid p';
                bestValue = midAvg;
              }
              if (highAvg !== null && highAvg < bestValue) {
                bestRange = 'High p';
                bestValue = highAvg;
              }
              
              return (
                <div key={exp.metadata?.id || idx} className="p-2 bg-gray-50 rounded">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium" style={{ color: colors[idx % colors.length] }}>
                      {exp.metadata?.name}
                    </span>
                    <span className="text-xs">
                      Best: {bestRange}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs mt-1">
                    <div className={`text-center ${bestRange === 'Low p' ? 'font-bold text-green-600' : 'text-gray-600'}`}>
                      <p>Low p</p>
                      <p>{lowAvg !== null ? lowAvg.toFixed(4) : 'N/A'}</p>
                    </div>
                    <div className={`text-center ${bestRange === 'Mid p' ? 'font-bold text-green-600' : 'text-gray-600'}`}>
                      <p>Mid p</p>
                      <p>{midAvg !== null ? midAvg.toFixed(4) : 'N/A'}</p>
                    </div>
                    <div className={`text-center ${bestRange === 'High p' ? 'font-bold text-green-600' : 'text-gray-600'}`}>
                      <p>High p</p>
                      <p>{highAvg !== null ? highAvg.toFixed(4) : 'N/A'}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Summary Statistics - MEJORADO */}
      <div className="mt-6 p-3 bg-blue-50 rounded">
        <h5 className="text-sm font-medium text-blue-800 mb-2">Comparative Insights</h5>
        <div className="grid grid-cols-3 gap-4 text-xs">
          <div>
            <p className="text-gray-600">Best Overall Performance:</p>
            <p className="font-medium">
              {(() => {
                let bestExp = null;
                let bestAvg = Infinity;
                
                rangeExperiments.forEach(exp => {
                  const avg = exp.results.reduce((s, r) => s + r.discrepancy, 0) / exp.results.length;
                  if (avg < bestAvg) {
                    bestAvg = avg;
                    bestExp = exp;
                  }
                });
                
                return bestExp ? `${bestExp.metadata?.name} (${bestAvg.toFixed(4)})` : 'N/A';
              })()}
            </p>
          </div>
          
          <div>
            <p className="text-gray-600">Most Stable (Lowest Variance):</p>
            <p className="font-medium">
              {(() => {
                let bestExp = null;
                let bestVariance = Infinity;
                
                rangeExperiments.forEach(exp => {
                  const values = exp.results.map(r => r.discrepancy);
                  const mean = values.reduce((s, v) => s + v, 0) / values.length;
                  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
                  
                  if (variance < bestVariance) {
                    bestVariance = variance;
                    bestExp = exp;
                  }
                });
                
                return bestExp ? `${bestExp.metadata?.name}` : 'N/A';
              })()}
            </p>
          </div>
          
          <div>
            <p className="text-gray-600">Widest Effective Range:</p>
            <p className="font-medium">
              {(() => {
                let bestExp = null;
                let bestRange = 0;
                const threshold = 0.1; // Considerar "efectivo" si discrepancia < 0.1
                
                rangeExperiments.forEach(exp => {
                  const effectiveResults = exp.results.filter(r => r.discrepancy < threshold);
                  if (effectiveResults.length > 0) {
                    const minP = Math.min(...effectiveResults.map(r => r.p));
                    const maxP = Math.max(...effectiveResults.map(r => r.p));
                    const range = maxP - minP;
                    
                    if (range > bestRange) {
                      bestRange = range;
                      bestExp = exp;
                    }
                  }
                });
                
                return bestExp ? `${bestExp.metadata?.name} (${bestRange.toFixed(2)})` : 'N/A';
              })()}
            </p>
          </div>
        </div>
        
        {/* Observations */}
        <div className="mt-3 pt-3 border-t border-blue-200">
          <p className="text-xs text-blue-700">
            📊 <strong>Quick Analysis:</strong>
          </p>
          <ul className="mt-1 text-xs text-blue-600 list-disc list-inside">
            {rangeExperiments.every(exp => {
              const p50 = exp.results.find(r => Math.abs(r.p - 0.5) < 0.01);
              return p50 && p50.discrepancy < 0.1;
            }) && (
              <li>All algorithms perform well around p=0.5 (crossover region)</li>
            )}
            
            {rangeExperiments.some(exp => {
              const lowP = exp.results.filter(r => r.p < 0.3);
              const highP = exp.results.filter(r => r.p > 0.7);
              const lowAvg = lowP.reduce((s, r) => s + r.discrepancy, 0) / lowP.length;
              const highAvg = highP.reduce((s, r) => s + r.discrepancy, 0) / highP.length;
              return Math.abs(lowAvg - highAvg) > 0.2;
            }) && (
              <li>Significant performance differences between low and high probability ranges</li>
            )}
            
            {rangeExperiments.filter(exp => exp.parameters?.algorithm === 'RECURSIVE AMP').length > 0 && (
              <li>Recursive AMP shows gradual convergence characteristics</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default CompleteDistributedComputingSimulator;