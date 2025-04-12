import React, { useState, useEffect, useCallback, useRef } from 'react';
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

// CONSTANTES DE COLORES
const ACCENT_COLOR = "#4CAF50";
const PRIMARY_COLOR = "#2c3e50";
const ALICE_COLOR = "#3498db";
const BOB_COLOR = "#e67e22";
const ERROR_COLOR = "#e74c3c";
const AMP_COLOR = "#9c27b0";
const FV_COLOR = "#e91e63";

// SIMULATION ENGINE: Lógica central de la simulación.
const SimulationEngine = {
  simulateRound: (aliceValue, bobValue, p, algorithm = "auto", meetingPoint = 1) => {
    if (algorithm === "auto") {
      algorithm = p > 0.5 ? "AMP" : "FV";
    }
    const aliceMessageDelivered = Math.random() < p;
    const bobMessageDelivered = Math.random() < p;
    let newAliceValue = aliceValue;
    let newBobValue = bobValue;
    if (bobMessageDelivered) {
      newAliceValue = algorithm === "AMP" ? meetingPoint : bobValue;
    }
    if (aliceMessageDelivered) {
      newBobValue = algorithm === "AMP" ? meetingPoint : aliceValue;
    }
    return {
      newAliceValue,
      newBobValue,
      aliceReceived: bobMessageDelivered,
      bobReceived: aliceMessageDelivered,
      messages: [
        { from: "Bob", to: "Alice", delivered: bobMessageDelivered, value: bobValue },
        { from: "Alice", to: "Bob", delivered: aliceMessageDelivered, value: aliceValue }
      ]
    };
  },

  runExperiment: (aliceInitial, bobInitial, p, rounds, algorithm = "auto", meetingPoint = 1) => {
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
      const result = SimulationEngine.simulateRound(aliceValue, bobValue, p, algorithm, meetingPoint);
      aliceValue = result.newAliceValue;
      bobValue = result.newBobValue;
      history.push({
        round: r,
        alice_value: aliceValue,
        bob_value: bobValue,
        discrepancy: Math.abs(bobValue - aliceValue),
        alice_received: result.aliceReceived,
        bob_received: result.bobReceived,
        messages: result.messages
      });
    }
    return history;
  },

  calculateExpectedDiscrepancy: (p, algorithm = "auto") => {
    if (algorithm === "auto") {
      algorithm = p > 0.5 ? "AMP" : "FV";
    }
    return algorithm === "AMP" ? (1 - p) : (Math.pow(1 - p, 2) + Math.pow(p, 2));
  },

  runMultipleExperiments: (aliceInitial, bobInitial, p, rounds, repetitions, algorithm = "auto", meetingPoint = 1) => {
    const allDiscrepancies = [];
    const allRuns = [];
    for (let i = 0; i < repetitions; i++) {
      const history = SimulationEngine.runExperiment(aliceInitial, bobInitial, p, rounds, algorithm, meetingPoint);
      const finalDiscrepancy = history[history.length - 1].discrepancy;
      allDiscrepancies.push(finalDiscrepancy);
      allRuns.push(history);
    }
    const mean = allDiscrepancies.reduce((a, b) => a + b, 0) / allDiscrepancies.length;
    const sorted = [...allDiscrepancies].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0 ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : sorted[Math.floor(sorted.length / 2)];
    const min = Math.min(...allDiscrepancies);
    const max = Math.max(...allDiscrepancies);
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

// COMPONENTES DE INTERFAZ

// AppLogo: Logotipo en SVG.
function AppLogo() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="40" fill="#f5f5f5" />
      <polygon points="50,30 65,37.5 65,62.5 50,70 35,62.5 35,37.5" fill="#4e54c8" stroke="#36389c" strokeWidth="1" />
    </svg>
  );
}

// Slider: Control deslizante reutilizable.
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

// MetricCard: Tarjeta para mostrar una métrica.
function MetricCard({ label, value, color }) {
  return (
    <div className="bg-white rounded-lg shadow p-4 flex-1 min-w-20" style={{ borderLeft: `5px solid ${color}` }}>
      <h3 className="text-sm text-gray-500 font-medium">{label}</h3>
      <p className="text-lg font-bold mt-1">{value}</p>
    </div>
  );
}

// ProgressBar: Barra de progreso.
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

// ExperimentVisualization: Grafica la simulación individual (histórico de rondas).
function ExperimentVisualization({ experimentData, currentRound = 0 }) {
  if (!experimentData || !Array.isArray(experimentData) || experimentData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-400">No experiment data available</p>
      </div>
    );
  }
  
  // Validar datos antes de procesarlos
  const roundData = experimentData.slice(0, Math.min(currentRound + 1, experimentData.length));
  const validData = roundData.map(d => {
    // Asegurar que los valores necesarios son números válidos
    const round = d && typeof d.round === 'number' ? d.round : 0;
    const alice_value = d && typeof d.alice_value === 'number' ? d.alice_value : 0;
    const bob_value = d && typeof d.bob_value === 'number' ? d.bob_value : 0;
    const discrepancy = d && typeof d.discrepancy === 'number' ? d.discrepancy : 0;
    
    return {
      round,
      alice: alice_value,
      bob: bob_value,
      discrepancy
    };
  });
  
  return (
    <div className="bg-white rounded-lg shadow p-4 h-64">
      <h3 className="text-lg font-semibold mb-4">Experiment Visualization</h3>
      <ResponsiveContainer width="100%" height="80%">
        <LineChart data={validData}>
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
          <Line type="monotone" dataKey="discrepancy" name="Discrepancy" stroke="#9b59b6" strokeWidth={2}
            dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// HistogramPlot: Histograma de la distribución final de discrepancias.
function HistogramPlot({ discrepancies, theoretical, experimental }) {
  if (!discrepancies || !Array.isArray(discrepancies) || discrepancies.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-400">No data available</p>
      </div>
    );
  }
  
  // Filtrar valores no numéricos o inválidos
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
  
  // Si min y max son iguales, no podemos hacer bins
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
  
  // Verificar que las referencias son números
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

// TheoryPlot: Grafica las curvas teóricas y la experimental (con una línea que conecta los puntos).
// Se usa displayCurves para decidir qué curvas mostrar.
function TheoryPlot({ currentP, experimentalData, displayOption, displayCurves }) {
  // Validar datos de entrada
  if (!currentP && currentP !== 0) currentP = 0.5;
  
  // Verificar si experimentalData es válido
  const validExperimentalData = Array.isArray(experimentalData) ? 
    experimentalData.filter(item => 
      item && 
      typeof item.p === 'number' && 
      typeof item.discrepancy === 'number'
    ) : [];
  
  // Datos teóricos para AMP y FV
  const ampData = [];
  const fvData = [];
  for (let p = 0; p <= 1; p += 0.02) {
    ampData.push({ p, discrepancy: 1 - p });
    fvData.push({ p, discrepancy: Math.pow(1 - p, 2) + Math.pow(p, 2) });
  }
  
  // Punto actual
  const currentPoint = {
    p: currentP,
    expectedDiscrepancy: SimulationEngine.calculateExpectedDiscrepancy(currentP)
  };

  // Determinar qué curvas mostrar basado en displayOption o displayCurves
  const showAMP = displayCurves?.theoreticalAmp || displayOption === "all" || displayOption === "theoretical-amp";
  const showFV = displayCurves?.theoreticalFv || displayOption === "all" || displayOption === "theoretical-fv";
  const showExperimental = (displayCurves?.experimental || displayOption === "all" || displayOption === "experimental") 
                           && validExperimentalData.length > 0;

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

          {/* Curvas teóricas */}
          {showAMP && (
            <Line data={ampData} type="monotone" dataKey="discrepancy" name="AMP Algorithm" stroke="#2ecc71" strokeWidth={2} dot={false} />
          )}
          {showFV && (
            <Line data={fvData} type="monotone" dataKey="discrepancy" name="FV Algorithm" stroke="#e74c3c" strokeWidth={2} dot={false} />
          )}

          {/* Curva experimental conectada */}
          {showExperimental && validExperimentalData.length > 0 && (
            <Line data={validExperimentalData} type="monotone" dataKey="discrepancy" name="Experimental Curve" stroke="purple" strokeWidth={2} dot={{ r: 3, stroke: "purple", fill: "white" }} />
          )}

          {/* Punto actual */}
          <Scatter data={[currentPoint]} fill="blue" name="Current Setting">
            <Cell fill="blue" r={6} />
          </Scatter>

          <ReferenceLine x={0.5} stroke="#666" strokeDasharray="3 3" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// AnimationControls: Controles para reproducir, pausar, resetear y navegar en la animación.
const AnimationControls = ({ currentRound, totalRounds, onPlay, onPause, onReset, onSliderChange, isPlaying }) => {
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
};

// ResultsTable: Muestra la información de cada ronda en una tabla.
function ResultsTable({ experimentData }) {
  if (!experimentData || !Array.isArray(experimentData) || experimentData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-400">No experiment data available</p>
      </div>
    );
  }
  
  // Filtrar datos inválidos
  const validData = experimentData.filter(data => 
    data && 
    typeof data.round === 'number' && 
    typeof data.alice_value === 'number' && 
    typeof data.bob_value === 'number' && 
    typeof data.discrepancy === 'number'
  );
  
  if (validData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-400">No valid experiment data available</p>
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
          {validData.map((data, index) => (
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

  const renderResults = (experimentalResults) => {
    if (!experimentalResults || !Array.isArray(experimentalResults) || experimentalResults.length === 0) {
      return (
        <div className="bg-gray-100 p-4 rounded-lg text-center text-gray-500">
          No hay resultados experimentales disponibles aún. Ejecuta la simulación para ver resultados.
        </div>
      );
    }

    // Filtrar resultados inválidos
    const validResults = experimentalResults.filter(result => 
      result && 
      typeof result.p === 'number' && 
      typeof result.discrepancy === 'number' && 
      typeof result.theoretical === 'number' &&
      typeof result.algorithm === 'string'
    );

    if (validResults.length === 0) {
      return (
        <div className="bg-gray-100 p-4 rounded-lg text-center text-gray-500">
          Los resultados experimentales no contienen datos válidos.
        </div>
      );
    }

    // Ordenar por probabilidad
    const sortedResults = [...validResults].sort((a, b) => a.p - b.p);
    
    return (
      <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                  Probabilidad (p)
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                  Algoritmo
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                  Experimental
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                  Teórico
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                  Error
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedResults.map((result, index) => {
                // Calcular el error (diferencia entre teórico y experimental)
                const error = Math.abs(result.theoretical - result.discrepancy);
                // Evitar división por cero
                const errorPercent = result.theoretical !== 0 ? (error / result.theoretical) * 100 : 0;
                
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono text-gray-900">{result.discrepancy.toFixed(4)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono text-gray-900">{result.theoretical.toFixed(4)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            <span className="font-semibold">Puntos totales:</span> {sortedResults.length}
            {sortedResults.length > 0 && (
              <>
                <span className="ml-4 font-semibold">Precisión promedio:</span> {
                  (sortedResults.reduce((acc, result) => {
                    const error = Math.abs(result.theoretical - result.discrepancy);
                    // Evitar división por cero
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
  };

// SaveExperimentModal: Modal para guardar un experimento
function SaveExperimentModal({ isOpen, onClose, experimentData, experimentType, onSave }) {
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  
  const handleSave = () => {
    // Construir el objeto de experimento
    const experiment = {
      type: experimentType,
      id: experimentType + "-" + Date.now(),
      name: name || `Unnamed ${experimentType} experiment`,
      timestamp: Date.now(),
      tags: tags.split(",").map(tag => tag.trim()).filter(tag => tag),
      notes,
      params: experimentData.params,
      results: experimentData.results
    };
    
    onSave(experiment);
    onClose();
  };
  
  // Renderizar el modal solo si está abierto
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-xl font-semibold mb-4">Save Experiment</h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Name *</label>
          <input
            type="text"
            className="w-full p-2 border rounded"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter a descriptive name"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Tags (comma separated)</label>
          <input
            type="text"
            className="w-full p-2 border rounded"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g. high-probability, optimal"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea
            className="w-full p-2 border rounded"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about this experiment"
            rows={3}
          />
        </div>
        
        <div className="flex justify-end space-x-3">
          <button
            className="px-4 py-2 bg-gray-200 rounded"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded"
            onClick={handleSave}
          >
            Save Experiment
          </button>
        </div>
      </div>
    </div>
  );
}

// ExperimentCard: Tarjeta para mostrar un experimento guardado
function ExperimentCard({ experiment, onLoad, onDelete, onToggleCompare, isSelected, compareMode }) {
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };
  
  // Obtener un icono basado en el tipo de experimento
  const getTypeIcon = (type) => {
    return type === "single" ? 
      "📊" : // Icono para single
      "📈"; // Icono para range
  };
  
  // Obtener un color basado en el tipo
  const getTypeColor = (type) => {
    return type === "single" ?
      "bg-blue-100 text-blue-800 border-blue-300" :
      "bg-purple-100 text-purple-800 border-purple-300";
  };
  
  return (
    <div className={`bg-white rounded-lg shadow p-4 border ${isSelected ? 'border-blue-500' : 'border-gray-200'}`}>
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-semibold text-gray-800 flex items-center">
          {getTypeIcon(experiment.type)} <span className="ml-2">{experiment.name}</span>
        </h4>
        <span className={`text-xs px-2 py-1 rounded-full border ${getTypeColor(experiment.type)}`}>
          {experiment.type === "single" ? "Single" : "Range"}
        </span>
      </div>
      
      <div className="text-xs text-gray-500 mb-3">
        Saved: {formatDate(experiment.timestamp)}
      </div>
      
      <div className="mb-3">
        {experiment.tags && experiment.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {experiment.tags.map((tag, idx) => (
              <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                {tag}
              </span>
            ))}
          </div>
        )}
        
        <div className="bg-gray-50 p-2 rounded text-xs mb-2">
          {experiment.type === "single" ? (
            <div>
              <div><span className="font-semibold">Probability:</span> {experiment.params.probability}</div>
              <div><span className="font-semibold">Algorithm:</span> {experiment.params.algorithm}</div>
              <div><span className="font-semibold">Result:</span> {experiment.results.mean.toFixed(4)} (±{experiment.results.std.toFixed(4)})</div>
            </div>
          ) : (
            <div>
              <div><span className="font-semibold">Range:</span> {experiment.params.minP} to {experiment.params.maxP}</div>
              <div><span className="font-semibold">Algorithm:</span> {experiment.params.algorithm}</div>
              <div><span className="font-semibold">Repetitions:</span> {experiment.params.repetitions}</div>
            </div>
          )}
        </div>
        
        {experiment.notes && (
          <div className="text-xs text-gray-600 italic">
            {experiment.notes.length > 60 ? 
              `${experiment.notes.substring(0, 60)}...` : 
              experiment.notes
            }
          </div>
        )}
      </div>
      
      <div className="flex justify-between">
        {compareMode ? (
          <button
            onClick={() => onToggleCompare(experiment.id)}
            className={`text-xs py-1 px-3 rounded ${isSelected ? 
              'bg-blue-100 text-blue-700 border border-blue-300' : 
              'bg-gray-100 text-gray-700 border border-gray-300'}`}
          >
            {isSelected ? 'Selected' : 'Select'}
          </button>
        ) : (
          <button
            onClick={() => onLoad(experiment)}
            className="text-xs py-1 px-3 bg-green-100 text-green-700 rounded border border-green-300"
          >
            Load
          </button>
        )}
        
        <button
          onClick={() => onDelete(experiment.id)}
          className="text-xs py-1 px-3 bg-red-100 text-red-700 rounded border border-red-300"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ComparisonView: Componente para comparar experimentos
function ComparisonView({ experiments }) {
  if (!experiments || experiments.length === 0) {
    return (
      <div className="bg-white p-4 rounded-lg shadow text-center text-gray-500">
        Select experiments to compare
      </div>
    );
  }
  
  // Detectar qué tipo de experimentos estamos comparando
  const experimentType = experiments[0].type;
  
  if (experimentType === "single") {
    return <SingleExperimentComparison experiments={experiments} />;
  } else {
    return <RangeExperimentComparison experiments={experiments} />;
  }
}

// SingleExperimentComparison: Componente para comparar experimentos individuales
function SingleExperimentComparison({ experiments }) {
  // Preparar datos para la gráfica
  const data = experiments.map(exp => ({
    name: exp.name,
    mean: exp.results.mean,
    min: exp.results.min,
    max: exp.results.max,
    theoretical: exp.results.theoretical,
    params: exp.params
  }));
  
  return (
    <div className="bg-white rounded-lg shadow p-4 mt-4">
      <h3 className="text-lg font-semibold mb-4">Single Experiments Comparison</h3>
      
      <div className="mb-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={50} />
            <YAxis domain={[0, 1]} />
            <Tooltip />
            <Legend />
            <Bar dataKey="mean" name="Experimental Mean" fill="#3498db" />
            <Bar dataKey="theoretical" name="Theoretical" fill="#9b59b6" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Probability</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Algorithm</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mean</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Theoretical</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Error</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((item, index) => {
              // Verificar que todos los valores necesarios existen
              if (!item || typeof item.mean !== 'number' || typeof item.theoretical !== 'number') {
                return (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td colSpan="6" className="px-4 py-2 text-center text-gray-500">
                      Datos incompletos para este resultado
                    </td>
                  </tr>
                );
              }
              
              const error = Math.abs(item.theoretical - item.mean);
              return (
                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-2 whitespace-nowrap">{item.name || 'Sin nombre'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{item.params?.probability || 'N/A'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{item.params?.algorithm || 'N/A'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{item.mean.toFixed(4)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{item.theoretical.toFixed(4)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{error.toFixed(4)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// RangeExperimentComparison: Componente para comparar experimentos de rango
function RangeExperimentComparison({ experiments }) {
  return (
    <div className="bg-white rounded-lg shadow p-4 mt-4">
      <h3 className="text-lg font-semibold mb-4">Range Experiments Comparison</h3>
      
      <div className="mb-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              type="number"
              dataKey="p"
              domain={[0, 1]}
              label={{ value: 'Probability (p)', position: 'insideBottom', offset: -5 }}
            />
            <YAxis
              type="number"
              domain={[0, 1]}
              label={{ value: 'Discrepancy', angle: -90, position: 'insideLeft', offset: -10 }}
            />
            <Tooltip formatter={(value) => value.toFixed(4)} />
            <Legend />
            
            {/* Curvas teóricas */}
            <Line 
              data={Array.from({length: 50}, (_, i) => ({p: i/50, discrepancy: 1 - i/50}))} 
              type="monotone" 
              dataKey="discrepancy" 
              name="AMP Theoretical" 
              stroke="#2ecc71" 
              strokeWidth={1} 
              dot={false} 
            />
            <Line 
              data={Array.from({length: 50}, (_, i) => {
                const p = i/50;
                return {p, discrepancy: Math.pow(1-p, 2) + Math.pow(p, 2)};
              })}
              type="monotone" 
              dataKey="discrepancy" 
              name="FV Theoretical" 
              stroke="#e74c3c" 
              strokeWidth={1} 
              dot={false} 
            />
            
            {/* Curvas experimentales */}
            {experiments.map((exp, index) => (
              <Line 
                key={index}
                data={exp.results}
                type="monotone"
                dataKey="discrepancy"
                name={exp.name}
                stroke={`hsl(${index * 50}, 70%, 50%)`}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Range</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Algorithm</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reps</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {experiments.map((experiment, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-2 whitespace-nowrap">{experiment.name}</td>
                <td className="px-4 py-2 whitespace-nowrap">{experiment.params.minP} - {experiment.params.maxP}</td>
                <td className="px-4 py-2 whitespace-nowrap">{experiment.params.algorithm}</td>
                <td className="px-4 py-2 whitespace-nowrap">{experiment.results.length}</td>
                <td className="px-4 py-2 whitespace-nowrap">{experiment.params.repetitions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// RangeExperimentsSection: Sección para configurar y ejecutar experimentos en un rango de probabilidades.
// Incluye el selector de curvas y un bloque resumen final.
const RangeExperimentsSection = ({
  rangeExperiments,
  setRangeExperiments,
  isRunning,
  progress,
  runRangeExperiments,
  experimentalResults,
  repetitions,
  setDisplayOption,
  currentRepetition,
  meetingPoint = 0.5,
  forcedAlgorithm,
  setForcedAlgorithm,
  prepareRangeExperiment
}) => {
  const [showTheory, setShowTheory] = useState(true);
  
  // Cambiamos de un string a un objeto de booleans para los checkboxes
  const [displayCurves, setDisplayCurves] = useState({
    experimental: true,
    theoreticalAmp: true,
    theoreticalFv: true
  });

  // Esta función actualiza el estado de las curvas y convierte la selección
  // al formato que espera el componente TheoryPlot
  const handleCurveDisplayChange = (curve) => {
    // Caso especial para manejar los algoritmos forzados
    if (curve === 'algorithmChange') {
      // Reiniciamos los checkboxes según el algoritmo seleccionado
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
      } else { // auto
        newDisplayCurves = {
          experimental: true,
          theoreticalAmp: true,
          theoreticalFv: true
        };
      }
      setDisplayCurves(newDisplayCurves);
      
      // Pasar directamente el estado de los checkboxes
      setDisplayOption(newDisplayCurves);
      return;
    }
    
    // Manejo normal para cambios en los checkboxes
    const newDisplayCurves = {
      ...displayCurves,
      [curve]: !displayCurves[curve]
    };
    
    setDisplayCurves(newDisplayCurves);
    
    // Pasar directamente el estado de los checkboxes
    setDisplayOption(newDisplayCurves);
  };

  return (
    <div className="border p-4 rounded-lg">
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
                  // Actualizar los checkboxes basados en el algoritmo seleccionado
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
            
            <div className="mt-3 text-xs text-gray-600 bg-blue-50 p-2 rounded">
              <p>Using the same simulation parameters:</p>
              <ul className="list-disc pl-4 mt-1">
                <li>Repetitions: {repetitions}</li>
                <li>Meeting point: {meetingPoint !== undefined ? meetingPoint : 0.5}</li>
              </ul>
            </div>
          </div>
        </div>

        <div>
          {/* Reemplazamos el dropdown por checkboxes */}
          <h4 className="font-semibold mb-2 border-b pb-1">Display Curves</h4>
          <div className="space-y-2">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="showExperimental"
                checked={displayCurves.experimental}
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
                checked={displayCurves.theoreticalAmp}
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
                checked={displayCurves.theoreticalFv}
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
        onClick={() => runRangeExperiments(forcedAlgorithm, showTheory)}
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
              Tested {experimentalResults.length} probability points from {rangeExperiments.minP} to {rangeExperiments.maxP}.
            </p>
            <p className="mt-2">
              The algorithm {forcedAlgorithm === "auto" ? "automatically selected" : `was forced to use ${forcedAlgorithm}`} for each test.
            </p>
            <div className="mt-2 italic text-gray-600">
              View results in the graph above and table below.
            </div>
          </div>
          
          <div className="mt-6">
            <h4 className="font-medium mb-3 text-lg text-gray-700 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z" clipRule="evenodd" />
              </svg>
              Detailed Results
            </h4>
            {/* Reemplazado ResultsComparisonTable con la función renderResults */}
            {renderResults(experimentalResults)}
          </div>
          
          {/* Botón para guardar experimento de rango */}
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
  );
};

// COMPONENTE PRINCIPAL: ApproximateLVL
const ApproximateLVL = () => {
  // Estados para la simulación individual.
  const [aliceValue, setAliceValue] = useState(0);
  const [bobValue, setBobValue] = useState(100);
  const [probability, setProbability] = useState(70);
  const [algorithm, setAlgorithm] = useState("auto");
  const [meetingPoint, setMeetingPoint] = useState(1);
  const [rounds, setRounds] = useState(1);
  const [repetitions, setRepetitions] = useState(50);

  // Estados para Range Experiments.
  const [rangeExperiments, setRangeExperiments] = useState({
    minP: 0.1,
    maxP: 0.9,
    steps: 10
  });
  const [forcedAlgorithm, setForcedAlgorithm] = useState("auto");

  // Estados para datos y visualización.
  const [experimentData, setExperimentData] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [currentAnimation, setCurrentAnimation] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState('simulation');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentRepetition, setCurrentRepetition] = useState(0);
  const animationTimerRef = useRef(null);
  const [logs, setLogs] = useState(["Welcome to the simulator. Configure the parameters and click 'Start Simulation'."]);
  const [experimentalResults, setExperimentalResults] = useState([]);
  const [rangeDisplayOption, setRangeDisplayOption] = useState({
    experimental: true,
    theoreticalAmp: true,
    theoreticalFv: true
  });
  
  // Estados para la gestión de experimentos guardados
  const [savedTab, setSavedTab] = useState('list'); // 'list' o 'compare'
  const [savedExperiments, setSavedExperiments] = useState([]);
  const [filteredExperiments, setFilteredExperiments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState([]);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [experimentToSave, setExperimentToSave] = useState(null);
  const [experimentTypeToSave, setExperimentTypeToSave] = useState(null);

  // Función para agregar mensajes a los logs.
  const addLog = useCallback((message) => {
    setLogs(prevLogs => [...prevLogs, `> ${message}`]);
  }, []);

  const getOptimalAlgorithm = useCallback((p) => (p > 0.5 ? "AMP" : "FV"), []);
  const getDisplayAlgorithm = useCallback((alg, p) => (alg === "auto" ? getOptimalAlgorithm(p / 100) : alg), [getOptimalAlgorithm]);
  
  // Funciones para gestionar experimentos guardados
  const saveExperimentToStorage = useCallback((experiment) => {
    const savedExperiments = JSON.parse(localStorage.getItem("approxLVLExperiments") || "[]");
    savedExperiments.push(experiment);
    localStorage.setItem("approxLVLExperiments", JSON.stringify(savedExperiments));
    setSavedExperiments(savedExperiments);
    setFilteredExperiments(savedExperiments);
    addLog(`Experiment "${experiment.name}" saved successfully`);
    return experiment.id;
  }, [addLog]);

  const loadSavedExperiments = useCallback(() => {
    const experiments = JSON.parse(localStorage.getItem("approxLVLExperiments") || "[]");
    setSavedExperiments(experiments);
    setFilteredExperiments(experiments);
  }, []);

  const deleteExperiment = useCallback((id) => {
    const experiments = savedExperiments.filter(exp => exp.id !== id);
    localStorage.setItem("approxLVLExperiments", JSON.stringify(experiments));
    setSavedExperiments(experiments);
    setFilteredExperiments(experiments.filter(exp => 
      (filterType === 'all' || exp.type === filterType) &&
      (exp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
       exp.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
    ));
    addLog(`Experiment deleted`);
  }, [savedExperiments, filterType, searchTerm, addLog]);

  // Función para filtrar experimentos
  const filterExperiments = useCallback((searchTerm, type = filterType) => {
    setSearchTerm(searchTerm);
    const filtered = savedExperiments.filter(exp => 
      (type === 'all' || exp.type === type) &&
      (exp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
       exp.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
    );
    setFilteredExperiments(filtered);
  }, [savedExperiments, filterType]);

  const filterByType = useCallback((type) => {
    setFilterType(type);
    filterExperiments(searchTerm, type);
  }, [filterExperiments, searchTerm]);

  const toggleCompareSelection = useCallback((id) => {
    setSelectedForCompare(prev => {
      if (prev.includes(id)) {
        return prev.filter(expId => expId !== id);
      } else {
        return [...prev, id];
      }
    });
  }, []);

  // Cargar experimentos guardados al inicio
  useEffect(() => {
    loadSavedExperiments();
  }, [loadSavedExperiments]);

  // Preparar datos para guardar un experimento individual
  const prepareSingleExperiment = useCallback(() => {
    if (!statsData) return;
    
    setExperimentToSave({
      params: {
        aliceValue: aliceValue / 100,
        bobValue: bobValue / 100,
        probability: probability / 100,
        algorithm,
        meetingPoint,
        rounds,
        repetitions
      },
      results: {
        mean: statsData.mean,
        median: statsData.median,
        min: statsData.min,
        max: statsData.max,
        std: statsData.std,
        theoretical: statsData.theoretical
      }
    });
    
    setExperimentTypeToSave("single");
    setSaveModalOpen(true);
  }, [aliceValue, bobValue, probability, algorithm, meetingPoint, rounds, repetitions, statsData]);

  // Preparar datos para guardar un experimento de rango
  const prepareRangeExperiment = useCallback(() => {
    if (!experimentalResults || experimentalResults.length === 0) return;
    
    setExperimentToSave({
      params: {
        minP: rangeExperiments.minP,
        maxP: rangeExperiments.maxP,
        steps: rangeExperiments.steps,
        algorithm: forcedAlgorithm,
        meetingPoint,
        repetitions
      },
      results: experimentalResults
    });
    
    setExperimentTypeToSave("range");
    setSaveModalOpen(true);
  }, [rangeExperiments, forcedAlgorithm, meetingPoint, repetitions, experimentalResults]);

  // Cargar un experimento guardado
  const loadExperiment = useCallback((experiment) => {
    if (experiment.type === "single") {
      // Cargar parámetros
      setAliceValue(experiment.params.aliceValue * 100);
      setBobValue(experiment.params.bobValue * 100);
      setProbability(experiment.params.probability * 100);
      setAlgorithm(experiment.params.algorithm);
      setMeetingPoint(experiment.params.meetingPoint);
      setRounds(experiment.params.rounds);
      setRepetitions(experiment.params.repetitions);
      
      // Crear una simulación básica para visualizar
      const data = [];
      for (let i = 0; i <= experiment.params.rounds; i++) {
        data.push({
          round: i,
          alice_value: i === 0 ? experiment.params.aliceValue : experiment.results.mean - experiment.results.std/2,
          bob_value: i === 0 ? experiment.params.bobValue : experiment.results.mean + experiment.results.std/2,
          discrepancy: i === 0 ? Math.abs(experiment.params.bobValue - experiment.params.aliceValue) : 
                                experiment.results.mean
        });
      }
      setExperimentData(data);
      
      // Cargar resultados
      setStatsData(experiment.results);
      setActiveTab('simulation');
      addLog(`Loaded experiment: ${experiment.name}`);
    } else if (experiment.type === "range") {
      // Cargar parámetros
      setRangeExperiments({
        minP: experiment.params.minP,
        maxP: experiment.params.maxP,
        steps: experiment.params.steps
      });
      setMeetingPoint(experiment.params.meetingPoint);
      setRepetitions(experiment.params.repetitions);
      
      // Cargar resultados
      setExperimentalResults(experiment.results);
      setActiveTab('theory');
      addLog(`Loaded experiment: ${experiment.name}`);
    }
  }, [setAliceValue, setBobValue, setProbability, setAlgorithm, setMeetingPoint, setRounds, setRepetitions, 
      setExperimentData, setStatsData, setActiveTab, addLog, setRangeExperiments]);

  // Función para volver a la lista de experimentos desde la vista de comparación
  const exitCompareMode = useCallback(() => {
    setCompareMode(false);
    setSelectedForCompare([]);
  }, []);

  // Simulación individual.
  const runSingleExperiment = useCallback(() => {
    setIsRunning(true);
    setProgress(10);
    addLog(`Starting simulation with p=${(probability / 100).toFixed(2)}, algorithm=${algorithm}, rounds=${rounds}`);
    const aliceInitial = aliceValue / 100;
    const bobInitial = bobValue / 100;
    const p = probability / 100;
    try {
      const data = SimulationEngine.runExperiment(aliceInitial, bobInitial, p, rounds, algorithm, meetingPoint);
      setExperimentData(data);
      setCurrentAnimation(0);
      setProgress(50);
      addLog(`Simulation completed. Final discrepancy: ${data[data.length - 1].discrepancy.toFixed(4)}`);
      setTimeout(() => {
        try {
          const stats = SimulationEngine.runMultipleExperiments(aliceInitial, bobInitial, p, rounds, repetitions, algorithm, meetingPoint);
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
  }, [aliceValue, bobValue, probability, algorithm, meetingPoint, rounds, repetitions, addLog]);

  // FUNCIÓN CORREGIDA: runRangeExperiments usando simulaciones reales
  const runRangeExperiments = useCallback((algorithm = "auto", showTheory = true) => {
    setExperimentalResults([]);
    addLog("Starting range experiments with actual distributed system simulation");
    setIsRunning(true);
    setProgress(0);
    setCurrentRepetition(0);
    
    const { minP, maxP, steps } = rangeExperiments;
    const rangeRepetitions = repetitions;
    const stepSize = (maxP - minP) / (Math.max(steps - 1, 1));
    const points = [];
    for (let i = 0; i < steps; i++) {
      points.push(minP + i * stepSize);
    }
    
    addLog(`Testing ${points.length} probability values from ${minP} to ${maxP} with ${rangeRepetitions} repetitions. Mode: ${algorithm}`);
    
    const totalExperiments = points.length * rangeRepetitions;
    let completedExperiments = 0;
    let aggregatedResults = {};
    points.forEach(p => {
      aggregatedResults[p.toFixed(2)] = [];
    });
    
    // Valores iniciales para Alice y Bob con diferencia máxima
    const aliceInitial = 0;
    const bobInitial = 1;
    // Número de rondas suficientes para alcanzar la convergencia
    const simulationRounds = rounds || 20;
    
    const runSingleRepetition = (repIndex) => {
      // Actualizar la repetición actual en la UI
      setCurrentRepetition(repIndex + 1);
      
      points.forEach(p => {
        // Determinar qué algoritmo usar: AMP para p>0.5, FV para p<=0.5 (si es automático)
        const algorithmToUse = algorithm === "auto" ? (p > 0.5 ? "AMP" : "FV") : algorithm;
        
        // En lugar de aproximar con fórmulas teóricas, ejecutamos una simulación real completa
        const result = SimulationEngine.runExperiment(
          aliceInitial, 
          bobInitial, 
          p, 
          simulationRounds, 
          algorithmToUse, 
          meetingPoint
        );
        
        // Obtenemos la discrepancia final de la simulación (importante: después de suficientes rondas)
        const finalDiscrepancy = result[result.length - 1].discrepancy;
        
        // Guardamos el resultado real
        aggregatedResults[p.toFixed(2)].push(finalDiscrepancy);
        completedExperiments++;
      });
      
      // Calculamos las estadísticas para cada punto de probabilidad
      const updatedResults = points.map(p => {
        const key = p.toFixed(2);
        const allValues = aggregatedResults[key];
        const avgDiscrepancy = allValues.reduce((a, b) => a + b, 0) / allValues.length;
        const algorithmUsed = algorithm === "auto" ? (p > 0.5 ? "AMP" : "FV") : algorithm;
        
        // El valor teórico se calcula con la fórmula correcta según el algoritmo
        const theoretical = algorithmUsed === "AMP" ? 1 - p : Math.pow(1 - p, 2) + Math.pow(p, 2);
        
        return { 
          p, 
          discrepancy: avgDiscrepancy, 
          theoretical, 
          algorithm: algorithmUsed, 
          repCount: allValues.length 
        };
      });
      
      setExperimentalResults(updatedResults);
      setProgress(Math.round((completedExperiments / totalExperiments) * 100));
      addLog(`Repetition ${repIndex + 1} completed`);
    };
    
    const   runAllRepetitions = (currentRep = 0) => {
      if (currentRep >= rangeRepetitions) {
        // Comprobamos la precisión de los resultados al finalizar
        const finalResults = experimentalResults;
        if (finalResults && finalResults.length > 0) {
          const avgError = finalResults.reduce((sum, result) => {
            // Aseguramos que los valores existen antes de calcular el error
            if (result && typeof result.theoretical === 'number' && typeof result.discrepancy === 'number') {
              return sum + Math.abs(result.theoretical - result.discrepancy);
            }
            return sum;
          }, 0) / (finalResults.filter(r => r && typeof r.theoretical === 'number' && typeof r.discrepancy === 'number').length || 1);
          
          addLog(`All range experiments completed. Average error: ${avgError ? avgError.toFixed(4) : 'N/A'}`);
        } else {
          addLog("All range experiments completed.");
        }
        
        setIsRunning(false);
        setProgress(100);
        return;
      }
      
      runSingleRepetition(currentRep);
      
      // Tiempo entre repeticiones (pequeño retraso para visualizar mejor el progreso)
      setTimeout(() => runAllRepetitions(currentRep + 1), 100);
    };
    
    runAllRepetitions(0);
  }, [rangeExperiments, addLog, repetitions, meetingPoint, rounds, experimentalResults]);

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
    }, 800);
  }, [experimentData]);

  const pauseAnimation = useCallback(() => {
    setIsPlaying(false);
    clearInterval(animationTimerRef.current);
  }, []);

  const resetAnimation = useCallback(() => {
    setCurrentAnimation(0);
    setIsPlaying(false);
    clearInterval(animationTimerRef.current);
  }, []);

  useEffect(() => {
    return () => clearInterval(animationTimerRef.current);
  }, []);

  const handleSliderChange = useCallback((value) => {
    setCurrentAnimation(value);
    if (isPlaying) pauseAnimation();
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
              <div className="mb-4">
                <h3 className="text-sm font-semibold mb-2 pb-1 border-b">Initial Values</h3>
                <Slider label="Alice" value={aliceValue} onChange={setAliceValue} color={ALICE_COLOR} />
                <Slider label="Bob" value={bobValue} onChange={setBobValue} color={BOB_COLOR} />
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
                <div className="flex items-center mb-4">
                  <label className="text-sm mr-2">Meeting Point:</label>
                  <input type="number" min="0" max="1" step="0.01" value={meetingPoint} onChange={(e) => setMeetingPoint(Number(e.target.value))} className="w-20 p-1 border border-gray-300 rounded-md" />
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
                    <input type="number" min="1" max="50" value={rounds} onChange={(e) => setRounds(Number(e.target.value))} className="w-full p-2 border border-gray-300 rounded-md" />
                  </div>
                  <div>
                    <label className="text-sm block mb-1">Repetitions:</label>
                    <input type="number" min="1" max="1000" value={repetitions} onChange={(e) => setRepetitions(Number(e.target.value))} className="w-full p-2 border border-gray-300 rounded-md" />
                  </div>
                </div>
              </div>
              {activeTab !== 'theory' && (
                <>
                  <button onClick={runSingleExperiment} disabled={isRunning}
                    className={`w-full py-3 px-4 rounded-md font-semibold text-white ${isRunning ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}>
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
                <button onClick={() => setActiveTab('simulation')}
                  className={`px-4 py-2 font-medium text-sm ${activeTab === 'simulation' ? 'border-b-2 border-green-500 text-green-600' : 'text-gray-500 hover:text-gray-700'}`}>
                  📊 Single Simulation
                </button>
                <button onClick={() => setActiveTab('statistics')}
                  className={`px-4 py-2 font-medium text-sm ${activeTab === 'statistics' ? 'border-b-2 border-green-500 text-green-600' : 'text-gray-500 hover:text-gray-700'}`}>
                  📈 Statistical Analysis
                </button>
                <button onClick={() => setActiveTab('theory')}
                  className={`px-4 py-2 font-medium text-sm ${activeTab === 'theory' ? 'border-b-2 border-green-500 text-green-600' : 'text-gray-500 hover:text-gray-700'}`}>
                  🔍 Theoretical Comparison
                </button>
                <button onClick={() => setActiveTab('saved')}
                  className={`px-4 py-2 font-medium text-sm ${activeTab === 'saved' ? 'border-b-2 border-green-500 text-green-600' : 'text-gray-500 hover:text-gray-700'}`}>
                  💾 Saved Experiments
                </button>
              </nav>
            </div>

            {activeTab === 'simulation' && (
              <div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <MetricCard label="Alice Initial" value={(aliceValue/100).toFixed(2)} color={ALICE_COLOR} />
                  <MetricCard label="Bob Initial" value={(bobValue/100).toFixed(2)} color={BOB_COLOR} />
                  <MetricCard label="Probability (p)" value={(probability/100).toFixed(2)} color="#9b59b6" />
                  <MetricCard label="Algorithm" value={getDisplayAlgorithm(algorithm, probability)} color={ACCENT_COLOR} />
                </div>
                <div className="mb-4">
                  <ExperimentVisualization experimentData={experimentData} currentRound={currentAnimation} />
                </div>
                {experimentData && (
                  <div className="mb-4">
                    <AnimationControls currentRound={currentAnimation}
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
                  <ResultsTable experimentData={experimentData} />
                </div>
                
                {/* Botón para guardar experimento individual */}
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

            {activeTab === 'statistics' && (
              <div>
                {statsData && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    <MetricCard label="Mean Discrepancy" value={statsData.mean.toFixed(4)} color="#3498db" />
                    <MetricCard label="Median Discrepancy" value={statsData.median.toFixed(4)} color="#2ecc71" />
                    <MetricCard label="Theoretical" value={statsData.theoretical.toFixed(4)} color="#9b59b6" />
                    <MetricCard label="Minimum Discrepancy" value={statsData.min.toFixed(4)} color="#e74c3c" />
                    <MetricCard label="Maximum Discrepancy" value={statsData.max.toFixed(4)} color="#f39c12" />
                    <MetricCard label="Standard Deviation" value={statsData.std.toFixed(4)} color="#34495e" />
                  </div>
                )}
                <div className="mb-4">
                  <HistogramPlot discrepancies={statsData?.allValues} theoretical={statsData?.theoretical} experimental={statsData?.mean} />
                </div>
                
                {/* Botón para guardar experimento individual */}
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

            {activeTab === 'theory' && (
              <div>
                <div className="mb-4">
                  <TheoryPlot 
                    currentP={probability/100} 
                    experimentalData={experimentalResults} 
                    displayOption={rangeDisplayOption}
                    displayCurves={rangeDisplayOption.experimental !== undefined ? rangeDisplayOption : undefined} 
                  />
                </div>
                <div className="bg-white rounded-lg shadow p-4 mb-4">
                  <h3 className="text-lg font-semibold mb-4">Range Experiments</h3>
                  <RangeExperimentsSection
                    rangeExperiments={rangeExperiments}
                    setRangeExperiments={setRangeExperiments}
                    isRunning={isRunning}
                    progress={progress}
                    runRangeExperiments={runRangeExperiments}
                    experimentalResults={experimentalResults}
                    repetitions={repetitions}
                    meetingPoint={meetingPoint}
                    setDisplayOption={setRangeDisplayOption}
                    currentRepetition={currentRepetition}
                    forcedAlgorithm={forcedAlgorithm}
                    setForcedAlgorithm={setForcedAlgorithm}
                    prepareRangeExperiment={prepareRangeExperiment}
                  />
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
            
            {activeTab === 'saved' && (
              <div>
                <div className="bg-white rounded-lg shadow p-4 mb-4">
                  <h3 className="text-lg font-semibold mb-4">Saved Experiments</h3>
                  
                  {/* Filtros y búsqueda */}
                  <div className="flex flex-wrap gap-4 mb-4">
                    <div className="flex-1 min-w-48">
                      <input 
                        type="text" 
                        placeholder="Search by name or tags" 
                        className="w-full p-2 border rounded"
                        onChange={(e) => filterExperiments(e.target.value)}
                      />
                    </div>
                    <div>
                      <select 
                        className="p-2 border rounded"
                        onChange={(e) => filterByType(e.target.value)}
                        value={filterType}
                      >
                        <option value="all">All Types</option>
                        <option value="single">Single Simulations</option>
                        <option value="range">Range Experiments</option>
                      </select>
                    </div>
                    <div>
                      <button 
                        className={`px-4 py-2 rounded ${compareMode ? 'bg-blue-100 text-blue-800 border border-blue-300' : 'bg-blue-600 text-white'}`}
                        onClick={() => setCompareMode(!compareMode)}
                      >
                        {compareMode ? "Exit Compare Mode" : "Compare Experiments"}
                      </button>
                    </div>
                  </div>
                  
                  {/* Mensaje si no hay experimentos */}
                  {filteredExperiments.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No saved experiments found. Run simulations and save them to see them here.
                    </div>
                  )}
                  
                  {/* Lista de experimentos */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredExperiments.map(experiment => (
                      <ExperimentCard 
                        key={experiment.id}
                        experiment={experiment}
                        onLoad={() => loadExperiment(experiment)}
                        onDelete={() => deleteExperiment(experiment.id)}
                        onToggleCompare={() => toggleCompareSelection(experiment.id)}
                        isSelected={selectedForCompare.includes(experiment.id)}
                        compareMode={compareMode}
                      />
                    ))}
                  </div>
                  
                  {/* Botones de comparación */}
                  {compareMode && selectedForCompare.length > 0 && (
                    <div className="mt-4 flex justify-between items-center">
                      <div className="text-sm">
                        {selectedForCompare.length} experiment(s) selected
                      </div>
                      <div>
                        <button
                          className="px-4 py-2 bg-blue-600 text-white rounded"
                          onClick={() => setSavedTab('compare')}
                        >
                          Compare Selected
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Vista de comparación */}
                {savedTab === 'compare' && (
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold">Comparison View</h3>
                      <button
                        className="px-3 py-1 text-sm bg-gray-200 rounded"
                        onClick={() => {
                          setSavedTab('list');
                          setCompareMode(false);
                          setSelectedForCompare([]);
                        }}
                      >
                        Back to List
                      </button>
                    </div>
                    
                    <ComparisonView 
                      experiments={savedExperiments.filter(exp => selectedForCompare.includes(exp.id))} 
                    />
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </main>

      <footer className="bg-white shadow rounded-lg p-4 text-center">
        <p className="text-sm text-gray-500">
          ApproximateLVL - Distributed Computing Agreement Simulator
        </p>
      </footer>
      
      {/* Modal para guardar experimentos */}
      <SaveExperimentModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        experimentData={experimentToSave}
        experimentType={experimentTypeToSave}
        onSave={saveExperimentToStorage}
      />
    </div>
  );
};

export default ApproximateLVL;